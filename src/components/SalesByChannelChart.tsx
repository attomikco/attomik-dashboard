'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { date: string; shopify: number; amazon: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + p.value, 0)
  const visible = payload.filter((p: any) => p.value > 0)
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>{label}</p>
      {visible.map((p: any) => (
        <p key={p.dataKey} style={{ color: '#00ff97', fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>
          {p.dataKey.charAt(0).toUpperCase() + p.dataKey.slice(1)}: ${Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      ))}
      {visible.length > 1 && (
        <p style={{ color: '#fff', fontWeight: 700, marginTop: 4, borderTop: '1px solid #333', paddingTop: 4, fontFamily: 'Barlow, sans-serif' }}>
          Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
    </div>
  )
}

export default function SalesByChannelChart({ data }: Props) {
  const hasAmazon = data.some(d => d.amazon > 0)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={48} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="shopify" stackId="a" fill="#00ff97" radius={hasAmazon ? [0,0,0,0] : [3,3,0,0]} barSize={14} />
        {hasAmazon && <Bar dataKey="amazon" stackId="a" fill="#00cc78" radius={[3,3,0,0]} barSize={14} />}
      </BarChart>
    </ResponsiveContainer>
  )
}
