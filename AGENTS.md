# 一笔（OneLedger）— AI 指导总纲

> 本文件是「分层 AI 指导」体系的**根**。AI 开工前先读这里；进入某个代码目录后，再读该目录自己的 `AGENTS.md`（见「5. 目录导航」）。
>
> **分工**：本文件 = 项目总体情况 + 全局铁律 + 目录导航 + 构建 / 发版 / 图标。具体目录的文件清单、代码约定、历史踩坑 **不在这里**，下沉到各目录的 `AGENTS.md`。
>
> 文档语言：中文。用户不懂编程，任何技术结论都要配通俗解释。

---

## 0. 30 秒速览

| 问题 | 答案 |
|---|---|
| 是什么 | Windows / macOS 桌面记账应用「一笔」，个人日常消费记录与支出管理 |
| 技术形态 | Tauri 2 外壳 + React 19 + TypeScript + SQLite；同一套前端另跑网页版（sql.js + IndexedDB） |
| 当前版本 | v2.4.0（唯一权威：`backend/tauri.conf.json` 的 `version`） |
| 桌面版跑起来 | `npm run tauri:dev` |
| 浏览器里跑起来 | `npm run dev` |
| 数据存哪 | 桌面版：本地 SQLite 文件 `one_ledger.db`；网页版：浏览器 IndexedDB。**两者不互通** |
| 最硬的规则 | 技术选型必须用户拍板，禁止擅自加库 / 换框架 |

---

## 1. 项目概述

| 项 | 内容 |
|---|---|
| 项目名称 | 一笔（OneLedger） |
| 目标 | 可运行在 Windows 与 Mac 上的桌面记账应用，界面中文，产品名英文仅供打包 |
| 目标用户 | 个人用户，日常消费记录与支出管理 |
| 货币单位 | 人民币（CNY / 元），金额支持两位小数 |
| 使用场景 | 单机离线。桌面版数据在本机 DB 文件；网页版部署在 Vercel，数据在各用户浏览器里 |

---

## 2. 核心功能需求（产品是什么）

### 2.1 消费记录

每条记录包含：**金额**（元，两位小数）、**日期**、**分类**（二级：大类 → 小类）、**备注**、**支付方式**、**收支类型**（支出 / 收入 / 不计）、**是否日常**。要求增、删、改、查齐全。

### 2.2 二级分类体系

11 个一级大类、56 个二级小类（小类名含 emoji 前缀）。分类**不是写死的**：用户可在「分类管理」页在线增删改、拖拽排序、编辑 emoji 图标、标记默认小类。默认种子写在 `frontend/data/categories.ts`，完整清单与数据模型见 [frontend/data/AGENTS.md](frontend/data/AGENTS.md)。

### 2.3 辅助功能优先级（用户定的优先级，别做反了）

| 优先级 | 内容 |
|---|---|
| **P0 必须有** | 记录增删改查、分类选择 |
| **P1 应该有** | 按月份 / 分类筛选查看、月度消费统计 |
| **P2 锦上添花** | 消费趋势图表、预算设置提醒、数据导出 |

### 2.4 核心业务规则（跨目录，动手前必须知道）

1. **统计口径**：所有「支出」统计（蓝色概览卡 / 分类排行 / 趋势图 / 每日小计 / 支付方式统计 / 预算）**只算收支类型为 `expense` 的记录**，收入与「不计」不参与。由 `expenseCodes`（SettingsContext）或 SQL `type IN (SELECT code FROM tx_types WHERE category='expense')` 保证。细节见 [frontend/data/AGENTS.md](frontend/data/AGENTS.md)。
2. **小类的金额唯一来源是「条件规则」**：每条规则 = 启用勾选 + 条件 + 金额，从上往下匹配、命中第一条即用。同类条件多值 = 或，不同类条件叠加 = 且。**不要**再给小类加写死的固定金额字段。
3. **日期三态 + 双层锁**（本项目特有，最容易改错）：
   - 三态：未记录（无记录 + 未锁）／已记账（有记录）／已确认（已锁；有记录 = 只读，无记录 = 「当天无消费」）。
   - 两层锁互相独立：**月锁**（`month_attributes.is_locked`）优先级高、**日锁**（`day_attributes.is_locked`）优先级低；某天是否锁定 = 月已锁 **或** 该天已锁。锁整月不改任何日锁；逐天锁满也不会自动置月锁。
   - 不新增「无消费」数据行：**锁定且无记录 = 当天无消费**。
   - 写操作在数据层统一拦截（`assertDateEditable`），UI 只是把按钮藏起来，不能只改 UI。
   - 锁 / 解锁点一下即生效，**没有确认弹窗**（可逆操作，弹框反而添乱）。
   - 删空某天（删掉最后一条记录 / 最后一个大类）→ 自动补日锁，就地显示「当天无消费」；只在运行时删除触发，升级老库不批量补标记。
