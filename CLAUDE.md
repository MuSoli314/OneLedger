# 一笔（OneLedger）- 产品文档

## 项目概述

**项目名称**: 一笔（OneLedger）  
**项目目标**: 开发一款可运行在 Windows 和 Mac 电脑上的桌面记账应用  
**目标用户**: 个人用户，用于日常消费记录与支出管理  
**货币单位**: 人民币（CNY / 元）

---

## 核心功能需求

### 1. 消费记录
- 记录每一笔花销的**金额**（单位：元，支持小数点后两位）
- 记录消费**日期**
- 记录消费**分类**（二级分类体系，见下方）
- 可添加**备注**说明
- 支持**增、删、改、查**所有记录

### 2. 消费分类体系（二级）

| 一级大类 | 二级小类 |
|---------|---------|
| 🍜 餐饮饮食 | 早餐、午餐、晚餐、零食饮料、水果、外卖、买菜做饭 |
| 🚗 交通出行 | 公交地铁、出租车/网约车、加油充电、停车费、火车高铁、飞机机票 |
| 🛒 购物消费 | 服饰鞋包、数码产品、家居用品、美妆护肤、日用百货 |
| 🏠 住房居家 | 房租/房贷、水电燃气、物业费、维修保养、日用品 |
| 🎮 娱乐休闲 | 电影演出、运动健身、游戏充值、旅游度假、宠物开销 |
| 🏥 医疗健康 | 看病买药、体检保健、口腔护理、眼镜配镜 |
| 📚 教育学习 | 书籍资料、培训课程、考试报名、文具用品 |
| 🎁 人情社交 | 请客送礼、红包礼金、聚会聚餐 |
| 📱 通讯网络 | 手机话费、宽带网络、会员订阅 |
| 💰 金融保险 | 手续费、保险费、贷款利息 |
| 📦 其他支出 | 快递物流、其他杂项 |

### 3. 辅助功能（按优先级排序）
- **P0 必须有**: 消费记录的增删改查、分类选择
- **P1 应该有**: 按月份/分类筛选查看、月度消费统计
- **P2 锦上添花**: 消费趋势图表、预算设置提醒、数据导出

---

## 技术栈（已确定）

> ⚠️ **重要规则**: 核心选型已全部确定（见下表），后续开发直接沿用即可。若将来需要引入新的框架/库/工具，仍须先列出可行方案并向用户通俗解释优劣，由用户拍板，禁止擅自选型。

| 层面 | 选型 | 说明 |
|------|------|------|
| 桌面外壳 | **Tauri** | 轻量桌面框架，复用系统浏览器内核，应用体积小（约 5-15 MB）、内存占用低 |
| 界面框架 | **React + TypeScript** | 前端页面与交互 |
| UI 样式 | **Tailwind CSS** | 原子化 CSS 工具类 |
| 数据存储 | **SQLite 本地数据库** | 单机使用，数据存本地，无需网络；schema 由前端 `database.ts` 统一维护 |
| 分类数据共享 | **React Context** | 分类持久化在 SQLite，Context 全局共享避免重复加载 |

---

## 项目规则（请严格遵守）

1. **技术决策由用户拍板**: 任何技术选型，必须先列出方案 + 通俗解释优劣，由用户决定。不要替用户做主。
2. **产品文档先行**: 在开始写代码之前，必须先确认产品设计和方案选择。
3. **分步推进**: 每个阶段完成后，先让用户确认，再进入下一阶段。
4. **用通俗语言解释**: 用户不懂编程，所有技术术语需要配合通俗解释。
5. **文档持续更新**: 所有重要决定都要记录在这个 CLAUDE.md 文件中。

---

## Claude Code 工作文件位置（记忆 + 文档）

Claude Code 为本项目生成的**记忆文件**和**工作文档**存放在项目内的 `.claude/` 目录（已加入 `.gitignore`，不随仓库提交）：

