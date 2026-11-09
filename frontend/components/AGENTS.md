# frontend/components — AI 指导

> 分层 AI 指导体系中的一层：仓库根 AGENTS.md（../../AGENTS.md）是总纲与目录导航。本文件只讲本目录，跨目录总体信息回根文件看。

## 这个目录是干什么的

`frontend/components/` 是**可复用的 UI 组件层**，27 个文件、约 5100 行。页面（`pages/`）只做编排，交互实现基本都落在这一层。

- **没有数据访问封装**：组件按需直接 `import` `../data/database` 的导出函数（`addExpense` / `getDailyTotals` / `getStatsByRange` / `resolveSubDefaults` …）和 `contexts/` 的 hook（`useCategories` / `useSettings`）。这是本项目既有模式，不算越层；但**组件里绝不写 SQL、不 import `@tauri-apps/plugin-sql`**（桌面版 / 网页版的差异由 `data/database.ts` 内部隔离）。
- **桌面版 / 网页版共用同一套组件**：组件内不做环境判断，两形态差异只在数据层。
- **数据向下、事件向上**：筛选、时间范围、写入动作由页面（`HomePage` 等）负责，列表只接收已筛好的 `expenses`；保存成功后靠 `onRefresh()` / 父页面自增 `dataVersion` 触发重新查库，组件不自己订阅数据库。
- **两种行**：已入库记录 `Expense`（`id > 0`）与本地临时行 `LocalRow`（`tempId < 0`，见 `expenseListTypes.ts`）。临时行保存成功才写库，小类为空 = 丢弃。
- **跨页面状态只在 Context**；组件内部只允许存界面态（展开/折叠、编辑中字段、弹层开关），这些一律不落库。

## 组件清单（分组 + 表格：文件 | 职责 | 关键点）

### 布局

| 文件 | 职责 | 关键点 |
|---|---|---|
| `Layout.tsx` | 应用外壳：顶栏导航（统计 / 记账 / 分类 / 设置，统计排第一）+ `<Outlet>` | 唯一由 `App.tsx` 挂载；启动时静默调 `ensureHolidayData()`，结束后广播 `HolidayStatusLine` 导出的 `HOLIDAY_DATA_UPDATED_EVENT`；联网失败静默、不阻塞任何功能 |

### 记账列表与记录

| 文件 | 职责 | 关键点 |
|---|---|---|
| `ExpenseList.tsx` | 列表主组件（1100 行，本目录最大）：按日期倒序分组、缺失日期「+ 添加」快捷行、「当天无消费」只读行、行内编辑状态机、完整编辑弹窗入口、三档折叠/展开、金额筛选预设、连续段折叠 | 真实记录 + 临时行 + 空白日期合并后统一渲染；折叠与编辑状态都在这里；`collectRunLayout()` 在文件顶部（纯函数）；筛选**不**在这里做 |
| `ExpenseRow.tsx` | 单条记录行：日常/非日常徽章、小类、金额、支付方式、收支类型、备注、编辑弹窗按钮、删除 | 金额颜色按收支类型（支出红 / 收入绿 / 不计灰）；0 元且非 ignore → 整行标红提醒补金额；`readOnly` 时全部只读；小类下拉首行「＋ 自定义」（哨兵值 `\u0000custom-sub`）切输入框 |
| `ExpenseCategoryGroup.tsx` | 一天里的一级大类分组：标题行（折叠、笔数、合计、删除整组）+ 记录行 +「添加小类」 | 折叠 key = `date` 与 `l1` 用竖线拼接；搜索中强制展开；大类合计**只排除 ignore**（收入仍计入，与日小计口径不同）；组内小类顺序取分类管理顺序 |
| `CategoryAddPopover.tsx` | 「+ 添加」弹出的大类 / 小类两列联动面板 | 受控组件（悬停大类、自定义输入等状态都在 ExpenseList）；当天已有大类置灰「已有」；支持自定义大类 / 小类（回车确认、Esc 取消） |
| `PaymentMethodTotals.tsx` | 每日支付方式金额徽章 | 只累计 `category === 'expense'` 的记录；按设置页顺序、金额 > 0 才显示；桌面 `hidden sm:flex` / 移动 `sm:hidden` 由 `className` 切换；自带悬浮气泡，未走 HoverTip |
| `EditExpenseDialog.tsx` | 记录完整编辑弹窗（含日期，日期录错不用删了重记） | 左侧 inline `DatePicker` + 右侧字段；金额走 `evaluateExpression`；Esc 关闭；保存调 `onSave(id, ExpenseInput)`，成功后父组件展开目标日期 |
| `expenseListTypes.ts` | 记账列表专用类型：`LocalRow` / `EditField` / `EditForm` | 数据字段一律 snake_case（与数据库列同名）；`EditField` 只覆盖行内可编辑的 5 个字段 |

