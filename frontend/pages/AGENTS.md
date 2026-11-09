# frontend/pages — AI 指导

> 分层 AI 指导体系中的一层：仓库根 AGENTS.md（../../AGENTS.md）是总纲与目录导航。本文件只讲本目录，跨目录总体信息回根文件看。

## 这个目录是干什么的

- **路由终点**：一页一个文件，命名 `XxxPage.tsx`，由 `frontend/App.tsx` 注册路由、`components/Layout.tsx` 顶栏导航（顺序：统计 `/stats` · 记账 `/` · 分类 `/categories` · 设置 `/settings`）。
- **只做页面编排**：把 Context（分类 / 设置 / 首页筛选）+ `components/` 业务组件 + `data/` 的导出函数组装成完整页面。**不写 SQL、不直接调 Tauri API、不 import `@tauri-apps/*`**。
- **状态归属分三层**（改之前先判断该放哪，别乱提层）：

| 状态 | 归属 | 例子 |
|---|---|---|
| 切页要保留 | `contexts/HomeFilterContext.tsx` | 时间范围、历史月份、自定义区间、支付方式/日常/分类/金额筛选、趋势图大类、快捷添加开关 |
| 页面自己的一次性 UI 状态 | 页面 `useState` | 列表数据 `expenses`、刷新信号 `dataVersion`、锁集合、预算草稿、删除确认目标、搜索词、展开命令 |
| 组件内部交互 | 子组件自己持有 | `ExpenseList` 的折叠/行内编辑、`MonthOverview` 的日历视图月份与图表大类、`StatsPanel` 的展开状态 |

> 页面 state 换页即销毁（路由切换会卸载页面）；放 `HomeFilterContext` 的筛选在应用不关闭期间一直保留，但**不落库**，重开应用恢复默认。

## 文件清单

| 文件 | 职责 | 关键点 |
|---|---|---|
| `HomePage.tsx` | 记账页（`/`）：顶部日历区 + 两栏仪表盘（左 3/5 概览卡 + 记录列表，右 2/5 分类排行） | 全项目最复杂页面（约 1210 行 / 59KB），交互链路见下一章 |
| `StatsPage.tsx` | 统计页（`/stats`，导航首位）：近 12 月趋势 + 本月概览/环比 + 近 12 月分类 TOP5 | 固定当前自然月，**不随记账页范围切换**；只与记账页共享 `trendCategory` |
| `CategoryPage.tsx` | 分类管理（`/categories`）：左「我的分类」可编辑 + 右「系统默认」只读出厂列（可一键恢复） | 拖拽 + 行内编辑 + 条件规则入口 + 节假日状态行 |
| `SettingsPage.tsx` | 设置（`/settings`）：支付方式 + 收支类型两栏管理 | 两者改名语义不同（见「其他页面」），拖拽排序 |

## HomePage 交互链路（重点章节）

### 1. 时间范围 → 数据加载（一切联动的源头）

```
HomeFilterContext 的 rangeMode/historyMonth/customRange
  → getRangeDates() 算出 { start, end }（本地日期，dateUtils）
  → loadData()：Promise.all(listExpenses({start,end})、getMonths()、listLocks())
  → setExpenses / setMonths / setLockedMonths / setLockedDays / dataVersion++
```

- 范围选择器在蓝色概览卡里：4 个固定 pill（近一周 / 近一月 / 本月 / 上月）+ 「历史月份」下拉（月份来自 `getMonths()`）+ 「自定义」浮窗（`DateRangePicker`，点外部或 Esc 收起）。`rangeLabel` 是折线图标题。
- `dataVersion` 是**刷新信号**：日历区（`MonthOverview`）和右栏排行（`StatsPanel`）自己查库，靠这个自增版本号重新拉数据。任何增/删/改后页面必须调 `loadData()`，否则只有由 `expenses` 直接推导的蓝色卡会变、图表不动。
- 蓝色卡的支出/笔数直接由 `expenses` 汇总；预算只在「本月 / 上月 / 历史月份」显示（`showBudgetPanel`），近一周/近一月/自定义显示 `-`。

### 2. 顶部日历区（`MonthOverview`，页面只传参）

- 布局：左 1/3 支出日历（`MonthCalendar`，正方形格子按金额热力深浅）+ 右 2/3 上下两张独立卡片——**上**农历黄历卡（`LunarCard`）、**下**按天双线折线图（高 200px）。
- **双向联动**：
  - 日历选月份 → `onMonthChange(month)`：等于本月就 `setRangeMode('month')`，否则 `setHistoryMonth(month)` + `setRangeMode('history')`。
  - 蓝色模块切整月范围 → `syncMonth`（本月/历史月份/上月，其它范围传 `null`）让日历跟随该月。
  - 点日历某天 → 页面推导 `selectedDay`（仅当「自定义」起止同一天）= 该天，切「自定义」并 `autoExpandDates` 展开那天；再点同一天（或 `null`）回本月。
