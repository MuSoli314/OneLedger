import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { useCategories } from '../contexts/CategoryContext'

interface Props {
  trendData: { month: string; total: number }[]
  categoryData: { name: string; value: number; color: string }[]
}

const COLORS = [
  '#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#64748b',
]

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

const PieTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    const d = payload[0]
    return (
      <div className="bg-white border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-sm">
        <p className="text-slate-500 mb-1">{d.name}</p>
        <p className="font-semibold text-slate-800">
          ¥{Number(d.value).toFixed(2)}
        </p>
      </div>
    )
  }
  return null
}

export function TrendLineChart({ data }: { data: Props['trendData'] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        暂无趋势数据
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `¥${v}`} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="total"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ fill: '#6366f1', r: 3 }}
          activeDot={{ r: 5, fill: '#6366f1' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function TrendPieChart({ data }: { data: Props['categoryData'] }) {
  const hasData = data.some((d) => d.value > 0)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        暂无分类数据
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={entry.color || COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function PieLegend({ data }: { data: Props['categoryData'] }) {
  const { categories } = useCategories()
  const hasData = data.some((d) => d.value > 0)
  if (!hasData) return null

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
      {data
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((d, i) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
          const icon = categories.find((c) => c.name === d.name)?.icon || '📂'
          return (
            <div key={d.name} className="flex items-center gap-2 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color || COLORS[i % COLORS.length] }}
              />
              <span className="text-slate-500 truncate">{icon} {d.name}</span>
              <span className="text-slate-400 ml-auto">{pct}%</span>
            </div>
          )
        })}
    </div>
  )
}
