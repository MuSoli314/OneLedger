# backend — AI 指导

> 本文件是「分层 AI 指导」体系中的一层：仓库根 [AGENTS.md](../AGENTS.md) 是总纲与目录导航。本文件只讲 `backend/`（Tauri 外壳）。

## 这个目录是干什么的

Tauri 2 的 **Rust 外壳 + 打包配置**。打开一个系统窗口、加载 `dist/` 里的前端、注册 SQL 插件，然后就没了。

> ⚠️ **这里没有业务逻辑**：不建表、不写 SQL、不实现记账 / 统计 / 分类功能，也没有 HTTP 接口。所有业务都在 `frontend/`。看到这个目录「空空的」是**故意的**，不要试图往这里加业务代码。

## 文件清单

| 文件 / 目录 | 职责 | 关键点 |
|---|---|---|
| `src/main.rs` | 程序入口 | release 下 `windows_subsystem = "windows"`（防止 Windows 弹控制台窗口，**不要删这行**），只调 `one_ledger_lib::run()` |
| `src/lib.rs` | Tauri Builder | 注册 `tauri-plugin-sql`；debug 构建下额外注册日志插件；`generate_context!()` 读取配置 |
| `capabilities/default.json` | 权限白名单 | 当前：`core:default` + `sql:default` / `sql:allow-load` / `sql:allow-execute` / `sql:allow-select` / `sql:allow-close` |
| `tauri.conf.json` | 窗口 / 构建 / 打包 / **版本号** | 见下方「配置要点」 |
| `Cargo.toml` | Rust 依赖 + crate 名 + 版本号 | crate 名 `one-ledger`，lib 名 `one_ledger_lib` |
| `Cargo.lock` | 依赖锁定 | 由 cargo 维护，勿手改 |
| `build.rs` | 构建脚本 | 只调 `tauri_build::build()`，无自定义逻辑 |
| `icons/` | 各平台图标 | 由根目录 `logo.png` 生成，流程见根 AGENTS.md 第 9 节；**不要手改** |
| `gen/` | Tauri 生成的 schema（gitignore） | 生成物，勿手改，删了会重新生成 |
| `target/` | Rust 构建产物（gitignore） | 安装包在这里：`target/release/bundle/` |

## 配置要点（`tauri.conf.json`）

| 字段 | 值 | 说明 |
|---|---|---|
| `productName` | `OneLedger` | **必须英文**：Windows MSI 打包工具（WiX）不支持中文文件名，改中文会导致打包失败 |
| `version` | 当前 `2.3.1` | **发版唯一权威版本号**，Tauri 打包以此为准 |
| `identifier` | `com.oneledger.accounting` | 应用唯一标识，别改（改了等于换一个 App，数据目录可能变） |
| `build.frontendDist` | `../dist` | 打正式包时加载 `npm run build` 的产物 |
| `build.devUrl` | `http://localhost:5173` | 开发模式地址，与 `vite.config.ts` 的 `strictPort` 对应 |
| `build.beforeDevCommand` / `beforeBuildCommand` | `npm run dev` / `npm run build` | 起窗口前先跑前端 |
| `app.windows[0]` | 标题「一笔」、1000×700、`maximized: true`、可缩放 | 窗口标题才是中文；产品名与窗口标题是两回事 |
| `app.security.csp` | `null` | 当前未启用 CSP |
| `bundle.targets` | `all` | 由 CI 按平台出包 |
| `bundle.icon` | 4 个 PNG + `.icns` + `.ico` | 新增图标文件要同步加进这个数组 |

## 必须遵守的约定

1. **不要在这里建表 / 写 migration**：schema 的唯一维护处是 `frontend/data/database.ts`（`CREATE TABLE IF NOT EXISTS` + 兼容性 `ALTER TABLE`，桌面版与网页版共用同一套）。`lib.rs` 里已有注释说明这一点，**两处 schema 会不一致，绝对不要重复定义**。
2. **新增 Tauri 插件的三步**：`Cargo.toml` 加依赖 → `lib.rs` 的 Builder 注册 → `capabilities/default.json` 加权限。**漏第三步前端调用会报 not allowed**。插件属于技术选型，须先让用户拍板。
3. **版本号三处保持一致**：`tauri.conf.json`（权威）、`Cargo.toml`、根 `package.json`。发版流程见根 AGENTS.md 第 8 节。
4. **`productName` 保持英文 `OneLedger`**；中文只出现在窗口标题与界面文案。
5. **改完 Rust 要能起**：`npm run tauri:dev`（首次编译较慢）。格式用 `cargo fmt`。
6. **`gen/`、`target/`、`Cargo.lock` 不要手改**；`gen/` 与 `target/` 已在 `.gitignore`。

## 改动检查清单

- [ ] schema 没动（动了就是错：应改 `frontend/data/database.ts`）
- [ ] 加了插件的话：依赖 / 注册 / 权限三步都做了
- [ ] 改了 `tauri.conf.json` 的话：`npm run tauri:dev` 能起、`npm run tauri:build` 不报配置错误
- [ ] 版本号三处一致
- [ ] 图标改动走了根 AGENTS.md 的 Logo 流程（`npx tauri icon` + 删 ios/android）
- [ ] 发版/打包相关的改动已同步本文件

## 相关文档

- 总纲（发版流程、Logo 流程）：[../AGENTS.md](../AGENTS.md)
- 前端总览（双形态、数据层切换）：[../frontend/AGENTS.md](../frontend/AGENTS.md)
- 数据层（schema 真正的维护处）：[../frontend/data/AGENTS.md](../frontend/data/AGENTS.md)
- CI 构建：[../.github/workflows/release.yml](../.github/workflows/release.yml)
