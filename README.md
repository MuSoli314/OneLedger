# 📒 一笔 · OneLedger

> 轻量级桌面记账应用 · 支持 Windows / Mac · 另有免费网页版

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一笔（OneLedger）是一款面向个人用户的消费记账软件，支持 **Windows** 和 **Mac** 双平台，同时也提供部署在浏览器里的**网页版**。应用体积小（约 13 MB）、启动快、操作直观，帮助用户轻松记录日常花销并掌握支出情况。

> 🧑‍💻 **开发者/接手项目的人**：先读 [ARCHITECTURE.md](ARCHITECTURE.md)（架构、命名规范、数据流、表结构），再回来对照本文档的功能说明；每个版本的改动记录在 [CHANGELOG.md](CHANGELOG.md)。

---

## ✨ 功能一览

### 📝 消费记录管理
- **记一笔**：填写金额（支持算式，如 `5*2`）、二级分类、日期、备注、支付方式、收支类型
- **快捷添加**：列表为缺失日期补「+ 添加」快捷行（可一键关闭）；「添加某天」按勾选的默认大类自动生成默认小类记录
- **编辑**：鼠标悬停记录任意字段即可行内编辑（回车/点外部自动保存）；或点「✏️」打开**完整编辑弹窗**（日期也能改，录错无需删了重记）
- **删除**：删除前二次确认；支持删除单条 / 整天 / 当天某大类
- **查看**：记录按日期分组（默认折叠），每日小计只统计「计入支出」的记录
- **筛选**：时间范围（近一周/近一月/本月/上月/历史月份/自定义）+ 支付方式 + 分类（大类/小类勾选）+ 日常/非日常 + 搜索，可叠加

### 🏷️ 二级分类体系（11 大类 + 56 小类）
- 「分类管理」页**在线增删改**大类/小类、自定义图标（emoji 选择器）、**拖拽排序**
- 小类可设**默认模板**（支付方式/收支类型/备注/日常非日常），记账时自动带出
- **条件规则**（2026-10-24 新增）：小类的**金额**改由「规则」决定——一个可以配**多条**规则，每条 = 启用勾选 + 条件 + 金额，从上往下匹配、**命中第一条即用**。条件支持：**总是**（不设条件 = 兜底）/ 工作日 / 休息日 / 每周星期几（多选）/ 每月第几天（多选）/ 每年某月某日；同一类条件多选算「或」（周一和周三一条规则就够），不同类条件叠加算「且」。
  - 例：地铁配一条「工作日 -¥12」→ 上班日自动记 12 元、周末和法定假日不记；房租配一条「每月 1 号 -¥1800」→ 只有 1 号自动记。
  - 点小类行最左侧的 `>` 展开规则区：☑ 可临时停用某条规则（不用删）、点条件标签改条件、点金额改金额、拖 ⠿ 调优先级、✕ 删除。规则区为空 = 这个小类不会被自动记账。
  - 「添加某天」/ 点「+ 大类」只给**这天有规则命中**的小类自动记；一条都没命中就不生成。手动点某个小类时即使没命中也会给一行（金额 0，等你填）。
  - 老版本升级会自动把原来的默认金额变成一条「总是」规则，**升级后行为不变**，想按条件记再改。
- **节假日数据**：工作日 / 休息日判断会自动联网更新（数据源 holiday-cn，每天自动抓国务院公告）；首次安装已内置 2001 年至今的数据，**离线也能判断**；当年数据缺失时退回「周一~周五」。分类管理页顶部会显示「节假日数据：已更新至 X 年」和「立即更新」按钮。
- **默认大类开关**：勾选 ✓ 的大类才参与「添加某天」自动记账
- 内置默认小类：🍜 餐饮饮食的早餐 / 午餐 / 晚餐（新装即默认）
- 记账时也能现场自定义大类/小类

### 📊 统计与趋势（独立统计页）
- **近 12 月支出趋势**折线图（可按大类筛选）
- **本月概览**：总支出 / 笔数 / 日均 / 单日最高 + 环比上月增减
- **近 12 月分类 TOP5** 排行