4. **默认小类预设**：餐饮饮食的 早餐 / 午餐 / 晚餐 出厂默认；「添加某天」自动记账只按勾选的大类，且只给**命中规则**的默认小类生成记录（没命中就不生成，不会留 0 元垃圾行）。

---

## 3. 技术栈（已确定）

> ⚠️ **重要**：核心选型已全部确定（见下表），后续开发直接沿用。若将来确实需要引入新的框架 / 库 / 工具，仍须**先列方案 + 通俗解释优劣，由用户拍板**，禁止擅自选型。

| 层面 | 选型 | 说明 |
|---|---|---|
| 桌面外壳 | **Tauri 2** | 复用系统浏览器内核，体积小（约 5-15 MB）、内存占用低；Rust 侧只做启动与插件注册，无业务逻辑 |
| 界面框架 | **React 19 + TypeScript** | 前端页面与交互；严格 TS（`tsc -b` 必须过） |
| UI 样式 | **Tailwind CSS v4** | 原子化 CSS；通过 `@tailwindcss/vite` 集成，**无 tailwind.config.js**，主题色在 `frontend/index.css` 的 `@theme` 块 |
| 数据存储 | **SQLite 本地库** | 单机离线；schema **仅由前端 `frontend/data/database.ts` 统一维护**（`CREATE TABLE IF NOT EXISTS` + 兼容性 `ALTER TABLE`），Rust 侧不定义任何表 |
| 分类共享 | **React Context** | 分类 / 设置 / 首页筛选三个 Context，见 [frontend/contexts/AGENTS.md](frontend/contexts/AGENTS.md) |
| 路由 | **React Router v7**（`react-router-dom`） | 4 个页面，见 [frontend/AGENTS.md](frontend/AGENTS.md) |
| 图表 | **Recharts** | 趋势折线图 |
| 拖拽排序 | **@dnd-kit** | 配置集中在 `frontend/components/sortableConfig.ts` |
| 农历 / 黄历 | **lunar-javascript** | 农历、节气、节日、宜忌 |
| 网页版数据库 | **sql.js + IndexedDB** | 浏览器内跑 SQLite，`frontend/data/webDb.ts` |
| 代码检查 | **oxlint** | 配置文件 `.oxlintrc.json`；**没有自动化测试框架** |

---

## 4. 全局铁律（用户定的项目规则，违反等于白干）

1. **技术决策由用户拍板**：任何技术选型，先列方案 + 通俗解释优劣，由用户决定。不要替用户做主。
2. **产品文档先行**：开始写代码之前，先确认产品设计和方案选择。
3. **分步推进**：每个阶段完成后，先让用户确认，再进入下一阶段。
4. **用通俗语言解释**：用户不懂编程，技术术语必须配通俗解释。
5. **文档持续更新**：产品 / 技术决定记录在根 `AGENTS.md` 与对应目录的 `AGENTS.md`；每次版本改动追加到 `CHANGELOG.md`。**不要在 AGENTS.md 里堆变更流水账**（历史都在 CHANGELOG）。
6. **改文档要成链**：新增一个代码目录 → 同步新增该目录的 `AGENTS.md`，并挂进下面的「目录导航」。新增 / 改名文件 → 同步该目录 `AGENTS.md` 的文件清单。**AGENTS.md 与代码不一致时，以代码为准，并顺手修正文档。**

---

## 5. 目录导航（AI 必读）

**读法**：先读本文件 → 按要改的东西找到对应目录 → 读那份 `AGENTS.md` → 再动手。

