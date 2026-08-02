# 📒 一笔 · OneLedger

> 轻量级桌面记账应用 · 支持 Windows / Mac

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一笔（OneLedger）是一款面向个人用户的桌面消费记账软件，支持 **Windows** 和 **Mac** 双平台。应用体积小（约 13 MB）、启动快、操作直观，帮助用户轻松记录日常花销并掌握支出情况。

---

## ✨ 功能一览

### 📝 消费记录管理
- **记一笔**：填写金额、选择分类（两级）、选择日期、添加备注
- **编辑**：鼠标悬停可编辑任意记录
- **删除**：删除前二次确认，防止误操作
- **查看**：所有记录按日期分组，每日显示小计
- **筛选**：可按月份筛选查看历史记录

### 🏷️ 二级分类体系（11 大类 + 50+ 小类）

| 大类 | 小类示例 |
|------|---------|
| 🍜 餐饮饮食 | 早餐、午餐、晚餐、外卖、水果等 |
| 🚗 交通出行 | 公交地铁、网约车、加油、停车费等 |
| 🛒 购物消费 | 服饰鞋包、数码产品、家居用品等 |
| 🏠 住房居家 | 房租、水电燃气、物业费、维修等 |
| 🎮 娱乐休闲 | 电影演出、健身、游戏、旅游等 |
| 🏥 医疗健康 | 看病买药、体检、口腔护理等 |
| 📚 教育学习 | 书籍、培训、考试报名、文具等 |
| 🎁 人情社交 | 请客、红包、聚会聚餐等 |
| 📱 通讯网络 | 话费、宽带、会员订阅等 |
| 💰 金融保险 | 手续费、保险费、贷款利息等 |
| 📦 其他支出 | 快递物流、其他杂项 |

### 📊 统计与趋势
- **月度概览**：当月总支出、总笔数一目了然
- **分类排行榜**：查看各类支出排名，带进度条和百分比
- **支出趋势折线图**：过去 12 个月支出变化趋势
- **分类饼图**：当月各大类支出占比可视化

### 💰 预算管理
- 设置每月预算上限
- 实时进度条显示使用比例
- 接近预算（≥80%）时黄色提醒
- 超支时红色警告

### 📤 数据导出
- 一键导出全部消费记录为 CSV 格式
- 可用 Excel / WPS 直接打开

---

## 🚀 快速使用

### Mac 用户
构建完成后，直接打开以下文件即可运行：

```
src-tauri/target/release/bundle/macos/一笔.app
```

或双击 DMG 安装到应用程序文件夹：

```
src-tauri/target/release/bundle/dmg/一笔_1.0.0_aarch64.dmg
```

### Windows 用户
在 Windows 电脑上构建后，运行：

```
src-tauri/target/release/bundle/msi/一笔_1.0.0_x64.msi
```

### 数据存储
所有数据存储在本地 SQLite 数据库中，无需联网，隐私安全。

---

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 桌面外壳 | **Tauri v2**（Rust 后端） |
| 前端框架 | **React 19** + **TypeScript** |
| 样式方案 | **Tailwind CSS v4** |
| 数据存储 | **SQLite**（`tauri-plugin-sql`） |
| 图表库 | **Recharts** |
| 路由 | **React Router v7** |

---

## 📁 目录结构

```
OneLedger/
├── src/                          # 前端源码
│   ├── data/
│   │   ├── types.ts              # TypeScript 类型定义
│   │   ├── categories.ts         # 消费分类数据
│   │   └── database.ts           # SQLite 数据库操作
│   ├── components/
│   │   ├── Layout.tsx            # 应用布局 + 顶部导航
│   │   ├── ExpenseForm.tsx       # 添加/编辑表单弹窗
│   │   ├── ExpenseList.tsx       # 消费记录列表（按日分组）
│   │   ├── CategoryPicker.tsx    # 二级分类选择器
│   │   ├── BudgetSetup.tsx       # 预算设置弹窗
│   │   └── TrendChart.tsx        # 趋势图表（折线图 + 饼图）
│   └── pages/
│       ├── HomePage.tsx          # 首页：记录列表 + 预算概览
│       └── StatsPage.tsx         # 统计页：趋势 + 分类排行
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── lib.rs                # 数据库初始化 + 迁移
│   │   └── main.rs               # Rust 入口
│   └── tauri.conf.json           # Tauri 窗口/打包配置
├── index.html                    # 入口 HTML
└── package.json                  # 项目依赖
```

---

## 🔧 开发命令

```bash
# 安装依赖
npm install

# 浏览器开发模式（热更新预览）
npm run dev

# 桌面应用开发模式
npx tauri dev

# 构建生产版本
npx tauri build
```

### Windows 构建准备
在 Windows 电脑上构建前需要安装：
1. Microsoft Visual Studio C++ Build Tools
2. WebView2 Runtime（Win10 以上通常已内置）

---

## 📋 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-07-19 | 正式版：P0 记帐 + P1 统计 + P2 图表/预算/导出 |

---

## 📄 许可

本项目为个人学习项目。
