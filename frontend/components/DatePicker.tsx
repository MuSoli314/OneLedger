import { useState, useRef, useEffect } from 'react'
import { DayPicker } from '@daypicker/react'
import { zhCN } from '@daypicker/react/locale'
import { format } from 'date-fns'
import '@daypicker/react/style.css'

interface Props {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
  placeholder?: string
  inline?: boolean
  className?: string
  buttonClassName?: string
  iconClassName?: string
}

const MIN_DATE = new Date(2020, 0, 1)
const MAX_DATE = new Date(2030, 11, 31)

export default function DatePicker({ value, onChange, placeholder = '选择日期', inline = false, className = '', buttonClassName = '', iconClassName = '' }: Props) {
  const [open, setOpen] = useState(inline)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (inline) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [inline])

  const selectedDate = value ? new Date(value + 'T00:00:00') : undefined

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'))
      if (!inline) setOpen(false)
    }
  }

  const displayValue = value
    ? format(new Date(value + 'T00:00:00'), 'yyyy/MM/dd')
    : placeholder

  return (
    <div className={`relative ${className}`} ref={ref}>
      {!inline && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-base text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-left flex items-center justify-between ${buttonClassName}`}
        >
          <span>{displayValue}</span>
          <svg className={`w-5 h-5 text-slate-400 ${iconClassName}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      )}

      {(open || inline) && (
        <div className={`${inline ? '' : 'absolute z-50 mt-2 left-0'} bg-white rounded-xl shadow-xl border border-slate-200 p-3`}>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            locale={zhCN}
            captionLayout="dropdown"
            startMonth={MIN_DATE}
            endMonth={MAX_DATE}
          />
        </div>
      )}
    </div>
  )
}
