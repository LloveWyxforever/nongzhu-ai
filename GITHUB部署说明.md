# GitHub 私密备份与 Pages

本仓库保存前后端源码、农业知识、参考资料、36张作物图片、李保国主题视频、部署脚本及视频制作文稿。排除了真实密钥、聊天数据库、个人上传、日志、依赖和重复导出。数据库首次启动由后端初始化，知识库资源需通过项目导入功能重新导入。

原项目及已部署服务器未被修改。Cloudflare 适配源码保留，前端可使用仓库的 frontend 构建；需重新配置自己的 D1 ID 和服务端 Secrets。

## Pages 的实际限制

2026-11-23 尝试创建 Pages，GitHub 返回 HTTP 422：当前套餐不支持本私密仓库启用 Pages。仓库保持私密，没有发布成功，也没有购买套餐。

若升级到支持私密仓库 Pages 的套餐，在仓库 Settings → Pages 选择 GitHub Actions，然后在 Actions 手动运行 Deploy frontend to GitHub Pages。私密源码不等于 Pages 网站私密，发布前检查 Pages 可见性。

Pages 只运行静态前端，不能运行 FastAPI、SQLite 或持有 API 密钥。完整应用仍需要服务器后端。仓库变量 VITE_API_ORIGIN 必须设为有效的 HTTPS 后端地址，后端还需要仅允许此 Pages Origin 的 CORS 配置及合适的身份验证。现有 http://47.239.109.63 不可直接连接 HTTPS Pages（混合内容限制）。未完成后端 HTTPS/CORS/认证联调前，Pages 前端不代表完整应用可用。

不要将 DeepSeek 密钥放入任何 VITE_ 变量或前端代码。不得为了 Pages 自动公开本仓库。
