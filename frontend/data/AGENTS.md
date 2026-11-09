# frontend/data — AI 指导

> 分层 AI 指导体系中的一层：仓库根 AGENTS.md（../../AGENTS.md）是总纲与目录导航。本文件只讲本目录，跨目录总体信息回根文件看。

## 这个目录是干什么的

`frontend/data/` 是**数据层**，只有两类东西：

1. **唯一的数据访问入口**：`database.ts` 封装全部 SQL，并负责在**桌面版（Tauri SQL 插件）**与**网页版（sql.js + IndexedDB）**之间运行时自动切换；`webDb.ts` 提供网页版连接与浏览器持久化。页面 / 组件 / Context **直接调用 `database.ts` 的导出函数**，不各自写 SQL。
2. **纯函数工具与静态种子**：类型、日期、金额表达式、金额筛选、拖拽重排、小类条件规则匹配、节假日抓取节流、农历、分类种子。这些文件**不依赖 React**（本目录全目录无 `react` import），也基本不依赖数据库，可单独验证、被任何层复用。

边界（必须守）：

| 允许 | 禁止 |
|---|---|
| 在这里定义 schema、SQL、迁移、内存缓存、纯计算 | 在组件 / 页面里直接 `CREATE TABLE` 或 import `@tauri-apps/plugin-sql` |
| 全项目直接调用 `database.ts` 导出函数 | 给数据层加 UI 状态（筛选条件、折叠档位、弹窗开关属于 Context / 页面） |
| 纯函数用返回 `null` / 返回原引用表示「不生效 / 不合法」 | 用 `eval` 做金额计算，或用抛异常处理正常业务分支 |

依赖方向（单向，不要反向）：

```
pages/ · components/ · contexts/  →  data/database.ts  →  webDb.ts ─┬→ Tauri SQL 插件（桌面）
                                                                      └→ sql.js + IndexedDB（网页）
```

## 文件清单

