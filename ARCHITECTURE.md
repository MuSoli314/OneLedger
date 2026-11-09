# 🏗 架构说明（开发者必读）

> 本文档面向**接手项目的人**：先读这一份，再读 [README.md](README.md)（产品视角）。
> 读完本文档，你应该能回答：代码放哪、数据怎么流、命名什么规矩、改一处要动几个文件。
>
> 🤖 **AI 开工请先读根 [AGENTS.md](AGENTS.md)**（分层 AI 指导总纲 + 目录导航）。本文件是给人看的架构总览，两个目录层级的 `AGENTS.md` 是给 AI 的就近说明，内容应保持一致。

---

## 1. 项目形态：一套前端，两种外壳

```
┌────────────────────────────────────────────────┐
│             前端（React + TypeScript）          │
│        同一份代码，运行时按环境切换数据层         │
│  ┌──────────────────────┐  ┌────────────────┐  │
│  │ 桌面版（Tauri 窗口）  │  │ 网页版（浏览器）│  │
│  │ tauri-plugin-sql     │  │ sql.js +       │  │
│  │ 本地 one_ledger.db   │  │ IndexedDB 持久化│  │
│  └──────────────────────┘  └────────────────┘  │
└────────────────────────────────────────────────┘
```

- **桌面版**：`backend/`（Rust/Tauri 壳）+ 前端。数据库是本地 SQLite 文件。
- **网页版**：只有前端，部署到 Vercel 等静态托管。数据库在**浏览器内**（sql.js 模拟 SQLite，数据写入 IndexedDB）。
- 两份数据互不相通（本地文件 vs 浏览器）。
- 判断当前环境：`webDb.ts` 的 `isTauri()`（检测 `__TAURI_INTERNALS__` 全局对象）。

---

## 2. 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 桌面壳 | **Tauri v2** + Rust（crate `one-ledger`，库 `one_ledger_lib`） | 只负责开窗口 + 提供 SQL 插件，**不碰业务逻辑** |
| 界面 | **React 19 + TypeScript**（`frontend/`） | 全部业务代码 |
| 样式 | **Tailwind CSS v4**（`index.css` 的 `@theme` 定义主题色） | 无 tailwind.config.js |
| 路由 | **React Router v7**（`App.tsx`） | 4 个页面 |
| 图表 | **Recharts**（`TrendChart.tsx`） | 折线图 |
| 拖拽 | **@dnd-kit** | 分类/支付方式/收支类型排序 |
| 日期 | **@daypicker/react** + **date-fns** | 日历选择 |
| 农历 | **lunar-javascript**（`lunarUtils.ts`） | 日历小字 + 黄历卡 |

---

## 3. 目录结构与职责

