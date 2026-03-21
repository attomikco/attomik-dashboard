'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { date: string; revenue: number; spend: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.dataKey === 'revenue' ? '#00ff97' : '#999', fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>
          {p.dataKey === 'revenue' ? `Sales: $${Number(p.value).toLocaleString()}` : `Spend: $${Number(p.value).toLocaleString()}`}
        </p>
      ))}
    </div>
  )
}

export default function SpendVsSalesChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={48} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="spend" fill="#f2f2f2" stroke="#e0e0e0" strokeWidth={1} radius={[3,3,0,0]} barSize={10} />
        <Line type="monotone" dataKey="revenue" stroke="#00ff97" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#00ff97' }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
