// 节假日数据状态行（分类管理页顶部小字）
//
// 「工作日」类规则要靠节假日数据判断，这里让用户一眼看到数据到哪一年了、能不能更新。
// 联网失败 / 该年安排未公布 → 工作日按周一~周五判断（不影响任何记账功能）。
import { useCallback, useEffect, useState } from 'react'
import {
  ensureHolidayData,
  getHolidayDataStatusAsync,
  type HolidayDataStatus,
} from '../data/database'

/** 数据库在启动检查结束后会广播这个事件，状态行据此刷新（避免用户看到过期状态） */
export const HOLIDAY_DATA_UPDATED_EVENT = 'holiday-data-updated'

export default function HolidayStatusLine() {
  const [status, setStatus] = useState<HolidayDataStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setStatus(await getHolidayDataStatusAsync())
    } catch (err) {
      console.error('读取节假日数据状态失败:', err)
    }
  }, [])

  useEffect(() => {
    load()
    const onUpdated = () => load()
    window.addEventListener(HOLIDAY_DATA_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(HOLIDAY_DATA_UPDATED_EVENT, onUpdated)
  }, [load])

  const updateNow = async () => {
    if (busy) return
    setBusy(true)
    try {
      await ensureHolidayData({ force: true })
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null

  const { currentYear, nextYear, latestReadyYear, currentYearReady, nextYearReady } = status
  // 说明文字：当年数据有没有就绪最重要；次年没就绪只是「尚未公布」，属正常
  const parts: string[] = []
  if (latestReadyYear !== null) parts.push(`已更新至 ${latestReadyYear} 年`)
  if (!currentYearReady) {
    parts.push(`${currentYear} 年数据尚未获取，工作日暂按周一~周五判断`)
  } else if (!nextYearReady) {
    parts.push(`${nextYear} 年安排尚未公布，工作日暂按周一~周五判断`)
  }
  const text = parts.join('（') + (parts.length > 1 ? '）' : '')

  return (
    <div className="flex items-center gap-3 text-xs text-slate-400">
      <span>
        <span className="text-slate-500">节假日数据：</span>
        {text || '尚未获取'}
      </span>
      <button
        type="button"
        onClick={updateNow}
        disabled={busy}
        className="px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? '更新中…' : '立即更新'}
      </button>
    </div>
  )
}
