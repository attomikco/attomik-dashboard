'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface Props {
  data: { date: string; roas: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>{label}</p>
      <p style={{ color: '#00ff97', fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>ROAS: {Number(payload[0].value).toFixed(2)}x</p>
    </div>
  )
}

export default function RoasChart({ data }: Props) {
  const avg = data.length > 0 ? data.reduce((s, d) => s + d.roas, 0) / data.length : 0
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}x`} width={40} />
        <Tooltip content={<CustomTooltip />} />
        {avg > 0 && <ReferenceLine y={avg} stroke="#e0e0e0" strokeDasharray="4 3" label={{ value: `avg ${avg.toFixed(1)}x`, position: 'right', fontSize: 10, fill: '#999', fontFamily: 'DM Mono, monospace' }} />}
        <Line type="monotone" dataKey="roas" stroke="#00ff97" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#00ff97' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