- `.claude/memory/` — 项目记忆（跨会话持续有效，索引见 `MEMORY.md`）
- `.claude/docs/` — 过程性工作文档

正式产品文档仍维护在本文件（CLAUDE.md）中，随仓库提交共享。

---

## 已实现功能清单

### ✅ P0 核心功能（已完成）
- [x] 消费记录添加（金额、分类、日期、备注、支付方式）
- [x] 消费记录编辑（含支付方式）
- [x] 消费记录删除（带确认弹窗）
- [x] 二级分类选择（11 大类 + 50+ 小类）
- [x] 按月份筛选查看
- [x] 数据持久化（SQLite 本地数据库）
- [x] 支付方式（微信/支付宝/银行卡/美团月付）
- [x] 支付方式按日统计展示

### ✅ P1 统计功能（已完成）
- [x] 月度总支出 / 总笔数统计
- [x] 分类排行榜（带进度条）
- [x] 每日小计展示

### ✅ P2 功能（已完成）
- [x] 消费趋势图表（月度折线图 + 分类饼图）
- [x] 预算设置与提醒（设置月度预算 + 进度条 + 超支/接近提醒）
- [x] 数据导出（CSV 格式）

### ✅ P2+ 功能（已完成）
- [x] 分类管理（在线新增/删除/修改分类与子分类）
- [x] 默认小类模板（标记默认小类，记账时自动填充）
- [x] 分类图标在线编辑（emoji 选择器）
- [x] 首页改版（两栏仪表盘布局 + 时间范围联动：近一周 / 近一月 / 本月 / 历史月份）
- [x] 按分类筛选（分类排行勾选大类/小类复选筛选记录列表，与支付方式筛选叠加生效）
- [x] 日常 / 非日常支出区分（小类默认标记 + 记录行内切换 + 当月支出图双线）

### ✅ 双形态：桌面版 + 网页版（已完成）
- [x] 网页版数据层（浏览器内运行 SQLite + IndexedDB 本地持久化，`webDb.ts`）
- [x] 网页版部署配置（`vercel.json` SPA 重写 + 部署指南 `WEB_DEPLOY.md`）
- 同一套前端代码跑桌面版（Tauri）与网页版，运行时按环境自动切换数据层：
  - 桌面版：Tauri SQL 插件（`Database.load('sqlite:one_ledger.db')`）
  - 网页版：sql.js（浏览器内 SQLite，数据存浏览器 IndexedDB）
- 数据不互通：桌面版数据在本地 DB 文件，网页版数据在各用户自己的浏览器里，互不影响。
- 网页版数据跟随浏览器，换设备/清缓存会丢，需提醒用户定期导出 CSV。

---

## 技术架构

```
OneLedger/
├── frontend/                      # 前端代码（React + TypeScript）
│   ├── data/
│   │   ├── types.ts              # TypeScript 类型定义
│   │   ├── categories.ts         # 默认消费分类数据 + 支付方式
│   │   ├── dateUtils.ts          # 本地日期工具（避免 UTC 时区问题）
│   │   ├── database.ts           # SQLite 数据库操作（含分类表，桌面/网页自适应）
│   │   └── webDb.ts              # 网页版数据层（sql.js + IndexedDB 持久化）
│   ├── contexts/
│   │   └── CategoryContext.tsx    # 分类数据共享 Context
│   ├── components/
│   │   ├── Layout.tsx            # 应用布局 + 顶部导航
│   │   ├── ExpenseForm.tsx       # 添加/编辑表单弹窗
│   │   ├── ExpenseList.tsx       # 消费记录列表（按日分组）
│   │   ├── CategoryPicker.tsx    # 二级分类选择器
│   │   ├── BudgetSetup.tsx       # 预算设置弹窗
│   │   ├── TrendChart.tsx        # 趋势图表（折线图：月度趋势 + 按天趋势）
│   │   ├── StatsPanel.tsx        # 首页右栏统计面板（当月支出图 + 分类排行）
│   │   └── ConfirmDialog.tsx     # 确认弹窗组件
│   └── pages/
│       ├── HomePage.tsx          # 首页：两栏仪表盘（趋势图 + 记录列表 + 统计面板）
│       └── CategoryManager.tsx   # 分类管理页（增删改 + 默认模板）
├── backend/                       # Rust 原生后端（Tauri）
│   ├── src/
│   └── tauri.conf.json           # Tauri 窗口/打包配置
├── index.html                    # 入口 HTML
├── logo.png                      # 应用图标源图（1024×1024，更换 Logo 见下方说明）
├── README.md                     # 产品文档
├── package.json                  # 项目依赖
└── .github/workflows/release.yml # 发版自动构建安装包（打标签触发）
```