| 文件 | 职责 | 关键点（导出 / 改动注意） |
|---|---|---|
| `types.ts` | 全项目共享类型 | `Expense` / `ExpenseInput`（`payment_method`、`type`、`is_non_daily`）、`CategoryWithChildren` / `SubCategoryChild`（`default_*`）、`SubcategoryRule` / `RuleCondition`、`RangeMode`、`MonthlyStats`、`BUILTIN_TX_CODES`。字段一律 snake_case 且与 DB 列同名；加字段先改 DB 再改类型与映射。 |
| `categories.ts` | 出厂种子数据（不是库里的数据） | `categories`（**11 大类 / 56 小类**，餐饮饮食的 🥚早餐 / 🍚午餐 / 🍜晚餐 `is_default: true`）、`DEFAULT_PAYMENT_METHODS`（4）、`DEFAULT_TX_TYPES`（3，`value` 即记录里的 `code`）、`NON_DAILY_DEFAULT_NAMES`（9 个固定开销小类）、`getAllSubCategories()`。⚠️ 小类名**必须带 emoji 前缀**，否则 `NON_DAILY_DEFAULT_NAMES` 匹配不上；改种子只影响**新装库**，老库得走迁移或让用户在分类管理页改。 |
| `dateUtils.ts` | 本地日期工具 | `localDateString` / `localMonthString` / `formatDate` / `getWeekday` / `formatMonth` / `addDays` / `eachDay` / `getRangeDates`（week / 30d / month / lastMonth / history / custom）。解析 `YYYY-MM-DD` 必须 `+ 'T00:00:00'` 按本地时间解析；`month` 返回整月 1 号→月末（含未来日期）。 |
| `calcUtils.ts` | 金额表达式计算 | `evaluateExpression(input)`：支持 `+ - * / ()` 与小数、全角/中文符号（`× ÷ ＋ － （）`），**递归下降、不用 eval**；除零 / 语法错返回 `null`；结果四舍五入 2 位。所有行内金额输入都应过它。 |
| `amountFilter.ts` | 记账列表金额筛选（纯函数） | `applyAmountFilter(list, mode, threshold, isExpenseType)`、`parseAmountThreshold`（只认 > 0）、`sanitizeAmountInput`（只留数字 + 两位小数，不接受算式）。`day` / `category` 是**分组门槛**（只累计计入支出的金额，命中的分组整体保留）；`single` 直接比单条金额。不依赖 DB / React，可直接单测。 |
| `reorderUtils.ts` | 拖拽排序的纯函数 | `applyOrder(prev, orderedIds)`：按 id 重排返回新数组；数量对不上（并发增删）原样返回，顺序没变返回原引用（让 React 跳过重渲染）。供 CategoryContext / SettingsContext 做乐观更新。 |
| `database.ts`（1235 行，本目录最大） | **唯一数据访问层 + schema 唯一维护处** | 单例连接（`db` / `dbInit`，失败重试 2 次、每次间隔 300ms）；建表 / 迁移 / 播种 / 内存缓存；导出 60+ 函数：记录 CRUD、`listExpenses`、`getDailyTotals*`、`getStatsByRange`、`getTrendData`、`getMonths`、预算、锁、`expensesToCSV`、分类 / 小类 / 规则、支付方式 / 收支类型、工作日判定。**加表加列只改这里**，SQL 必须桌面 / 网页都能跑。 |
| `subcategoryRules.ts` | 小类条件规则的模型 + 纯匹配 | `parseConditions` / `serializeConditions`（脏数据退化成 `[]` = 总是）、`conditionsMatch`、`matchRulesAmount`（跳过 `enabled=false`、命中第一条）、`splitLocalDate`（按年/月/日分量算本地星期，不解析日期字符串）、`fallbackIsWorkday`、`describeConditions`。**不依赖 DB / React / date-fns**；改规则语义先改这里。 |
| `holidaySync.ts` | 节假日数据源 + 节流（纯逻辑，不碰 DB） | `collectBuiltinHolidayDays`（lunar-javascript 内置 2001–当年）、`fetchHolidayYear`（holiday-cn 静态 JSON，超时 8s，**永不抛异常**）、`shouldCheckYear`（24 小时节流）、`holidayFetchTargets`（当年未就绪一直试 / 次年 10 月起才试 / 单次最多 4 年）。常量：`BUILTIN_FIRST_YEAR=2001`、`CHECK_INTERVAL_MS`、`NEXT_YEAR_CHECK_FROM_MONTH=10`、`MAX_YEARS_PER_RUN=4`。 |
| `webDb.ts` | 网页版数据层 | `isTauri()`、`createWebDbConnection()`、`DbConnection`（与 Tauri 插件同形的 `execute` / `select`）。sql.js 在浏览器里跑 SQLite，`export()` 成字节存 IndexedDB；写入后 400ms 防抖保存，`beforeunload` / `visibilitychange` 立刻 flush；`$1..$n` 自动转命名绑定（乱序占位也正确）。**接口改形会同时影响两种形态**。 |
| `lunarUtils.ts` | 农历 / 节气 / 节日 / 黄历（日历展示用） | `getDayExtra(date)`（格子小字：法定节假日 > 传统节日 > 节气 > 农历日；调休上班显示「班」）、`getDayLunarInfo(date)`（干支 / 农历月日 / 宜忌）。数据直接来自依赖库 `HolidayUtil`，**不读 `holidays` 表**；带 Map 缓存，纯本地计算、无需联网。 |
| `lunar-javascript.d.ts` | 补齐 `lunar-javascript` 的类型声明 | npm 包不带 types，这里只声明项目用到的 API（`Solar` / `Lunar` / `Holiday` / `HolidayUtil`）。不要删；升级依赖时按真实 API 同步。 |
| `emojis.ts` | 共享 emoji 候选表 | `EMOJI_LIST`（32 个），分类 / 设置页的图标选择器共用。加 emoji 直接追加即可。 |

## 数据库表结构

11 张表，全部在 `database.ts` 的 `connectDb()` 里用 `CREATE TABLE IF NOT EXISTS` 建。schema **只此一处**，Rust 后端不建表。

