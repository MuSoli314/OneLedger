import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts'

interface BaseProps {
  data: { key: string; total: number }[]
  color?: string
  height?: number
  tickFormatter?: (value: any) => string
  emptyText?: string
}

// 折线图公共实现：数据统一转成 { key, total }，X 轴与悬浮提示都显示 tickFormatter 格式化后的日期
function LineChartBase({ data, color = '#6366f1', height = 220, tickFormatter, emptyText = '暂无趋势数据' }: BaseProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        {emptyText}
      </div>
    )
  }

  const formatLabel = (label: any) => (tickFormatter ? tickFormatter(label) : label)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-sm">
          <p className="text-slate-500 mb-1">{formatLabel(label)}</p>
          <p className="font-semibold text-slate-800">
            ¥{Number(payload[0].value).toFixed(2)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="key" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={tickFormatter} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `¥${v}`} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="total"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 3 }}
          activeDot={{ r: 5, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** 近 12 月月度支出趋势（月份维度，X 轴显示 YYYY/MM；color 区分「全天」与选中某大类） */
export function TrendLineChart({ data, color, height }: { data: { month: string; total: number }[]; color?: string; height?: number }) {
  return (
    <LineChartBase
      data={data.map((d) => ({ key: d.month, total: d.total }))}
      color={color}
      height={height}
      tickFormatter={(v: string) => v.replace('-', '/')} // YYYY-MM → YYYY/MM
    />
  )
}

/** 按天支出趋势（日期维度，X 轴显示 MM/DD；color 区分「全天」与选中某大类） */
export function DailyLineChart({ data, color, height }: { data: { date: string; total: number }[]; color?: string; height?: number }) {
  return (
    <LineChartBase
      data={data.map((d) => ({ key: d.date, total: d.total }))}
      color={color}
      height={height}
      tickFormatter={(v: string) => v.slice(5).replace('-', '/')} // YYYY-MM-DD → MM/DD
    />
  )
}

// —— 分段压缩 Y 轴（当月支出图）——
// 目的：日常开销大多集中在 0-100 元，用等距刻度会全部挤在底部看不清。
// 方案：把真实金额映射到 0..1 的「显示刻度」，0-100 占 60% 高度、100-200 占 20%、
//       200-500 占 12%、500+ 占 8%，分界处放刻度标签；悬浮提示再反算回真实金额。
const Z1 = 0.6 // 0-100 段终点
const Z2 = 0.8 // 100-200 段终点
const Z3 = 0.92 // 200-500 段终点
const Z4 = 1.0 // 500+ 段终点

/** 真实金额 → 0..1 显示刻度（top 为 500+ 段的顶值，随当前数据自适应） */
function moneyToUnit(v: number, top: number): number {
  if (v <= 0) return 0
  if (v <= 100) return (v / 100) * Z1
  if (v <= 200) return Z1 + ((v - 100) / 100) * (Z2 - Z1)
  if (v <= 500) return Z2 + ((v - 200) / 300) * (Z3 - Z2)
  return Z3 + Math.min((v - 500) / (top - 500), 1) * (Z4 - Z3)
}

/** 0..1 显示刻度 → 真实金额（悬浮提示用） */
function unitToMoney(u: number, top: number): number {
  if (u <= 0) return 0
  if (u <= Z1) return (u / Z1) * 100
  if (u <= Z2) return 100 + ((u - Z1) / (Z2 - Z1)) * 100
  if (u <= Z3) return 200 + ((u - Z2) / (Z3 - Z2)) * 300
  return 500 + ((u - Z3) / (Z4 - Z3)) * (top - 500)
}

/** 按天支出双线图（全天虚线 + 日常实线，日期维度 X 轴显示 MM/DD；Y 轴分段压缩）。
 *  height 传数字为固定高度，传 "100%" 时由父容器（需有确定高度，如 flex-1）撑满。 */
export function DailyDualLineChart({ data, height = 200 }: { data: { date: string; allTotal: number; dailyTotal: number }[]; height?: number | `${number}%` }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        暂无趋势数据
      </div>
    )
  }
  const dataMax = Math.max(...data.map((d) => Math.max(d.allTotal, d.dailyTotal)))
  // 500+ 段的顶值：数据最大值向上取整到 50，最低 500（数据都 ≤500 时该段为空、不显示顶值标签）
  const top = Math.max(500, Math.ceil(dataMax / 50) * 50)
  const hasZone4 = top > 500
  const ticks = hasZone4 ? [0, Z1, Z2, Z3, Z4] : [0, Z1, Z2, Z3]

  const mapped = data.map((d) => ({
    key: d.date,
    全天支出: moneyToUnit(d.allTotal, top),
    日常支出: moneyToUnit(d.dailyTotal, top),
  }))
  const formatLabel = (v: string) => v.slice(5).replace('-', '/') // YYYY-MM-DD → MM/DD
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-sm">
          <p className="text-slate-500 mb-1">{formatLabel(label)}</p>
          {payload.map((p: any) => (
            <p key={p.dataKey} className="font-medium" style={{ color: p.stroke }}>
              {p.name}：¥{unitToMoney(Number(p.value), top).toFixed(2)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={mapped} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="key" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatLabel} />
        <YAxis
          domain={[0, 1]}
          ticks={ticks}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickFormatter={(u: number) => `¥${Math.round(unitToMoney(u, top))}`}
        />
        <Tooltip content={<CustomTooltip />} />
        {/* 分段底色：淡灰/白相间，弱化分区界限（真正的分区标记是 Y 轴刻度线） */}
        <ReferenceArea y1={0} y2={Z1} fill="#f8fafc" fillOpacity={0.7} />
        <ReferenceArea y1={Z1} y2={Z2} fill="#ffffff" fillOpacity={0.7} />
        <ReferenceArea y1={Z2} y2={Z3} fill="#f8fafc" fillOpacity={0.7} />
        <ReferenceArea y1={Z3} y2={Z4} fill="#ffffff" fillOpacity={0.7} />
        <Line type="monotone" dataKey="全天支出" name="全天支出" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 2 }} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="日常支出" name="日常支出" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
