'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { day: number; current: number | null; previous: number }[]
  currentLabel: string
  previousLabel: string
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>Day {label}</p>
      {payload.map((p: any) => p.value != null && (
        <p key={p.dataKey} style={{ color: p.dataKey === 'current' ? '#00ff97' : '#e0e0e0', fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>
          {p.name}: ${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  )
}

export default function PacingChart({ data, currentLabel, previousLabel }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `D${v}`} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={48} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="previous" name={previousLabel} stroke="#e0e0e0" strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 3, fill: '#e0e0e0' }} />
        <Line type="monotone" dataKey="current" name={currentLabel} stroke="#00ff97" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#00ff97' }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