| 表 | 关键字段 | 用途 / 注意 |
|---|---|---|
| `expenses` | `id, amount, category_l1, category_l2, date, note, payment_method, type, is_non_daily, created_at` | 消费记录。分类 / 支付方式存**名称文本**（分类改名不影响旧记录；支付方式改名由 `updatePaymentMethodName` 迁移历史 + 小类默认模板）；`type` 存 `tx_types.code`（改名无需迁移）；`is_non_daily` 0=日常 / 1=非日常。 |
| `categories` | `id, name(UNIQUE), icon, sort_order, is_default` | 一级大类；`is_default` = 是否参与「添加某天」批量自动记账。 |
| `subcategories` | `id, category_id(FK), name, is_default, sort_order, default_note, default_payment_method, default_amount, default_type, default_is_non_daily` | 二级小类 + 公共属性模板。⚠️ `default_amount` 是**历史遗留列**（只作为迁移 v2 的种子源，运行期无人读取）；金额唯一来源是 `subcategory_rules`。`is_default` 只管批量自动记账带不带它。 |
| `subcategory_rules` | `id, subcategory_id(FK), sort_order, enabled, conditions(JSON), amount` | 小类条件规则；`sort_order` 即匹配优先级，`conditions='[]'` = 总是，`enabled=0` 跳过。**金额唯一来源**。 |
| `budgets` | `id, month(UNIQUE), amount` | 月度预算，一月一行。 |
| `payment_methods` | `id, name(UNIQUE), icon, sort_order` | 支付方式配置；记录里存 name。 |
| `tx_types` | `id, code(UNIQUE), name, icon, category, sort_order` | 收支类型；`category ∈ expense / income / ignore` 决定统计归属；自定义类型 `code = 't_<id>'`。 |
| `month_attributes` | `month(PRIMARY KEY), is_locked` | 月份属性表（一月一行，当前只有锁）；月锁优先级高于日锁。 |
| `day_attributes` | `date(PRIMARY KEY), is_locked` | 日期属性表（一天一行，当前只有锁）；解锁只置 0 保留行，方便将来挂别的属性。 |
| `holidays` | `date(PRIMARY KEY), year, name, is_off_day` | 只存**特殊日期**（放假 + 调休补班），`is_off_day=0` = 补班；查不到就按周一~周五推。 |
| `holiday_years` | `year(PRIMARY KEY), ready, source, fetched_at, last_checked_at` | 每年一行：数据是否就绪、来源（builtin / holiday-cn）、最近联网检查时间（24 小时节流用）。 |

### 建表与迁移（都在 `database.ts` 的 `connectDb()` 里，按顺序执行）

- **幂等建表**：`CREATE TABLE IF NOT EXISTS` + 逐条 `ALTER TABLE ... ADD COLUMN` 包在 `try/catch` 里（列已存在就忽略）。
- **新装播种**：`categories` / `payment_methods` / `tx_types` 都是 `COUNT(*) === 0` 才播种，`holiday_years` 为空才导内置节假日。⚠️ 因此用户把某张表**删光后重启会被重新播种**，这不是「只播一次」。
- **迁移 v1（`user_version < 1`）**：把「餐饮饮食」的 🥚早餐 / 🍚午餐 / 🍜晚餐 回填为默认小类（新装播种已带，老库靠这条补）。
- **迁移 v2（`user_version < 2`）**：给 `is_default=1` 或 `default_amount<>0` 的小类生成一条「总是」规则，金额 = 旧 `default_amount`（`NOT EXISTS` 防重复），升级后自动记账结果与升级前一致。
- 两条迁移都靠 `PRAGMA user_version` 一次性执行（置 1 / 置 2 后不再跑），用户之后的删除 / 取消默认**不会被改回**。
- **外键声明了但不生效**：SQLite 默认不开 `foreign_keys`，所以删大类 / 小类时**手动**先删 `subcategory_rules` 再删本体（`deleteCategory` / `deleteSubCategory`）。
- **5 个内存缓存**，连库时载入、写操作后同步：`subRules`（规则整表，按小类分组）、`holidayDays` / `holidayYears`、`lockedMonths` / `lockedDays`（只读 `is_locked=1`）。规则写操作后必须 `reloadSubRules()`；锁操作直接改 Set；节假日同步成功后再 `loadHolidayCache()`。
- **双形态连接**：`isTauri() ? Database.load('sqlite:one_ledger.db') : createWebDbConnection()`。SQL 只用两边都支持的语法（`$1..$n`、`strftime`、`date('now','localtime')`、`INSERT OR REPLACE`、`CASE WHEN`、`PRAGMA user_version`）。

