param([ValidateSet('start','stop','check')][string]$Action='check')
$ErrorActionPreference='Stop'
$ProjectRoot=Split-Path -Parent $PSScriptRoot
$PythonPath=Join-Path $ProjectRoot 'backend\.venv\Scripts\python.exe'
$StatePath=Join-Path $ProjectRoot 'data\processes.json'
function OwnedProcess($entry) {
    $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.pid)" -ErrorAction SilentlyContinue
    if (-not $proc) { return $null }
    $start=(Get-Process -Id $entry.pid -ErrorAction SilentlyContinue).StartTime.ToUniversalTime().Ticks.ToString()
    if ($start -ne $entry.started) { return $null }
    return $proc
}
function ReadState { if(Test-Path -LiteralPath $StatePath){return @(Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json)};return @() }
if($Action -eq 'stop') {
    foreach($entry in (ReadState)) {
        if(OwnedProcess $entry) {
            # Only terminate the exact recorded process and its current descendants.
            $children=@(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($entry.pid)" -ErrorAction SilentlyContinue)
            foreach($child in $children){Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue}
            Stop-Process -Id $entry.pid -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped project process $($entry.pid)"
        }
    }
    if(Test-Path -LiteralPath $StatePath){Remove-Item -LiteralPath $StatePath}
    Write-Host 'Project stopped. Local data retained.'
    exit 0
}
if($Action -eq 'check') {
    Write-Host "Project: $ProjectRoot"
    Write-Host "Python environment: $(Test-Path -LiteralPath $PythonPath)"
    Write-Host "Node: $((Get-Command node -ErrorAction SilentlyContinue).Source)"
    foreach($port in @(8017,5173)){Write-Host "Port $port listening: $([bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue))"}
    try{$health=Invoke-RestMethod 'http://127.0.0.1:8017/api/health' -TimeoutSec 3;Write-Host "API: $($health.status), SQLite: $($health.database), AI configured: $($health.ai_configured)"}catch{Write-Host 'API not running'}
    exit 0
}
$ownedIds=@()
foreach($entry in (ReadState)) {
    if(OwnedProcess $entry) {
        $ownedIds += [int]$entry.pid
        # Windows virtualenv Python may own the listening socket in a child process.
        $ownedIds += @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($entry.pid)" -ErrorAction SilentlyContinue | ForEach-Object {[int]$_.ProcessId})
    }
}
$runningPorts=@()
foreach($port in @(8017,5173)) {
    $listeners=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if($listeners.Count) {
        foreach($listener in $listeners) {
            if([int]$listener.OwningProcess -notin $ownedIds) {
                throw "Port $port is in use by another service. Check the occupying process before restarting."
            }
        }
        $runningPorts += $port
    }
}
if($runningPorts.Count -eq 2) {
    try {
        $health=Invoke-RestMethod 'http://127.0.0.1:8017/api/health' -TimeoutSec 3
        $null=Invoke-WebRequest 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 3
        if($health.status -ne 'ok'){throw 'Backend health check failed'}
    }catch{throw 'Project processes exist but are not responding. Run stop.bat, then start.bat.'}
    Write-Host 'Project already running normally: http://127.0.0.1:5173'
    exit 0
}
if($runningPorts.Count) {
    throw 'Only part of the project is running. Run stop.bat, then start.bat to restart both services.'
}
if(-not(Get-Command node -ErrorAction SilentlyContinue)){throw 'Install Node.js 22+ LTS first.'}
if(-not(Test-Path -LiteralPath $PythonPath)){
    if(-not(Get-Command python -ErrorAction SilentlyContinue)){throw 'Install Python 3.11+ first.'}
    & python -m venv (Join-Path $ProjectRoot 'backend\.venv')
    if($LASTEXITCODE -ne 0){throw 'Python environment creation failed'}
}
if(-not(Test-Path -LiteralPath (Join-Path $ProjectRoot 'data\python-ready'))){
    & $PythonPath -m pip install -r (Join-Path $ProjectRoot 'backend\requirements.txt')
    if($LASTEXITCODE -ne 0){throw 'Python dependency installation failed'}
    New-Item -ItemType File -Path (Join-Path $ProjectRoot 'data\python-ready') -Force | Out-Null
}
if(-not(Test-Path -LiteralPath (Join-Path $ProjectRoot 'frontend\node_modules\vite'))){
    Push-Location (Join-Path $ProjectRoot 'frontend')
    try{& npm.cmd install --cache (Join-Path $ProjectRoot 'data\npm-cache');if($LASTEXITCODE -ne 0){throw 'Frontend dependency installation failed'}}finally{Pop-Location}
}
if(-not(Test-Path -LiteralPath (Join-Path $ProjectRoot '.env'))){Copy-Item -LiteralPath (Join-Path $ProjectRoot '.env.example') -Destination (Join-Path $ProjectRoot '.env')}
$records=@()
try {
    $backend=Start-Process -FilePath $PythonPath -ArgumentList @('-m','uvicorn','main:app','--host','127.0.0.1','--port','8017') -WorkingDirectory (Join-Path $ProjectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $ProjectRoot 'logs\backend.log') -RedirectStandardError (Join-Path $ProjectRoot 'logs\backend-error.log') -PassThru
    $records+=@{pid=$backend.Id;started=$backend.StartTime.ToUniversalTime().Ticks.ToString();kind='backend'}
    $nodePath=(Get-Command node).Source
    $vitePath=Join-Path $ProjectRoot 'frontend\node_modules\vite\bin\vite.js'
    $front=Start-Process -FilePath $nodePath -ArgumentList @(('"'+$vitePath+'"'),'--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory (Join-Path $ProjectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $ProjectRoot 'logs\frontend.log') -RedirectStandardError (Join-Path $ProjectRoot 'logs\frontend-error.log') -PassThru
    $records+=@{pid=$front.Id;started=$front.StartTime.ToUniversalTime().Ticks.ToString();kind='frontend'}
    $records | ConvertTo-Json | Set-Content -LiteralPath $StatePath -Encoding UTF8
    $ready=$false
    for($attempt=0;$attempt -lt 25;$attempt++){
        try{$null=Invoke-RestMethod 'http://127.0.0.1:8017/api/health' -TimeoutSec 1;$null=Invoke-WebRequest 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 1;$ready=$true;break}catch{Start-Sleep -Milliseconds 400}
    }
    if(-not $ready){throw 'Services did not become ready. See logs directory.'}
    Write-Host 'Nongzhu AI ready: http://127.0.0.1:5173'
    Write-Host 'Configure .env and restart to enable the real AI service.'
}catch{
    foreach($entry in $records){if(OwnedProcess $entry){Stop-Process -Id $entry.pid -Force -ErrorAction SilentlyContinue}}
    throw
}
