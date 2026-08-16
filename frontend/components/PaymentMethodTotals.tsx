// 每日支付方式统计徽章（只显示金额 > 0 的支付方式，按设置页顺序展示）
// 桌面/移动两处用法仅外层容器 class 不同（hidden sm:flex / sm:hidden）
import type { Expense, PaymentMethodConfig, TxTypeConfig } from '../data/types'

interface Props {
  items: Expense[]
  paymentMethods: PaymentMethodConfig[]
  txTypeByCode: Map<string, TxTypeConfig>
  /** 外层容器 class：桌面版 "hidden sm:flex"，移动版 "sm:hidden" */
  className?: string
}

export default function PaymentMethodTotals({
  items,
  paymentMethods,
  txTypeByCode,
  className = 'hidden sm:flex',
}: Props) {
  // 只统计「计入支出」的支付方式金额（与蓝色卡/右栏统计口径一致；收入、不计类型不参与）
  const pmTotals: Record<string, number> = {}
  for (const e of items) {
    const pm = e.payment_method || ''
    if (pm && txTypeByCode.get(e.type)?.category === 'expense') pmTotals[pm] = (pmTotals[pm] || 0) + e.amount
  }
  // 按设置页中的支付方式顺序展示（只显示金额 > 0 的；已从设置删除的历史支付方式排在最后兜底）
  const orphanPms = Object.keys(pmTotals).filter((pm) => !paymentMethods.some((p) => p.name === pm))
  const ordered = [...paymentMethods.map((p) => p.name), ...orphanPms]

  return (
    <div className={`${className} items-center gap-1 flex-wrap`}>
      {ordered
        .filter((pm) => (pmTotals[pm] || 0) > 0)
        .map((pm) => {
          const pmInfo = paymentMethods.find((p) => p.name === pm)
          const total = pmTotals[pm]
          return (
            <span key={pm} className="relative group inline-flex items-center justify-center gap-0.5 w-[76px] text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md cursor-pointer">
              <span>{pmInfo?.icon || ''}</span>
              <span className="tabular-nums font-medium">¥{total.toFixed(2)}</span>
              {/* 悬浮气泡（CSS 自绘，WebView 也支持） */}
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded-md bg-slate-800 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-lg">
                {pm}
              </span>
            </span>
          )
        })}
    </div>
  )
}