```
frontend/
├── data/                  # 「数据层」：类型、种子、SQL、工具（不依赖 React）
│   ├── types.ts           #   TS 类型 + 内置收支类型代号
│   ├── categories.ts      #   默认分类 / 支付方式 / 收支类型种子 + 非日常预设名单
│   ├── database.ts        #   ⭐ 唯一 SQL 层：建表(schema 唯一维护处) + 全部 CRUD/统计
│   ├── webDb.ts           #   网页版数据层：sql.js + IndexedDB + isTauri() 判定
│   ├── dateUtils.ts       #   本地日期工具（杜绝 UTC 时区 Bug）
│   ├── calcUtils.ts       #   金额算式解析（+ - * / 括号，递归下降，无 eval）
│   ├── amountFilter.ts    #   记账列表金额筛选：按天/大类/单笔 + ≥ 阈值（纯函数，含输入净化）
│   ├── subcategoryRules.ts #  小类条件规则：条件模型 + 纯匹配（不依赖 DB / React，可直接单测）
│   ├── reorderUtils.ts    #   拖拽重排工具（按 id 列表重排数组，乐观更新用，纯函数）
│   ├── holidaySync.ts     #   节假日数据：内置导入 + holiday-cn 抓取 + 24 小时节流（不碰 DB）
│   ├── lunarUtils.ts      #   农历/节气/节日/黄历（缓存计算结果）
│   ├── emojis.ts          #   emoji 候选列表（分类/设置共用）
│   └── lunar-javascript.d.ts  # 第三方库手写类型声明
├── contexts/              # 「状态层」：全局共享状态（不直接写 SQL）
│   ├── CategoryContext.tsx    #   分类树缓存 + 分类增删改/排序封装（操作后自动 refresh）
│   ├── SettingsContext.tsx    #   支付方式/收支类型配置 + 统计口径（expenseCodes）
│   └── HomeFilterContext.tsx  #   首页筛选状态（时间范围/支付方式/分类/金额筛选，切页保留，纯内存）
├── components/            # 「视图层」：通用与业务组件
│   ├── Layout.tsx             #   顶栏导航 + 路由出口
│   ├── MonthOverview.tsx      #   记账页顶部：支出日历(左 1/3) + 右侧上黄历卡 / 下按天双线图(2/3)
│   ├── MonthCalendar.tsx      #   支出日历（42 格固定行数；有支出统一浅靛蓝底，不按金额分档；悬停黄历）
│   ├── LunarCard.tsx          #   农历黄历卡（宜/忌，悬停联动）
│   ├── TrendChart.tsx         #   折线图（月度趋势 / 按天双线，Y 轴分段压缩）
│   ├── ExpenseList.tsx        #   记账列表主组件（日期分组 + 缺失日期快捷行 + 行内编辑状态 + 完整编辑弹窗入口 + 折叠/展开档位状态）
│   ├── ExpenseRow.tsx         #   单条记录行（含行内编辑：小类/金额/支付方式/类型/备注/日常/删除）
│   ├── ExpenseCategoryGroup.tsx # 按日分组内的「一级大类」分组（标题 + 记录行 + 添加小类）
│   ├── CategoryAddPopover.tsx #   「添加」按钮弹出的大类+小类联动选择面板（支持自定义）
│   ├── PaymentMethodTotals.tsx #  每日支付方式统计徽章（桌面/移动两态复用）
│   ├── expenseListTypes.ts    #   记账列表专用类型（LocalRow/EditField/EditForm）
│   ├── DragHandle.tsx         #   拖拽排序手柄（六点 grip，两页共用，触摸设备放大）
│   ├── sortableConfig.ts      #   拖拽排序统一配置（传感器/让位动画/垂直锁定/行样式）
│   ├── SortableCategoryRow.tsx #  分类管理可拖拽大类行（标题/改名/图标选择/小类插槽）
│   ├── SortableSubCategoryRow.tsx # 分类管理可拖拽小类行（公共属性行内编辑 + 规则条数徽章展开规则区，导出 EditField/SubEditForm）
│   ├── SubcategoryRuleList.tsx  # 小类规则列表（启用勾选/条件标签/金额行内编辑/拖拽排序/删除，嵌套 DndContext）
│   ├── RuleConditionPanel.tsx   # 规则条件面板（总是/工作日/休息日/每周多选/每月多选/每年某月某日）
│   ├── HolidayStatusLine.tsx    # 节假日数据状态行 +「立即更新」（分类管理页顶部）
│   ├── SystemDefaultCategories.tsx # 分类管理「系统默认」只读列（出厂种子清单展示 + 一键恢复按钮）
│   ├── EditExpenseDialog.tsx  #   记录完整编辑弹窗（含日期）
│   ├── StatsPanel.tsx         #   右栏分类排行（可勾选筛选）
│   ├── DatePicker.tsx         #   日期选择
│   ├── DateRangePicker.tsx    #   日期区间选择
│   ├── InlineSelect.tsx       #   行内自绘下拉（portal，WebView 兼容）
│   ├── EmojiPicker.tsx        #   emoji 选择器
│   ├── HoverTip.tsx           #   即时悬浮提示气泡（CSS 自绘，替代有延迟的原生 title）
│   └── ConfirmDialog.tsx      #   确认弹窗
└── pages/                 # 「路由页」：一页一文件，命名一律 XxxPage.tsx
    ├── HomePage.tsx           #   记账页（/）
    ├── StatsPage.tsx          #   统计页（/stats）
    ├── CategoryPage.tsx       #   分类管理（/categories）
    └── SettingsPage.tsx       #   设置：支付方式/收支类型（/settings）
```

