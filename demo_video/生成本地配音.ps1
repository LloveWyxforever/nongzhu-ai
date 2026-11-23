$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$demoRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$demoScenes=Get-Content -LiteralPath (Join-Path $demoRoot 'scenes.json') -Raw -Encoding utf8 | ConvertFrom-Json
$demoVoice=New-Object System.Speech.Synthesis.SpeechSynthesizer
$demoVoice.SelectVoice('Microsoft Huihui Desktop')
$demoVoice.Rate=1
try {
 for($demoIndex=0;$demoIndex -lt $demoScenes.Count;$demoIndex++) {
  $demoAudio=Join-Path $demoRoot ('配音\voice_{0:00}.wav' -f $demoIndex)
  $demoVoice.SetOutputToWaveFile($demoAudio)
  $demoVoice.Speak([string]$demoScenes[$demoIndex][3])
  $demoVoice.SetOutputToNull()
  Write-Output ('完成配音 {0}' -f $demoIndex)
 }
} finally { $demoVoice.Dispose() }
