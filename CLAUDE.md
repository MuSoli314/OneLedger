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
- [x] 消费记录完整编辑弹窗（悬浮行编辑按钮，弹窗内日期/大类/小类等全部信息可改，日期录错无需删除重记）
- [x] 消费记录删除（带确认弹窗）
- [x] 二级分类选择（11 大类 + 50+ 小类）
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
│   │   ├── database.ts           # SQLite 数据库操作（schema 唯一维护处，桌面/网页自适应）
│   │   ├── webDb.ts              # 网页版数据层（sql.js + IndexedDB 持久化）
│   │   ├── lunarUtils.ts         # 农历 / 节气 / 节日 / 黄历工具（lunar-javascript）
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
│   │   ├── CategoryDragHandle.tsx   # 拖拽排序手柄（六点 grip）
│   │   ├── SortableCategoryRow.tsx  # 分类管理可拖拽大类行（标题/改名/图标选择/小类插槽）
│   │   ├── SortableSubCategoryRow.tsx # 分类管理可拖拽小类行（默认模板行内编辑，导出 EditField/SubEditForm）
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
├── README.md                     # 产品文档
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
>
> 2026-08-16 全面代码审查修复（第二次）：修复 `ExpenseList` 日期解析的 UTC 时区隐患（统一带
> `T00:00:00` 本地解析）、预算输入框 ±1000 误触发保存、每日小计/当日支付方式统计口径统一为
> 只算「计入支出」的记录、`listExpenses` 移除 10000 条默认上限、自定义小类保存竞态（去掉
> setTimeout）、分类管理默认金额负数校验；提交 `backend/Cargo.lock`（保证构建可复现）、删除遗留
> `public/icons.svg`、`index.html` 语言改 zh-CN、补全 `Cargo.toml` 元数据；同步更新 README.md 与
> 本文档中过期的目录结构 / 组件清单 / 路由表 / 分类表 / 数据库表结构。
>
> 2026-08-16（补充）：默认小类预设 —— 「餐饮饮食」的 🥚早餐/🍚午餐/🍜晚餐标记为默认小类
> （记账自动带出、参与「添加某天」）。新装库播种即生效；老库由 `database.ts` 迁移 v1 用
> SQLite `user_version` 一次性回填（置 1 后不再执行，用户手动取消的默认不会被改回）。
>
> 2026-08-17 首页布局改版（用户拍板）：新增统计模块（记账之前，固定当前自然月视角）——
> 近 12 月趋势图（原顶部趋势图搬入，占 2/3 宽）+ 本月概览卡（总支出 / 笔数 / 日均 / 单日最高，
> 含环比上月增减）/ 近 12 月分类 TOP5（占右列）；记账模块顶部原「近 12 月趋势图」位置改为
> 本月支出日历（每天格子显示支出金额）+ 右侧按天双线图（原右栏「当月支出」图搬入，右栏只留
> 分类排行）；点击日历某天联动下方记录列表只看当天（再点同一天或点「退出」取消，无记录时补
> 「+ 添加」快捷行）。新增组件 `StatsModule.tsx` / `MonthOverview.tsx` / `MonthCalendar.tsx`，
> 无数据库改动（复用 `getDailyTotals` / `getDailyTotalsByNonDaily` / `getStatsByRange` /
> `getTrendData`）。
>
> 2026-08-17（补充，用户反馈后调整）：统计内容改为**独立统计页**（导航「统计/记账/分类/设置」
> 第一位，路由 `/stats`，页面 `StatsPage.tsx`，原 `StatsModule.tsx` 并入后删除）；记账页不再
> 含统计内容；日历宽度改为占记账页顶部区域的 **2/5**（趋势图占 3/5）。
>
> 2026-08-17（补充二，用户反馈后调整）：① 记账页右侧按天折线图恢复「只是换位置」的行为——
> 标题显示当前时间范围标签、数据跟随范围选择器与记账列表联动（日历仍固定本月）；高度撑满与
> 日历卡片对齐。② 点击日历某天 = 时间范围「自定义」选中该天（整页联动），再点同一天回到本月。
> ③ 记账列表 / 蓝色概览卡所在左栏占 **3/5** 宽，右栏分类排行占 2/5。
>
> 2026-08-17（补充三，用户反馈后调整）：日历模块改为**可自选月份**（默认本月）——卡片头部
> 提供左右箭头前后翻月（跨年自动处理）+ 有记录月份下拉直接跳选 + 「回本月」快捷按钮；日历金额
> 按所选月份查询，其余联动（点某天=自定义选中该天、右侧折线图跟随范围选择器）不变。
>
> 2026-08-17（补充四，用户反馈后调整）：① 日历月份下拉去掉「（本月）」备注；② 日历选月份与
> 蓝色模块**双向联动**——日历选 X 月 = 蓝色模块切到「历史月份 X」（选本月 = 「本月」），反向
> 蓝色模块切整月范围（本月/历史/上月）时日历跟随；非整月范围（近一周/近一月/自定义）日历保持
> 不动。
>
> 2026-08-17（补充五，用户反馈后调整）：日历模块宽度收窄（顶部区域占比 2/5 → **3/8**，
> 折线图相应扩为 5/8）；日历日期格子改为**正方形**（`aspect-square`，宽高相等）。
>
> 2026-08-17（补充六，用户反馈后调整）：日历模块宽度再次收窄（顶部区域占比 3/8 → **1/3**，
> 折线图相应扩为 2/3）。
>
> 2026-08-17（补充七，日历热力色阶，用户拍板）：记账页顶部支出日历的日期格子改为按当日支出
> 金额显示**靛蓝色系深浅**（4 档，借鉴 GitHub 贡献热力图 / 金融 App 消费日历的做法），**按月
> 自动分档**（以当月最高单日支出为基准均分，哪天花最多永远最深）；今天用主题色圆形徽标、选中
> 格子用深色外圈高亮，热力背景不被覆盖（选中/今天状态叠加在色阶之上）。仅改 `MonthCalendar.tsx`，
> 无数据库改动。（补充七追加：格子下方原色阶图例「少→多/最深=单日最高」经用户确认取消；
> 日历改为**固定 6 行（42 格）**，前后不足的格子补上/下月日期（灰色小字、不可点击、不显示
> 金额），解决不同月份行数 4/5/6 行导致卡片高度跳动的问题——与 Google 日历 / iOS 日历做法一致。）
>
> 2026-08-18 记录完整编辑弹窗（用户反馈后新增）：原行内编辑改不了日期，录错只能删了重记。
> 现在记录行悬浮时在删除按钮**左侧**新增「编辑」按钮（本地未入库的临时行不显示），点击弹出
> **完整信息编辑弹窗**（新组件 `EditExpenseDialog.tsx`）：日期（日历常开，与「添加日期」弹窗
> 一致）、大类/小类（联动，切换大类时小类不在新大类则清空）、金额、支付方式、收支类型、
> 备注、日常/非日常全部可改，Esc/遮罩/取消关闭，保存校验与行内编辑一致（金额支持算式、不可
> 为负）。保存走 `updateExpense`（数据库本就支持改 date），改日期后自动展开目标日期分组让记录
> 直接可见。行内编辑保留不动（快速小改仍点格子），两个编辑入口并存（用户拍板）。
>
> 2026-08-18（补充，用户反馈后调整）：记账页顶部右侧按天折线图**高度调为原来的 2/3**（卡片
> 高度仍与日历对齐，图表下方 1/3 留白；移动端单列时图表保持 300px 不变）。仅改
> `MonthOverview.tsx`（图表与占位 div 按 flex 权重 1:0.5 分配剩余高度），无数据库改动。
>
> 2026-08-18（补充二，用户反馈后调整）：折线图下方原 1/3 留白改为**农历黄历面板**——干支年月日
> （如「丙午马年 丙申月 戊午日」）+ 宜 / 忌列表（老黄历事项）。**鼠标悬停日历某天即时显示该天
> 黄历**，点击选中某天也显示，默认显示今天；宜红字 / 忌灰字，副标题带公历日期与农历月日。
> 改动：`lunarUtils.ts` 新增 `getDayLunarInfo`（缓存）、`lunar-javascript.d.ts` 补声明、
> `MonthCalendar.tsx` 新增 `onHoverDay` 悬停回调、`MonthOverview.tsx` 下方 1/3 改为黄历面板，
> 无数据库改动。
>
> 2026-08-18（补充三，用户反馈后调整）：黄历不再和折线图共用一张卡 —— 记账页右侧改为**上下两张
> 独立卡片**：上面折线图卡（图表高 200px ≈ 原来高度的 2/3），下面独立**农历黄历卡**（淡黄底色
> + 边框，与折线图明显区分；内容垂直居中，flex-1 撑满剩余高度与日历对齐）。仅改
> `MonthOverview.tsx`，无数据库改动。
>
> 2026-08-18（补充四，用户反馈后调整）：农历黄历卡**字号整体调大** —— 干支年月日由 14px 提到
> 16px 加粗、宜/忌事项由 11px 提到 14px、公历/农历副标题 11px → 12px，行距同步放宽。仅改
> `MonthOverview.tsx`。
>
> 2026-08-18（补充五，用户反馈后调整）：农历黄历卡 **UI 美化** —— 顶部新增「📜 黄历」胶囊标签
> （左）+ 公历/农历日期（右）；干支年月日改为**居中主标题**（字距加宽）；宜/忌改为**红/灰徽标行**
> （红底红字「宜」/ 灰底灰字「忌」圆角小方块 + 事项），事项改用「、」分隔，宜/忌区与干支区之间
> 加淡黄分隔线；卡片底色改为淡黄到浅黄渐变。仅改 `MonthOverview.tsx`，无数据库改动。
>
> 2026-08-18（补充六，用户反馈后调整）：黄历卡**整体压矮** —— 去掉顶部「📜 黄历」标签行与
> 分隔线，干支年月日改为**第一行居中**（公历/农历日期小字居中放其下方一行），宜/忌徽标缩小
> （w-6 h-6）行距收紧。仅改 `MonthOverview.tsx`，无数据库改动。
>
> 2026-08-18（补充七，用户反馈后调整）：黄历卡**第一行三区布局** —— 第一行改为「📜 黄历」标签
> （左）+ 干支年月日（中，居中）+ 公历/农历日期（右，如 8月16日 · 今天 · 农历七月初四）单行排列，
> 不再单独占行，下方宜/忌徽标行不变，卡片保持紧凑。仅改 `MonthOverview.tsx`，无数据库改动。
>
> 2026-08-18（补充八）：黄历卡抽成独立组件 `LunarCard.tsx` —— 悬停状态（hoverDay）内置在卡片
> 内部，日历悬停事件经父组件持有的 `hoverBridge` ref 跨列直达卡片内部 setter，悬停日历只重渲染
> 这张卡，右侧折线图不再被悬停触发重渲染/重放动画。`MonthOverview.tsx` 相应瘦身。
>
> 2026-08-18（补充九，用户反馈后调整）：宜/忌事项**固定一行展示** —— 超出部分省略号截断（不再
> 换行导致卡片高度自适应变化），鼠标悬浮该行显示完整事项列表（原生 title 提示气泡）。仅改
> `LunarCard.tsx`，无数据库改动。
>
> 2026-08-18（补充十，用户反馈后调整）：原生 title 提示在 Tauri WebView（WKWebView）里不显示，
> 改为**自定义悬浮气泡** —— `LunarCard.tsx` 新增内部 `YiJiRow` 行组件：用 ResizeObserver 检测
> 该行文字是否真的被截断，仅截断时渲染深色提示气泡（group-hover 显示完整事项列表，pointer-events
> 不挡鼠标）；文字放得下时不弹气泡。仅改 `LunarCard.tsx`，无数据库改动。
>
> 2026-08-18（补充十一，用户拍板：每模块不同浅色）：记账页每个子模块卡左上角加**「图标 + 名称」
> 胶囊标题**（与黄历卡「📜 黄历」同款样式，各模块不同浅色以便区分）—— 📅 支出日历（淡靛蓝，
> 月份导航前）/ 📈 按天趋势（淡蓝，范围标题前）/ 💰 概览（蓝色渐变卡上白底胶囊）/ 📝 消费记录
> （淡绿，与搜索框同一行）/ 🏆 分类排行（淡紫，替换原纯文字标题）。黄历卡保持原样。改动：
> `MonthOverview.tsx`、`HomePage.tsx`、`StatsPanel.tsx`，无数据库改动。
>
> 2026-08-18（补充十二，用户反馈后调整）：去掉支出日历卡右上角提示「点击某天 = 查看当天」
> （日历顶部只留月份导航 + 📅 支出日历标题）。仅改 `MonthOverview.tsx`，无数据库改动。
>
> 2026-08-18（补充十三，用户反馈后调整）：记账页列表模块胶囊标题由「📝 消费记录」改为
> 「📝 记账列表」。仅改 `HomePage.tsx`，无数据库改动。
>
> 2026-08-18（补充十四，用户反馈后调整）：顶部趋势图模块胶囊标题由「📈 按天趋势」改为
> 「📈 支出趋势」。仅改 `MonthOverview.tsx`，无数据库改动。
>
> 2026-08-18（补充十五，用户反馈后调整）：全部 6 个模块胶囊标题字号由 text-xs（12px）统一提到
> text-sm（14px），保证标题不小于正文。改动：`MonthOverview.tsx`、`HomePage.tsx`、`StatsPanel.tsx`、
> `LunarCard.tsx`，无数据库改动。
>
> 2026-08-18（补充十六，用户反馈后调整）：概览卡里的**日常 / 非日常 可点击筛选**（与下方支付方式
> 筛选行为一致）—— 点击「日常」列表只显示日常记录、点击「非日常」只显示非日常记录，再点取消；
> 选中态白底主题色字、未选中半透明、另一个筛选生效时对方置灰；可与支付方式/分类筛选叠加；纳入
> 「清除筛选」。筛选状态提升到 `HomeFilterContext`（`dailyFilter`），切页保留。改动：
> `HomeFilterContext.tsx`、`HomePage.tsx`，无数据库改动。
>
> 2026-08-18（补充十七，用户反馈后调整）：记账列表标题行右侧新增**「快捷添加」开关**（滑动开关
> 样式，默认开）—— 关闭后隐藏列表里缺失日期的「+ 添加」快捷行（含「+ 更多（N 天）」折叠行），
> 列表更干净易读；开启恢复。状态在 `HomeFilterContext`（`showQuickAdd`），切页保留。改动：
> `HomeFilterContext.tsx`、`HomePage.tsx`，无数据库改动。
>
> 2026-08-18 前后端命名与工程规范化（用户拍板，纯重构无功能变化）：① Rust crate 改名
> `app` → `one-ledger`（库 `one_ledger_lib`，`Cargo.toml` + `main.rs`，桌面安装包名不受影响）；
> ② `Expense`/`ExpenseInput` 字段 `isNonDaily` → `is_non_daily`（与数据库列名完全一致，
> 消除同接口内 camel/snake 混用；`defaultIsNonDaily` 属 UI 包装类型不变）；
> ③ 分类管理页 `CategoryManager.tsx` → `CategoryPage.tsx`（页面统一 `*Page` 命名）；
> ④ 新增 `ARCHITECTURE.md`（架构/数据流/命名规范/表结构对照，开发者必读）；
> ⑤ README.md 对齐真实代码（目录结构/功能/版本历史/从零运行指南）；
> ⑥ `backend/gen/` 加入 `.gitignore`；⑦ `package.json` 加 `engines` + `typecheck` 脚本、
> `Cargo.toml` 补 `repository`；⑧ `.oxlintrc.json` 加 `allowExportNames`（Context hook 白名单），
> lint 恢复 0 警告。
>
> 2026-08-18 C1 配置类类型全量 snake_case（用户拍板，纯重构无功能变化）：把上一轮遗留的
> 4 个 UI 包装类型的 camelCase 字段全部改为 snake_case，命名规则从此**无例外** ——
> `SubCategoryChild`（`isDefault`→`is_default`、`defaultNote`→`default_note`、
> `defaultPaymentMethod`→`default_payment_method`、`defaultAmount`→`default_amount`、
> `defaultType`→`default_type`、`defaultIsNonDaily`→`default_is_non_daily`）、
> `CategoryWithChildren.isDefault`→`is_default`（`PaymentMethodConfig`/`TxTypeConfig` 字段
> 本就是单词无需改）；连带更新：`categories.ts` 种子标记、`database.ts` 映射与
> `updateSubCategoryDefaults`/toggle 参数、`CategoryContext.tsx` 接口与回调、
> `HomePage.tsx`「添加某天」、`ExpenseList.tsx` 默认小类取值、`CategoryPage.tsx` 编辑表单
> （含 `subEditForm` 表单字段与 `EditField`）；ARCHITECTURE.md §5 命名规范表同步更新
> （去掉 camelCase 例外，规则：数据字段一律 snake_case，函数/局部变量/React 状态名仍 camelCase）。
>
> 2026-08-18 C2 拆分大文件（用户拍板，纯搬运无功能变化）：`ExpenseList.tsx` 1318 行拆为
> 主组件 819 行 + `ExpenseRow.tsx`（单条记录行，含行内编辑与聚焦逻辑）、
> `ExpenseCategoryGroup.tsx`（按日分组内的大类分组）、`CategoryAddPopover.tsx`
> （「添加」按钮的大类+小类联动面板）、`PaymentMethodTotals.tsx`（支付方式统计徽章，
> 顺带消除桌面/移动两段重复代码）、`expenseListTypes.ts`（LocalRow/EditField/EditForm 类型，
> `formatDate`/`getWeekday` 并入 `data/dateUtils.ts`）；`CategoryPage.tsx` 1039 行拆为
> 主组件 539 行 + `SortableCategoryRow.tsx`（可拖拽大类行）、`SortableSubCategoryRow.tsx`
> （可拖拽小类行，导出 EditField/SubEditForm）、`CategoryDragHandle.tsx`（拖拽手柄）；
> 全部为新文件纯剪切搬运，props 显式透传，无行为变化；ARCHITECTURE.md 组件清单同步更新。

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
| `/categories` | `CategoryPage` | 分类管理（增删改 + 默认模板 + 默认大类开关 + 拖拽排序） |
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
- **拖拽排序**：`@dnd-kit` 实现分类管理页面的拖拽重排，`reorderCategories` / `reorderSubCategories` 批量写入 `sort_order`。
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
