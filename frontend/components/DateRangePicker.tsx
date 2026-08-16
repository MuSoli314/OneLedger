import { useState } from 'react'
import { DayPicker } from '@daypicker/react'
import type { DateRange } from '@daypicker/react'
import { zhCN } from '@daypicker/react/locale'
import { format } from 'date-fns'
import '@daypicker/react/style.css'

interface Props {
  start: string
  end: string
  onChange: (range: { start: string; end: string }) => void
  onComplete?: () => void
  onCancel?: () => void
}

const MIN_DATE = new Date(2020, 0, 1)
const MAX_DATE = new Date(2030, 11, 31)

export default function DateRangePicker({ start, end, onChange, onComplete, onCancel }: Props) {
  // 打开时回显上次选择的区间（若有过选择）
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = start ? new Date(start + 'T00:00:00') : undefined
    const to = end ? new Date(end + 'T00:00:00') : undefined
    return from ? { from, to } : undefined
  })
  // 只选了开始日期后，鼠标悬浮预览用
  const [hovered, setHovered] = useState<Date | undefined>()
  // 打开时默认展示「上月 + 本月」两个月份（第一个显示 defaultMonth，第二个自动为下一个月）
  const defaultMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)

  // 预览区间：开始日期 + 悬浮日期（自动处理两个方向），仅在未选结束日期时生效
  const displayRange: DateRange | undefined =
    range?.from && !range.to && hovered
      ? range.from <= hovered
        ? { from: range.from, to: hovered }
        : { from: hovered, to: range.from }
      : range

  const handleSelect = (_selected: DateRange | undefined, triggerDate?: Date) => {
    setHovered(undefined)
    if (!triggerDate) return
    if (!range?.from) {
      // 第一下：只设开始日期
      setRange({ from: triggerDate, to: undefined })
      return
    }
    if (range.to) {
      // 已有完整区间：从新日期重新开始
      setRange({ from: triggerDate, to: undefined })
      return
    }
    // 第二下：与开始日期组成完整区间（自动交换方向）
    const [s, e] =
      range.from <= triggerDate
        ? [range.from, triggerDate]
        : [triggerDate, range.from]
    setRange({ from: s, to: e })
    onChange({ start: format(s, 'yyyy-MM-dd'), end: format(e, 'yyyy-MM-dd') })
    onComplete?.()
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <DayPicker
          mode="range"
          min={1}
          resetOnSelect
          selected={displayRange}
          onSelect={handleSelect}
          onDayMouseEnter={(day) => {
            if (range?.from && !range.to) setHovered(day)
          }}
          onDayMouseLeave={() => setHovered(undefined)}
          locale={zhCN}
          numberOfMonths={2}
          defaultMonth={defaultMonth}
          captionLayout="dropdown"
          startMonth={MIN_DATE}
          endMonth={MAX_DATE}
        />
      </div>

      <div className="flex items-center justify-between">
        {range?.from && !range.to ? (
          <span className="text-xs text-slate-500">
            已选择开始日期 {format(range.from, 'yyyy/MM/dd')}，请点击结束日期
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            请点击开始日期，再点击结束日期
          </span>
        )}
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}