- 折线图跟随 `startDate/endDate`（与列表联动），图例为「全天（虚线）+ 日常（实线）」，右上角还有**只影响图表**的「全天/大类」下拉（`MonthOverview` 内部 state，不进 `HomeFilterContext`）。
- 日历悬停某天 → 经 ref 桥接给 `LunarCard` 显示黄历，悬停状态在黄历卡内部，**不重渲染折线图**。
- 整月锁按钮也在这里，只写月锁属性（见第 5 节）。

### 3. 蓝色概览卡（左栏）

- 一行五份：支出（金额 + 笔数）/ 日常 / 非日常 / 预算 / 剩余；下面进度条。
- 「日常 / 非日常」可点击筛选列表（再点取消，互斥），金额只统计 `expenseCodes` 内的记录。
- 预算输入框：回车 / 失焦保存；原生上下箭头（`step=1000`）靠 `onChange` 里「相对上次保存值整步跳变 ±1000」立即保存（打字逐字符不触发）；**输入 0 = 删除该月预算**，回到未设置。
- 预算配色：超支 `red`、接近（≥80%）`amber`、正常 `primary`（`--color-primary`）；剩余徽章随状态换底色。
- 底部支付方式统计（每行 3 个）：点击某支付方式 = 筛选列表，再点取消；占比分母是 `expenseTotal`。

### 4. 筛选链路（唯一入口 `filteredExpenses`，顺序不能乱）

`filteredExpenses = expenses → 支付方式 → 日常/非日常 → 分类（selectedCats，键为 catKey） → 搜索（备注/金额子串，不区分大小写） → 金额筛选`

- 金额筛选：条件（按天 / 大类 / 单笔）+ 阈值（`parseAmountThreshold`：空/0/非法 = 不生效；输入经 `sanitizeAmountInput` 净化）。判定是纯函数 `applyAmountFilter(list, mode, threshold, expenseCodes.has)`，所以统计基数 = 已叠加前面所有筛选的结果。
- `hasAnyFilter = 任一筛选生效`（含搜索、金额筛选项）。它决定：缺失日期「+ 添加」快捷行与「当天无消费」行隐藏（`missingDates` / `noSpendDates` 直接置空）、`extraDates` 置空、列表标题行「快捷添加」开关整体置灰。
- 金额筛选生效时还会给列表一个**自动折叠预设**（`expandPreset` + `expandPresetKey = mode:threshold`）：按天 = 只留每天一行、大类 = 天展开并收起大类、单笔 = 全部展开。`ExpenseList` 只在触发键变化时套用一次，之后用户仍可手动折叠。
- 右栏排行始终统计完整范围数据（不随筛选变），它本身就是筛选入口；「✕ 清除筛选」按钮显示条件是 `selectedCats.size || paymentFilter || amountFilterActive`（不含日常/搜索）。

### 5. 缺失日期、当天无消费与日期锁

- `missingDates` = 范围内无记录且未锁的日期（仅无筛选时算）；`noSpendDates` = 范围内无记录但已锁 = 「当天无消费」。
- 锁 = **月已锁 或 该天已锁**。日锁按钮在整月锁生效时置灰（月锁优先，必须先解锁整月）；锁/解锁点一下即生效、无确认弹窗。锁定只影响「能不能写」，列表/日历/统计/导出照常包含。
- 列表的 `extraDates` = `addedDates`（手动添加的空白日期）+ `noSpendDates`，**必须 `useMemo`**：`ExpenseList` 用它做自动展开 effect，每次渲染传新数组会死循环。
- 快捷添加开关（`showQuickAdd`，存 Context）：控制缺失日期快捷行显隐；`noSpendDates` 不受它控制。
- 三条删除路径（单条记录 / 整天 / 整个大类）删完都走 `autoConfirmNoSpendIfEmpty(date)`：`countExpensesByDate(date) === 0` 就 `setDayLocked(date, true)`，就地显示「当天无消费」，不退回「未记录」。只在运行时删除触发，升级老库不批量补标记。
- 手动加日期：右下角悬浮按钮 → 弹窗校验（已有记录 / 已锁定则禁用「添加」）→ `saveNewDate(date)`：只处理勾选默认的大类，其默认小类经 `resolveSubDefaults(sub, date)` 命中规则才写记录；一条都没写成时只把日期加进 `addedDates` 显示空白行。⚠️ `addedDates` 只是页面 state、不落库：若这天最终无记录也没上锁，切页/重开后会消失。

