import { useState, useEffect, useMemo } from 'react'
import { getDailyTotals, getStatsByRange } from '../data/database'
import { eachDay } from '../data/dateUtils'
import { useCategories } from '../contexts/CategoryContext'
import { DailyLineChart } from './TrendChart'
import type { DailyTrendPoint, MonthlyStats } from '../data/types'

interface Props {
  startDate: string
  endDate: string
  title: string
}

export default function StatsPanel({ startDate, endDate, title }: Props) {
  const { categories } = useCategories()
  // '' 表示「全天」（所有大类按天汇总）
  const [activeCategory, setActiveCategory] = useState('')
  const [daily, setDaily] = useState<DailyTrendPoint[]>([])
  const [stats, setStats] = useState<MonthlyStats | null>(null)

  // 当月支出图数据（选中某大类时按大类过滤）
  useEffect(() => {
    getDailyTotals(startDate, endDate, activeCategory || undefined)
      .then(setDaily)
      .catch(console.error)
  }, [startDate, endDate, activeCategory])

  // 分类排行数据（与选中大类无关，只随时间范围变化）
  useEffect(() => {
    getStatsByRange(startDate, endDate).then(setStats).catch(console.error)
  }, [startDate, endDate])

  // 把区间内无记录的日期补 0，保证折线连续
  const dailyMap = useMemo(() => new Map(daily.map((d) => [d.date, d.total])), [daily])
  const filledDaily = useMemo(
    () => eachDay(startDate, endDate).map((d) => ({ date: d, total: dailyMap.get(d) ?? 0 })),
    [startDate, endDate, dailyMap]
  )

  const byCategory = stats?.byCategory || []
  const total = stats?.total ?? 0

  return (
    <>
      {/* 当月支出图 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-primary"
          >
            <option value="">📊 全天</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
        <DailyLineChart
          data={filledDaily}
          color={activeCategory ? '#f59e0b' : '#6366f1'}
          height={200}
        />
      </div>

      {/* 分类排行 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">📊 分类排行</h3>
        {byCategory.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">暂无数据</div>
        ) : (
          <div className="space-y-3">
            {byCategory.map((item) => {
              const pct = total > 0 ? (item.total / total) * 100 : 0
              const icon = categories.find((c) => c.name === item.category_l1)?.icon || '📂'
              return (
                <div key={item.category_l1}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <span className="text-sm font-medium text-slate-700">{item.category_l1}</span>
                      <span className="text-sm text-slate-400">{item.count}笔</span>
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
  )
}
