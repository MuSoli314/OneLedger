import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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

/** 按天支出双线图（全天虚线 + 日常实线，日期维度 X 轴显示 MM/DD） */
export function DailyDualLineChart({ data, height = 200 }: { data: { date: string; allTotal: number; dailyTotal: number }[]; height?: number }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        暂无趋势数据
      </div>
    )
  }
  const mapped = data.map((d) => ({ key: d.date, 全天支出: d.allTotal, 日常支出: d.dailyTotal }))
  const formatLabel = (v: string) => v.slice(5).replace('-', '/') // YYYY-MM-DD → MM/DD
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-sm">
          <p className="text-slate-500 mb-1">{formatLabel(label)}</p>
          {payload.map((p: any) => (
            <p key={p.dataKey} className="font-medium" style={{ color: p.stroke }}>
              {p.name}：¥{Number(p.value).toFixed(2)}
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
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="key" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatLabel} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `¥${v}`} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="全天支出" name="全天支出" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 2 }} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="日常支出" name="日常支出" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
