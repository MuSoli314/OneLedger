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

> 实际数据以 `frontend/data/categories.ts` 为准（小类名含 emoji 前缀，用户可在「分类管理」页在线增删改），下表为当前默认种子。
>
> **默认小类预设**（记账时自动带出、参与「添加某天」自动记账）：🍜 餐饮饮食的 **🥚早餐 / 🍚午餐 / 🍜晚餐**。
> 新装库播种即默认；老库由 `database.ts` 迁移 v1 用 SQLite `user_version` 一次性回填（置 1 后不再执行，用户在分类管理页手动取消的默认不会被改回）。

| 一级大类 | 二级小类 |
|---------|---------|
| 🍜 餐饮饮食 | 🥚早餐、🍚午餐、🍜晚餐、🧋奶茶、🍟零食、🥤饮料、🍎水果、🥡外卖、🍳买菜 |
| 🚗 交通出行 | 🚇地铁、🚌公交、🚕出租车、🚗网约车、🚄火车高铁、✈️飞机机票、⛽️加油、🔋充电、🅿️停车费 |
| 🛒 购物消费 | 👔服饰鞋包、📱数码产品、🪑家居用品、💄美妆护肤、🏬日用百货 |
| 🏠 住房居家 | 🚪房租、🏡房贷、🧹物业费、🚰水费、🔋电费、🧰维修保养 |
| 🎮 娱乐休闲 | 🎬电影、🎤演出、🏊运动健身、🎮游戏充值、⛱️旅游度假、🐈‍⬛宠物开销 |
| 🏥 医疗健康 | 🧑‍⚕️看病、💊买药、🩻体检、🦷口腔、👓眼镜 |
| 📚 教育学习 | 📖书籍资料、👩‍🏫培训课程、📃考试报名、✏️文具用品、🤖AI订阅 |
| 🎁 人情社交 | 🎁请客送礼、🧧红包礼金、🥳聚会聚餐 |
| 📱 通讯网络 | 📲手机话费、🛜宽带网络、🆙会员订阅 |
| 💰 金融保险 | 💲手续费、🧑‍💼保险费、🏦贷款利息 |
| 📦 其他支出 | 🚚快递物流、➕其他杂项 |

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
5. **文档持续更新**: 产品/技术决定记录在本文件（CLAUDE.md）；每次版本改动追加到 `CHANGELOG.md`，本文件不再堆变更流水账。

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
- [x] 消费记录完整编辑弹窗（悬浮行编辑按钮，弹窗内日期/大类/小类等全部信息可改，日期录错无需删除重记）
- [x] 消费记录删除（带确认弹窗）
- [x] 二级分类选择（11 大类 + 56 小类）
- [x] 按月份筛选查看
- [x] 数据持久化（SQLite 本地数据库）
- [x] 支付方式（支付宝/微信/银行卡/现金，可在设置页增删改）
- [x] 支付方式按日统计展示

### ✅ P1 统计功能（已完成）
- [x] 月度总支出 / 总笔数统计
- [x] 分类排行榜（带进度条）
- [x] 每日小计展示

### ✅ P2 功能（已完成）
- [x] 消费趋势图表（近 12 月月度折线图 + 当月按天双线图）
- [x] 预算设置与提醒（设置月度预算 + 进度条 + 超支/接近提醒）
- [x] 数据导出（CSV 格式）

