'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { month: string; returning: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>{label}</p>
      <p style={{ color: '#00ff97', fontWeight: 700, fontFamily: 'Barlow, sans-serif' }}>
        {payload[0].value} returning customers
      </p>
    </div>
  )
}

export default function ReturnGrowthChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <defs>
          <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00ff97" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#00ff97" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="returning" stroke="#00ff97" strokeWidth={2.5} fill="url(#retGrad)" dot={{ r: 4, fill: '#00ff97', stroke: '#fff', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
