import { useState, useEffect, useMemo } from 'react'
import { getDailyTotals, getStatsByRange } from '../data/database'
import { eachDay } from '../data/dateUtils'
import { useCategories } from '../contexts/CategoryContext'
import { DailyLineChart } from './TrendChart'
import type { DailyTrendPoint, MonthlyStats } from '../data/types'

interface Props {
  startDate: string
  endDate: string
  dataVersion: number // 数据版本号：HomePage 每次列表刷新后自增，用于触发本组件重新查库
  title: string
  selectedCats: Set<string> // 已勾选的小类组合键（来自 HomePage）
  isCatSelected: (l1: string, l2: string) => boolean
  onToggleCategory: (l1: string, l2s: string[]) => void
  onToggleSubCategory: (l1: string, l2: string) => void
  onClearFilters: () => void
  paymentFilter: string // 支付方式筛选（'' 表示未筛选，用于展示清除筛选按钮）
}

export default function StatsPanel({ startDate, endDate, dataVersion, title, selectedCats, isCatSelected, onToggleCategory, onToggleSubCategory, onClearFilters, paymentFilter }: Props) {
  const { categories } = useCategories()
  // '' 表示「全天」（所有大类按天汇总）
  const [activeCategory, setActiveCategory] = useState('')
  const [daily, setDaily] = useState<DailyTrendPoint[]>([])
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  // 分类排行展开状态：默认全部折叠，点击大类可展开查看小类金额
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // 当月支出图数据（选中某大类时按大类过滤）。dataVersion 变化时重新查库，
  // 保证编辑/删除/新增记录后图表同步刷新（仅靠 startDate/endDate 不会触发）。
  useEffect(() => {
    getDailyTotals(startDate, endDate, activeCategory || undefined)
      .then(setDaily)
      .catch(console.error)
  }, [startDate, endDate, activeCategory, dataVersion])

  // 分类排行数据（始终统计完整范围内数据，作为勾选筛选的入口，不随筛选变化）
  useEffect(() => {
    getStatsByRange(startDate, endDate).then(setStats).catch(console.error)
  }, [startDate, endDate, dataVersion])

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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">📊 分类排行</h3>
          {(selectedCats.size > 0 || paymentFilter) && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs text-primary hover:bg-primary/5 rounded-lg px-2 py-1 transition-colors"
              title="清除支付方式和分类筛选"
            >
              ✕ 清除筛选
            </button>
          )}
        </div>
        {byCategory.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            {selectedCats.size > 0 || paymentFilter ? '当前筛选下暂无数据' : '暂无数据'}
          </div>
        ) : (
          <div className="space-y-3">
            {byCategory.map((item) => {
              const pct = total > 0 ? (item.total / total) * 100 : 0
              const icon = categories.find((c) => c.name === item.category_l1)?.icon || '📂'
              const isOpen = expanded.has(item.category_l1)
              const hasChildren = item.children.length > 0
              // 以时间范围内实际出现的小类为基准（不用分类设置里的小类——用户改过/删过小类时两者不一致）
              const l2s = item.children.map((c) => c.category_l2)
              // 大类勾选态 = 时间范围内它所有小类都被勾选
              const catChecked = l2s.length > 0 && l2s.every((l2) => isCatSelected(item.category_l1, l2))
              const catIndeterminate = !catChecked && l2s.some((l2) => isCatSelected(item.category_l1, l2))
              return (
                <div key={item.category_l1}>
                  {/* 大类行：左侧复选框勾选=筛选该类所有小类；右侧名称/金额区点击展开/折叠小类明细 */}
                  <div className="grid grid-cols-4 gap-2 items-center mb-1 -mx-1 px-1 py-0.5 rounded-lg hover:bg-slate-50 transition-colors">
                    {/* 第一格：复选框 + 展开按钮（箭头+图标+名称），各占 1/4 等宽 */}
                    <div className="flex items-center min-w-0">
                      <button
                        type="button"
                        onClick={() => onToggleCategory(item.category_l1, l2s)}
                        className="shrink-0 rounded hover:bg-primary/5 p-0.5 flex items-center justify-center"
                        title={catChecked ? '取消筛选该大类' : '筛选该大类下所有小类'}
                      >
                        {/* 复选框：勾选该大类 = 选中它的所有小类 */}
                        <span
                          className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded border-2 text-white transition-colors ${
                            catChecked
                              ? 'bg-primary border-primary'
                              : catIndeterminate
                              ? 'bg-primary/30 border-primary/50'
                              : 'border-slate-300 hover:border-primary/50'
                          }`}
                        >
                          {catChecked && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {catIndeterminate && <span className="w-1.5 h-1.5 bg-white rounded-sm" />}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.category_l1)}
                        disabled={!hasChildren}
                        className={`flex items-center gap-1 min-w-0 flex-1 text-left ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
                        title={item.category_l1}
                      >
                        <svg
                          className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'} ${hasChildren ? '' : 'opacity-30'}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span className="text-lg">{icon}</span>
                        <span className="text-sm font-medium text-slate-700 truncate">{item.category_l1}</span>
                      </button>
                    </div>
                    <span className="text-center text-sm text-slate-500 tabular-nums">{item.count}笔</span>
                    <span className="text-right text-base font-semibold text-slate-800 tabular-nums">
                      ¥{item.total.toFixed(2)}
                    </span>
                    <span className="text-right text-sm text-slate-400 tabular-nums">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  {/* 展开后的小类明细：复选框 / 小类 / 笔数 / 金额 / 占总支出 / 占大类，各占 1/6；点击小类行勾选筛选 */}
                  {isOpen && hasChildren && (
                    <div className="mt-2">
                      <div className="grid grid-cols-6 gap-2 px-3 mb-1 text-[11px] text-slate-400">
                        <div /> {/* 复选框列占位，无标题 */}
                        <div className="text-center">小类</div>
                        <div className="text-center">笔数</div>
                        <div className="text-right">金额</div>
                        <div className="text-right">占总支出</div>
                        <div className="text-right">占大类</div>
                      </div>
                      <div className="space-y-1">
                        {item.children.map((child) => {
                          const shareTotal = total > 0 ? (child.total / total) * 100 : 0
                          const shareL1 = item.total > 0 ? (child.total / item.total) * 100 : 0
                          const checked = isCatSelected(item.category_l1, child.category_l2)
                          return (
                            <button
                              type="button"
                              key={child.category_l2}
                              onClick={() => onToggleSubCategory(item.category_l1, child.category_l2)}
                              className={`w-full grid grid-cols-6 gap-2 items-center rounded-lg px-3 py-1.5 border text-left transition-colors ${
                                checked
                                  ? 'bg-indigo-50 border-primary/40'
                                  : 'bg-slate-50 border-slate-100 hover:bg-slate-100/70'
                              }`}
                              title={checked ? '取消筛选该小类' : '筛选该小类'}
                            >
                              {/* 复选框 */}
                              <span className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded border-2 text-white transition-colors justify-self-center ${
                                checked ? 'bg-primary border-primary' : 'border-slate-300 hover:border-primary/50'
                              }`}>
                                {checked && (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              <div className="text-sm text-slate-600 truncate text-center" title={child.category_l2}>
                                {child.category_l2}
                              </div>
                              <div className="text-center text-xs text-slate-400 tabular-nums">{child.count}</div>
                              <div className="text-right text-sm font-medium text-slate-700 tabular-nums">
                                ¥{child.total.toFixed(2)}
                              </div>
                              <div className="text-right text-xs text-slate-500 tabular-nums">{shareTotal.toFixed(1)}%</div>
                              <div className="text-right text-xs text-slate-500 tabular-nums">{shareL1.toFixed(1)}%</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
