# frontend/contexts — AI 指导

> 本文件是「分层 AI 指导」体系中的一层：仓库根 [AGENTS.md](../../AGENTS.md) 是总纲与目录导航，上一层 [frontend/AGENTS.md](../AGENTS.md) 是前端总览。本文件只讲 `contexts/`。

## 这个目录是干什么的

三个 React Context，负责**跨页面、跨组件共享的全局状态**。它们在 `main.tsx` 里嵌套包裹整个 App，数据只从 `data/database.ts` 取，写操作也只经 `database.ts` 落库。

用 Context 的原因有两条：① 分类 / 支付方式这类配置几乎每个页面都要用，避免每处重复查库；② 首页筛选状态要**在切页后保留**（`HomePage` 卸载时组件内 `useState` 会销毁，放 Context 才能切回来还是原来的筛选）。

## 文件清单

| 文件 | 导出的 hook | 职责 |
|---|---|---|
| `CategoryContext.tsx` | `useCategories()` | 分类树（大类 + 小类）+ 小类条件规则，全局唯一副本，含全部增删改 / 拖拽重排 |
| `SettingsContext.tsx` | `useSettings()` | 支付方式、收支类型配置，另提供「哪些是支出类型」的派生数据 |
| `HomeFilterContext.tsx` | `useHomeFilter()` | 首页筛选状态（时间范围 / 支付方式 / 日常性 / 分类 / 金额筛选 / 趋势大类 / 快捷行开关） |

命名约定：文件名 `XxxContext.tsx`，导出 `XxxProvider` + `useXxx()`；hook 必须在 `XxxProvider` 内使用，否则抛错。

---

## CategoryContext（`useCategories`）

**状态**：`categories: CategoryWithChildren[]`（大类套小类）、`rulesBySub: Record<number, SubcategoryRule[]>`（小类 id → 规则列表）、`loading`。

**方法**（全部 `useCallback`，写库后 `refresh()` 保持同步）：

| 分组 | 方法 |
|---|---|
| 大类 | `addCategory` / `deleteCategory` / `updateCategoryName` / `updateCategoryIcon` / `toggleCategoryDefault` / `reorderCategories` |
| 小类 | `addSubCategory` / `deleteSubCategory` / `updateSubCategoryName` / `toggleSubCategoryDefault` / `updateSubCategoryDefaults` / `reorderSubCategories` |
| 小类规则 | `addRule` / `updateRule` / `deleteRule` / `clearRules` / `reorderRules` |
| 刷新 | `refresh()` 重拉分类树；`refreshRules()` 重拉规则 |

**关键约定**：

- **拖拽重排必须乐观更新**：`reorderCategories` / `reorderSubCategories` / `reorderRules` 先 `setState` 改内存顺序（配合 `data/reorderUtils.ts` 的 `applyOrder`），再后台批量落库；落库失败才 `refresh()` 回滚。原因见 [components/AGENTS.md](../components/AGENTS.md) 的「拖拽排序四条铁律」。
- 规则的 `sort_order` 就是匹配优先级，重排 = 改优先级；规则匹配逻辑本身在 `data/subcategoryRules.ts`（纯函数），**Context 不做匹配计算**。
- `toggleCategoryDefault` 只改大类是否参与「添加某天」自动记账，不影响已有记录。

---

## SettingsContext（`useSettings`）

**状态**：`paymentMethods: PaymentMethodConfig[]`、`txTypes: TxTypeConfig[]`、`loading`。

**派生值**（`useMemo`，统计口径的唯一来源）：

- `expenseCodes: string[]`：所有 `category === 'expense'` 的收支类型 code。**所有支出统计都要用它**（或 SQL 里的等价子查询）。
- `defaultExpenseCode`：新建记录默认用的支出类型 code。

**方法**：`addPaymentMethod` / `deletePaymentMethod` / `updatePaymentMethodName` / `updatePaymentMethodIcon` / `reorderPaymentMethods`；`addTxType` / `deleteTxType` / `updateTxTypeName` / `updateTxTypeIcon` / `reorderTxTypes`；`refresh()`。

**关键约定**：

