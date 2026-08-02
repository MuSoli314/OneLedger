import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-sm">
        <p className="text-slate-500 mb-1">{label}</p>
        <p className="font-semibold text-slate-800">
          ¥{Number(payload[0].value).toFixed(2)}
        </p>
      </div>
    )
  }
  return null
}

interface BaseProps {
  data: { key: string; total: number }[]
  color?: string
  height?: number
  tickFormatter?: (value: any) => string
  emptyText?: string
}

// 折线图公共实现：数据统一转成 { key, total }，X 轴显示 key
function LineChartBase({ data, color = '#6366f1', height = 220, tickFormatter, emptyText = '暂无趋势数据' }: BaseProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        {emptyText}
      </div>
    )
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

/** 近 12 月月度支出趋势（月份维度，X 轴显示 YYYY-MM；color 区分「全天」与选中某大类） */
export function TrendLineChart({ data, color, height }: { data: { month: string; total: number }[]; color?: string; height?: number }) {
  return (
    <LineChartBase
      data={data.map((d) => ({ key: d.month, total: d.total }))}
      color={color}
      height={height}
    />
  )
}

/** 按天支出趋势（日期维度，X 轴显示 MM-DD；color 区分「全天」与选中某大类） */
export function DailyLineChart({ data, color, height }: { data: { date: string; total: number }[]; color?: string; height?: number }) {
  return (
    <LineChartBase
      data={data.map((d) => ({ key: d.date, total: d.total }))}
      color={color}
      height={height}
      tickFormatter={(v: string) => v.slice(5)} // YYYY-MM-DD → MM-DD
    />
  )
}
