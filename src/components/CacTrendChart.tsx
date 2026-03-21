'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { period: string; cac: number; newCustomers: number; spend: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const cac = payload.find((p: any) => p.dataKey === 'cac')
  const customers = payload.find((p: any) => p.dataKey === 'newCustomers')
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>{label}</p>
      {customers && (
        <p style={{ color: '#00ff97', fontWeight: 600, fontFamily: 'Barlow, sans-serif', marginBottom: 4 }}>
          New customers: {customers.value}
        </p>
      )}
      {cac && (
        <p style={{ color: '#fff', fontWeight: 700, fontFamily: 'Barlow, sans-serif' }}>
          CAC: ${Number(cac.value).toFixed(2)}
        </p>
      )}
    </div>
  )
}

export default function CacTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="cac" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={48} />
        <YAxis yAxisId="customers" orientation="right" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<CustomTooltip />} />
        <Bar yAxisId="customers" dataKey="newCustomers" fill="rgba(0,255,151,0.15)" stroke="rgba(0,255,151,0.3)" strokeWidth={1} radius={[3,3,0,0]} barSize={20} />
        <Line yAxisId="cac" type="monotone" dataKey="cac" stroke="#000" strokeWidth={2} dot={{ r: 3, fill: '#000', stroke: '#fff', strokeWidth: 1 }} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
