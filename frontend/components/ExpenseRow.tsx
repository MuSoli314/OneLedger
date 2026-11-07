// 记账列表单条记录行（含行内编辑：小类/金额/支付方式/收支类型/备注/日常非日常/编辑弹窗/删除）
import { useEffect, useRef, useState } from 'react'
import InlineSelect from './InlineSelect'
import type { CategoryWithChildren, Expense, PaymentMethodConfig, SubCategoryChild, TransactionType, TxTypeConfig } from '../data/types'
import { resolveSubDefaults } from '../data/database'
import type { EditField, EditForm } from './expenseListTypes'

/** 小类下拉里「自定义」选项的哨兵值（不会与真实小类重名） */
const CUSTOM_SUB_VALUE = '\u0000custom-sub'

interface Props {
  expense: Expense
  isEditing: boolean
  /** 是否本日期大类的最后一条（控制底部边框） */
  isLastItem: boolean
  /** 只读（该日期已锁定）：所有格子不可点击进入编辑、不能切换日常标记，隐藏编辑/删除按钮 */
  readOnly?: boolean
  editForm: EditForm
  focusField: EditField | null
  categories: CategoryWithChildren[]
  paymentMethods: PaymentMethodConfig[]
  txTypeByCode: Map<string, TxTypeConfig>
  /** 编辑容器 ref（主组件用它做「点击外部自动保存」） */
  editRef: React.RefObject<HTMLDivElement | null>
  /** 更新编辑表单（主组件负责同步 ref，保证下拉选完同帧保存读到最新值） */
  onEditFormChange: (form: EditForm) => void
  onStartEditing: (field?: EditField) => void
  /** 保存真实行（下拉选完即保存；主组件按 id 读最新表单） */
  onSaveRow: (id: number) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onDelete: (expense: Expense) => void
  onOpenEditDialog: (expense: Expense) => void
  onUpdate: (id: number, category_l2: string, note: string, amount: number, payment_method: string, type: TransactionType, is_non_daily: boolean) => Promise<void>
  onRefresh?: () => void
  /** 小类下拉第一行「＋ 自定义」：把输入的名字存为新小类（重名直接复用）；返回是否成功 */
  onCreateSubCategory?: (l1: string, name: string) => Promise<boolean>
}