### 📅 支出日历 + 农历黄历（记账页顶部）
- **支出日历**：每天格子显示支出金额（靛蓝色系深浅按当月自动分档，花得越多越深）；可自选月份，点击某天 = 整页联动查看当天
- **农历黄历卡**：干支年月日 + 宜/忌，鼠标悬停日历某天即时显示该天黄历

### 🔒 日期锁与「当天无消费」
- **确认无误就上锁**：某天记完账点一下锁图标即锁定，锁定后完全只读（不能增、改、删），要先解锁才能动
- **锁住的空白天 = 当天无消费**：不新增任何"无消费"记录，锁定 + 没有记录就自动显示为一行「当天无消费」
- **删光某天记录 = 自动标记当天无消费**：删掉某天最后一条记录（或最后一个大类的全部记录）后，这天会自动上锁、就地显示为「当天无消费」，不用再手动找锁图标；想补记点 🔒 解锁即可（数据可逆）
- **月锁 / 日锁两层**：日历右上角可一键锁整月（整月只读），也可逐天锁；两者互不干扰，解锁整月不会影响之前单独锁过的天
- **锁定点一下就生效**：锁定/解锁都没有确认弹窗，点错了再点一下即可，数据可逆
- 锁定只影响"能不能写"，统计 / 图表 / 导出照常包含锁定日期的数据

### 🏷️ 日常 / 非日常支出
- 固定开销（房租、水电、保险等）标记为「非日常」，行内一键切换
- 按天双线图区分：全天虚线 + 日常实线（聚焦可控的日常支出），Y 轴分段压缩

### 💰 预算管理
- 设置每月预算上限（原生上下箭头 ±1000 步进，回车/失焦保存）
- 实时进度条：接近预算（≥80%）黄色提醒，超支红色警告

### 📤 数据导出
- 一键导出全部消费记录为 CSV（含收支类型、是否非日常列），Excel / WPS 直接打开（已处理 BOM 与转义）

### 🌐 双形态：桌面版 + 网页版
- 同一套前端代码，桌面版（Tauri）与网页版（浏览器内 SQLite）按环境自动切换数据层
- 网页版数据存在**各用户自己的浏览器**（IndexedDB），不经过服务器，隐私最好
- 网页版部署与注意事项见 [WEB_DEPLOY.md](WEB_DEPLOY.md)

---

## 🚀 快速使用

### Mac 用户
构建完成后，直接打开以下文件即可运行：

```
backend/target/release/bundle/macos/OneLedger.app
```

或双击 DMG 安装到应用程序文件夹：

```
backend/target/release/bundle/dmg/OneLedger_<版本>_universal.dmg
```

### Windows 用户
在 Windows 电脑上构建后，运行：

```
backend/target/release/bundle/msi/OneLedger_<版本>_x64.msi
```

> 也可以从 GitHub Releases 页面直接下载官方构建的安装包（无需自己构建）。

### 数据存储
所有数据存储在本地 SQLite 数据库中，无需联网，隐私安全。

---

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 桌面外壳 | **Tauri v2**（Rust 后端，crate `one-ledger`） |
| 前端框架 | **React 19** + **TypeScript** |
| 样式方案 | **Tailwind CSS v4** |
| 数据存储 | **SQLite**（桌面：`tauri-plugin-sql`；网页：`sql.js` + IndexedDB） |
| 图表库 | **Recharts** |
| 路由 | **React Router v7** |
| 拖拽排序 | **@dnd-kit** |
| 日期选择 | **@daypicker/react** |
| 农历 | **lunar-javascript** |

---

## 📁 目录结构

