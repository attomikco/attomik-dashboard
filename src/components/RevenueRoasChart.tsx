'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { date: string; revenue: number; roas: number; prevRevenue?: number | null; prevRoas?: number | null }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const rev = payload.find((p: any) => p.dataKey === 'revenue')
  const roas = payload.find((p: any) => p.dataKey === 'roas')
  const prevRev = payload.find((p: any) => p.dataKey === 'prevRevenue')
  const prevRoas = payload.find((p: any) => p.dataKey === 'prevRoas')
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>{label}</p>
      {rev && <p style={{ color: '#00ff97', fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>Revenue: ${Number(rev.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
      {prevRev && prevRev.value != null && <p style={{ color: '#999', fontFamily: 'Barlow, sans-serif' }}>Prev: ${Number(prevRev.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
      {roas && <p style={{ color: '#fff', fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>ROAS: {Number(roas.value).toFixed(2)}x</p>}
      {prevRoas && prevRoas.value != null && <p style={{ color: '#999', fontFamily: 'Barlow, sans-serif' }}>Prev ROAS: {Number(prevRoas.value).toFixed(2)}x</p>}
    </div>
  )
}

export default function RevenueRoasChart({ data }: Props) {
  const hasRoas = data.some(d => d.roas > 0)
  const hasPrev = data.some(d => d.prevRevenue != null)
  const hasPrevRoas = data.some(d => d.prevRoas != null)
  const tickInterval = data.length > 20 ? Math.ceil(data.length / 8) - 1 : data.length > 10 ? 2 : 0

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: hasRoas ? 48 : 4, left: 0, bottom: data.length > 14 ? 16 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} interval={tickInterval} angle={data.length > 14 ? -45 : 0} textAnchor={data.length > 14 ? 'end' : 'middle'} />
        <YAxis yAxisId="revenue" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} width={48} />
        {hasRoas && <YAxis yAxisId="roas" orientation="right" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}x`} width={40} />}
        <Tooltip content={<CustomTooltip />} />
        {/* Bars only for revenue — no duplicate line */}
        <Bar yAxisId="revenue" dataKey="revenue" fill="#00ff97" radius={[3,3,0,0]} barSize={14} />
        {hasPrev && <Line yAxisId="revenue" type="monotone" dataKey="prevRevenue" stroke="#bbb" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />}
        {hasRoas && <Line yAxisId="roas" type="monotone" dataKey="roas" stroke="#000" strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 3, fill: '#000' }} />}
        {hasPrevRoas && <Line yAxisId="roas" type="monotone" dataKey="prevRoas" stroke="#ccc" strokeWidth={1.25} strokeDasharray="2 3" dot={false} connectNulls />}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