## 必须遵守的约定

| 约定 | 正确做法 | 为什么 / 不这么做会怎样 |
|---|---|---|
| **本地日期** | 日期一律走 `dateUtils.ts`；解析 `YYYY-MM-DD` 必须 `+ 'T00:00:00'`；要拆年月日就用 `subcategoryRules.splitLocalDate`（按分量算） | `toISOString()` 走 UTC：凌晨 0–8 点（或西半球时区）日期会错一天，`new Date('2026-07-01')` 会按 UTC 解析。历史上修过这个 bug，别再引入。 |
| **金额** | 入库前过 `calcUtils.evaluateExpression`；`null` = 非法，拒绝保存；负数拦截；0 允许但标红提醒 | 用 `eval` 有安全与注入风险（用户输入直接执行）；自己写 `parseFloat` 会丢失 `5*2` 这类算式支持。 |
| **金额筛选** | 阈值只认 `> 0`；`day` / `category` 只累计 `isExpenseType` 的金额；`single` 直接比单条 | 阈值 0 等于不筛选（金额非负）；把收入 / 不计算进合计会让「今天花了 100」的口径与蓝色卡不一致。纯函数，别塞 React 状态。 |
| **小类条件规则** | 金额**只**来自 `subcategory_rules`；同类多值 = 或、不同类 = 且；`conditions='[]'` = 总是；跳过 `enabled=0`；以**记录那天**判定；4 个取默认值入口统一调 `resolveSubDefaults` | 复活 `default_amount` 会造出「两套金额来源」，改规则不生效；用「今天」判定会让补记的历史日期算错；各入口各写一遍必然分叉。 |
| **勾选默认小类会自动补规则** | `toggleSubCategoryDefault(id, true)` 时若该小类一条规则都没有，自动插入一条「总是 ¥0」（`sort_order=0`） | 默认小类要参与「添加某天」批量记账，而批量入口只认「有规则命中」的小类；没有这条兜底规则，用户勾了 ✓ 却什么也不会生成。勾选前已有规则则不插手。 |
| **节假日 / 工作日** | 表里只存特殊日期，查不到按周一~周五；判定用同步函数 `isWorkday` / `isRestDay` / `getHolidayName`；联网失败静默 | 同步是硬要求（筛选 / 自动记账渲染期频繁调用），改成 async 会让列表闪错；把「没数据」当成「全上班」会漏算调休补班。换数据源只改「写进这两张表」的代码，匹配逻辑一行都不用动。 |
| **日期锁** | 所有写记录的函数（`addExpense` / `updateExpense` / `deleteExpense` / `deleteExpensesByDate` / `deleteExpensesByCategory`）开头 `assertDateEditable`；改记录时**新旧日期都要过**；锁定 = 月已锁 或 该天已锁 | UI 藏按钮只是第二道防线，绕过 UI 的调用必须被数据层拦住；月锁 / 日锁两个属性互不改写，自动同步会让「锁整月不影响单独锁过的天」这条语义失效。唯一例外：`updatePaymentMethodName` 的批量改名会写到锁定日期的记录（元数据改名，非内容修改）。 |
| **缓存一致性** | 分类 / 规则增删改后 `reloadSubRules()`；锁操作用 `setMonthLocked` / `setDayLocked`（内部同步 Set），别直接改表 | 规则匹配是同步读缓存的，缓存不刷新 = 改完规则界面不生效，直到重启。 |
| **双形态兼容** | 新功能只走 `database.ts` 导出函数；不 import Tauri 专属 API；不依赖只桌面可用的 SQL 特性 | 网页版是同一份代码跑 sql.js，写了 Tauri 专属调用浏览器直接崩；网页数据只存在该浏览器的 IndexedDB，清缓存 / 换设备 / 换浏览器都会丢，应用不会自动备份（只能靠用户导出 CSV）。 |
| **排序落库** | 重排统一走 `buildReorderSql()`（单条 `CASE WHEN` UPDATE），配合 `reorderUtils.applyOrder` 先改内存再落库 | N 次串行 UPDATE 会让拖拽落位等待变长；先落库再改 state 会「回影」（动画飞回旧位置）。 |
| **字段命名** | DB 列 / 数据行类型 / 界面拼装类型一律 snake_case 且同名；函数与局部变量 camelCase | 数据字段一律与 DB 列一致，读代码不用猜；混用 camelCase 曾导致 `isDefault` / `is_default` 两套字段。 |
| **CSV 导出** | `expensesToCSV(expenses, txTypes)`：带 UTF-8 BOM、逗号 / 引号 / 换行转义 | 少 BOM 时 Excel 打开中文乱码；不转义时备注含逗号会把列错位。 |