### 分类管理与规则

| 文件 | 职责 | 关键点 |
|---|---|---|
| `SortableCategoryRow.tsx` | 可拖拽大类行：手柄、默认大类开关、展开、改名、图标选择、删除、小类插槽 | `useSortable` + `sortableRowStyle`；图标用 `EmojiPickerGrid`；**卡片不要加 `overflow-hidden`**（会裁掉拖出卡片的小类行） |
| `SortableSubCategoryRow.tsx` | 可拖拽小类行：默认开关、日常标记、名称、公共属性（支付方式 / 收支类型 / 备注）、规则条数徽章 | 金额不在主行（金额只来自规则）；`>` 尖头和「已启用/总计」都能展开规则区（纯界面态）；HoverTip 用得最密；导出的 `EditField` / `SubEditForm` 与 `expenseListTypes.ts` 的 `EditField` **同名不同义**，import 时看清来源 |
| `SubcategoryRuleList.tsx` | 小类规则列表：启用勾选、条件标签、金额行内编辑、拖拽排序、删除、＋添加规则 | 嵌套 `DndContext` 必须给唯一 id（`rule-dnd-${subId}`）；规则 id 加 `rule-` 前缀；新规则默认「总是 ¥0」；「总是」规则排在前面会挡住后面的规则 → 行内琥珀色警告 |
| `RuleConditionPanel.tsx` | 规则条件面板：总是 / 工作日 / 休息日 / 每周多选 / 每月多选 / 每年某月某日 | 同类多值 = 或、不同类 = 且；工作日与休息日互斥；「总是」= 清空条件；每点一下立即 `onChange` 落库（无确定按钮）；条件按固定 `KIND_ORDER` 排序 |
| `HolidayStatusLine.tsx` | 分类管理页顶部节假日数据状态行 +「立即更新」 | 导出 `HOLIDAY_DATA_UPDATED_EVENT`（`Layout` 也 import 它）；更新走 `ensureHolidayData({ force: true })`；数据没就绪时文案退化为「工作日按周一~周五判断」 |
| `SystemDefaultCategories.tsx` | 「系统默认」只读列：出厂种子分类 + 一键恢复 | 数据直读 `data/categories.ts` 种子（不查库、不受用户增删改影响）；✓ / 日常标记只读展示；已存在的大类 / 小类按钮置灰 |

### 日期、日历与统计

