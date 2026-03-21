'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { date: string; revenue: number; roas: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const rev = payload.find((p: any) => p.dataKey === 'revenue')
  const roas = payload.find((p: any) => p.dataKey === 'roas')
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>{label}</p>
      {rev && <p style={{ color: '#00ff97', fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>Revenue: ${Number(rev.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
      {roas && <p style={{ color: '#fff', fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>ROAS: {Number(roas.value).toFixed(2)}x</p>}
    </div>
  )
}

export default function RevenueRoasChart({ data }: Props) {
  const hasRoas = data.some(d => d.roas > 0)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: hasRoas ? 48 : 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis yAxisId="revenue" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} width={48} />
        {hasRoas && <YAxis yAxisId="roas" orientation="right" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}x`} width={40} />}
        <Tooltip content={<CustomTooltip />} />
        {/* Bars only for revenue — no duplicate line */}
        <Bar yAxisId="revenue" dataKey="revenue" fill="#00ff97" radius={[3,3,0,0]} barSize={14} />
        {hasRoas && <Line yAxisId="roas" type="monotone" dataKey="roas" stroke="#000" strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 3, fill: '#000' }} />}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
