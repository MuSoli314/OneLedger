# 📒 一笔 · OneLedger

> 轻量级桌面记账应用 · 支持 Windows / Mac · 另有免费网页版

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一笔（OneLedger）是一款面向个人用户的消费记账软件，支持 **Windows** 和 **Mac** 双平台，同时也提供部署在浏览器里的**网页版**。应用体积小（约 13 MB）、启动快、操作直观，帮助用户轻松记录日常花销并掌握支出情况。

> 🧑‍💻 **开发者/接手项目的人**：先读 [ARCHITECTURE.md](ARCHITECTURE.md)（架构、命名规范、数据流、表结构），再回来对照本文档的功能说明。

---

## ✨ 功能一览

### 📝 消费记录管理
- **记一笔**：填写金额（支持算式，如 `5*2`）、二级分类、日期、备注、支付方式、收支类型
- **快捷添加**：列表为缺失日期补「+ 添加」快捷行（可一键关闭）；「添加某天」按勾选的默认大类自动生成默认小类记录
- **编辑**：鼠标悬停记录任意字段即可行内编辑（回车/点外部自动保存）；或点「✏️」打开**完整编辑弹窗**（日期也能改，录错无需删了重记）
- **删除**：删除前二次确认；支持删除单条 / 整天 / 当天某大类
- **查看**：记录按日期分组（默认折叠），每日小计只统计「计入支出」的记录
- **筛选**：时间范围（近一周/近一月/本月/上月/历史月份/自定义）+ 支付方式 + 分类（大类/小类勾选）+ 日常/非日常 + 搜索，可叠加

### 🏷️ 二级分类体系（11 大类 + 50+ 小类）
- 「分类管理」页**在线增删改**大类/小类、自定义图标（emoji 选择器）、**拖拽排序**
- 小类可设**默认模板**（金额/支付方式/收支类型/备注/日常非日常），记账时自动带出
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
│   │   ├── lunarUtils.ts         # 农历 / 节气 / 节日 / 黄历工具
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
│   │   ├── ExpenseList.tsx       # 消费记录列表（按日分组 + 行内编辑 + 快捷添加）
│   │   ├── EditExpenseDialog.tsx # 记录完整编辑弹窗（含日期）
│   │   ├── StatsPanel.tsx        # 右栏分类排行（勾选筛选）
│   │   ├── DatePicker.tsx        # 日期选择
│   │   ├── DateRangePicker.tsx   # 日期区间选择
│   │   ├── InlineSelect.tsx      # 行内下拉选择（WebView 兼容）
│   │   ├── EmojiPicker.tsx       # emoji 选择器
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
2. 提交并打标签：`git tag v2.0.0 && git push && git push origin v2.0.0`
3. 等约 10~20 分钟，GitHub Releases 页面自动出现 Mac / Windows 安装包

详细说明见 `.github/workflows/release.yml` 顶部注释。

---

## 📋 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-07-19 | 正式版：P0 记账 + P1 统计 + P2 图表/预算/导出 |
| v2.0.0 | 2026-07-22 | 全面代码审查修复版（时区修复、列表无上限、CSV 转义、schema 前端统一维护等） |
| v2.0.0+ | 2026-08 | 首页两栏仪表盘改版、独立统计页、支出日历 + 农历黄历卡、记录完整编辑弹窗、日常/非日常区分、分类管理/支付方式/收支类型设置页、桌面+网页双形态、缺失日期快捷添加、默认小类预设 |
| 2026-08（工程化） | — | 前后端命名统一（Rust crate `one-ledger`、`Expense.is_non_daily`、页面统一 `*Page` 命名）、新增 `ARCHITECTURE.md`、README 对齐真实代码、lint 0 警告 |

---

## 📄 许可

本项目为个人学习项目，基于 [MIT License](LICENSE) 开源。