**约定**：`data/` 不 import React；`pages/` 只做页面编排；业务组件在 `components/`；全局状态只在 `contexts/`。

**AI 指导**：从上到下的每个目录（`frontend/`、`frontend/data/`、`frontend/components/`、`frontend/contexts/`、`frontend/pages/`、`backend/`）都有一份 `AGENTS.md`，写该目录的文件清单、约定与坑；根 [AGENTS.md](AGENTS.md) 是总纲与目录导航。**改代码 / 改结构时，本文件与对应 `AGENTS.md` 要同步更新。**

---

## 4. 数据流

```
database.ts（唯一 SQL 层，单例连接，重试 2 次）
     ▲
     │ 页面/组件直接调用导出函数（listExpenses / addExpense / getStatsByRange …）
     │
CategoryContext / SettingsContext（缓存树形数据，操作后自动 refresh()，全局只加载一次）
     ▲
     │ useCategories() / useSettings() / useHomeFilter()
     │
各页面与组件
```

规则：
- **所有 SQL 只能出现在 `database.ts`**，页面禁止写 SQL、禁止直接调 Tauri API。
- 桌面/网页的差异只隔离在 `webDb.ts`（`DbConnection` 接口形状一致），`database.ts` 无感知。
- Context 是「缓存 + 封装」，不是第二套数据访问层。

---

## 5. 命名规范（前后端一致，新人最容易踩坑）

### 5.1 数据库 ↔ TypeScript 字段名

| 层 | 规则 | 例子 |
|----|------|------|
| 数据库表名/字段 | **一律 snake_case** | `is_non_daily`、`default_note`、`payment_methods` |
| TS 数据行类型 | **与数据库字段同名（snake_case）** | `Expense.is_non_daily`、`Expense.category_l1` |
| TS 界面拼装类型 | **同样一律 snake_case**（无例外） | `CategoryWithChildren.is_default`、`SubCategoryChild.default_note` |
| 函数/变量 | camelCase | `getDailyTotals`、`expenseCodes` |
| 常量 | 大写蛇形 | `CAT_KEY_SEP`、`DEFAULT_PAYMENT_METHODS` |

> **为什么全部用 snake_case？**
> 早期 `CategoryWithChildren` / `SubCategoryChild` 等界面拼装类型允许 camelCase
> （`isDefault`、`defaultNote`），2026-08-18 工程规范化后已统一为 snake_case：
> **所有承载数据的字段名（数据库行 / 界面拼装 / 编辑表单）一律与数据库列名一致，无任何例外**，
> 新手无需再区分「这是数据库字段还是界面字段」。
> 判断标准：**只要它承载数据，字段一律 snake_case；函数、局部变量、React 状态名仍用 camelCase。**

### 5.2 记录里存什么

| expenses 字段 | 存的内容 | 改名的后果 |
|---------------|---------|-----------|
| `category_l1` / `category_l2` | 分类**名称文本**（含 emoji） | 分类改名不影响旧记录（显示的是文本） |
| `payment_method` | 支付方式**名称文本** | 支付方式改名会**同步迁移**历史记录（`updatePaymentMethodName`） |
| `type` | 收支类型 **code**（内置 `expense/income/ignore` 或自定义 `t_<id>`） | 改名全局生效，无需迁移（`tx_types.code` 唯一） |
| `is_non_daily` | 0=日常，1=非日常 | — |