| 文件 | 职责 | 关键点 |
|---|---|---|
| `MonthOverview.tsx` | 记账页顶部：左 1/3 支出日历（可切月份 + 整月锁），右 2/3 上下两张卡（农历黄历卡 + 按天双线图） | 自己查库（`getDailyTotals` / `getDailyTotalsByNonDaily` / `getMonths`），`dataVersion` 触发刷新；悬停经 `hoverBridge` ref 直达 LunarCard，避免折线图跟着重渲染；图表按大类筛选只影响图、不影响列表 |
| `MonthCalendar.tsx` | 42 格固定行数支出日历（农历小字、锁图标、今天徽章） | 月份由父组件控制；金额缩写（≥10 万 → x.x万，否则取整）；**有支出统一浅靛蓝底，不按金额分档**（不是热力图）；点某天 = `onSelectDay(date)`，再点同一天传 `null` |
| `LunarCard.tsx` | 农历黄历卡（干支年月日、宜 / 忌） | 显示优先级 悬停 → 选中 → 今天；悬停 state 在卡片内部（避免整块重渲染）；宜 / 忌单行截断，ResizeObserver 检测后自绘气泡，不用原生 title |
| `TrendChart.tsx` | Recharts 折线图：`TrendLineChart` / `DailyLineChart` / `DailyDualLineChart` | 双线图 Y 轴是 0..1 **分段压缩**（0-100 / 100-200 / 200-500 / 500+），悬浮时 `unitToMoney` 反算真实金额；改轴必须同时改 `moneyToUnit` |
| `StatsPanel.tsx` | 右栏分类排行：大类 / 小类两级、进度条、勾选筛选入口 | `getStatsByRange` 始终统计完整范围（不受筛选影响，才能当筛选入口）；勾选大类 = 选中其全部小类；小类基准取「时间范围内实际出现的」而非分类配置 |
| `DatePicker.tsx` | 单日选择（`@daypicker/react` + `date-fns`） | 值进出都是 `YYYY-MM-DD`；解析一律 `new Date(value + 'T00:00:00')`（不带后缀按 UTC 解析，西半球错一天）；`inline` 模式直接内嵌；可选范围 2020-2030 |
| `DateRangePicker.tsx` | 日期区间选择（双月、鼠标悬停预览） | 第一下选开始、第二下选结束（自动交换方向），选满才 `onChange`；`onComplete` / `onCancel` 交回父页面；默认展示上月 + 本月 |

### 通用交互与拖拽

| 文件 | 职责 | 关键点 |
|---|---|---|
| `InlineSelect.tsx` | 行内自绘下拉（portal 到 body） | 替代原生 `<select>`（WebView 里 `showPicker()` 不可靠自动展开）；`initialOpen` 让点格子即展开；选项 `mousedown` 阻止冒泡，避免触发行级「点外部自动保存」；支持上下键 / Esc；`forwardRef` 给父组件聚焦 |
| `EmojiPicker.tsx` | emoji 选择：`EmojiPickerGrid`（网格 + 自定义粘贴）、`EmojiGrid`（absolute 弹层）、`IconPickerButton`（图标按钮 + 点外部关闭） | 候选来自 `data/emojis.ts`；自定义输入 `maxLength=8`；三个都是具名导出，没有 default |
| `HoverTip.tsx` | 即时悬浮提示气泡（CSS 自绘） | 替代原生 `title`；`text` 为空则原样返回 children（不产生包裹层）；`group/tip` 命名组；`align="right"` 防溢出；包裹层是 span，会顶掉 flex 收缩，记得传 `className="shrink-0"` |
| `ConfirmDialog.tsx` | 确认弹窗（标题、说明、危险色、确认 / 取消） | fixed 全屏遮罩；Esc / 点遮罩 = 取消；`danger` 换 🗑️ 图标与红按钮；无 portal |
| `DragHandle.tsx` | 六点 grip 拖拽手柄 | `touch-action: manipulation`（触摸拖拽前提，dnd-kit 才能在 `touchmove` 里 preventDefault）；`pointer-coarse` 放大到 36×44；`select-none` |
| `sortableConfig.ts` | 拖拽统一配置 | `SORTABLE_TRANSITION` 150ms、`restrictToVerticalAxis`、`useSortableSensors()`（MouseSensor 5px + TouchSensor 250ms/5px）、`sortableRowStyle()`（含拖拽中 zIndex 10）；改手感只改这一处 |

## 必须遵守的约定

### 1. 行内编辑：点格子进入、回车 / 点外部保存