**构建产物**:
- Mac .app: `backend/target/release/bundle/macos/OneLedger.app`（直接打开）
- Mac 安装包: `backend/target/release/bundle/dmg/OneLedger_xxx.dmg`
- Windows .exe: 在 Windows 电脑上运行 `npm run tauri:build` 生成

---

## 版本发布流程（GitHub 自动构建安装包）

发版后，访客可在 GitHub 项目页面的 **Releases（发行版）** 区域直接下载 Mac / Windows 安装包。整个构建由 GitHub 服务器自动完成，**不需要 Windows 电脑**。

### 发版步骤（三步）

1. 修改版本号：打开 `backend/tauri.conf.json`，把 `version` 字段改成新版本号（如 `2.1.0`）。Tauri 打包版本以该文件为准；建议顺手把 `backend/Cargo.toml` 的 `version` 也改成一致。
2. 提交：`git add -A && git commit -m "发布 v2.1.0"`
3. 打标签并推送：`git tag v2.1.0 && git push && git push origin v2.1.0`（标签名 `v` 后面的数字必须与步骤 1 的版本号一致）

等约 10~20 分钟，Releases 页面就会出现安装包，自动发布无需人工操作。

### 每个平台得到什么文件

| 平台 | 文件 | 说明 |
|------|------|------|
| Mac | `OneLedger_<版本>_universal.dmg` | 通用版，苹果 M 系列芯片和 Intel 都支持（下载它） |
| Mac | `OneLedger.app.tar.gz` | 压缩包，普通用户忽略 |
| Windows | `OneLedger_<版本>_x64-setup.exe` | 安装程序（下载它） |
| Windows | `OneLedger_<版本>_x64_en-US.msi` | 另一种安装包，可忽略 |

> 📌 **为什么安装包文件名是英文**：Windows 的 MSI 打包工具（WiX）不支持中文文件名，中文产品名会导致打包失败。因此安装包的产品名使用英文 **OneLedger**。软件打开后的窗口标题和界面文字仍然是中文「一笔」，不受影响。（2026-08-02 决定）

### 无签名证书的提示（现状）

应用暂未购买数字签名证书，访客首次打开会有安全提示，属正常现象：
- **Mac**：右键应用图标 →「打开」即可运行
- **Windows**：点「更多信息」→「仍要运行」

将来若购买 Apple 开发者证书和 Windows 签名证书，可在发布流程中加入签名环节，届时访客可正常双击打开。

**当前版本**: v2.0.0（2026-07-22 全面代码审查修复版）

> v2.0.0 变更摘要：修复时区 Bug（统一使用 `dateUtils.ts` 本地日期）、取消列表 100 条上限、
> 首页卡片跟随筛选月份、CSV 导出转义、数据库 schema 统一由前端维护（Rust 端不再重复建表）、
> 小类拖拽 ref 修复、编辑老记录不再被模板覆盖、行内记账金额校验、饼图颜色固定、趋势图补零、
> 弹窗支持 Esc 关闭。
> （2026-08-02 正式发版补充：Windows MSI 打包工具不支持中文文件名，安装包产品名改用英文 OneLedger，软件界面仍为中文「一笔」。）
>
> 2026-08-02 首页改版：两栏仪表盘布局（顶部全宽近 12 月趋势图 + 左右两栏），新增时间范围选择器
> （近一周 / 近一月 / 本月 / 历史月份），蓝色卡、记账列表、右栏「当月支出」图与分类排行联动；
> 删除独立统计页 /stats 与饼图组件。