### 6. 列表标题行「折叠 / 展开」按钮（一次走一档）

- `HomePage` 只**发命令**：`expandCommand = { action, seq }`，每点一次 `seq + 1`。折叠状态全在 `ExpenseList` 内，父组件不碰。
- `ExpenseList` 收到命令后，按**实际折叠状态**（不是记「当前第几档」这个数字）走一档：天折叠 → 天展开+大类收起 → 全部展开；折叠对称回退。用户手动点过某天/某大类也不乱。
- `ExpenseList` 通过 `onExpandControlsChange({ expandStep, collapseStep })` 回报「下一档」；页面用它禁用到底的按钮、写 `HoverTip` 文案（`handleExpandControlsChange` 里值没变就沿用旧对象，避免 effect→setState→渲染循环）。
- 搜索中两个按钮直接置灰（搜索走渲染期强制展开，按了也看不出效果）；状态不持久化，进页面永远是第 1 档。窄窗口（<1280，`xl`）按钮只留图标。

### 7. 导出与两栏响应式

- CSV 导出：`getAllExpenses()` 取**全部记录，与当前时间范围/筛选无关**；排序 = 日期降序 → 分类固定顺序 → id 升序；`expensesToCSV(all, txTypes)`（带 BOM，Excel 中文不乱码），文件名 `一笔_YYYY-MM-DD.csv`。无消费日没有记录，天然不进 CSV。
- 两栏：`lg:grid-cols-5`，左 `col-span-3`（概览卡 + 列表）、右 `col-span-2`（只有 `StatsPanel` 分类排行）。⚠️ 预算输入与导出按钮**在左栏蓝色卡内**，不在右栏。
- <1024 单栏堆叠；<1280 标题行收成「图标 + 搜索框最窄 120px」，保证不换行。

## 其他页面

### StatsPage

- 查询全部按「当前自然月」现算（本月 / 上月 / 近 12 月），进入页面查询一次，切页重新挂载即拿最新数据；不读记账页的时间范围。
- 三块：近 12 月趋势（`getTrendData(12, trendCategory)`，缺月补 0；选了大类线变 `amber` 色）、本月概览（总支出 + 环比上月 + 笔数/日均/单日最高，日均 = 总支出 ÷ 当前日期）、近 12 月分类 TOP5（`getStatsByRange(12 个月前, 本月末).byCategory.slice(0,5)`，进度条以第 1 名为基准）。
- 趋势图大类筛选存 `HomeFilterContext.trendCategory`，所以切页回来仍保留。

### CategoryPage

- 两栏：左「我的分类」可增删改/拖拽排序/勾选默认；右「系统默认」是出厂种子只读列（`SystemDefaultCategories`），每个大类/小类带「＋ 恢复」，大类已存在时置灰、小类已存在不重复添加；恢复单个小类时若大类被删会先重建大类。
- 恢复语义：重建小类 → `clearRules` → 写默认支付方式/非日常标记 → 出厂默认小类再补一条「总是 ¥0」规则并勾 ✓（让「添加某天」行为与出厂一致）。
- 小类行：名称/备注/默认支付方式/收支类型/日常标记行内编辑（回车或点外部自动保存，Esc 取消），金额**不在主行**，在备注右侧「规则条数徽章」展开的规则区。
- 顶部 `HolidayStatusLine`（工作日/休息日判定的数据基础 +「立即更新」）；单个 `DndContext`（`id="category-dnd"`）+ 嵌套 `SortableContext`（大类 / 同一大类内的小类），传感器统一走 `sortableConfig`；无 `<DragOverlay>`。
- 删除大类会连带删其小类，但已有消费记录不受影响（记录存的是分类名称文本）。

### SettingsPage

- 两栏：支付方式 / 收支类型，各自由可拖拽行 + 新增区组成；行内改名（Enter 保存 / Esc 取消）、emoji 图标选择、删除前用 `countExpensesByPaymentMethod` / `countExpensesByType` 统计用量并在确认弹窗提示。
- **改名语义不同**：支付方式在记录里存**名称文本**，改名时 `updatePaymentMethodName` 会同步迁移历史记录的 `payment_method` 和小类默认支付方式；收支类型在记录里存 **code**，改名只需改配置、无需迁移（但删类型后旧记录显示「未定义」并掉出统计）。
- 收支类型行显示类别徽章（计入支出 / 计入收入 / 不计数）；新增时可选择类别。拖拽重排走 Context（乐观更新）。

