import { useState, useEffect } from 'react'
import { getMonthlyStats, getMonths, getTrendData } from '../data/database'
import { localMonthString, formatMonth } from '../data/dateUtils'
import { useCategories } from '../contexts/CategoryContext'
import { TrendLineChart, TrendPieChart, PieLegend } from '../components/TrendChart'
import type { MonthlyStats, TrendPoint } from '../data/types'

const PIE_COLORS = [
  '#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#64748b',
]

// 简单字符串哈希，让已删除分类的颜色也保持稳定
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// 把趋势数据补齐为连续 N 个月（缺记录的月份补 0）
function fillTrendGaps(data: TrendPoint[], months: number): TrendPoint[] {
  const map = new Map(data.map((d) => [d.month, d.total]))
  const result: TrendPoint[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push({ month: key, total: map.get(key) ?? 0 })
  }
  return result
}

export default function StatsPage() {
  const { categories } = useCategories()
  const [selectedMonth, setSelectedMonth] = useState(localMonthString())
  const [months, setMonths] = useState<string[]>([])
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMonths().then(setMonths).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getMonthlyStats(selectedMonth),
      getTrendData(12),
    ])
      .then(([s, t]) => {
        setStats(s)
        setTrendData(t)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedMonth])

  function getIcon(l1: string): string {
    return categories.find((c) => c.name === l1)?.icon || '📂'
  }

  // 饼图数据 — 颜色按分类名固定（按分类列表顺序取色），不随排名变化
  const pieData = (stats?.byCategory || []).map((item) => {
    const idx = categories.findIndex((c) => c.name === item.category_l1)
    const colorIdx = idx >= 0 ? idx : hashString(item.category_l1)
    return {
      name: item.category_l1,
      value: item.total,
      color: PIE_COLORS[colorIdx % PIE_COLORS.length],
    }
  })

  // 趋势数据补零，避免缺记录的月份断档
  const filledTrend = fillTrendGaps(trendData, 12)

  return (
    <div className="space-y-5">
      {/* 月份选择 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">月度统计</h2>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-primary"
        >
          {months.length === 0 && (
            <option value={selectedMonth}>
              {formatMonth(selectedMonth)}
            </option>
          )}
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-base">加载中...</div>
      ) : (
        <>
          {/* 总览卡片 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="text-sm text-slate-400 mb-1">总支出</div>
              <div className="text-2xl font-bold text-expense tabular-nums">
                ¥{stats?.total.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="text-xs text-slate-400 mb-1">总笔数</div>
              <div className="text-2xl font-bold text-slate-800 tabular-nums">
                {stats?.count || 0} 笔
              </div>
            </div>
          </div>

          {/* 支出趋势折线图 */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">📈 月度支出趋势</h3>
            <TrendLineChart data={filledTrend} />
          </div>

          {/* 分类饼图 */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">🎯 分类分布</h3>
            <p className="text-[11px] text-slate-400 mb-1">{formatMonth(selectedMonth)}</p>
            <TrendPieChart data={pieData} />
            <PieLegend data={pieData} />
          </div>

          {/* 分类排行 */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">📊 分类排行</h3>

            {!stats || stats.byCategory.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                暂无数据
              </div>
            ) : (
              <div className="space-y-3">
                {stats.byCategory.map((item) => {
                  const pct = stats.total > 0 ? (item.total / stats.total) * 100 : 0
                  return (
                    <div key={item.category_l1}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getIcon(item.category_l1)}</span>
                          <span className="text-sm font-medium text-slate-700">
                            {item.category_l1}
                          </span>
                          <span className="text-sm text-slate-400">
                            {item.count}笔
                          </span>
                        </div>
                        <span className="text-base font-semibold text-slate-800 tabular-nums">
                          ¥{item.total.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-400 text-right mt-0.5">
                        {pct.toFixed(1)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
