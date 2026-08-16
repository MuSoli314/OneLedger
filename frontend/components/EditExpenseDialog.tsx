import { useState, useEffect } from 'react'
import DatePicker from './DatePicker'
import InlineSelect from './InlineSelect'
import { useCategories } from '../contexts/CategoryContext'
import { useSettings } from '../contexts/SettingsContext'
import { evaluateExpression } from '../data/calcUtils'
import type { Expense, ExpenseInput, TransactionType } from '../data/types'

interface Props {
  expense: Expense
  onSave: (id: number, input: ExpenseInput) => Promise<void> | void
  onClose: () => void
}

/**
 * 完整编辑弹窗：展示一条记账的全部信息（含日期），全部可改。
 * 用于解决行内编辑改不了日期的问题——日期录错时不用删了重记，
 * 直接在这个弹窗里把日期改对即可。
 */
export default function EditExpenseDialog({ expense, onSave, onClose }: Props) {
  const { categories } = useCategories()
  const { paymentMethods, txTypes } = useSettings()

  const [form, setForm] = useState({
    date: expense.date,
    category_l1: expense.category_l1,
    category_l2: expense.category_l2,
    amount: expense.amount.toString(),
    payment_method: expense.payment_method || '',
    type: expense.type || 'expense',
    note: expense.note,
    isNonDaily: expense.isNonDaily,
  })
  const [saving, setSaving] = useState(false)

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))

  // Esc 取消（与其它弹窗一致）
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const subOptions = categories.find((c) => c.name === form.category_l1)?.children.map((c) => c.name) || []

  // 切换大类：小类还存在于新大类里就保留，否则清空让用户重选
  const handleL1Change = (l1: string) => {
    const children = categories.find((c) => c.name === l1)?.children.map((c) => c.name) || []
    set({ category_l1: l1, category_l2: children.includes(form.category_l2) ? form.category_l2 : '' })
  }

  const handleSave = async () => {
    if (saving) return
    if (!form.category_l1) {
      alert('请选择大类')
      return
    }
    if (!form.category_l2) {
      alert('请选择小类')
      return
    }
    if (!form.date) {
      alert('请选择日期')
      return
    }
    // 金额校验与行内编辑一致：支持算式（如 5*2），不能为负数
    const amountNum = evaluateExpression(form.amount)
    if (amountNum === null || amountNum < 0) {
      alert('请输入正确的金额（不能为负数）')
      return
    }
    setSaving(true)
    try {
      await onSave(expense.id, {
        amount: amountNum,
        category_l1: form.category_l1,
        category_l2: form.category_l2,
        date: form.date,
        note: form.note,
        payment_method: form.payment_method || '',
        type: form.type || 'expense',
        isNonDaily: form.isNonDaily,
      })
      onClose()
    } catch (err) {
      alert('保存失败：' + String(err))
      setSaving(false)
    }
  }

  const txCat = txTypes.find((t) => t.code === form.type)?.category
  const amountColor = txCat === 'income' ? '#10b981' : txCat === 'ignore' ? '#94a3b8' : '#ef4444'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 弹窗：左右两栏（左日历 + 右字段），高度紧凑，保存/取消固定在底部 */}
      <div className="relative bg-white rounded-2xl shadow-xl w-[660px] max-w-[94vw] max-h-[90vh] overflow-hidden p-5 flex flex-col">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            编辑记录
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="关闭"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区（窗口太小时中间滚动，按钮始终可见） */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex gap-5">
            {/* 左栏：日期日历 */}
            <div className="w-[290px] flex-shrink-0">
              <label className="block text-xs font-medium text-slate-500 mb-1">日期</label>
              <DatePicker inline value={form.date} onChange={(d) => set({ date: d })} />
            </div>

            {/* 右栏：其余字段 */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* 大类 + 小类（联动） */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">大类</label>
                  <InlineSelect
                    value={form.category_l1}
                    options={categories.map((c) => ({ value: c.name, label: <span className="inline-flex items-center gap-1">{c.icon} {c.name}</span> }))}
                    placeholder="请选择大类"
                    className="w-full"
                    onChange={handleL1Change}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">小类</label>
                  <InlineSelect
                    value={form.category_l2}
                    options={subOptions.map((sc) => ({ value: sc, label: sc }))}
                    placeholder="请选择小类"
                    textColor={form.category_l2 ? 'text-slate-700' : 'text-slate-400'}
                    className="w-full"
                    onChange={(v) => set({ category_l2: v })}
                  />
                </div>
              </div>

              {/* 金额 + 支付方式 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">金额（元）</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={form.amount}
                    onChange={(e) => set({ amount: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                    placeholder="金额"
                    className="w-full h-8 border border-slate-200 rounded-lg px-2 text-sm font-semibold tabular-nums bg-white focus:outline-none focus:border-primary"
                    style={{ color: amountColor }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">支付方式</label>
                  <InlineSelect
                    value={form.payment_method}
                    options={paymentMethods.map((pm) => ({ value: pm.name, label: <span className="inline-flex items-center gap-1">{pm.icon} {pm.name}</span> }))}
                    placeholder="支付方式"
                    textColor="text-slate-500"
                    className="w-full"
                    onChange={(v) => set({ payment_method: v })}
                  />
                </div>
              </div>

              {/* 收支类型 + 日常/非日常 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">收支类型</label>
                  <InlineSelect
                    value={form.type}
                    options={txTypes.map((t) => ({ value: t.code, label: <span className="inline-flex items-center gap-1">{t.icon} {t.name}</span> }))}
                    placeholder="收支类型"
                    textColor="text-slate-600"
                    className="w-full"
                    onChange={(v) => set({ type: v as TransactionType })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">标记</label>
                  <button
                    type="button"
                    onClick={() => set({ isNonDaily: !form.isNonDaily })}
                    className={`w-full h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                      form.isNonDaily
                        ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        : 'bg-transparent text-slate-400 border border-dashed border-slate-300 hover:border-slate-500 hover:text-slate-600'
                    }`}
                    title="切换日常/非日常"
                  >
                    {form.isNonDaily ? '非日常' : '日常'}
                  </button>
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">备注</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => set({ note: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                  placeholder="备注（可选）"
                  className="w-full h-8 border border-slate-200 rounded-lg px-2 text-sm bg-white focus:outline-none focus:border-primary text-slate-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 按钮（固定在弹窗底部） */}
        <div className="flex gap-3 mt-5 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors ${
              saving ? 'bg-primary/60 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark'
            }`}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
