'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: data.length > 8 ? 16 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} interval={data.length > 12 ? Math.ceil(data.length / 8) - 1 : 0} angle={data.length > 8 ? -45 : 0} textAnchor={data.length > 8 ? 'end' : 'middle'} />
        <YAxis tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="returning" fill="#00ff97" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
