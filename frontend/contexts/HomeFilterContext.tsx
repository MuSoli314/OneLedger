import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { localDateString } from '../data/dateUtils'
import type { RangeMode } from '../data/types'

/**
 * 首页筛选状态（时间范围 + 支付方式筛选 + 分类筛选 + 趋势图大类）。
 * 提升到全局 Context：切换页面时 HomePage 组件会被卸载，放在组件内部的
 * useState 会随之销毁；放在这里则应用不关闭就一直保留，切页回来筛选不变。
 * 纯内存状态，关掉应用重开后恢复默认值。
 */
interface HomeFilterContextValue {
  rangeMode: RangeMode
  setRangeMode: Dispatch<SetStateAction<RangeMode>>
  historyMonth: string
  setHistoryMonth: Dispatch<SetStateAction<string>>
  customRange: { start: string; end: string }
  setCustomRange: Dispatch<SetStateAction<{ start: string; end: string }>>
  paymentFilter: string
  setPaymentFilter: Dispatch<SetStateAction<string>>
  selectedCats: Set<string>
  setSelectedCats: Dispatch<SetStateAction<Set<string>>>
  trendCategory: string
  setTrendCategory: Dispatch<SetStateAction<string>>
  /** 清理支付方式 + 分类筛选（保留时间范围） */
  clearFilters: () => void
}

const HomeFilterContext = createContext<HomeFilterContextValue>(null!)

export function HomeFilterProvider({ children }: { children: ReactNode }) {
  const [rangeMode, setRangeMode] = useState<RangeMode>('month')
  const [historyMonth, setHistoryMonth] = useState('') // 仅 rangeMode='history' 时有效
  const [customRange, setCustomRange] = useState({ start: localDateString(), end: localDateString() })
  const [paymentFilter, setPaymentFilter] = useState('') // 按支付方式筛选列表，'' 表示不筛选
  // 按分类筛选：Set 里存的是「大类+小类」组合键（catKey）。选了某大类 = 它所有小类都选中
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set())
  const [trendCategory, setTrendCategory] = useState('') // '' 表示「全天」（所有大类按月汇总）

  const clearFilters = () => {
    setPaymentFilter('')
    setSelectedCats(new Set())
  }

  return (
    <HomeFilterContext.Provider
      value={{
        rangeMode,
        setRangeMode,
        historyMonth,
        setHistoryMonth,
        customRange,
        setCustomRange,
        paymentFilter,
        setPaymentFilter,
        selectedCats,
        setSelectedCats,
        trendCategory,
        setTrendCategory,
        clearFilters,
      }}
    >
      {children}
    </HomeFilterContext.Provider>
  )
}

export function useHomeFilter(): HomeFilterContextValue {
  const ctx = useContext(HomeFilterContext)
  if (!ctx) {
    throw new Error('useHomeFilter must be used within a HomeFilterProvider')
  }
  return ctx
}