### ✅ P2+ 功能（已完成）
- [x] 分类管理（在线新增/删除/修改分类与子分类）
- [x] 默认小类模板（标记默认小类，记账时自动填充）
- [x] 分类图标在线编辑（emoji 选择器）
- [x] 首页改版（两栏仪表盘布局 + 时间范围联动：近一周 / 近一月 / 本月 / 历史月份）
- [x] 独立统计页（导航「统计/记账/分类/设置」首位：近 12 月趋势 + 本月概览/环比上月 + 近 12 月分类 TOP5）+ 记账页顶部日历区（支出日历可自选月份默认本月、每天显示支出金额，点击某天 = 时间范围自定义选中该天，选月份与蓝色模块历史月份/本月联动；右侧按天双线图跟随范围选择器与列表联动，左栏概览卡/列表占 3/5 宽）
- [x] 按分类筛选（分类排行勾选大类/小类复选筛选记录列表，与支付方式筛选叠加生效）
- [x] 日常 / 非日常支出区分（小类默认标记 + 记录行内切换 + 当月支出图双线）
- [x] 默认大类开关（大类前勾选 ✓ = 参与「添加某天」自动记账；「添加某天」只按勾选的大类生成其默认小类记录，老库默认全勾选，行为不变）
- [x] 分类管理双栏（「我的分类」可编辑 + 「系统默认」只读列）：无论用户如何增删改，右侧始终展示 App 出厂内置的 11 大类 + 56 小类（数据直接读 `categories.ts` 种子清单，不查库、不受用户操作影响）；默认列每个大类/小类带「＋ 恢复」按钮，可一键按出厂种子配置加回「我的分类」（图标 / 默认小类标记 / 非日常标记 / 默认支付方式），大类已存在则置灰提示、小类已存在则不重复添加，恢复单个小类时若大类已被删会自动一并重建

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
│   │   ├── categories.ts         # 默认分类 / 支付方式 / 收支类型种子数据
│   │   ├── dateUtils.ts          # 本地日期工具（避免 UTC 时区问题）
│   │   ├── calcUtils.ts          # 金额表达式解析（+ - * / 与括号，递归下降，无 eval）
│   │   ├── reorderUtils.ts       # 拖拽重排通用工具（按 id 列表重排数组，乐观更新用，纯函数）
│   │   ├── database.ts           # SQLite 数据库操作（schema 唯一维护处，桌面/网页自适应）
│   │   ├── webDb.ts              # 网页版数据层（sql.js + IndexedDB 持久化）
│   │   ├── lunarUtils.ts         # 农历 / 节气 / 节日 / 黄历工具（lunar-javascript）
│   │   ├── lunar-javascript.d.ts # lunar-javascript 缺失类型声明补充
│   │   └── emojis.ts             # emoji 候选列表
│   ├── contexts/
│   │   ├── CategoryContext.tsx   # 分类数据共享 Context
│   │   ├── SettingsContext.tsx   # 支付方式 / 收支类型配置 Context
│   │   └── HomeFilterContext.tsx # 首页筛选状态（切页保留）
│   ├── components/
│   │   ├── Layout.tsx            # 应用布局 + 顶部导航
│   │   ├── ExpenseList.tsx       # 记账列表主组件（日期分组 + 缺失日期快捷行 + 行内编辑状态 + 完整编辑弹窗入口）
│   │   ├── ExpenseRow.tsx        # 单条记录行（含行内编辑：小类/金额/支付方式/类型/备注/日常/删除）
│   │   ├── ExpenseCategoryGroup.tsx # 按日分组内的「一级大类」分组（标题 + 记录行 + 添加小类）
│   │   ├── CategoryAddPopover.tsx   # 「添加」按钮弹出的大类+小类联动选择面板（支持自定义）
│   │   ├── PaymentMethodTotals.tsx  # 每日支付方式统计徽章（桌面/移动两态复用）
│   │   ├── expenseListTypes.ts      # 记账列表专用类型（LocalRow/EditField/EditForm）
│   │   ├── DragHandle.tsx           # 拖拽排序手柄（六点 grip，触摸设备自动放大接触面积）
│   │   ├── sortableConfig.ts        # 拖拽排序统一配置（鼠标+触摸传感器/让位动画/垂直锁定/行样式）
│   │   ├── SortableCategoryRow.tsx  # 分类管理可拖拽大类行（标题/改名/图标选择/小类插槽）
│   │   ├── SortableSubCategoryRow.tsx # 分类管理可拖拽小类行（默认模板行内编辑，导出 EditField/SubEditForm）
│   │   ├── SystemDefaultCategories.tsx # 分类管理「系统默认」只读列（出厂种子分类 + 一键恢复到「我的分类」）
│   │   ├── EditExpenseDialog.tsx # 记录完整编辑弹窗（全部信息含日期可改）
│   │   ├── MonthOverview.tsx     # 记账页顶部（支出日历 1/3，日期为正方形格子、可自选月份默认本月 + 右侧上下两张独立卡片：按天双线图卡（高 200px）+ 农历黄历卡（干支年月日/宜/忌，悬停联动）；折线图跟随范围选择器）
│   │   ├── MonthCalendar.tsx     # 支出日历（每天格子显示支出金额，金额越高格子背景靛蓝色越深 = 按月自动分档热力图，点击某天 = 自定义选中该天，月份由外部控制）
│   │   ├── LunarCard.tsx         # 农历黄历卡（干支年月日/宜/忌，悬停联动，独立卡片）
│   │   ├── StatsPanel.tsx        # 右栏统计面板（分类排行）
│   │   ├── TrendChart.tsx        # 折线图（月度趋势 / 按天双线，Y 轴分段压缩）
│   │   ├── DatePicker.tsx        # 日期选择
│   │   ├── DateRangePicker.tsx   # 日期区间选择
│   │   ├── InlineSelect.tsx      # 行内下拉选择（portal，WebView 兼容）
│   │   ├── EmojiPicker.tsx       # emoji 选择器
│   │   └── ConfirmDialog.tsx     # 确认弹窗组件
│   └── pages/
│       ├── HomePage.tsx          # 记账页：日历区 + 两栏（左 3/5 概览卡/记录列表 + 右 2/5 分类排行）
│       ├── StatsPage.tsx         # 统计页（导航首位：近 12 月趋势 + 本月概览/环比 + 分类 TOP5）
│       ├── CategoryPage.tsx      # 分类管理页（增删改 + 默认模板 + 拖拽排序）
│       └── SettingsPage.tsx      # 设置页（支付方式 / 收支类型管理）
├── backend/                       # Rust 原生后端（Tauri）
│   ├── src/
│   ├── capabilities/             # 权限配置
│   └── tauri.conf.json           # Tauri 窗口/打包配置
├── public/                        # 网页版 favicon 等静态资源
├── index.html                    # 入口 HTML
├── logo.png                      # 应用图标源图（1024×1024，更换 Logo 见下方说明）
├── ARCHITECTURE.md               # 架构说明（开发者必读：命名规范 / 数据流 / 表结构）
├── README.md                     # 产品文档（面向用户的功能说明）
├── CHANGELOG.md                  # 版本变更记录（Keep a Changelog 格式，历史改动都在这里）
├── package.json                  # 项目依赖
└── .github/workflows/release.yml # 发版自动构建安装包（打标签触发）
```

**构建产物**:
- Mac .app: `backend/target/release/bundle/macos/OneLedger.app`（直接打开）
- Mac 安装包: `backend/target/release/bundle/dmg/OneLedger_<版本>_universal.dmg`
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

**当前版本**: v2.2.0（以 `backend/tauri.conf.json` 为准）

> 完整的历史版本与变更记录见 [CHANGELOG.md](CHANGELOG.md)（按版本倒序，最新排在最上面）；
> 本文件只保留产品设计、技术选型、目录结构与当前状态，不再堆积逐次改动记录。

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
| `/` | `HomePage` | 记账页：顶部日历区（日历 1/3，日期为正方形格子 + 按天图 2/3，折线图跟随范围）+ 两栏（左 3/5 概览卡/记录列表 + 右 2/5 分类排行 + 预算 + CSV 导出） |
| `/stats` | `StatsPage` | 统计页（导航首位「统计/记账/分类/设置」）：近 12 月趋势 + 本月概览/环比 + 分类 TOP5 |
| `/categories` | `CategoryPage` | 分类管理（两栏：「我的分类」增删改 + 默认模板 + 默认大类开关 + 拖拽排序；「系统默认」只读列 + 一键恢复） |
| `/settings` | `SettingsPage` | 设置（支付方式 / 收支类型管理） |

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
| `expenses` | `id, amount, category_l1, category_l2, date, note, payment_method, type, is_non_daily, created_at` | 消费记录（type 存收支类型 code；is_non_daily 0=日常 1=非日常） |
| `categories` | `id, name (UNIQUE), icon, sort_order, is_default` | 一级分类大类（is_default 控制是否参与「添加某天」自动记账） |
| `subcategories` | `id, category_id (FK), name, is_default, sort_order, default_note, default_payment_method, default_amount, default_type, default_is_non_daily` | 二级分类小类（default_* 为记账时的默认模板） |
| `budgets` | `id, month (UNIQUE), amount` | 月度预算 |
| `payment_methods` | `id, name (UNIQUE), icon, sort_order` | 支付方式配置（记录里存 name，改名时同步迁移历史记录） |
| `tx_types` | `id, code (UNIQUE), name, icon, category, sort_order` | 收支类型配置（记录里存 code，改名无需迁移；category ∈ expense/income/ignore） |

### 关键模式

- **本地日期处理**：所有日期操作通过 `dateUtils.ts` 进行，使用 `getFullYear / getMonth / getDate` 避免 `toISOString()` 的 UTC 时区偏移（凌晨 0-8 点时区 Bug，v2.0.0 修复）。注意：解析 `YYYY-MM-DD` 字符串必须带 `T00:00:00` 后缀按本地时间解析（`new Date('2026-07-01')` 会按 UTC 解析，西半球时区会错一天）。
- **行内编辑**：记录列表 / 分类管理 / 设置页均采用行内编辑（点格子进入、回车或点外部自动保存、Esc 关闭），金额统一用 `calcUtils.evaluateExpression` 校验（支持算式如 `5*2`，负数拦截，0 金额允许保存后标红提醒）。编辑旧记录时不自动填充默认模板值。记录行的完整编辑（含日期）走 `EditExpenseDialog.tsx` 弹窗（悬浮行编辑按钮进入），保存仍经 `updateExpense`。
- **统计口径**：所有「支出」统计（蓝色卡 / 分类排行 / 当月支出图 / 每日小计 / 支付方式统计）只统计收支类型为 `expense` 的记录；收入、不计类型不参与。口径统一由 `expenseCodes`（SettingsContext）或 SQL 中 `type IN (SELECT code FROM tx_types WHERE category='expense')` 保证。
- **CSV 导出**：`expensesToCSV()` 函数使用 BOM + 双引号转义，确保 Excel 正确识别中文字符。
- **拖拽排序**：`@dnd-kit` 统一实现（分类管理 + 设置页），配置集中在 `components/sortableConfig.ts`。四条铁律：
  1. **不用 `<DragOverlay>`**——让真实的行自己跟着指针移动，拖拽中的行与静止时样式完全一致；只在拖拽中提升 `zIndex`（不可见）以盖住相邻行。
  2. **乐观更新**——`reorderXxx` 必须**先同步 `setState` 改内存顺序、再后台落库**。dnd-kit 的落位动画在松手瞬间现测被拖节点位置作为动画终点，等数据库写完才更新界面会导致动画飞回旧位置（回影）。落库失败才 `refresh()` 回滚。
  3. **批量落库**——重排统一走 `database.ts` 的 `buildReorderSql()`（单条 `CASE WHEN` UPDATE 代替 N 次串行 UPDATE）。
  4. **鼠标与触摸分开设传感器**——统一的 `useSortableSensors()`：`MouseSensor` 移动 5px 即拖，`TouchSensor` 长按 250ms 才拖（移动超过 5px 取消）。这样手机上手指上下滑动页面是滚动、长按手柄 0.25 秒才进入拖拽排序。**不要用 `PointerSensor`**（它同时接管鼠标与触摸，无法给两者设不同约束，手指一碰就拖、页面滚不动）；手柄须带 `touch-action: manipulation`（`DragHandle.tsx` 已加），触摸事件下 dnd-kit 才能在 `touchmove` 里阻止页面滚动。
  当前使用方：`CategoryContext`（大类/小类）、`SettingsContext`（支付方式/收支类型）。
- **预算颜色**：Tailwind 主题色 `--color-primary: #6366f1`（正常）、`amber` 接近（≥80%）、`red` 超支。
- **时间范围联动**：记账页通过 `dateUtils.getRangeDates` 计算起止日（本地日期），`database.ts` 的 `listExpenses(startDate/endDate)` / `getDailyTotals` / `getStatsByRange` 按范围查询聚合，蓝色卡 / 列表 / 右栏排行 / 顶部折线图随之联动（折线图标题即范围标签）。日历可自选月份（默认本月，左右箭头微调 + 有记录月份下拉），选月份与蓝色模块双向联动：日历选 X 月 = 蓝色模块切到「历史月份 X」，选本月 = 「本月」；反向蓝色模块切整月范围（本月/历史/上月）时日历跟随。点击日历某天 = 时间范围设为「自定义」且起止都是该天（再点同一天回到本月）。独立统计页固定当前自然月，不随记账页范围切换。

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