---

## 更换应用图标（Logo）

**图标源图**: 项目根目录的 `logo.png`（1024×1024，内容铺满整幅画面、无留白边距）。

**更换步骤**:

1. 准备一张 **1024×1024 的 PNG** 新 Logo，替换项目根目录的 `logo.png`
   - ⚠️ 素材**不要放在 `dist/` 目录**，该目录每次构建都会被清空
   - ⚠️ 图案要**铺满整个正方形**（四边不留透明边距），否则 macOS 会给图标加一圈白色底板，很难看；圆角交给系统自动裁剪即可
2. 一键生成所有平台图标：
   ```bash
   npx tauri icon logo.png -o backend/icons
   ```
3. 删除自动附带生成、但本项目（纯桌面版）用不上的手机图标文件夹：
   ```bash
   rm -rf backend/icons/ios backend/icons/android
   ```
4. 重新打包生效：
   ```bash
   npm run tauri:build
   ```
   > 若打包后图标没变化，是 macOS 的图标缓存，重启 Finder 或电脑即可。

**图标文件说明**（`backend/icons/`）:

| 文件 | 用途 |
|------|------|
| `icon.icns` | Mac 专用图标（.app 和 .dmg 使用） |
| `icon.ico` | Windows 专用图标（.exe 使用） |
| `32x32.png` / `128x128.png` / `128x128@2x.png` / `64x64.png` | 各尺寸 PNG，被 `backend/tauri.conf.json` 的 `icon` 字段引用 |
| `Square*Logo.png` / `StoreLogo.png` | Windows 应用商店上架才需要，当前未使用，生成时附带更新 |
| `icon.png` | 512×512 源图备份 |

**网页版 Favicon**（`public/` 下，`index.html` 引用）:
- 换 Logo 后需同步更新：用 **ffmpeg lanczos** 从 `logo.png` 重采样生成（`sips` 的缩放会让边缘发白发虚，勿用）：
  ```bash
  for s in 16 32 48 192; do ffmpeg -hide_banner -loglevel error -i logo.png -vf "scale=${s}:${s}:flags=lanczos" -y public/favicon-${s}x${s}.png; done
  ffmpeg -hide_banner -loglevel error -i logo.png -vf "scale=180:180:flags=lanczos" -y public/apple-touch-icon.png
  ```
- 旧 `favicon.svg`（模板遗留的紫色闪电）已删除，勿再引用。
- **换 Logo 完整流程**：① 替换根目录 `logo.png`（1024×1024）→ ② 桌面图标：`npx tauri icon logo.png -o backend/icons`（记得删 ios/android 文件夹）→ ③ 网页 favicon：执行上方 ffmpeg 命令 → ④ 重新构建。
- ⚠️ logo 设计要点（2026-08-10 落实）：**四角必须留透明**（不要白色实底，否则网页小尺寸四角现白边）；**内容铺满画布**（四周少留白，否则网页 favicon 会显得小）。当前 `logo.png` 已是透明四角 + 内容铺满（99.7%×97.2%）版，桌面图标与网页 favicon 均从它生成。
- ℹ️ **macOS 图标"留白"是系统行为，非 bug**（2026-08-10 定位）：Finder/Dock 显示任何 `.app` 图标时，macOS 会把图标内容统一缩到约 80% 并居中，四周留约 10% 透明边距（所有 App 一致）。因此"内容铺满"的图标在 .app 里看起来也"小一点、四周有留白"，属正常。而 `npm run tauri:dev` 跑的是裸二进制（不在 .app 里），macOS 不做缩边，图标看起来"比正常大"。验证方式：`NSWorkspace.shared.icon(forFile:)` 渲染即 Finder 所见（内容 80.5%）。无需也无法修改，这是 macOS 对所有 App 的统一定制。