### 5.3 文件命名

- 页面：`XxxPage.tsx`（HomePage / StatsPage / CategoryPage / SettingsPage）
- 组件：PascalCase（`ExpenseList`、`MonthCalendar`）
- Context：`XxxContext.tsx` + 配套 `useXxx()` hook
- 工具：`data/XxxUtils.ts`
- 路由表（`App.tsx`）：`/` 记账 · `/stats` 统计 · `/categories` 分类 · `/settings` 设置

### 5.4 统计口径（重要）

所有「支出」统计（蓝色概览卡 / 分类排行 / 折线图 / 每日小计 / 支付方式统计）只统计
`category='expense'` 的收支类型，收入、不计类型不参与。SQL 侧统一用
`type IN (SELECT code FROM tx_types WHERE category='expense')`；前端过滤统一用
`expenseCodes.has(e.type)`（来自 `SettingsContext`）。**新写统计必须沿用此口径。**

**无例外**：同屏的「每日小计」（`ExpenseList` 的 `dayTotal`）、「大类合计」（`ExpenseCategoryGroup` 的 `l1Total`）、支付方式统计都只算支出，所以「一天里各大类合计之和 = 当天小计」（不计 / 收入记录照常显示在列表里，但不参与任何合计）。金额筛选的「按天 / 按大类」也用同一口径判断阈值，看到的合计与筛选结果不会互相矛盾。

---

## 6. 数据库表结构（唯一维护处：`frontend/data/database.ts`）

| 表 | 关键字段 | 说明 |
|----|---------|------|
| `expenses` | `id, amount, category_l1, category_l2, date, note, payment_method, type, is_non_daily, created_at` | 消费记录 |
| `categories` | `id, name(UNIQUE), icon, sort_order, is_default` | 大类；`is_default`=是否参与「添加某天」自动记账 |
| `subcategories` | `id, category_id(FK→categories, CASCADE), name, is_default, sort_order, default_note, default_payment_method, default_amount, default_type, default_is_non_daily` | 小类 + 公共属性模板（备注 / 支付方式 / 收支类型 / 日常）。⚠️ **金额不在这里**：`default_amount` 是历史遗留列（只作迁移 v2 的种子源，运行期无人读取），金额唯一来源是 `subcategory_rules` |
| `subcategory_rules` | `id, subcategory_id(FK), sort_order, enabled, conditions(JSON), amount` | 小类条件规则：`sort_order` 即匹配优先级，`conditions='[]'` = 总是，`enabled=0` 跳过；**金额唯一来源** |
| `budgets` | `id, month(UNIQUE), amount` | 月度预算 |
| `payment_methods` | `id, name(UNIQUE), icon, sort_order` | 支付方式配置 |
| `tx_types` | `id, code(UNIQUE), name, icon, category(expense/income/ignore), sort_order` | 收支类型配置 |
| `month_attributes` | `month(PRIMARY KEY), is_locked` | 月份属性表（一月一行，当前仅有锁属性）；月锁生效时该月每天只读 |
| `day_attributes` | `date(PRIMARY KEY), is_locked` | 日期属性表（一天一行，当前仅有锁属性）；解锁只置 0 保留行 |
| `holidays` | `date(PRIMARY KEY), year, name, is_off_day` | 节假日特殊日期（**只存放假 + 调休补班**，`is_off_day=0` = 补班）；查不到按周一~周五 |
| `holiday_years` | `year(PRIMARY KEY), ready, source, fetched_at, last_checked_at` | 每年一行：数据是否就绪 / 来源（`builtin` / `holiday-cn`）/ 最近一次联网检查时间（24 小时节流用） |