export default function ExpenseRow({
  expense,
  isEditing,
  isLastItem,
  readOnly,
  editForm,
  focusField,
  categories,
  paymentMethods,
  txTypeByCode,
  editRef,
  onEditFormChange,
  onStartEditing,
  onSaveRow,
  onKeyDown,
  onDelete,
  onOpenEditDialog,
  onUpdate,
  onRefresh,
  onCreateSubCategory,
}: Props) {
  // 编辑控件 refs，按 focusField 聚焦
  const categoryL2Ref = useRef<HTMLButtonElement | null>(null)
  const amountRef = useRef<HTMLInputElement | null>(null)
  const paymentRef = useRef<HTMLButtonElement | null>(null)
  const typeRef = useRef<HTMLButtonElement | null>(null)
  const noteRef = useRef<HTMLInputElement | null>(null)
  // 小类下拉里点了「＋ 自定义」→ 该格子切换成输入框
  const [customSubOpen, setCustomSubOpen] = useState(false)
  const [customSubName, setCustomSubName] = useState('')
  // 自定义输入框关掉后，重新挂载的下拉不要自动弹开（否则 Esc 一按又弹出来）
  const [suppressSubOpen, setSuppressSubOpen] = useState(false)

  // 进入编辑态后按 focusField 聚焦对应编辑控件
  useEffect(() => {
    if (!isEditing) return
    const refMap: Record<EditField, React.RefObject<HTMLInputElement | HTMLButtonElement | null>> = {
      category_l2: categoryL2Ref,
      amount: amountRef,
      payment_method: paymentRef,
      type: typeRef,
      note: noteRef,
    }
    const el = refMap[focusField || 'category_l2']?.current
    if (!el) return
    el.focus()
    // 自由输入框（金额/备注）进入编辑时全选已有内容，方便直接输入替换；下拉按钮无需处理
    if (el instanceof HTMLInputElement) el.select()
  }, [isEditing, focusField])

  // 退出编辑时关掉「自定义小类」输入框，避免下次进入编辑还停在输入态
  useEffect(() => {
    if (!isEditing) {
      setCustomSubOpen(false)
      setCustomSubName('')
      setSuppressSubOpen(false)
    }
  }, [isEditing])

  // 切到别的字段再回来时恢复正常（点小类格子依旧自动展开下拉）
  useEffect(() => {
    setSuppressSubOpen(false)
  }, [focusField])

  const isLocal = expense.id < 0
  // 锁定日期的行完全只读：不进入编辑、不切换日常标记、不显示编辑/删除按钮
  const ro = !!readOnly
  const rowTx = txTypeByCode.get(expense.type)
  // 金额为 0 的记录标红提醒（非 ignore 类型；编辑态仍走 indigo 编辑样式）
  const isZeroAmount = expense.amount === 0 && rowTx?.category !== 'ignore'

  const getSubCategories = (l1: string): string[] => {
    return categories.find((c) => c.name === l1)?.children.map((c) => c.name) || []
  }

  // 选中某个小类（含刚自定义出来的新小类）：
  // 新增行 → 加载该小类的默认模板；已有记录 → 只改小类并立即保存退出编辑
  const applySubSelected = (newL2: string, sub?: SubCategoryChild) => {
    if (isLocal) {
      const resolved = sub ?? categories.find((c) => c.name === expense.category_l1)?.children.find((c) => c.name === newL2)
      // 条件规则：金额只来自规则（按这条记录的日期判断，不是今天）；没命中就给 0 让用户自己填
      const defaults = resolved
        ? resolveSubDefaults(resolved, expense.date)
        : { matched: false, amount: 0, note: '', payment_method: '', type: 'expense' as TransactionType, is_non_daily: false }
      onEditFormChange({
        category_l2: newL2,
        note: defaults.note,
        payment_method: defaults.payment_method,
        amount: defaults.amount ? defaults.amount.toString() : '0',
        type: defaults.type,
        is_non_daily: defaults.is_non_daily,
      })
    } else {
      onEditFormChange({ ...editForm, category_l2: newL2 })
      onSaveRow(expense.id)
    }
  }

  const handleSubSelect = (newL2: string) => {
    // 第一行「＋ 自定义」：把这个格子切换成输入框，不当作小类名
    if (newL2 === CUSTOM_SUB_VALUE) {
      setCustomSubName('')
      setSuppressSubOpen(true)
      setCustomSubOpen(true)
      return
    }
    applySubSelected(newL2)
  }

  // 回车确认自定义小类：先存进分类表（重名直接复用），再按普通选中处理
  const submitCustomSub = async () => {
    const name = customSubName.trim()
    setCustomSubOpen(false)
    setCustomSubName('')
    if (!name || !onCreateSubCategory) return
    if (!getSubCategories(expense.category_l1).includes(name)) {
      const ok = await onCreateSubCategory(expense.category_l1, name)
      if (!ok) return
    }
    // 新小类没有模板默认值，用空模板兜底
    applySubSelected(name, {
      id: -1,
      name,
      is_default: false,
      default_note: '',
      default_payment_method: '',
      default_amount: 0,
      default_type: 'expense',
      default_is_non_daily: false,
    })
  }

  return (
    <div
      ref={isEditing ? editRef : undefined}
      className={`flex items-center gap-2 px-2 pl-2 py-1 text-base transition-colors ${
        isEditing
          ? 'bg-indigo-50 border-l-2 border-l-primary'
          : isZeroAmount
          ? 'bg-red-100 hover:bg-red-200 border-l-2 border-l-red-500'
          : rowTx?.category === 'ignore'
          ? 'bg-slate-300 hover:bg-slate-400'
          : expense.is_non_daily
          ? 'bg-slate-100/60 hover:bg-slate-100'
          : 'hover:bg-slate-50'
      } ${ro ? 'cursor-default' : 'cursor-pointer group'} ${isLastItem && !isLocal ? '' : 'border-b border-slate-50'}`}
      onClick={() => { if (!ro && !isEditing) onStartEditing() }}
    >
      {/* 日常/非日常徽章 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (ro) return
          if (isLocal || isEditing) {
            // 新增本地行或已在编辑态：只改本地表单（新增行由行外点击/回车统一入库；编辑行由行外点击/回车统一保存）
            onEditFormChange({ ...editForm, is_non_daily: !editForm.is_non_daily })
            return
          }
          // 非编辑态真实行：立即切换保存（不改其它字段）
          const next = !expense.is_non_daily
          onUpdate(expense.id, expense.category_l2, expense.note, expense.amount, expense.payment_method || '', expense.type || 'expense', next)
            .then(() => onRefresh?.())
            .catch((err) => console.error('保存失败', err))
        }}
        className={`w-[52px] h-6 flex-shrink-0 flex items-center justify-center rounded-md text-sm transition-colors ${
          ((isEditing || isLocal) ? editForm.is_non_daily : expense.is_non_daily)
            ? 'bg-slate-200 text-slate-500 hover:bg-slate-300'
            : 'bg-transparent text-slate-300 border border-dashed border-slate-200 hover:border-slate-400 hover:text-slate-500'
        } ${ro ? 'cursor-default' : ''}`}
        title={ro ? '已锁定，不可修改' : isEditing || isLocal ? '切换非日常标记' : (expense.is_non_daily ? '非日常（点击改为日常）' : '日常（点击改为非日常）')}
      >
        {((isEditing || isLocal) ? editForm.is_non_daily : expense.is_non_daily) ? '非日常' : '日常'}
      </button>
      {/* 小类 */}
      {isEditing ? (
        <div className="w-[110px] flex-shrink-0">
          {customSubOpen ? (
            <input
              autoFocus
              value={customSubName}
              onChange={(e) => setCustomSubName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') submitCustomSub()
                if (e.key === 'Escape') { setCustomSubOpen(false); setCustomSubName('') }
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="新小类，回车确认"
              className="w-full h-8 text-xs border border-primary rounded-lg px-2 bg-white focus:outline-none text-slate-700"
            />
          ) : (
          <InlineSelect
            value={editForm.category_l2}
            options={[
              // 第一行：自定义新小类（点了就变成输入框）
              ...(onCreateSubCategory
                ? [{ value: CUSTOM_SUB_VALUE, label: <span className="text-primary">＋ 自定义</span> }]
                : []),
              ...getSubCategories(expense.category_l1).map((sc) => ({ value: sc, label: sc })),
            ]}
            placeholder="请选择小类"
            initialOpen={focusField === 'category_l2' && !suppressSubOpen}
            textColor={editForm.category_l2 ? 'text-slate-700' : 'text-slate-400'}
            ref={categoryL2Ref}
            className="w-full"
            onChange={handleSubSelect}
          />
          )}
        </div>
      ) : (
        <div
          className="w-[110px] min-w-0 flex-shrink-0 text-right"
          onClick={(e) => { e.stopPropagation(); if (!ro) onStartEditing('category_l2') }}
        >
          <span className={`text-sm font-medium ${expense.category_l2 ? 'text-slate-700' : 'text-slate-300 italic'}`}>
            {expense.category_l2 || '未设置'}
          </span>
        </div>
      )}

      {/* 金额 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isEditing ? (
          <div className="w-[90px]">
            <input
              type="text"
              inputMode="decimal"
              value={editForm.amount}
              onChange={(e) => onEditFormChange({ ...editForm, amount: e.target.value })}
              className="w-full h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white focus:outline-none focus:border-primary text-right font-semibold tabular-nums"
              style={{ color: txTypeByCode.get(editForm.type)?.category === 'income' ? '#10b981' : txTypeByCode.get(editForm.type)?.category === 'ignore' ? '#94a3b8' : '#ef4444' }}
              ref={amountRef}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onKeyDown}
              placeholder="金额"
            />
          </div>
        ) : (
          <span
            className={`text-sm font-semibold tabular-nums w-[100px] text-right ${
              rowTx?.category === 'income' ? 'text-emerald-500' : rowTx?.category === 'ignore' ? 'text-slate-400' : 'text-expense'
            }`}
            onClick={(e) => { e.stopPropagation(); if (!ro) onStartEditing('amount') }}
          >
            {rowTx?.category === 'income' ? '+' : rowTx?.category === 'ignore' ? '' : '-'}¥{expense.amount.toFixed(2)}
          </span>
        )}
      </div>

      {/* 支付方式 */}
      {isEditing ? (
        <div className="w-[90px] flex-shrink-0">
          <InlineSelect
            value={editForm.payment_method}
            options={paymentMethods.map((pm) => ({ value: pm.name, label: <span className="inline-flex items-center gap-1">{pm.icon} {pm.name}</span> }))}
            placeholder="支付方式"
            initialOpen={focusField === 'payment_method'}
            textColor="text-slate-500"
            ref={paymentRef}
            className="w-full"
            onChange={(v) => {
              onEditFormChange({ ...editForm, payment_method: v })
              // 已有记录：选完即自动保存退出编辑；新增行仅更新表单
              if (!isLocal) onSaveRow(expense.id)
            }}
          />
        </div>
      ) : (
        expense.payment_method ? (
          <div
            className="w-[90px] flex-shrink-0 flex justify-end"
            onClick={(e) => { e.stopPropagation(); if (!ro) onStartEditing('payment_method') }}
          >
            <span className="inline-flex items-center gap-1 text-sm text-slate-400 bg-slate-100 px-2 py-1 rounded-full whitespace-nowrap">
              {paymentMethods.find((pm) => pm.name === expense.payment_method)?.icon || ''}
              {expense.payment_method}
            </span>
          </div>
        ) : (
          <div
            className="w-[90px] flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); if (!ro) onStartEditing('payment_method') }}
          />
        )
      )}

      {/* 收支类型 */}
      {isEditing ? (
        <div className="w-[80px] flex-shrink-0">
          <InlineSelect
            value={editForm.type}
            options={Array.from(txTypeByCode.values()).map((t) => ({ value: t.code, label: <span className="inline-flex items-center gap-1">{t.icon} {t.name}</span> }))}
            initialOpen={focusField === 'type'}
            textColor="text-slate-600"
            ref={typeRef}
            className="w-full"
            onChange={(v) => {
              onEditFormChange({ ...editForm, type: v as TransactionType })
              // 已有记录：选完即自动保存退出编辑；新增行仅更新表单
              if (!isLocal) onSaveRow(expense.id)
            }}
          />
        </div>
      ) : (
        <div
          className="w-[80px] flex-shrink-0 flex justify-end"
          onClick={(e) => { e.stopPropagation(); if (!ro) onStartEditing('type') }}
        >
          <span className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full whitespace-nowrap ${
            !rowTx ? 'text-slate-500 bg-slate-200'
              : rowTx.category === 'expense' ? 'text-red-500 bg-red-50'
              : rowTx.category === 'income' ? 'text-emerald-600 bg-emerald-50'
              : 'text-slate-500 bg-slate-200'
          }`}>
            {rowTx ? `${rowTx.icon} ${rowTx.name}` : '🚫 未定义'}
          </span>
        </div>
      )}

      {/* 备注 */}
      {isEditing ? (
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={editForm.note}
            onChange={(e) => onEditFormChange({ ...editForm, note: e.target.value })}
            placeholder="备注（可选）"
            className="w-full h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white focus:outline-none focus:border-primary text-slate-700"
            ref={noteRef}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          />
        </div>
      ) : (
        <div
          className="flex-1 min-w-0"
          onClick={(e) => { e.stopPropagation(); if (!ro) onStartEditing('note') }}
        >
          <span className="text-sm text-slate-400 truncate block">
            {expense.note || '-'}
          </span>
        </div>
      )}

      {/* 编辑按钮（完整信息弹窗，可改日期；本地未入库的临时行 / 锁定的日期不显示） */}
      {!isLocal && !ro && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenEditDialog(expense) }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${
            isEditing
              ? 'text-slate-400 hover:bg-primary/10 hover:text-primary'
              : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:bg-primary/10 hover:text-primary'
          }`}
          title="编辑"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}

      {/* 删除按钮（锁定日期不显示） */}
      {!ro && (
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(expense) }}
        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${
          isEditing
            ? 'text-slate-400 hover:bg-red-50 hover:text-red-500'
            : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:bg-red-50 hover:text-red-500'
        }`}
        title="删除"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
      )}
    </div>
  )
}