| 路径 | AI 指导文件 | 一句话职责 | 什么时候读 |
|---|---|---|---|
| `frontend/` | [frontend/AGENTS.md](frontend/AGENTS.md) | 前端总览：入口、路由、命令、双形态、主题 | 任何前端改动先读 |
| `frontend/data/` | [frontend/data/AGENTS.md](frontend/data/AGENTS.md) | 数据层：SQLite schema、双数据层、分类种子、纯函数工具 | 动数据库 / 表结构 / 日期 / 金额 / 规则 / 节假日 |
| `frontend/components/` | [frontend/components/AGENTS.md](frontend/components/AGENTS.md) | 组件层：25 个组件 + 2 个辅助模块的文件清单 + 通用 UI 约定（行内编辑 / HoverTip / 拖拽 / 折叠） | 动 UI 交互、列表、日历、弹窗 |
| `frontend/contexts/` | [frontend/contexts/AGENTS.md](frontend/contexts/AGENTS.md) | Context 层：分类 / 设置 / 首页筛选的全局状态 | 要跨页面共享状态、或改筛选状态 |
| `frontend/pages/` | [frontend/pages/AGENTS.md](frontend/pages/AGENTS.md) | 页面层：4 个页面的职责与页面级交互链路 | 改首页筛选联动、统计页、分类页、设置页 |
| `backend/` | [backend/AGENTS.md](backend/AGENTS.md) | Tauri（Rust）外壳：启动、插件、权限、打包配置、图标 | 改窗口 / 权限 / 打包 / Tauri 版本 |

**根目录其他文档**（不是 AI 指导文件，是对人的交付物）：

| 文件 | 用途 | 谁来维护 |
|---|---|---|
| `README.md` | 面向用户的产品说明 | 功能变化时同步 |
| `ARCHITECTURE.md` | 面向开发者的架构说明（命名规范 / 数据流 / 表结构） | 架构变化时同步 |
| `CHANGELOG.md` | 版本变更记录（Keep a Changelog 格式，最新在最上面） | **每次版本改动必须追加** |
| `WEB_DEPLOY.md` | 网页版部署指南 | 部署方式变化时同步 |

---

## 6. 技术架构（目录树）

```
OneLedger/
├── AGENTS.md                      # ← 本文件：AI 总纲 + 目录导航
├── frontend/                      # React 前端（桌面版 + 网页版共用同一套代码）
│   ├── AGENTS.md                  # 前端总览
│   ├── main.tsx                   # 入口：StrictMode + BrowserRouter + 三层 Provider
│   ├── App.tsx                    # 路由表（4 个页面共用 Layout）
│   ├── index.css                  # Tailwind 入口 + @theme 主题色 + react-day-picker 定制
│   ├── data/                      # 数据层（AGENTS.md 在此）
│   ├── contexts/                  # 全局状态 Context（AGENTS.md 在此）
│   ├── components/                # 可复用 UI 组件（AGENTS.md 在此）
│   └── pages/                     # 4 个页面（AGENTS.md 在此）
├── backend/                       # Tauri（Rust）外壳（AGENTS.md 在此）
│   ├── src/                       # lib.rs（插件注册）/ main.rs（入口）
│   ├── capabilities/              # 权限配置 default.json（SQL 权限在此）
│   ├── icons/                     # 各平台图标（由 logo.png 生成）
│   ├── tauri.conf.json            # 窗口 / 打包 / 版本号（发版改这里）
│   ├── Cargo.toml                 # Rust 依赖与版本号
│   └── gen/                       # Tauri 生成的 schema（gitignore，勿手改）
├── public/                        # 网页版 favicon / apple-touch-icon
├── index.html                     # 网页入口 HTML（引用 /frontend/main.tsx）
├── logo.png                       # 图标源图（1024×1024）
├── package.json                   # 依赖与 npm 脚本
├── vite.config.ts                 # Vite 配置（react + tailwind 插件）
├── tsconfig*.json                 # TypeScript 配置（noEmit + 未使用变量/参数报错，include: frontend）
├── .oxlintrc.json                 # oxlint 规则
├── vercel.json                    # 网页版 SPA 重写（部署用）
├── README.md / ARCHITECTURE.md / CHANGELOG.md / WEB_DEPLOY.md
└── .github/workflows/release.yml  # 打标签自动构建安装包
```

**构建产物**：Mac `.app` / `.dmg` 在 `backend/target/release/bundle/` 下；Windows `.exe` / `.msi` 由 GitHub Actions 在标签触发时构建（本地 Mac 打不出 Windows 包）。