- **交互**：点格子 → 进入编辑（下拉用 `InlineSelect`，金额 / 备注用 `<input>`）→ 回车保存、点行外自动保存；已入库行的下拉选完即保存退出，本地新增行只更新表单（等回车 / 点外部再入库）。
- **为什么**：记账高频操作，弹窗太重；自绘下拉是因为桌面 WebView 里原生 `<select>` 的 `showPicker()` 无法可靠自动展开。
- **金额一律过 `calcUtils.evaluateExpression`**：支持 `5*2` 算式、负数拦截、0 允许保存但列表标红提醒（`ExpenseRow` 的 `isZeroAmount`；ignore 类型不算 0 元异常）。三个入口都要走：`ExpenseList` 保存、`EditExpenseDialog`、`SubcategoryRuleList` 规则金额。
- **编辑旧记录不自动填默认模板**：只有本地新增行（`isLocal` / `tempId < 0`）选小类时才用 `resolveSubDefaults(sub, 记录日期)` 带出默认值；已入库旧记录只改小类。为什么：模板服务「新建」，改旧记录不该悄悄改掉金额 / 备注 / 支付方式。
- **坑**：记录行内编辑**没有 Esc 取消**——`ExpenseList` 的键盘处理只认 Enter，实测按 Esc 不会退出编辑。Esc 只在 `InlineSelect` 面板、两个弹窗、分类改名、自定义小类输入框里生效，别按「行内编辑都支持 Esc」去改。
- 保存细节：用 `editFormRef` / `editingIdRef` 保持最新值（下拉选完同帧保存要读到新值）；本地行「点外部保存」用 `setTimeout(0)`，让控件 change 先触发。

### 2. 悬浮提示：新增一律用 HoverTip，禁止新增原生 title

- **为什么**：桌面版跑在 Tauri 的 WebView 里，原生 `title` 要等约 1 秒、有时干脆不弹；`HoverTip` 是 CSS 自绘，移入即显、移出即隐。
- **用法**：`<HoverTip text="点击锁定" align="right" className="shrink-0"><button/></HoverTip>`。贴近容器右边缘用 `align="right"` 防气泡被裁；包裹层是 `span.relative.inline-flex.group/tip`，会顶掉原按钮的 flex 收缩行为，所以 `className="shrink-0"` 基本是标配；`text` 为空时不产生包裹层。
- **坑**：`HoverTip` 用 `group/tip` 命名组，避免和外层行的 `group`（行 hover 才显示编辑 / 删除按钮）互相触发。
- **现状**：`ExpenseList` / `MonthOverview` / `SortableSubCategoryRow` / `SubcategoryRuleList` 已大量改用 HoverTip，但 components 目录仍有 **35 处**原生 `title`（静态 `title="…"` 26 处 + 动态 `title={…}` 9 处，`grep -o "title=" frontend/components/*.tsx | wc -l`；pages 目录另 22 处），碰到顺手换成 HoverTip，新代码不要新增。

### 3. 拖拽排序（@dnd-kit）四条铁律

1. **不用 `<DragOverlay>`**：让真实行跟着指针移动，拖拽中不改任何外观，只提升 `zIndex`（`sortableRowStyle` 里 `isDragging ? 10`）。为什么：拖拽中的行与静止时样式要完全一致。
2. **乐观更新**：先同步 `setState` 改内存顺序、再后台落库（Context 里的 `applyOrder` + `reorderXxx`）。为什么：dnd-kit 在松手瞬间现测被拖节点位置作为动画终点，等落库完再改界面会「飞回旧位置」（回影）；失败才 `refresh()` 回滚。
3. **批量落库**：排序写库统一走 `database.ts` 的 `buildReorderSql()`（单条 `CASE WHEN` UPDATE），不要 N 次串行 UPDATE。
4. **鼠标与触摸分开设传感器**：统一用 `useSortableSensors()` = `MouseSensor`（移动 5px）+ `TouchSensor`（长按 250ms、容差 5px）。**禁止 `PointerSensor`**：它同时接管鼠标和触摸，无法分设约束，手机上手指一碰就拖、页面滚不动。手柄 `DragHandle` 必须带 `touch-action: manipulation`。
- 嵌套列表要套自己的 `DndContext` 并给唯一 id（`SubcategoryRuleList` 用 `rule-dnd-${subId}`），否则和外层撞车。
- 卡片容器**不要 `overflow-hidden`**：会把拖出卡片的小类行裁掉（`SortableCategoryRow` 已因此去掉）。
- 排序 id 要有前缀区分层级：小类 `sub-`、规则 `rule-`。

### 4. 记账列表折叠：三档 + 两条独立的自动展开通道

