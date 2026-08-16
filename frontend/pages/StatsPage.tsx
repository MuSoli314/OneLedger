// 统计页（独立于记账页，导航位于「统计 / 记账 / 分类 / 设置」第一位）：
// 近 12 月支出趋势 + 本月概览（含环比上月）+ 近 12 月分类 TOP5。
// 固定「当前自然月」视角；进入页面时查询一次数据库（切页会重新挂载，天然取到最新数据）。
import { useState, useEffect } from 'react'
import { getTrendData, getStatsByRange, getDailyTotals } from '../data/database'
import { localDateString, localMonthString, formatMonth } from '../data/dateUtils'
import { useCategories } from '../contexts/CategoryContext'
import { useHomeFilter } from '../contexts/HomeFilterContext'
import { TrendLineChart } from '../components/TrendChart'
import type { TrendPoint } from '../data/types'

// 把趋势数据补齐为连续 12 个月（缺记录的月份补 0），保证折线不断档
function fillTrendGaps(data: TrendPoint[]): TrendPoint[] {
  const map = new Map(data.map((d) => [d.month, d.total]))
  const result: TrendPoint[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push({ month: key, total: map.get(key) ?? 0 })
  }
  return result
}

export default function StatsPage() {
  const { categories } = useCategories()
  const { trendCategory, setTrendCategory } = useHomeFilter()
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [thisMonth, setThisMonth] = useState<{ total: number; count: number }>({ total: 0, count: 0 })
  const [lastMonthTotal, setLastMonthTotal] = useState(0)
  const [maxDay, setMaxDay] = useState(0)
  const [topCats, setTopCats] = useState<{ category_l1: string; total: number }[]>([])

  const now = new Date()
  // 本月 / 上月 / 近 12 个月的本地起止日期（固定当前自然月，与记账页时间范围选择器无关）
  const thisFirst = localDateString(new Date(now.getFullYear(), now.getMonth(), 1))
  const thisLast = localDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const lastFirst = localDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const lastLast = localDateString(new Date(now.getFullYear(), now.getMonth(), 0))
  const yearAgoFirst = localDateString(new Date(now.getFullYear(), now.getMonth() - 11, 1))
  const monthLabel = localMonthString()

  // 近 12 月趋势（固定近 12 个月；可按大类筛选，随 trendCategory 变化）
  useEffect(() => {
    getTrendData(12, trendCategory || undefined).then(setTrendData).catch(console.error)
  }, [trendCategory])

  // 本月概览 + 环比上月 + 近 12 月分类 TOP5
  useEffect(() => {
    Promise.all([
      getStatsByRange(thisFirst, thisLast),
      getStatsByRange(lastFirst, lastLast),
      getStatsByRange(yearAgoFirst, thisLast),
      getDailyTotals(thisFirst, thisLast),
    ])
      .then(([tm, lm, yr, days]) => {
        setThisMonth({ total: tm.total, count: tm.count })
        setLastMonthTotal(lm.total)
        setMaxDay(days.reduce((m, d) => Math.max(m, d.total), 0))
        setTopCats(yr.byCategory.slice(0, 5).map((c) => ({ category_l1: c.category_l1, total: c.total })))
      })
      .catch(console.error)
  }, [thisFirst, thisLast, lastFirst, lastLast, yearAgoFirst])

  const filledTrend = fillTrendGaps(trendData)
  // 环比：本月 vs 上月；日均按本月已过的天数算
  const diff = thisMonth.total - lastMonthTotal
  const pct = lastMonthTotal > 0 ? (diff / lastMonthTotal) * 100 : null
  const avgPerDay = thisMonth.total / Math.max(1, now.getDate())

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* 近 12 月趋势（占 2/3 宽） */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-slate-700">📈 近12月支出趋势</h3>
            <select
              value={trendCategory}
              onChange={(e) => setTrendCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-primary"
            >
              <option value="">📊 全天</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          <TrendLineChart
            data={filledTrend}
            color={trendCategory ? '#f59e0b' : '#6366f1'}
            height={320}
          />
        </div>

        {/* 右列：本月概览 + 近 12 月分类 TOP5 */}
        <div className="space-y-6">
          {/* 本月概览（含环比上月） */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">📅 本月概览</h3>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">¥{thisMonth.total.toFixed(2)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 mb-3">本月（{formatMonth(monthLabel)}）总支出</div>
            <div className={`flex items-center gap-1 text-xs font-medium mb-3 ${
              diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-slate-400'
            }`}>
              {diff > 0 ? '↑' : diff < 0 ? '↓' : '—'}
              <span>较上月</span>
              {pct != null
                ? <b>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</b>
                : <span>{thisMonth.total > 0 ? '新增支出' : '持平'}</span>}
              <span className="text-slate-400">（{diff > 0 ? '+' : ''}¥{diff.toFixed(2)}）</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
              <div>
                <div className="text-xs text-slate-400">笔数</div>
                <div className="text-sm font-semibold text-slate-800 tabular-nums">{thisMonth.count}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">日均</div>
                <div className="text-sm font-semibold text-slate-800 tabular-nums">¥{avgPerDay.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">单日最高</div>
                <div className="text-sm font-semibold text-slate-800 tabular-nums">¥{maxDay.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* 近 12 月分类 TOP5 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">🏆 近12月分类 TOP5</h3>
            {topCats.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">暂无数据</div>
            ) : (
              <div className="space-y-3">
                {topCats.map((item, i) => {
                  const icon = categories.find((c) => c.name === item.category_l1)?.icon || '📂'
                  const pct = topCats[0].total > 0 ? (item.total / topCats[0].total) * 100 : 0
                  return (
                    <div key={item.category_l1}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm text-slate-600 truncate" title={item.category_l1}>
                          <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold text-white mr-1 ${
                            i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-400' : 'bg-slate-300'
                          }`}>{i + 1}</span>
                          {icon} {item.category_l1}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 tabular-nums">¥{item.total.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