---

## 代码架构与数据流

### 路由结构（React Router v7）

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | `HomePage` | 记录列表 + 预算概览 + CSV导出 |
| `/stats` | `StatsPage` | 趋势折线图 + 分类饼图 + 分类排行 |
| `/categories` | `CategoryManager` | 分类增删改 + 默认模板 + 拖拽排序 |

所有页面共享 `Layout` 组件（顶部导航栏），通过 `BrowserRouter` 包裹。

### 数据访问模式

```
database.ts (SQLite CRUD)  ←── 所有页面/组件直接调用
       ↑
CategoryContext.tsx         ←── 拉取分类树，全局共享避免重复查库
       ↑
  各组件 (useCategories)
```

- **`database.ts`** — 唯一的数据访问层。所有 SQL 操作集中在此，以单例模式连接 SQLite（重连自动重试 2 次）。Rust 后端不维护任何表结构，schema 仅由前端 `database.ts` 中的 `CREATE TABLE IF NOT EXISTS` + 兼容性 `ALTER TABLE` 语句定义。
- **`CategoryContext.tsx`** — 将分类数据（树形结构）缓存为 React Context，全局只加载一次。提供增删改查 / 拖拽重排 / 默认模板等操作的封装方法，每次操作后自动 `refresh()` 保持同步。
- **各组件直接调用 `database.ts`** 的导出函数（如 `listExpenses`、`addExpense`、`getBudget`），不经过二次封装。

### 数据库表结构（SQLite，由 database.ts 维护）

| 表名 | 关键字段 | 说明 |
|------|---------|------|
| `expenses` | `id, amount, category_l1, category_l2, date, note, payment_method, created_at` | 消费记录 |
| `categories` | `id, name (UNIQUE), icon, sort_order` | 一级分类大类 |
| `subcategories` | `id, category_id (FK), name, is_default, sort_order, default_note, default_payment_method, default_amount` | 二级分类小类 |
| `budgets` | `id, month (UNIQUE), amount` | 月度预算 |

### 关键模式

- **本地日期处理**：所有日期操作通过 `dateUtils.ts` 进行，使用 `getFullYear / getMonth / getDate` 避免 `toISOString()` 的 UTC 时区偏移（凌晨 0-8 点时区 Bug，v2.0.0 修复）。
- **表单弹窗**：`ExpenseForm` 组件在记账/编辑时接收金额实时校验（正则），Esc 键关闭弹窗。编辑旧记录时不自动填充默认模板值。
- **CSV 导出**：`expensesToCSV()` 函数使用 BOM + 双引号转义，确保 Excel 正确识别中文字符。
- **拖拽排序**：`@dnd-kit` 实现分类管理页面的拖拽重排，`reorderCategories` / `reorderSubCategories` 批量写入 `sort_order`。
- **预算颜色**：Tailwind 主题色 `--color-primary: #6366f1`（正常）、`amber` 接近（≥80%）、`red` 超支。
- **时间范围联动**：首页通过 `dateUtils.getRangeDates` 计算起止日（本地日期），`database.ts` 的 `listExpenses(startDate/endDate)` / `getDailyTotals` / `getStatsByRange` 按范围查询聚合，蓝色卡 / 列表 / 右栏图 / 排行随之联动。顶部趋势图固定近 12 月不随范围切换。

### 常用命令

```bash
npm run dev            # 浏览器热更新开发
npm run tauri:dev      # 桌面窗口开发模式
npm run tauri:build    # 构建生产版本
npm run build          # 仅构建前端
npm run lint           # oxlint 代码检查
```

### 当前状态

- **测试**：无测试框架。
- **UI 主题**：Tailwind CSS v4（通过 `@tailwindcss/vite` 插件集成，无 tailwind.config.js，自定义色值在 `index.css` 的 `@theme` 块中定义）。
- **Lint**：使用 `oxlint`（替代 ESLint），配置文件 `.oxlintrc.json`。
