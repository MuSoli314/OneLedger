# frontend — AI 指导

> 本文件是「分层 AI 指导」体系中的一层：仓库根 [AGENTS.md](../AGENTS.md) 是总纲与目录导航、全局铁律、构建发版。本文件只讲 `frontend/` 整体；每个子目录还有自己的 `AGENTS.md` 讲细节。

## 这个目录是干什么的

- 整个应用的**界面与业务逻辑**（TypeScript + React 19）。
- **同一套代码同时跑桌面版（Tauri）与网页版（浏览器）**，运行时按环境自动切换数据层。
- 没有服务端：没有自建 API，唯一的外部网络请求是节假日数据更新（`data/holidaySync.ts`）。

## 入口文件（3 个）

| 文件 | 职责 | 关键点 |
|---|---|---|
| `main.tsx` | 挂载根节点 + Provider 嵌套 | 嵌套顺序 `BrowserRouter` → `CategoryProvider` → `SettingsProvider` → `HomeFilterProvider`；`StrictMode` 下 effect 会执行两次，**写库 / 联网逻辑必须幂等** |
| `App.tsx` | 路由表 | `<Route element={<Layout />}>` 下挂 4 个页面，全部共享顶部导航 |
| `index.css` | Tailwind 入口 + 主题 + react-day-picker 定制 | `@import "tailwindcss"`；`@theme` 定义 `--color-*`；`.rdp-root.rdp-root` 用双类选择器是为了压过库自带同样式的单类规则；`button, select { user-select: none }`（按钮文字不可选中，正文可复制） |

## 路由结构（React Router v7）

| 路径 | 页面 | 说明 |
|---|---|---|
| `/` | `HomePage` | 记账页：日历区 + 两栏（左 3/5 时间范围 / 导出 / 概览卡（含预算）/ 记录列表，右 2/5 分类排行） |
| `/stats` | `StatsPage` | 统计页，导航排第一：近 12 月趋势 + 本月概览 / 环比 + 分类 TOP5 |
| `/categories` | `CategoryPage` | 分类管理：我的分类（可编辑）+ 系统默认（只读列） |
| `/settings` | `SettingsPage` | 设置：支付方式 / 收支类型管理 |

- 使用 `BrowserRouter`（不是 HashRouter），所以**网页版必须有 `vercel.json` 的 SPA 重写**，否则直接打开 `/categories` 会 404。
- 页面级交互细节（筛选联动、折叠档位、删除自动补锁等）见 [pages/AGENTS.md](pages/AGENTS.md)。

## 子目录导航

| 目录 | 指导文件 | 内容 |
|---|---|---|
| `data/` | [data/AGENTS.md](data/AGENTS.md) | SQLite schema、双数据层、分类种子、日期 / 金额 / 规则 / 节假日纯函数 |
| `contexts/` | [contexts/AGENTS.md](contexts/AGENTS.md) | Category / Settings / HomeFilter 三个全局 Context |
| `components/` | [components/AGENTS.md](components/AGENTS.md) | 可复用组件清单 + 通用 UI 约定（行内编辑 / HoverTip / 拖拽 / 折叠） |
| `pages/` | [pages/AGENTS.md](pages/AGENTS.md) | 4 个页面的职责与交互链路 |

## 双形态：桌面版 / 网页版

判定函数 `isTauri()`（`data/webDb.ts`）= `'__TAURI_INTERNALS__' in window`。`data/database.ts` 的 `connectDb()` 据此选连接：

| 形态 | 数据层 | 存储位置 |
|---|---|---|
| 桌面（Tauri） | `@tauri-apps/plugin-sql`：`Database.load('sqlite:one_ledger.db')` | 系统应用数据目录下的 SQLite 文件 |
| 网页（浏览器） | `data/webDb.ts`：sql.js 在浏览器内跑 SQLite | IndexedDB（库 `one_ledger` / store `kv` / key `sqlite_db`） |

- 两者实现同一个 `DbConnection` 接口（`execute` / `select`），所以 `database.ts` 不感知差异。
- **数据不互通**：桌面版数据在本机 DB 文件，网页版在各自浏览器；换设备 / 清缓存会丢，需提醒用户导出 CSV 备份。
- 网页版 sql.js 的 wasm 用 `sql.js/dist/sql-wasm.wasm?url` 导入，**不要改成 CDN**（离线可用 + 构建可复现）。
- 网页版部署见 `WEB_DEPLOY.md`（Vercel 自动识别 Vite，Output Directory `dist`）。

## 样式与主题

Tailwind CSS v4：**没有 `tailwind.config.js`**，全部走 `index.css` 的 `@theme` 块。改色只改这里：