## 改动检查清单

- [ ] **加表**：在 `connectDb()` 里 `CREATE TABLE IF NOT EXISTS`；要不要 `user_version` 迁移回填老库？sql.js 能跑吗？`types.ts` 与聚合函数是否要同步？
- [ ] **加字段**：`CREATE TABLE` 与 `ALTER TABLE` **两条都要**（新装 + 老库）；`types.ts` 行类型 / Input 加同名列；`addExpense` / `updateExpense` / `listExpenses` 的 SQL 与映射同步；`expensesToCSV` 是否要带这列。
- [ ] **动金额逻辑**：确认金额仍只来自 `subcategory_rules`，没有顺手复活 `default_amount`；`resolveSubDefaults` 是唯一「取默认值」入口。
- [ ] **加纯函数**：放 `data/` 且不 import React / database；非法输入返回 `null` 或原引用，不抛异常（沿用 `amountFilter` / `applyOrder` 风格），方便将来直接单测。
- [ ] **动日期**：用 `localDateString` 而非 `toISOString`；新解析路径是否带 `T00:00:00`；跨时区 / 凌晨时段过一遍。
- [ ] **动锁**：新增写记录入口是否也 `assertDateEditable`；月锁 / 日锁是否仍互不改写；解锁是否只置 0 保留行。
- [ ] **动节假日**：是否只写 `holidays` / `holiday_years`；24 小时节流、次年 10 月、单次 4 年常量是否被破坏；联网失败是否仍静默。
- [ ] **动分类种子**：只影响新装库；老库是否需要迁移；`NON_DAILY_DEFAULT_NAMES` 的名字是否仍带 emoji 且与 `categories.ts` 完全一致。
- [ ] **动 webDb**：`DbConnection` 形状是否保持；防抖保存 / 关页 flush 是否仍生效；网页版是否仍能建表迁移。
- [ ] **动规则**：语义改动先改 `subcategoryRules.ts`（纯函数），再改 `database.ts` 的缓存；规则条数徽章 / 条件标签用 `describeConditions`，别在组件里另写一套文案。
- [ ] **跑检查**：`npm run typecheck`、`npm run lint` 必须过。项目**没有测试框架**，纯函数改动请手动验证边界（空串、0、负数、除零、脏 `conditions`）。
- [ ] **同步文档**：新增 / 改名 / 删除本目录文件，或改了下表里的约定 → 同步更新本文件「文件清单」「必须遵守的约定」。

## 相关文档

| 文档 | 什么时候读 |
|---|---|
| [../../AGENTS.md](../../AGENTS.md) | 总纲：项目定位、全局铁律、目录导航、发版流程 |
| [../AGENTS.md](../AGENTS.md) | 前端总览：入口、路由、双形态、开发命令 |
| [../components/AGENTS.md](../components/AGENTS.md) | 谁在调数据层，以及行内编辑、HoverTip、拖拽排序等 UI 约定 |
| [../contexts/AGENTS.md](../contexts/AGENTS.md) | 分类 / 设置 / 首页筛选三个 Context 的缓存与 refresh 时机 |
| [../pages/AGENTS.md](../pages/AGENTS.md) | 页面如何组合数据层查询（筛选链路、统计口径） |
| [../../ARCHITECTURE.md](../../ARCHITECTURE.md) | 命名规范、数据流、双形态；⚠️ 其「数据库表结构」章节滞后（缺 `subcategory_rules` / `holidays` / `holiday_years`），以代码与本文件为准 |
| [../../CHANGELOG.md](../../CHANGELOG.md) | 历史版本改动都在这里；AGENTS.md 不堆变更流水账 |
