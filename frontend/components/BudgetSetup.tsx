import { useState, useEffect } from 'react'
import { getBudget, setBudget } from '../data/database'
import { daysInMonth, formatMonth } from '../data/dateUtils'

interface Props {
  month: string
  onClose: () => void
  onSaved: () => void
}

export default function BudgetSetup({ month, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getBudget(month).then((b) => {
      if (b) setAmount(b.amount.toString())
    })
  }, [month])

  // 按 Esc 关闭弹窗
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSave = async () => {
    setError('')
    const num = parseFloat(amount)
    if (isNaN(num) || num < 0) {
      setError('请输入有效的预算金额')
      return
    }
    setLoading(true)
    try {
      await setBudget(month, Math.round(num * 100) / 100)
      onSaved()
    } catch (err) {
      setError('保存失败：' + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">预算设置</h2>
        <p className="text-xs text-slate-400 mb-5">
          为 {formatMonth(month)} 设置支出预算上限
        </p>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="mb-5">
          <label className="block text-sm text-slate-500 mb-1.5">月度预算（元）</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-lg font-medium text-slate-900 placeholder-slate-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          {amount && parseFloat(amount) > 0 && (
            <p className="text-xs text-slate-400 mt-1.5">
              日均预算约 ¥{(parseFloat(amount) / daysInMonth(month)).toFixed(2)}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
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