```
OneLedger/
├── frontend/                     # 前端代码（React + TypeScript，全部业务逻辑）
│   ├── data/
│   │   ├── types.ts              # TS 类型定义（与数据库字段同名）
│   │   ├── categories.ts         # 默认分类 / 支付方式 / 收支类型种子数据
│   │   ├── database.ts           # ⭐ SQLite 操作（schema 唯一维护处，桌面/网页自适应）
│   │   ├── webDb.ts              # 网页版数据层（sql.js + IndexedDB）
│   │   ├── dateUtils.ts          # 本地日期工具（避免 UTC 时区问题）
│   │   ├── calcUtils.ts          # 金额表达式解析（+ - * / 与括号，无 eval）
│   │   ├── reorderUtils.ts       # 拖拽重排通用工具（乐观更新用）
│   │   ├── lunarUtils.ts         # 农历 / 节气 / 节日 / 黄历工具
│   │   ├── lunar-javascript.d.ts # lunar-javascript 缺失类型声明补充
│   │   └── emojis.ts             # emoji 候选列表
│   ├── contexts/
│   │   ├── CategoryContext.tsx   # 分类数据共享 Context
│   │   ├── SettingsContext.tsx   # 支付方式 / 收支类型配置 Context
│   │   └── HomeFilterContext.tsx # 首页筛选状态（切页保留）
│   ├── components/
│   │   ├── Layout.tsx            # 应用布局 + 顶部导航
│   │   ├── MonthOverview.tsx     # 记账页顶部：支出日历 + 黄历卡 + 按天趋势图
│   │   ├── MonthCalendar.tsx     # 支出日历（42 格热力日历）
│   │   ├── LunarCard.tsx         # 农历黄历卡（宜/忌）
│   │   ├── TrendChart.tsx        # 折线图（月度趋势 / 按天双线）
│   │   ├── ExpenseList.tsx       # 消费记录列表主组件（按日分组 + 行内编辑 + 快捷添加）
│   │   ├── ExpenseRow.tsx        # 单条记录行（行内编辑 + 非日常徽章 + 悬浮编辑/删除）
│   │   ├── ExpenseCategoryGroup.tsx # 按日分组内的一级大类分组
│   │   ├── CategoryAddPopover.tsx   # 「添加」按钮的大类+小类联动面板
│   │   ├── PaymentMethodTotals.tsx  # 每日支付方式统计徽章
│   │   ├── expenseListTypes.ts      # 记账列表专用类型（LocalRow/EditField/EditForm）
│   │   ├── EditExpenseDialog.tsx # 记录完整编辑弹窗（含日期）
│   │   ├── DragHandle.tsx           # 拖拽排序手柄（两页共用，触摸设备自动放大）
│   │   ├── sortableConfig.ts        # 拖拽排序统一配置（传感器/动画/垂直锁定/行样式）
│   │   ├── SortableCategoryRow.tsx  # 分类管理可拖拽大类行
│   │   ├── SortableSubCategoryRow.tsx # 分类管理可拖拽小类行（默认模板行内编辑）
│   │   ├── SystemDefaultCategories.tsx # 分类管理「系统默认」只读列（一键恢复出厂分类）
│   │   ├── StatsPanel.tsx        # 右栏分类排行（勾选筛选）
│   │   ├── DatePicker.tsx        # 日期选择
│   │   ├── DateRangePicker.tsx   # 日期区间选择
│   │   ├── InlineSelect.tsx      # 行内下拉选择（WebView 兼容）
│   │   ├── EmojiPicker.tsx       # emoji 选择器
│   │   ├── HoverTip.tsx          # 即时悬浮提示气泡（替代有延迟的原生 title）
│   │   └── ConfirmDialog.tsx     # 确认弹窗
│   └── pages/
│       ├── HomePage.tsx          # 记账页（/）
│       ├── StatsPage.tsx         # 统计页（/stats）
│       ├── CategoryPage.tsx      # 分类管理（/categories）
│       └── SettingsPage.tsx      # 设置（/settings）
├── backend/                      # Rust 原生后端（Tauri 壳，不维护业务逻辑）
│   ├── src/
│   ├── capabilities/             # 权限配置
│   └── tauri.conf.json           # Tauri 窗口/打包配置
├── public/                       # 网页版 favicon 等静态资源
├── index.html                    # 入口 HTML
├── logo.png                      # 应用图标源图（1024×1024）
├── ARCHITECTURE.md               # ⭐ 架构说明（开发者必读：命名规范 / 数据流 / 表结构）
├── README.md                     # 产品文档（本文档）
├── CHANGELOG.md                  # ⭐ 版本变更记录（Keep a Changelog 格式）
├── package.json                  # 项目依赖
└── .github/workflows/release.yml # 发版自动构建安装包（打标签触发）
```