## 必须遵守的约定

1. **统计口径**：页面侧所有「支出」金额/笔数只算 `expenseCodes.has(e.type)`（来自 `SettingsContext`）；需走 SQL 的（排行/趋势/日合计）由 `database.ts` 的 `type IN (SELECT code FROM tx_types WHERE category='expense')` 保证。收入、「不计」不参与任何支出统计与预算。CSV 导出是例外（导出全部记录）。
2. **日期**：一律用 `dateUtils` 的本地日期函数；解析 `YYYY-MM-DD` 必须带 `T00:00:00`，禁止 `toISOString()` 取日期。
3. **写数据后刷新**：页面调 `database.ts` 导出函数完成增删改 → 必须 `loadData()`（`dataVersion++`），否则日历/排行/图表不更新。
4. **新增悬浮提示用 `components/HoverTip.tsx`**，不要新增原生 `title`（Tauri WebView 里延迟约 1 秒甚至不弹）。
5. **锁属性互不改写**：页面的整月锁操作只写月锁、日锁只写日锁；写操作拦截在 `database.ts`（`assertDateEditable`），页面只负责禁用/提示，不能只在 UI 层拦。
6. **不要给页面加 SQL 或 Tauri 调用**；业务组件不够用时先看 `components/`，状态不够用再看 `contexts/`。
7. **别持久化折叠档位**：三档是从实际折叠状态现算出来的，不存数字、不存库、不记忆。

## 改动检查清单

- [ ] 新增/修改首页筛选：是否该进 `HomeFilterContext`（切页保留）？是否计入 `hasAnyFilter` 与 `hasFilter`？是否决定隐藏 `missingDates` / `noSpendDates` / `extraDates`？可清除的筛选项是否同步 `clearFilters` 与 `StatsPanel`「清除筛选」按钮的显示条件？
- [ ] 改筛选顺序或金额筛选：`filteredExpenses` 的链条与 `expandPreset`（按天/大类/单笔三套折叠层级）是否仍匹配？是否保持纯函数 `applyAmountFilter` 不掺页面逻辑？
- [ ] 改折叠/展开：仍只发 `{action, seq}` 命令吗？`onExpandControlsChange` 回报的「下一档」是否仍由实际状态算出？搜索置灰、金额筛选预设、手动折叠三者是否互不破坏？窄屏是否仍不换行？
- [ ] 改时间范围：`getRangeDates` 是否覆盖新模式？`RANGE_PILLS` / `rangeLabel` / `syncMonth` / 日历联动 / `showBudgetPanel`+`budgetMonth` 是否同步？
- [ ] 改删除或新增写入：是否接上 `autoConfirmNoSpendIfEmpty`？锁拦截是否仍在数据层？会不会破坏「删空 = 当天无消费」闭环？
- [ ] 改统计/图表/排行：是否漏了 `expense` 口径？范围是否仍是「统计页固定当前自然月、记账页跟随范围选择器」？`dataVersion` 是否让组件重新查库？
- [ ] 改 CSV：是否仍导出全部记录（与范围/筛选无关）？新增字段是否同步表头、`database.ts` 映射与 BOM？
- [ ] 改分类/设置页：改名迁移语义（name vs code）是否处理？拖拽是否走 Context 的乐观更新与 `sortableConfig` 统一传感器？
- [ ] 收尾：`npm run typecheck`、`npm run lint` 必须过；对照本文件与子目录 AGENTS.md 有出入时以代码为准并修文档。

## 相关文档

| 文档 | 内容 |
|---|---|
| [../../AGENTS.md](../../AGENTS.md) | 总纲：项目概况、全局铁律、目录导航、构建/发版 |
| [../AGENTS.md](../AGENTS.md) | 前端总览：入口、路由表、命令、双形态、主题 |
| [../components/AGENTS.md](../components/AGENTS.md) | 组件层：`ExpenseList` / `MonthOverview` / `StatsPanel` 等内部约定 |
| [../contexts/AGENTS.md](../contexts/AGENTS.md) | Context 层：分类 / 设置 / 首页筛选状态 |
| [../data/AGENTS.md](../data/AGENTS.md) | 数据层：`database.ts` SQL、`dateUtils`、`amountFilter` 纯函数与口径 |
| [../../ARCHITECTURE.md](../../ARCHITECTURE.md) | 面向开发者的架构说明（数据流 / 命名 / 表结构） |
