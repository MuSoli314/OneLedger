// 记账列表按日分组内的「一级大类」分组（标题行可折叠 + 该大类的记录行 + 添加小类按钮）
import ExpenseRow from './ExpenseRow'
import type { CategoryWithChildren, Expense, PaymentMethodConfig, TransactionType, TxTypeConfig } from '../data/types'
import type { EditField, EditForm } from './expenseListTypes'

interface Props {
  date: string
  l1: string
  l1Items: Expense[]
  isLastL1: boolean
  collapsedMap: Set<string>
  searchActive?: boolean
  /** 只读（该日期已锁定）：隐藏删除大类 / 添加小类入口，记录行不可编辑 */
  readOnly?: boolean
  categories: CategoryWithChildren[]
  paymentMethods: PaymentMethodConfig[]
  txTypeByCode: Map<string, TxTypeConfig>
  onToggleCollapse: (key: string) => void
  onDeleteCategory?: (date: string, category_l1: string) => void
  onAddSubCategory: (date: string, l1: string) => void
  // 行内编辑（透传给 ExpenseRow）
  editingId: number | null
  editForm: EditForm
  focusField: EditField | null
  editRef: React.RefObject<HTMLDivElement | null>
  onEditFormChange: (form: EditForm) => void
  onStartEditing: (expense: Expense, field?: EditField) => void
  onSaveRow: (id: number) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onDelete: (expense: Expense) => void
  onOpenEditDialog: (expense: Expense) => void
  onUpdate: (id: number, category_l2: string, note: string, amount: number, payment_method: string, type: TransactionType, is_non_daily: boolean) => Promise<void>
  onRefresh?: () => void
}

export default function ExpenseCategoryGroup({
  date,
  l1,
  l1Items,
  isLastL1,
  collapsedMap,
  searchActive,
  readOnly,
  categories,
  paymentMethods,
  txTypeByCode,
  onToggleCollapse,
  onDeleteCategory,
  onAddSubCategory,
  editingId,
  editForm,
  focusField,
  editRef,
  onEditFormChange,
  onStartEditing,
  onSaveRow,
  onKeyDown,
  onDelete,
  onOpenEditDialog,
  onUpdate,
  onRefresh,
}: Props) {
  // 该大类合计（ignore 类型不参与金额合计，与其它统计口径一致）
  const l1Total = l1Items.reduce((s, e) => s + (txTypeByCode.get(e.type)?.category === 'ignore' ? 0 : e.amount), 0)
  // 按分类管理器中的小类顺序显示
  const cat = categories.find((c) => c.name === l1)
  const subOrder = new Map(cat?.children.map((c, i) => [c.name, i]) || [])
  const sortedL1Items = [...l1Items].sort((a, b) => {
    const ai = subOrder.get(a.category_l2) ?? 999
    const bi = subOrder.get(b.category_l2) ?? 999
    return ai - bi
  })
  const collapseKey = `${date}|${l1}`
  // 搜索中强制展开大类（搜索结果直接可见）；否则按用户手动折叠状态
  const collapsed = !searchActive && collapsedMap.has(collapseKey)
  const catIcon = categories.find((c) => c.name === l1)?.icon || '📂'

  return (
    <div>
      {/* 大类标题行（可点击折叠） */}
      <button
        onClick={() => onToggleCollapse(collapseKey)}
        className={`w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left cursor-pointer ${
          isLastL1 && collapsed ? '' : 'border-b border-slate-50'
        } ${collapsed ? 'rounded-b-xl' : ''}`}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              collapsed ? '-rotate-90' : ''
            }`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-lg">{catIcon}</span>
          <span className="text-base font-semibold text-slate-700">{l1}</span>
          <span className="text-sm text-slate-400 ml-1">
            {l1Items.length}笔
          </span>
        </div>
        <span className="text-sm font-medium text-slate-500 tabular-nums">
          合计 ¥{l1Total.toFixed(2)}
        </span>
        {onDeleteCategory && l1Items.length > 0 && !readOnly && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteCategory(date, l1) }}
            className="ml-1.5 w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
            title="删除本大类所有记录"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </button>

      {/* 该大类的每一条记录（折叠时隐藏） */}
      {!collapsed && sortedL1Items.map((expense, itemIdx) => {
        const isLastItem = itemIdx === sortedL1Items.length - 1 && isLastL1
        return (
          <ExpenseRow
            key={expense.id}
            expense={expense}
            isEditing={editingId === expense.id}
            isLastItem={isLastItem}
            readOnly={readOnly}
            editForm={editForm}
            focusField={focusField}
            categories={categories}
            paymentMethods={paymentMethods}
            txTypeByCode={txTypeByCode}
            editRef={editRef}
            onEditFormChange={onEditFormChange}
            onStartEditing={(field) => onStartEditing(expense, field)}
            onSaveRow={onSaveRow}
            onKeyDown={onKeyDown}
            onDelete={onDelete}
            onOpenEditDialog={onOpenEditDialog}
            onUpdate={onUpdate}
            onRefresh={onRefresh}
          />
        )
      })}

      {/* 添加小类按钮（折叠时也隐藏；锁定日期不提供） */}
      {!collapsed && !readOnly && (
        <button
          onClick={() => onAddSubCategory(date, l1)}
          className={`w-full flex items-center gap-2 px-4 pl-16 py-2.5 text-sm text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors border-b border-slate-50 ${
            isLastL1 ? '' : ''
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>添加小类</span>
        </button>
      )}
    </div>
  )
}
