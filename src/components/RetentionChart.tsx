'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { month: string; total: number; returning: number; new: number; retRate: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontFamily: 'Barlow, sans-serif' }}>{label}</p>
      <p style={{ color: '#00ff97', fontWeight: 600, fontFamily: 'Barlow, sans-serif', marginBottom: 4 }}>Returning: {d.returning}</p>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Barlow, sans-serif', marginBottom: 4 }}>New: {d.new}</p>
      <p style={{ color: '#fff', fontWeight: 700, fontFamily: 'Barlow, sans-serif', marginBottom: 4 }}>Total: {d.total}</p>
      <p style={{ color: '#999', fontFamily: 'Barlow, sans-serif' }}>Return Rate: {d.retRate.toFixed(1)}%</p>
    </div>
  )
}

export default function RetentionChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 48, left: 0, bottom: data.length > 8 ? 16 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} interval={data.length > 12 ? Math.ceil(data.length / 8) - 1 : 0} angle={data.length > 8 ? -45 : 0} textAnchor={data.length > 8 ? 'end' : 'middle'} />
        <YAxis yAxisId="count" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} width={40} />
        <YAxis yAxisId="rate" orientation="right" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={44} domain={[0, 100]} />
        <Tooltip content={<CustomTooltip />} />
        <Bar yAxisId="count" dataKey="new" fill="#e0e0e0" radius={[0, 0, 0, 0]} stackId="customers" />
        <Bar yAxisId="count" dataKey="returning" fill="#00ff97" radius={[4, 4, 0, 0]} stackId="customers" />
        <Line yAxisId="rate" type="monotone" dataKey="retRate" stroke="#000" strokeWidth={2} dot={{ r: 3, fill: '#000' }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