---

## 7. 已实现功能清单（当前状态，别重复实现）

> 详细行为说明见对应目录的 `AGENTS.md`；逐版本改动见 `CHANGELOG.md`。

**P0 记账核心**
- 记录增删改查（金额 / 分类 / 日期 / 备注 / 支付方式 / 收支类型 / 日常标记）
- 二级分类选择（11 大类 + 56 小类），记录完整编辑弹窗（含日期，录错日期不用删了重记）
- 按月份筛选查看、数据持久化（桌面 SQLite / 网页 IndexedDB）
- 支付方式可配置（增删改排序），按日支付方式统计

**P1 统计**
- 月度总支出 / 总笔数、分类排行榜（带进度条）、每日小计

**P2 增强**
- 趋势图（近 12 月月度折线 + 当月按天双线）
- 月度预算 + 进度条 + 接近 / 超支提醒
- CSV 导出

**P2+ 体验**
- 分类管理（在线增删改、emoji 图标、拖拽排序）、默认小类模板、系统默认分类只读列 + 一键恢复
- 首页改版：顶部日历区（左 1/3 支出日历；右侧上农历黄历卡、下按天双线图）+ 两栏（左 3/5：时间范围选择器 / 导出 / 蓝色概览卡（含预算输入）/ 记录列表；右 2/5：分类排行）
- 时间范围联动（近一周 / 近一月 / 本月 / 上月 / 历史月份 / 自定义某天），日历与蓝色模块双向联动
- 独立统计页（导航首位）：近 12 月趋势 + 本月概览 / 环比 + 分类 TOP5
- 按分类勾选筛选（与支付方式筛选叠加）
- 列表搜索 + 金额筛选（按天 / 大类 / 单笔，≥ 阈值）
- 列表「折叠 / 展开」按钮（三档：按天 → 展开大类 → 展开小类，一次走一档）
- 小类条件规则（总是 / 工作日 / 休息日 / 每周几 / 每月几号 / 每年某日）
- 节假日数据（内置导入 + 联网更新，离线可用、失败静默）
- 日期锁（日锁 / 月锁）与「当天无消费」确认
- 双形态：桌面版（Tauri）+ 网页版（Vercel + sql.js）

---

## 8. 构建 / 开发 / 发版

### 8.1 常用命令

```bash
npm install            # 首次安装依赖
npm run dev            # 浏览器热更新开发（http://localhost:5173）
npm run tauri:dev      # 桌面窗口开发模式（会先起 vite）
npm run build          # 仅构建前端（tsc -b && vite build）
npm run typecheck      # 只做 TypeScript 类型检查
npm run lint           # oxlint 代码检查
npm run tauri:build    # 构建桌面安装包
```

### 8.2 版本发布流程（GitHub 自动构建安装包）

发版后，访客在 GitHub 项目页面的 **Releases** 区直接下载 Mac / Windows 安装包。构建由 GitHub 服务器完成，**不需要 Windows 电脑**。

**三步**：

1. 改版本号：`backend/tauri.conf.json` 的 `version`（Tauri 打包以它为准），顺手把 `backend/Cargo.toml` 的 `version` 也改成一致。
2. 提交：`git add -A && git commit -m "发布 v2.1.0"`。
3. 打标签并推送：`git tag v2.1.0 && git push && git push origin v2.1.0`（标签名 `v` 后的数字**必须**与步骤 1 的版本号一致）。

等约 10~20 分钟，Releases 页面就会出现安装包。

| 平台 | 文件 | 说明 |
|---|---|---|
| Mac | `OneLedger_<版本>_universal.dmg` | 通用版，M 系列与 Intel 都支持（下载它） |
| Mac | `OneLedger.app.tar.gz` | 压缩包，普通用户忽略 |
| Windows | `OneLedger_<版本>_x64-setup.exe` | 安装程序（下载它） |
| Windows | `OneLedger_<版本>_x64_en-US.msi` | 另一种安装包，可忽略 |

> 📌 **安装包文件名为什么是英文**：Windows 的 MSI 打包工具（WiX）不支持中文文件名，中文产品名会打包失败，因此产品名用英文 **OneLedger**。软件窗口标题与界面文字仍是中文「一笔」。

