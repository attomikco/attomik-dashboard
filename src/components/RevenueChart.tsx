'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface RevenueChartProps {
  data: { date: string; revenue: number; orders: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#000', border: '1px solid #333', borderRadius: 8,
      padding: '10px 14px', fontSize: '0.8rem',
    }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.name === 'revenue' ? 'var(--accent)' : '#fff', fontWeight: 600 }}>
          {p.name === 'revenue' ? `$${p.value.toLocaleString()}` : `${p.value} orders`}
        </p>
      ))}
    </div>
  )
}

export default function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#999', fontFamily: 'var(--font-mono)' }}
          axisLine={false} tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="revenue"
          tick={{ fontSize: 11, fill: '#999', fontFamily: 'var(--font-mono)' }}
          axisLine={false} tickLine={false}
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          width={48}
        />
        <YAxis
          yAxisId="orders"
          orientation="right"
          tick={{ fontSize: 11, fill: '#999', fontFamily: 'var(--font-mono)' }}
          axisLine={false} tickLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar yAxisId="orders" dataKey="orders" fill="rgba(0,0,0,0.07)" radius={[3, 3, 0, 0]} barSize={12} />
        <Line
          yAxisId="revenue" type="monotone" dataKey="revenue"
          stroke="#00ff97" strokeWidth={2} dot={false}
          activeDot={{ r: 4, fill: '#00ff97' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