- **支付方式在记录里存的是 `name`**：改名时 `database.ts` 会同步迁移历史记录的 `payment_method`，所以不能绕过 `updatePaymentMethodName` 直接改库。
- **收支类型在记录里存的是 `code`**：改名只改配置表，历史记录无需迁移；自定义类型的 code 形如 `t_<id>`。
- 内置兜底 code 见 `data/types.ts` 的 `BUILTIN_TX_CODES = ['expense','income','ignore']`。

---

## HomeFilterContext（`useHomeFilter`）

**为什么独立**：首页筛选是纯内存状态（关应用重开恢复默认），但要在切页后保留，所以提升到全局。

**状态字段**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `rangeMode` | `'week' \| '30d' \| 'month' \| 'lastMonth' \| 'history' \| 'custom'` | 时间范围模式（`RangeMode`） |
| `historyMonth` | `string` | 仅 `rangeMode === 'history'` 时有效（`YYYY-MM`） |
| `customRange` | `{ start, end }` | 仅 `custom` 时有效；默认都是今天 |
| `paymentFilter` | `string` | 支付方式名，`''` = 不筛选 |
| `dailyFilter` | `'' \| 'daily' \| 'nonDaily'` | 日常 / 非日常筛选 |
| `selectedCats` | `Set<string>` | 分类筛选，键是「大类+小类」组合 `catKey`；选大类 = 其所有小类选中 |
| `trendCategory` | `string` | 趋势图看的大类，`''` = 全部 |
| `showQuickAdd` | `boolean` | 记账列表是否显示缺失日期的「+ 添加」快捷行 |
| `amountFilterMode` | `'day' \| 'category' \| 'single'` | 金额筛选条件（`AmountFilterMode`） |
| `amountFilterValue` | `string` | 金额阈值输入值，`''` 或 ≤0 = 不筛选 |
| `clearFilters()` | 方法 | 清支付方式 + 日常性 + 分类 + 金额阈值，并把条件复位 `day`；**保留时间范围** |

**关键约定**：

- Context **只存原始状态**，派生计算放页面：范围起止日由 `data/dateUtils.getRangeDates` 在页面里算，筛选判定由 `data/amountFilter.applyAmountFilter` 等纯函数算。不要把计算结果塞回 Context。
- 新增一种筛选时，要同步考虑三处：`HomeFilterContext` 加状态、`clearFilters()` 清它、页面的 `hasAnyFilter` 计入它（否则「筛选生效隐藏快捷行」会漏）。
- `showQuickAdd` 与「筛选」无关：它是显示开关，不受 `clearFilters` 影响。

---

## 必须遵守的约定

1. **只有多页面 / 多组件共享的状态才放 Context**。页面私有状态留在页面（例：列表折叠档位、`expandCommand` 命令对象都在 `HomePage` / `ExpenseList`，故意不进 Context）。
2. **Context 只做「取数 + 写库 + refresh」**，业务计算交给 `data/` 的纯函数（可脱离 React 单测 / 复用）。
3. **写操作后必须 refresh**（或按乐观更新规则先改内存再落库），否则界面与库不一致。
4. **新增 hook 名字要加进 `.oxlintrc.json` 的 `react/only-export-components` 白名单**（当前白名单：`useCategories` / `useSettings` / `useHomeFilter`）。
5. **Provider 嵌套顺序在 `main.tsx`**：Category 在最外层。新增 Provider 要插在正确层级，且保证被依赖的在外面。
6. 用 `createContext(null!)` + hook 内抛错（现有写法），不要用默认空对象糊弄。

## 改动检查清单

- [ ] 新状态确实需要跨页面共享吗？只在页面用的别放进来
- [ ] 写操作有 refresh 或乐观更新吗？失败能回滚吗？
- [ ] 新增 hook 已加进 oxlint 白名单
- [ ] 动 HomeFilter 的三个联动点（状态 / clearFilters / hasAnyFilter）都改了吗
- [ ] 相关 `AGENTS.md`（本文件、`pages/AGENTS.md`）已同步

## 相关文档

- 总纲：[../../AGENTS.md](../../AGENTS.md) ｜ 前端总览：[../AGENTS.md](../AGENTS.md)
- 数据层（Context 的数据来源）：[../data/AGENTS.md](../data/AGENTS.md)
- 使用方：页面层 [../pages/AGENTS.md](../pages/AGENTS.md) ｜ 组件层 [../components/AGENTS.md](../components/AGENTS.md)
