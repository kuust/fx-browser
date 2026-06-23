# FX Browser

FX Browser 是一个面向 Windows 个人使用场景的浏览器环境管理器。第一阶段目标是支持从 MoreLogin 导出的 `export_profile.txt` 中严格迁移环境数据，包括环境顺序、账号资料、Cookie、代理/IP、UA、分组、标签和备注。

> ⚠️ 安全原则：真实 `export_profile.txt`、Cookie、账号密码、代理密码、本地数据库、浏览器 profile 数据均不得提交到 GitHub。本仓库只保存程序代码和假数据测试。

## V0.1 目标

- Windows EXE 桌面客户端骨架
- 富信 Logo / FX Browser 品牌界面
- MoreLogin TXT 导入器
- 保留导出文件中的原始顺序 `importOrder`
- 保留 MoreLogin `Profile ID`
- 解析 MoreLogin 代理格式，例如 `socks5://host:port:user:pass`
- 解析 Cookie JSON 数组并统计 Cookie 数量
- GitHub Actions 自动构建 Windows 安装包
- 安全检查，避免误提交真实导出文件、数据库、profiles、cookies 等敏感数据

## 不会提交的敏感数据

`.gitignore` 已排除：

- `export_profile.txt`
- `export_profile.xlsx`
- `data/`
- `profiles/`
- `cookies/`
- `secrets/`
- `*.sqlite`, `*.db`
- `import_report*.json`
- `.env*`

## 本地开发

```bash
npm install
npm run typecheck
npm test
npm run lint:security
npm run dev:electron
```

## Windows 打包

本地 Windows 上：

```bash
npm run package:win
```

GitHub Actions：

- push 到 `main` 后自动运行 `.github/workflows/windows-build.yml`
- 构建产物会上传为 `FX-Browser-Windows` artifact

## 当前状态

这是项目初始骨架，已包含：

- Electron 主进程
- React/Vite 渲染界面
- MoreLogin 导入器初版
- 代理解析器
- 假数据单元测试
- Windows EXE 构建工作流

后续阶段会继续加入：

- 本地 SQLite 数据库
- 环境列表持久化
- Cookie normalization / Chromium 注入
- 独立 `user-data-dir` 启动器
- 代理检测
- 基础指纹设置面板
- 多窗口同步器