- **三档**：第 1 档按天折叠（一行一天）→ 第 2 档天展开 + 大类收起（一天里一个大类一行）→ 第 3 档全部展开（一笔一行）。展开按钮逐档前进，折叠按钮原路退回。
- **代码不记「当前第几档」**：父页面只发命令 `expandCommand = { action, seq }`（每点一次 seq + 1）；`ExpenseList` 用 `useMemo` 从 `expandedDates` + `collapsedMap` + 当前列表算出「下一步」`expandStep` / `collapseStep`，再经 `onExpandControlsChange` 回报父组件（父组件据此禁用到底的按钮、写气泡文案）。为什么：用户中途手动点过某天 / 某个大类后，按钮仍要接着**实际**状态走一档。
- **改的是 state**（`expandedDates` / `collapsedMap`），不是渲染期强制覆盖。**唯一的渲染期覆盖是搜索**：`searchActive` 时 `ExpenseCategoryGroup` 里 `collapsed = !searchActive && collapsedMap.has(key)`，搜索结果强制展开且不改用户状态；搜索中两个按钮在父页面置灰。
- **坑**：不要把金额筛选的 `expandPreset` 塞进 `searchActive`，否则按天 / 大类筛选会变成全部展开，与「一行一天 / 一行一大类」的预期相反。

### 5. 金额筛选的折叠预设 expandPreset

- 三种预设：`collapseDays`（按天）、`expandDaysCollapseL1`（大类）、`expandAll`（单笔）。
- 只在 `${expandPreset}|${expandPresetKey}` 变化时套用一次（`lastExpandPresetKey` ref 去重），之后用户手动点日期 / 大类按常折叠；清空筛选只是停止套用、**不回滚**用户状态。为什么：每次渲染都重新套预设会与用户操作打架。
- 预设按「实际会被渲染的日期」展开：`expenses` + `extraDates` + `missingDates`，别只遍历 `expenses`。

### 6. 连续段折叠 collectRunLayout()

- `ExpenseList.tsx` 顶部纯函数（不依赖 React），未记账快捷行与「当天无消费」行共用：段长 ≤3 全部显示，>3 只显示最早 / 最晚两天，中间折成「+ 更多（N 天）」；展开段首尾各一个「收起」。
- 两套段用 runId 前缀区分：未记账段 `q:`、当天无消费段 `n:`。展开状态共用一个 `expandedRuns` Set，但 key 不同前缀 → 两类段互不影响、也不合并（一眼能分清「还没记」和「已确认没花钱」）。
- 注意：该函数目前是模块内私有（**没有 export**），要单测得先导出；改动时保持纯函数，别引入 React 或读外部可变状态。

### 7. 日期锁 UI（日锁 / 月锁）

- 某天是否锁定 = 月已锁 **或** 该天已锁（`isDateLocked`）。锁定后整组只读：`ExpenseRow` 的 `readOnly` 隐藏编辑 / 删除 / 日常切换，`ExpenseCategoryGroup` 隐藏删除大类与添加小类，`ExpenseList` 隐藏添加与删除当天按钮。
- **锁按钮位置**：已记账日期在日期标题行右侧；**未记录的日期没有标题行，锁按钮放在「+ 添加」快捷行右侧**（点一下 = 确认这天没消费）。HoverTip 文案：未锁「点击锁定」（空白天「点击锁定（视为无消费）」）、已锁「点击解锁」。
- **月锁生效时**行内锁按钮 `disabled` 且提示「整月已锁定，请先解锁整月」；整月锁按钮在 `MonthOverview`（只写月属性，不动日锁）。锁 / 解锁点一下即生效，**没有确认弹窗**（可逆操作，弹框反而添乱）。
- 锁定的空白天 = 一行「当天无消费」：不展开白块、点击标题也不折叠。

### 8. 日历 / 黄历 / 趋势图

- `MonthCalendar` 固定 42 格（6 行）保证卡片高度恒定，邻月补格灰色不可点；金额显示做缩写（≥10 万 → x.x万，否则取整到元）；**所有有支出的格子统一浅靛蓝底，不按金额分档变深**——它不是热力图，别按「越花越深」去改；格子第三行是农历小字（节日红 / 节气绿 / 调休「班」灰底）。
- 月份由父组件（`MonthOverview`）控制，日历自己只存选中 / 悬停；点某天 = `onSelectDay(date)`，**再点同一天传 `null`**（父页面把时间范围设成自定义单天）。
- 悬停联动不要提升到 `MonthOverview` 的 state：日历在左列、黄历卡在右列，悬停事件经 `hoverBridge` ref 直达 `LunarCard` 内部 setState；否则悬停会让折线图反复重渲染 / 重放动画。
- 趋势图 `DailyDualLineChart` 的 Y 轴是分段压缩，悬浮提示要 `unitToMoney` 反算真实金额；改分段比例时 `moneyToUnit` / `unitToMoney` 必须成对改。