- 建表用 `CREATE TABLE IF NOT EXISTS` + 兼容性 `ALTER TABLE`，**幂等**，旧库自动补列。
- 迁移用 SQLite `PRAGMA user_version` 做一次性回填：**v1** = 把早餐 / 午餐 / 晚餐回填为默认小类；**v2** = 按旧 `default_amount` 给默认小类生成一条「总是」规则（金额来源迁到 `subcategory_rules`）。执行后置位，不再重复跑。
- 分类 / 支付方式 / 收支类型表在 `COUNT(*) === 0` 时播种（**删光重启会重新播种**，不是「只播一次」）。
- 连接时把 5 类数据读进内存缓存并保持同步：`subRules`（规则）、`holidayDays` / `holidayYears`、`lockedMonths` / `lockedDays`。规则写操作后必须 `reloadSubRules()`。
- **Rust 后端不建表**（`backend/src/lib.rs` 注释声明），schema 只此一处，避免前后端不一致。

---

## 7. 关键实现模式（改代码前先读）

1. **本地日期**：一律用 `dateUtils.ts`（`localDateString` 等）。解析 `YYYY-MM-DD` 必须带 `T00:00:00`
   后缀按本地时间解析（`new Date('2026-07-01')` 按 UTC，西半球会错一天）。
2. **金额**：入库前必须过 `calcUtils.evaluateExpression`（支持算式 `5*2`、拦截负数、四舍五入两位）。
3. **行内编辑**：点格子进入 → 回车 / 点外部自动保存；**记录行内编辑没有 Esc 取消**（`ExpenseList` 的键盘处理只认 Enter），Esc 只在两个弹窗（`ConfirmDialog` / `EditExpenseDialog`）、`InlineSelect` 面板、分类改名与自定义小类输入框里生效。下拉用 `InlineSelect`（WebView 兼容，替代不可靠的原生 `showPicker()`）；金额一律过 `evaluateExpression`；编辑旧记录不自动填默认模板（模板只服务新建行）。
4. **数据刷新信号**：`HomePage` 维护 `dataVersion`，列表增删改后自增，日历区/排行面板据此重新查库。
5. **分类筛选键**：`catKey(l1, l2) = l1 + '§' + l2`（小类在不同大类下可能重名，必须组合键）。
6. **CSV 导出**：`expensesToCSV` 带 BOM + 双引号转义，Excel 直接打开不乱码。
7. **预算颜色**：主题色 `#6366f1` 正常 → `amber` ≥80% → `red` 超支（Tailwind `@theme` 的 `--color-primary`）。
8. **拖拽排序**：@dnd-kit，写库走 `reorderCategories / reorderSubCategories / reorderPaymentMethods / reorderTxTypes`。
   - 统一配置在 `components/sortableConfig.ts`：`useSortableSensors()`（鼠标移动 5px / 触摸长按 250ms 的传感器组合）、`SORTABLE_TRANSITION`（让位动画 150ms）、`restrictToVerticalAxis`（只许上下拖）、`sortableRowStyle()`（行样式，含拖拽中的 `zIndex`）。四个可排序行组件与两个页面的 `DndContext` 全部引同一份，改手感只改这一处。
   - **鼠标与触摸必须用不同传感器**：`MouseSensor`（distance 5）+ `TouchSensor`（delay 250 / tolerance 5）。用 `PointerSensor` 的话它同时接管鼠标与触摸、无法分设约束，手机上手指一碰就进入拖拽、页面滚不动。用 TouchSensor 时手柄须带 `touch-action: manipulation`（触摸事件不受指针事件限制，dnd-kit 能在 `touchmove` 里 `preventDefault` 阻止滚动）。手柄在触摸设备上通过 `pointer-coarse:` 变体放大到 36×44。
   - **不用 `<DragOverlay>`**：dnd-kit 在 `useDragOverlay` 为 false 时会自动让被拖节点本身跟随指针（`shouldDisplaceDragSource`），且此时不施加过渡，跟手不延迟；拖拽中的行与静止时样式完全一致。
   - **上下文必须乐观更新**：`reorderXxx` 先同步 `setState` 重排（`data/reorderUtils.ts` 的 `applyOrder`），再后台落库。否则 dnd-kit 的落位动画（松手瞬间现测被拖节点位置为终点）会朝旧位置飞，即「回影」。
   - 注意：卡片容器**不要加 `overflow-hidden`**，否则会把拖到容器外的小类行裁掉（`SortableCategoryRow` 已因此去掉）。
