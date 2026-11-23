# 农助AI Cloudflare 独立适配版

平台：Cloudflare Workers 静态资源 + D1。未开通付费 Workers 或 Containers。

发布地址：https://nongzhu-ai.nongzhu-cloud-worker.workers.dev/#home

## 当前验收状态（2026-11-18）

已部署成功，D1 数据库迁移已应用，DeepSeek 密钥和 AI 访问码已通过 Secret 配置。原项目业务代码及正式 SQLite 数据库未修改。

**公网访问验收未通过。** 本机普通 DNS 将该域名解析到 31.13.112.4；Cloudflare 与 Google 的 DNS HTTPS 查询均返回 172.67.164.154、104.21.82.228。普通连接出现 TLS 握手失败/超时，指定官方解析 IP 连接也被重置。没有修改系统 DNS、hosts 或建立隧道。不能保证当前网络可以打开该域名。

Chrome 自动化连接返回 Codex auth token is unavailable，未完成浏览器视觉与端到端验收。不能宣称所有功能与本地一致。

## 已完成验证

- React/TypeScript/Vite 生产构建成功，静态资源、36张作物图及李保国视频随部署发布。
- 5项纯逻辑测试通过：缺水停长、种植浇水收获、防重复收获、环境时钟、访客隔离及非法参数。
- 实际 Worker 打包代码 + 独立内存 SQLite D1 接口适配器测试通过：数据持久化、访客隔离、模拟环境、任务、知识库导入/检索/删除、跨站写入拦截、未配置AI及错误访问码拒绝。
- 已获授权执行一次真实 AI 联调：专业种植分析 + 总智能体汇总，共2次实际模型请求，收到554字回答及完整SSE事件；结果保存在本目录真实AI联调结果.json。这是本地代码包联调，不能替代公网Worker运行验证。
- Cloudflare API确认两项Secret已存在，未记录或输出密钥。

## 使用与差异

系统设置中填写本目录「云端AI访问码.txt」的访问码，仅当前标签页保存。**请勿把此文件公开发布。** 每日最多20次非媒体AI对话，单次最多3个专业请求+1个汇总请求；正常单专业请求为2次模型调用。使用现有DeepSeek账户额度。

每个浏览器通过HttpOnly Cookie取得独立D1空间，清除Cookie或换浏览器后进入新空间；本版本没有账号登录或跨设备同步。没有迁移私人对话、用户地块和附件，只初始化模拟地块与已有6份公共农业资料。体验田和播报共用同一套状态接口。所有农场环境均为模拟，不是传感器或数字孪生。

免费适配差异：知识库采用D1存储、中文子串资料检索，不是SQLite FTS5 trigram；原始PDF/DOCX在浏览器提取文字，云端文字总空间约1.8MB，单文档文字上限1.5MB。图片/视频仅在浏览器预览与抽帧，不保存云端原始附件；本地版原来也未配置视觉模型，云端仍未配置，不会声称已识别图片。大文件存储R2未启用。源网页上部分“本地”表述仍需浏览器验收确认。

访问码只保护付费模型请求，种植体验为公开的独立访客演示。Cookie不是正式账号系统，不宜保存敏感生产数据。免费资源有平台配额，未申请付费升级。

## 复现命令

在本目录运行（项目目录工具，不需要系统安装）：

```powershell
node --test tests/state.test.mjs
node ../tools/node_modules/wrangler/bin/wrangler.js deploy --dry-run --outdir build
node tests/integration.mjs
cd frontend
npm run build
cd ..
node ../tools/node_modules/wrangler/bin/wrangler.js deploy
```

本机Wrangler本地workerd无法启动（spawn EFTYPE），因此测试使用实际打包Worker和独立SQLite适配器；实际Cloudflare运行仍需在可访问公网域名的网络完成验收。

不应将“已部署”理解为“全功能已通过公网验收”。下一步需要能正常访问workers.dev的网络，或由用户已有域名绑定自定义域名后继续验证（尚无域名；未购买任何域名）。
