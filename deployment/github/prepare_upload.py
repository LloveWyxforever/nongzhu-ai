"""Create an independent, secret-free GitHub source snapshot."""
from pathlib import Path
import shutil
import re

root = Path(__file__).resolve().parents[2]
out = root.parent / 'nongzhu-ai-github'
out.mkdir(exist_ok=True)
excluded = {'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', '.wrangler', 'dist', 'build', '.git'}
def copy_tree(src, dst):
    if not src.exists(): return
    dst.mkdir(parents=True, exist_ok=True)
    for p in src.iterdir():
        if p.name in excluded or p.is_symlink(): continue
        if p.is_dir(): copy_tree(p, dst / p.name)
        elif p.suffix not in {'.pyc', '.db', '.sqlite', '.log', '.tsbuildinfo'} and p.name != '.env' and '访问码' not in p.name and '联调结果' not in p.name:
            shutil.copy2(p, dst / p.name)

for name in ['backend', 'frontend', 'knowledge', 'docs', 'scripts', 'deploy', 'deployment/ecs', 'deployment/github', 'demo_video']:
    copy_tree(root / name, out / name)
for name in ['README.md', '.env.example', '.dockerignore', 'Dockerfile', 'Dockerfile.web', 'docker-compose.yml', 'start.bat', 'stop.bat', 'check.bat']:
    shutil.copy2(root / name, out / name)
copy_tree(root / 'data/media/crops', out / 'data/media/crops')
shutil.copy2(root / 'data/media/li-baoguo.mp4', out / 'data/media/li-baoguo.mp4')
for name in ['src', 'migrations', 'tests']:
    copy_tree(root / 'deployment/cloudflare/app' / name, out / 'deployment/cloudflare/app' / name)
for name in ['package.json', 'README.md', '.gitignore']:
    shutil.copy2(root / 'deployment/cloudflare/app' / name, out / 'deployment/cloudflare/app' / name)
import json
cfg=json.loads((root/'deployment/cloudflare/app/wrangler.jsonc').read_text(encoding='utf-8-sig'))
cfg.pop('account_id', None)
cfg['d1_databases'][0]['database_id']='REPLACE_WITH_YOUR_D1_DATABASE_ID'
(out/'deployment/cloudflare/app/wrangler.jsonc').write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding='utf-8')

(out/'.gitignore').write_text('''**/node_modules/
**/.venv/
**/venv/
**/__pycache__/
**/.pytest_cache/
**/.wrangler/
**/dist/
**/build/
**/*.tsbuildinfo
**/.env
**/.env.*
!**/.env.example
!**/.env.server.example
**/*.db
**/*.sqlite*
**/*.log
**/*访问码*
**/*联调结果*
data/uploads/
logs/
''', encoding='utf-8')

# All changes below apply only to the upload copy, leaving the running app intact.
api=out/'frontend/src/api.ts'
s=api.read_text(encoding='utf-8')
s='const backendOrigin = ((import.meta as any).env.VITE_API_ORIGIN || "").replace(/\\/$/, "");\nexport const apiUrl = (path:string) => backendOrigin + path;\n'+s
s=s.replace("fetch('/api'+path,", "fetch(apiUrl('/api'+path),")
api.write_text(s, encoding='utf-8')
chat=out/'frontend/src/Chat.tsx'
s=chat.read_text(encoding='utf-8').replace('import {api,names,', 'import {api,apiUrl,names,').replace("fetch('/api/chat',", "fetch(apiUrl('/api/chat'),")
s=s.replace('src={video.url}', 'src={apiUrl(video.url)}').replace('onOpen(video)', 'onOpen({...video,url:apiUrl(video.url)})').replace('src={f.url}', 'src={apiUrl(f.url)}')
chat.write_text(s, encoding='utf-8')
vite=out/'frontend/vite.config.ts'
s=vite.read_text(encoding='utf-8').replace('defineConfig({plugins:', "defineConfig({base:'./',plugins:")
vite.write_text(s, encoding='utf-8')
workflow=out/'.github/workflows/pages.yml'
workflow.parent.mkdir(parents=True, exist_ok=True)
workflow.write_text('''name: Deploy frontend to GitHub Pages
on:
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
        env:
          VITE_API_ORIGIN: ${{ vars.VITE_API_ORIGIN }}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: frontend/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
''', encoding='utf-8')
(out/'GITHUB部署说明.md').write_text('''# GitHub 私密备份与 Pages

本仓库保存前后端源码、农业知识、参考资料、36张作物图片、李保国主题视频、部署脚本及视频制作文稿。排除了真实密钥、聊天数据库、个人上传、日志、依赖和重复导出。数据库首次启动由后端初始化，知识库资源需通过项目导入功能重新导入。

原项目及已部署服务器未被修改。Cloudflare 适配源码保留，前端可使用仓库的 frontend 构建；需重新配置自己的 D1 ID 和服务端 Secrets。

## Pages 的实际限制

2026-11-23 尝试创建 Pages，GitHub 返回 HTTP 422：当前套餐不支持本私密仓库启用 Pages。仓库保持私密，没有发布成功，也没有购买套餐。

若升级到支持私密仓库 Pages 的套餐，在仓库 Settings → Pages 选择 GitHub Actions，然后在 Actions 手动运行 Deploy frontend to GitHub Pages。私密源码不等于 Pages 网站私密，发布前检查 Pages 可见性。

Pages 只运行静态前端，不能运行 FastAPI、SQLite 或持有 API 密钥。完整应用仍需要服务器后端。仓库变量 VITE_API_ORIGIN 必须设为有效的 HTTPS 后端地址，后端还需要仅允许此 Pages Origin 的 CORS 配置及合适的身份验证。现有 http://47.239.109.63 不可直接连接 HTTPS Pages（混合内容限制）。未完成后端 HTTPS/CORS/认证联调前，Pages 前端不代表完整应用可用。

不要将 DeepSeek 密钥放入任何 VITE_ 变量或前端代码。不得为了 Pages 自动公开本仓库。
''', encoding='utf-8')
print('Prepared:', out)
print('Files:', sum(p.is_file() for p in out.rglob('*')))