**构建产物**：
- Mac .app: `backend/target/release/bundle/macos/OneLedger.app`（直接打开）
- Mac 安装包: `backend/target/release/bundle/dmg/OneLedger_<版本>_universal.dmg`
- Windows .exe: 在 Windows 电脑上运行 `npm run tauri:build` 生成（也可用 GitHub Releases 自动构建）

---

## 🔧 开发（从零开始）

### 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | `^20.19.0` 或 `>=22.12.0` | 前端构建（见 `package.json` 的 `engines`） |
| Rust | stable | 仅桌面版需要（网页版开发不需要） |

Windows 构建桌面版还需：Microsoft Visual Studio C++ Build Tools、WebView2 Runtime（Win10 以上通常已内置）。

### 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 网页版开发模式（浏览器热更新预览）
npm run tauri:dev    # 桌面应用开发模式
npm run typecheck    # TypeScript 类型检查
npm run lint         # oxlint 代码检查
npm run build        # 构建生产版本（前端）
npm run tauri:build  # 构建桌面安装包
```

---

## 🚢 发版流程（GitHub 自动构建安装包）

1. 修改版本号：`backend/tauri.conf.json` 的 `version` 字段（建议同步 `backend/Cargo.toml`）
2. 在 [CHANGELOG.md](CHANGELOG.md) 里把「未发布」一节改成新版本号 + 日期
3. 提交并打标签：`git tag v2.1.0 && git push && git push origin v2.1.0`
4. 等约 10~20 分钟，GitHub Releases 页面自动出现 Mac / Windows 安装包

详细说明见 `.github/workflows/release.yml` 顶部注释。

---

## 📋 版本历史

完整变更记录见 **[CHANGELOG.md](CHANGELOG.md)**（按版本倒序，最新排在最上面）。已发布版本一览：

| 版本 | 日期 | 说明 |
|------|------|------|
| 未发布 | 2026-10-24 | 小类默认值升级为**条件规则**（启用勾选 + 条件 + 金额，多选、可叠加、拖拽调优先级；工作日/休息日/每周/每月/每年）；小类主行去掉「金额」格改为 `>` 展开规则区；「添加某天」只给有规则命中的小类记账；老库一次性迁移自动生成「总是」规则保持行为不变；新增节假日数据（内置导入 + 联网更新 + 状态行），「工作日/休息日」条件据此判断 |
| v2.3.0 | 2026-10-09 | 日期锁（日锁 + 月锁）与「当天无消费」确认：锁定后完全只读、锁住的空白天自动显示为「当天无消费」；两层锁属性独立互不修改、锁定/解锁点一下即生效无确认弹窗；连续无消费日期与未记账快捷行各自折叠；新增即时悬浮提示组件 `HoverTip`；支出日历移除「回本月」按钮 |
| v2.2.0 | 2026-10-08 | 分类管理双栏（我的分类 + 系统默认只读列，可一键恢复出厂分类）；拖拽排序全线修复（回影、拖拽中变样）并统一到一份配置（`sortableConfig.ts`，含垂直锁定与乐观更新）；拖拽排序支持触摸（长按 0.25 秒触发，为手机版铺路） |
| v2.1.0 | 2026-08-16 | 首页两栏仪表盘、独立统计页、支出日历 + 农历黄历卡、记录完整编辑弹窗、日常/非日常区分、设置页、桌面+网页双形态、默认小类预设；前后端命名与工程规范化重构（Rust crate `one-ledger`、字段全 snake_case、拆分大文件、新增 `ARCHITECTURE.md`） |
| v2.0.0 | 2026-07-22 | 全面代码审查修复版（时区修复、列表无上限、CSV 转义、schema 前端统一维护等） |
| v1.0.0 | 2026-07-19 | 正式版：P0 记账 + P1 统计 + P2 图表/预算/导出 |

---

## 📄 许可

本项目为个人学习项目，基于 [MIT License](LICENSE) 开源。