| 变量 | 值 | 用途 |
|---|---|---|
| `--color-primary` | `#6366f1` | 主色（正常预算、选中态） |
| `--color-primary-dark` | `#4f46e5` | 主色深 |
| `--color-expense` | `#ef4444` | 支出 / 超支 |
| `--color-income` | `#10b981` | 收入 |
| `--color-bg` / `--color-surface` / `--color-border` | `#f8fafc` / `#ffffff` / `#e2e8f0` | 背景 / 卡片 / 描边 |
| `--color-text` / `--color-text-muted` | `#1e293b` / `#64748b` | 正文 / 次要文字 |

- 预算进度色：正常 `primary` → ≥80% `amber` → 超支 `red`。
- 日期选择统一用 `@daypicker/react`（v10），外观靠 `index.css` 里的 `.rdp-root` CSS 变量覆盖；两个月强制横排，容器放不下时外层横向滚动。

## TypeScript / Lint 约束

- `npm run typecheck` = `tsc -b`；配置 `tsconfig.app.json`，`include` 只有 `frontend`。
- 已开启：`noUnusedLocals`、`noUnusedParameters`、`verbatimModuleSyntax`（**类型导入必须 `import type`**）、`erasableSyntaxOnly`（**不能用 `enum` / `namespace` / 构造函数参数属性**）、`allowImportingTsExtensions`。
- **没有自动化测试框架**：验证靠 `typecheck` + `lint` + 手动跑两个形态。
- oxlint（`.oxlintrc.json`）：`react/rules-of-hooks` 为 error；`react/only-export-components` 允许常量导出 + 白名单 hook `useCategories` / `useSettings` / `useHomeFilter`——**在 Context 文件里新增 hook 要同步加进白名单**，否则告警。

## 依赖（已装，禁止擅自新增）

`react` 19 / `react-dom` 19、`react-router-dom` 7、`recharts` 3、`@dnd-kit/*`、`@daypicker/react` 10、`date-fns` 4、`lunar-javascript`、`sql.js`、`@tauri-apps/api` + `@tauri-apps/plugin-sql`、`tailwindcss` 4 + `@tailwindcss/vite`、`esbuild`。

> 需要新库：必须先列方案 + 通俗解释优劣，让用户拍板（根 AGENTS.md「全局铁律 1」）。

## 必须遵守的约定（前端层）

1. **不许在 `components/` / `pages/` 里写 SQL**：一律调 `data/database.ts` 导出的函数。
2. **不许在组件里手工拼日期**：日期运算 / 格式化一律用 `data/dateUtils.ts`；日期字符串按**本地时区**，禁止用 `toISOString()` 取日期（会有凌晨偏移）。
3. **悬浮提示用 `components/HoverTip.tsx`**，不要新增原生 `title`（桌面 WebView 里 title 延迟约 1 秒甚至不弹）。
4. **新增页面要成链**：`App.tsx` 加路由 → `Layout` 加导航 → `pages/AGENTS.md` 加说明 → 检查根 AGENTS.md「目录导航 / 已实现功能」是否需要更新。
5. **注意桌面 WebView 的兼容性**：能直接用原生 `<select>` 就别自造控件；需要浮层的（如 `InlineSelect`）用 portal 且已验证；CSS 不要依赖特定浏览器特性。
6. **大文件先 grep 再改**：`HomePage.tsx`（约 59KB）、`ExpenseList.tsx`（约 50KB）、`data/database.ts`（约 55KB）都很大，**不要整文件重写**，先 `grep` 定位再局部改。

## 改动检查清单

- [ ] `npm run typecheck` 通过
- [ ] `npm run lint` 通过
- [ ] 桌面版（`npm run tauri:dev`）与网页版（`npm run dev`）都还能跑
- [ ] 没有引入新依赖；如有，用户已拍板
- [ ] 涉及的目录 `AGENTS.md` 已同步（见根 AGENTS.md 第 10 节）

## 相关文档

- 总纲与目录导航：[../AGENTS.md](../AGENTS.md)
- 数据层 [data/AGENTS.md](data/AGENTS.md) ｜ 组件层 [components/AGENTS.md](components/AGENTS.md) ｜ Context 层 [contexts/AGENTS.md](contexts/AGENTS.md) ｜ 页面层 [pages/AGENTS.md](pages/AGENTS.md)
- 面向开发者：[../ARCHITECTURE.md](../ARCHITECTURE.md) ｜ 网页版部署：[../WEB_DEPLOY.md](../WEB_DEPLOY.md) ｜ 版本变更：[../CHANGELOG.md](../CHANGELOG.md)
