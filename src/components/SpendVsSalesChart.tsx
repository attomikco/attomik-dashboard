'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { date: string; revenue: number; spend: number; prevRevenue?: number | null; prevSpend?: number | null }[]
}

const LABEL: Record<string, string> = {
  revenue: 'Sales',
  spend: 'Spend',
  prevRevenue: 'Prev Sales',
  prevSpend: 'Prev Spend',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>{label}</p>
      {payload.filter((p: any) => p.value != null).map((p: any) => {
        const isPrev = p.dataKey === 'prevRevenue' || p.dataKey === 'prevSpend'
        const color = isPrev ? '#888' : (p.dataKey === 'revenue' ? '#00ff97' : '#999')
        return (
          <p key={p.dataKey} style={{ color, fontWeight: isPrev ? 400 : 600, fontFamily: 'Barlow, sans-serif' }}>
            {LABEL[p.dataKey] ?? p.dataKey}: ${Number(p.value).toLocaleString()}
          </p>
        )
      })}
    </div>
  )
}

export default function SpendVsSalesChart({ data }: Props) {
  const tickInterval = data.length > 20 ? Math.ceil(data.length / 8) - 1 : data.length > 10 ? 2 : 0
  const hasPrevRev = data.some(d => d.prevRevenue != null)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: data.length > 14 ? 16 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} interval={tickInterval} angle={data.length > 14 ? -45 : 0} textAnchor={data.length > 14 ? 'end' : 'middle'} />
        <YAxis tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={48} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="spend" fill="#f2f2f2" stroke="#e0e0e0" strokeWidth={1} radius={[3,3,0,0]} barSize={10} />
        <Line type="monotone" dataKey="revenue" stroke="#00ff97" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#00ff97' }} />
        {hasPrevRev && <Line type="monotone" dataKey="prevRevenue" stroke="#bbb" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