**无签名证书的提示（现状）**：首次打开会有安全提示，属正常。Mac 右键 →「打开」；Windows 点「更多信息」→「仍要运行」。将来购买签名证书可在发布流程加签名环节。

---

## 9. 更换应用图标（Logo）

**源图**：项目根目录 `logo.png`（1024×1024，内容铺满整幅画面、四角透明、无白色实底）。

1. 用新 Logo 替换根目录 `logo.png`。
   - ⚠️ 素材**不要放 `dist/`**，该目录每次构建都会被清空。
   - ⚠️ 图案要**铺满整个正方形**（四边不留透明边距），否则 macOS 会给图标加一圈白色底板；圆角交给系统裁剪。
   - ⚠️ 四角必须**透明**（不要白色实底），否则网页小尺寸 favicon 四角现白边。
2. 生成桌面全平台图标，并删掉本项目用不上的手机图标：
   ```bash
   npx tauri icon logo.png -o backend/icons
   rm -rf backend/icons/ios backend/icons/android
   ```
3. 同步生成网页 favicon（用 ffmpeg lanczos；`sips` 缩放会让边缘发白发虚，勿用）：
   ```bash
   for s in 16 32 48 192; do ffmpeg -hide_banner -loglevel error -i logo.png -vf "scale=${s}:${s}:flags=lanczos" -y public/favicon-${s}x${s}.png; done
   ffmpeg -hide_banner -loglevel error -i logo.png -vf "scale=180:180:flags=lanczos" -y public/apple-touch-icon.png
   ```
   旧 `favicon.svg`（模板遗留）已删除，勿再引用。
4. 重新打包：`npm run tauri:build`。若图标没变化，是 macOS 图标缓存，重启 Finder 或电脑。

| 文件（`backend/icons/`） | 用途 |
|---|---|
| `icon.icns` | Mac（.app / .dmg） |
| `icon.ico` | Windows（.exe） |
| `32x32.png` / `128x128.png` / `128x128@2x.png` / `64x64.png` | 被 `tauri.conf.json` 的 `icon` 字段引用 |
| `Square*Logo.png` / `StoreLogo.png` | Windows 商店上架才需要，当前未用 |

> ℹ️ **macOS 图标「留白」是系统行为，不是 bug**：Finder / Dock 显示任何 `.app` 时都会把内容缩到约 80% 居中。而 `npm run tauri:dev` 跑的是裸二进制（不在 .app 里），系统不缩边，图标看起来「比正常大」。这是 macOS 对所有 App 的统一定制，无需也无法修改。

---

## 10. 文档索引：改动该同步哪份文档

| 你改了什么 | 必须同步 |
|---|---|
| 新增 / 删除 / 重命名代码目录 | 本文件「目录导航」+ 新目录的 `AGENTS.md` |
| 某目录里新增 / 改名 / 删除文件 | 该目录的 `AGENTS.md` 文件清单 |
| 改了某目录的核心约定 / 架构 | 该目录的 `AGENTS.md`；跨目录的才改本文件 |
| 任何版本功能改动 | `CHANGELOG.md`（最新在最上面） |
| 用户可见的功能变化 | `README.md` |
| 表结构 / 命名规范 / 数据流 | `ARCHITECTURE.md` + `frontend/data/AGENTS.md` |
| 窗口 / 权限 / 打包配置 | `backend/AGENTS.md` |
| 网页版部署 | `WEB_DEPLOY.md` |

---

## 11. 给 AI 的协作提示

1. **先定位再动手**：改代码前先确认归属目录，读该目录的 `AGENTS.md`。多个目录都相关时全读。
2. **不要擅自重构**：这个项目有大量「看起来奇怪但故意的」实现（折叠档位不存数字、删空某天自动补锁、拖拽乐观更新、月锁日锁互不改写…），每份 `AGENTS.md` 都写了「为什么」。删代码 / 改约定前先读懂理由。
3. **改完自检**：`npm run typecheck` 与 `npm run lint` 必须过；涉及列表 / 筛选 / 锁 / 统计的改动，逐条对照相关 `AGENTS.md` 的「改动检查清单」。
4. **保持文档诚实**：发现的代码与文档不一致，以代码为准并修正文档，在回复里指出。
5. **`.claude/` 目录**（gitignore，不提交）：`memory/` 是跨会话项目记忆（索引 `MEMORY.md`），`docs/` 是过程性工作文档。正式文档不在那里。
