'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { date: string; shopify: number; amazon: number; prevTotal?: number | null }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const channels = payload.filter((p: any) => (p.dataKey === 'shopify' || p.dataKey === 'amazon') && p.value > 0)
  const prev = payload.find((p: any) => p.dataKey === 'prevTotal')
  const total = channels.reduce((s: number, p: any) => s + p.value, 0)
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>{label}</p>
      {channels.map((p: any) => (
        <p key={p.dataKey} style={{ color: '#00ff97', fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>
          {p.dataKey.charAt(0).toUpperCase() + p.dataKey.slice(1)}: ${Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      ))}
      {channels.length > 1 && (
        <p style={{ color: '#fff', fontWeight: 700, marginTop: 4, borderTop: '1px solid #333', paddingTop: 4, fontFamily: 'Barlow, sans-serif' }}>
          Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
      {prev && prev.value != null && (
        <p style={{ color: '#999', marginTop: 4, fontFamily: 'Barlow, sans-serif' }}>
          Prev total: ${Number(prev.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
    </div>
  )
}

export default function SalesByChannelChart({ data }: Props) {
  const hasAmazon = data.some(d => d.amazon > 0)
  const hasPrev = data.some(d => d.prevTotal != null)
  const tickInterval = data.length > 20 ? Math.ceil(data.length / 8) - 1 : data.length > 10 ? 2 : 0
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: data.length > 14 ? 16 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} interval={tickInterval} angle={data.length > 14 ? -45 : 0} textAnchor={data.length > 14 ? 'end' : 'middle'} />
        <YAxis tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={48} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="shopify" stackId="a" fill="#00ff97" radius={hasAmazon ? [0,0,0,0] : [3,3,0,0]} barSize={14} />
        {hasAmazon && <Bar dataKey="amazon" stackId="a" fill="#00cc78" radius={[3,3,0,0]} barSize={14} />}
        {hasPrev && <Line type="monotone" dataKey="prevTotal" stroke="#bbb" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