9. **日期锁（月锁 / 日锁）**：`database.ts` 连接时把 `is_locked=1` 的月份/日期读进内存缓存 `lockedMonths` / `lockedDays`，
   导出同步判断 `isDateLocked(date)`（= 月锁 ∥ 日锁）与 `isMonthLocked(month)`；五个写记录的导出函数
   （`addExpense / updateExpense / deleteExpense / deleteExpensesByDate / deleteExpensesByCategory`）开头一律
   `assertDateEditable(date)`（改记录时新旧日期都要过），UI 藏按钮只是第二道防线。两个锁属性**互不修改**，
   解锁只把 `is_locked` 置 0、保留行。唯一例外：`updatePaymentMethodName` 的批量改名会写到锁定日期的记录（属元数据改名，非内容修改）。
   - **删空某天自动补日锁**：`HomePage.tsx` 的三条删除路径删完后调 `countExpensesByDate(date)`，为 0 就 `setDayLocked(date, true)`
     （`autoConfirmNoSpendIfEmpty`）——「添加某天 → 删掉 ¥0 占位记录」收尾成「当天无消费」，不再退回「未记录」。仅运行时删除触发，老数据不批量补标记。
10. **悬浮提示**：新增提示一律用 `components/HoverTip.tsx`（CSS 自绘，移入即显、移出即隐），不要再用原生 `title`
   （Tauri WebView 里要等约 1 秒、有时不弹）。贴近容器右边缘的元素传 `align="right"`，并给包裹层加 `shrink-0`。
   历史遗留的原生 `title` 仍散落在日历格子、记录行徽章、分类/设置页图标按钮等处（全项目 57 处：components 35 + pages 22），尚未迁移，逐步替换。
11. **小类条件规则（金额的唯一来源）**：`data/subcategoryRules.ts` 是纯函数层（`conditionsMatch` / `matchRulesAmount`），`database.ts` 把 `subcategory_rules` 整表读进内存缓存 `subRules`，导出**同步**函数 `matchSubcategoryAmount` / `resolveSubDefaults`。语义：**同一种条件多值 = 或、不同条件叠加 = 且**；`conditions=[]` = 总是；跳过 `enabled=0`；判定基准是**记录那天的日期**（不是今天）。
    - 4 个「取默认值」入口统一调 `resolveSubDefaults`：批量入口（「添加某天」/「+ 大类」）没命中就**不生成记录**；手动入口（点小类 / 行内切小类）没命中给 0 元行。
    - 勾选默认小类时若该小类一条规则都没有，自动补一条「总是 ¥0」（否则批量入口不会给它写记录）。
12. **节假日 / 工作日判定**：`isWorkday` / `isRestDay` / `getHolidayName` 是**同步**函数（`holidayDays` / `holidayYears` 两个内存缓存在连接时载入）。表里只存特殊日期，查不到就按周一~周五——「该年没数据」与「该年确实没有特殊日期」走同一条路径。
    - 数据由 `holidaySync.ts` 提供：首次安装导入 `lunar-javascript` 内置 2001–当年（离线可用），联网以 holiday-cn 静态 JSON 覆盖；同一年 24 小时内至多查一次、次年 10 月起才查、单次最多 4 年、空数据不算就绪、失败静默不阻塞功能。启动时 `Layout.tsx` 静默调一次 `ensureHolidayData()`。
    - 日历格子的小字（`lunarUtils.ts`）直接读依赖库的 `HolidayUtil`，**不读 `holidays` 表**，与规则判定是两套数据源。
