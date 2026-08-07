import { useState, useEffect } from 'react'
import CategoryPicker from './CategoryPicker'
import DatePicker from './DatePicker'
import { addExpense, updateExpense } from '../data/database'
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '../data/categories'
import { localDateString } from '../data/dateUtils'
import type { Expense, ExpenseInput, TransactionType } from '../data/types'

interface Props {
  editExpense?: Expense | null
  defaultDate?: string
  onSuccess: () => void
  onCancel: () => void
}

export default function ExpenseForm({ editExpense, defaultDate, onSuccess, onCancel }: Props) {
  const [txType, setTxType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState({ l1: '', l2: '' })
  const [date, setDate] = useState(defaultDate || localDateString())
  const [note, setNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editExpense) {
      setTxType(editExpense.type || 'expense')
      setAmount(editExpense.amount.toString())
      setCategory({ l1: editExpense.category_l1, l2: editExpense.category_l2 })
      setDate(editExpense.date)
      setNote(editExpense.note)
      setPaymentMethod(editExpense.payment_method || '')
    }
  }, [editExpense])

  // 按 Esc 关闭弹窗
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onCancel])

  const handleSubmit = async () => {
    setError('')

    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('请输入正确的金额')
      return
    }
    if (!category.l1 || !category.l2) {
      setError('请选择消费分类')
      return
    }
    if (!date) {
      setError('请选择日期')
      return
    }

    const input: ExpenseInput = {
      amount: Math.round(amountNum * 100) / 100,
      category_l1: category.l1,
      category_l2: category.l2,
      date,
      note: note.trim(),
      payment_method: paymentMethod,
      type: txType,
    }

    setLoading(true)
    try {
      if (editExpense) {
        await updateExpense(editExpense.id, input)
      } else {
        await addExpense(input)
      }
      onSuccess()
    } catch (err) {
      setError('保存失败：' + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in">
        <h2 className="text-lg font-semibold text-slate-900 mb-5">
          {editExpense ? '编辑记录' : '记一笔'}
        </h2>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* 收支类型 */}
        <div className="mb-4">
          <label className="block text-base text-slate-500 mb-1.5">收支类型</label>
          <div className="flex gap-2">
            {TRANSACTION_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTxType(t.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-all ${
                  txType === t.value
                    ? t.value === 'expense'
                      ? 'border-red-400 bg-red-50 text-red-600 font-medium'
                      : t.value === 'income'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-600 font-medium'
                      : 'border-slate-300 bg-slate-100 text-slate-600 font-medium'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 分类 */}
        <div className="mb-4">
          <label className="block text-base text-slate-500 mb-1.5">分类</label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>

        {/* 金额 */}
        <div className="mb-4">
          <label className="block text-sm text-slate-500 mb-1.5">金额（元）</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">¥</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-lg font-medium text-slate-900 placeholder-slate-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>

        {/* 日期 */}
        <div className="mb-4">
          <label className="block text-sm text-slate-500 mb-1.5">日期</label>
          <DatePicker value={date} onChange={setDate} />
        </div>

        {/* 支付方式 */}
        <div className="mb-4">
          <label className="block text-base text-slate-500 mb-1.5">支付方式</label>
          <div className="flex gap-2 flex-wrap">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.name}
                type="button"
                onClick={() => setPaymentMethod(pm.name === paymentMethod ? '' : pm.name)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-all ${
                  paymentMethod === pm.name
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span>{pm.icon}</span>
                <span>{pm.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 备注 */}
        <div className="mb-5">
          <label className="block text-base text-slate-500 mb-1.5">备注（可选）</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-base text-slate-900 placeholder-slate-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>

        {/* 按钮 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