### 9. 数据口径与刷新

- **统计只算 expense**：日小计 `dayTotal`、`PaymentMethodTotals` 只累计 `txTypeByCode.get(type)?.category === 'expense'`，收入与「不计」不参与。
- **已知不一致（改统计前先确认）**：`ExpenseCategoryGroup` 的大类合计只排除 `ignore`（收入仍计入），与日小计 / 全局统计口径不同。
- 排序基准：每天的大类顺序用 `categories.findIndex`，组内小类顺序用 `categories` 里 `children` 的顺序。
- 组件不缓存业务数据：写操作完成后调 `onRefresh()`，由父页面自增 `dataVersion` 触发重新查库；`MonthOverview` / `StatsPanel` 都靠这个版本号刷新。

### 10. 弹窗与浮层

- 两类弹窗都是 fixed 全屏遮罩 + 白卡片：`ConfirmDialog`（确认 / 危险色）、`EditExpenseDialog`（左日历右字段、底部按钮固定、中间可滚动）。
- 浮层全部自绘、不用第三方 Popover：`CategoryAddPopover`（两列联动）、`EmojiPicker`（`EmojiGrid` absolute 撑满父宽 / `IconPickerButton` 自带点外部关闭）、`InlineSelect`（portal 到 body）。
- 点外部关闭统一用 `document.addEventListener('mousedown')` + `ref.contains()` 判断，**记得在 cleanup 里 remove**（每条 useEffect 都要有对应的 removeEventListener）。
- Esc：`ConfirmDialog` / `EditExpenseDialog` 监听 document keydown；`InlineSelect` 与各输入框各自处理。

## 改动检查清单

- [ ] 新增悬浮提示用的是 `HoverTip`（带 `align` / `shrink-0`），没有新增原生 `title`。
- [ ] 新增金额输入走 `evaluateExpression`，负数拦截、0 元标红逻辑没被破坏。
- [ ] 桌面版与网页版都验证过（不要 import Tauri API；数据库操作只走 `data/database.ts`）。
- [ ] 列表相关改动：三档折叠 / 展开仍「一次走一档」，搜索强制展开未被改写，金额筛选预设仍只套用一次。
- [ ] `collectRunLayout()` 仍是纯函数，`q:` / `n:` 两套段的展开状态没有互相污染。
- [ ] 拖拽改动：没有 `<DragOverlay>`、仍是乐观更新 + `buildReorderSql()`、仍是 MouseSensor + TouchSensor、手柄仍有 `touch-action`。
- [ ] 锁定日期仍然整组只读（编辑 / 删除 / 添加入口都藏了），月锁生效时行内锁按钮仍置灰。
- [ ] 新增 / 改名文件后，同步更新本文件的组件清单（必须与 `ls frontend/components/` 一一对应）。
- [ ] `npm run typecheck` 与 `npm run lint` 通过（项目没有自动化测试框架，手工回归记账主流程）。

## 相关文档

- 仓库根总纲与目录导航：[../../AGENTS.md](../../AGENTS.md)
- 前端总览（入口 / 路由 / 主题 / 双形态）：[../AGENTS.md](../AGENTS.md)
- 数据层（schema、日期 / 金额 / 规则 / 节假日纯函数）：[../data/AGENTS.md](../data/AGENTS.md)
- 全局状态（分类 / 设置 / 首页筛选）：[../contexts/AGENTS.md](../contexts/AGENTS.md)
- 页面编排（筛选联动、时间范围）：[../pages/AGENTS.md](../pages/AGENTS.md)
- 面向开发者的架构与命名规范：[../../ARCHITECTURE.md](../../ARCHITECTURE.md)
- 版本变更记录：[../../CHANGELOG.md](../../CHANGELOG.md)