13. **记账列表折叠（三档 / 自动预设 / 连续段）**：
    - 三档 = 按天折叠（默认）→ 天展开 + 大类收起 → 全部展开；按钮一次走一档。**代码不记「当前第几档」**：`HomePage` 只发命令 `expandCommand={action, seq}`，`ExpenseList` 按实际 `expandedDates` + `collapsedMap` 算出下一步，再经 `onExpandControlsChange` 把「下一档是什么」回报给父页面。
    - 金额筛选生效时套一次折叠预设 `expandPreset`（按天 = 一天一行 / 大类 = 一天一大类 / 单笔 = 全部展开），只在「条件 + 阈值」触发键变化时套用一次，之后用户手动折叠不受影响；**不要塞进 `searchActive`**（搜索是渲染期强制展开，语义不同）。
    - 连续段折叠 `collectRunLayout()` 在 `ExpenseList.tsx` 顶部（纯函数，**模块内私有**，要单测需先 export）：未记账段 `q:` 与「当天无消费」段 `n:` 各自独立，段长 ≤3 全展示、>3 只留首尾两天 + 「+ 更多」。

---

## 8. 常见开发任务（照着做）

### 8.1 给消费记录加一个新字段

1. `database.ts`：建表 SQL 加列 + 加一条兼容性 `ALTER TABLE`（老库自动补）。
2. `types.ts`：`Expense` / `ExpenseInput` 加同名 snake_case 字段。
3. `database.ts`：`addExpense` / `updateExpense` / `listExpenses`（SELECT 映射）同步。
4. 界面：`ExpenseList.tsx` 行内编辑 + `EditExpenseDialog.tsx` 弹窗 + 需要时 CSV 导出列。
5. 文档：同步 `frontend/data/AGENTS.md` 的「数据库表结构 / 文件清单」，必要时改本文件。

### 8.2 新增一个页面

1. `pages/XxxPage.tsx`（命名 `XxxPage`）。
2. `App.tsx` 注册路由。
3. `Layout.tsx` 顶栏加导航入口。
4. 文档：同步 `frontend/pages/AGENTS.md` 与本文件的目录树；根 [AGENTS.md](AGENTS.md) 的「目录导航 / 已实现功能」按需更新。

### 8.3 修改默认分类种子

改 `frontend/data/categories.ts`。注意：**只对新装库的播种生效**；老库已有数据，
要么走 `database.ts` 的 `user_version` 迁移，要么让用户在「分类管理」页手动改。
⚠️ 种子里**没有小类金额**——金额由 `subcategory_rules` 的条件规则决定（见 §6），不要想着往种子或 `default_amount` 里加金额。

### 8.4 双形态注意

新功能只要走 `database.ts` 导出函数，桌面/网页自动都支持；**不要**在组件里直接 `import Database from '@tauri-apps/plugin-sql'`。

### 8.5 发版

改 `backend/tauri.conf.json` 的 `version`（建议同步 `backend/Cargo.toml`）→ 提交 → `git tag vX.Y.Z && git push --tags`。
GitHub Actions（`.github/workflows/release.yml`）自动构建 Mac/Windows 安装包。

---

## 9. 本地环境要求

| 工具 | 版本 | 用途 |
|------|------|------|
| Node.js | `^20.19.0` 或 `>=22.12.0`（见 `package.json` engines） | 前端构建 |
| Rust | stable（`rustup` 安装） | Tauri 桌面壳编译 |
| 系统依赖 | Mac 无额外要求；Windows 需 VS C++ Build Tools + WebView2 | 桌面打包 |

常用命令：`npm run dev`（网页版热更新）· `npm run tauri:dev`（桌面开发）· `npm run typecheck` · `npm run lint` · `npm run build` · `npm run tauri:build`。
