'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { day: number; current: number | null; previous: number | null; projection: number | null }[]
  currentLabel: string
  previousLabel: string
  estEOM?: number | null
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>Day {label}</p>
      {payload.map((p: any) => p.value != null && (
        <p key={p.dataKey} style={{
          color: p.dataKey === 'current' ? '#00ff97' : p.dataKey === 'projection' ? '#00ff97' : '#999',
          fontWeight: 600, fontFamily: 'Barlow, sans-serif', marginBottom: 2
        }}>
          {p.name}: ${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  )
}

const fmt$ = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${n.toFixed(0)}`

export default function PacingChart({ data, currentLabel, previousLabel, estEOM }: Props) {
  const hasProjection = data.some(d => d.projection !== null)
  const actualDays = data.filter(d => d.current !== null).length

  return (
    <div>
      {/* Legend + EOM badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 2, background: '#00ff97', borderRadius: 1 }} />
          <span style={{ fontSize: '0.75rem', color: '#666', fontFamily: 'Barlow, sans-serif' }}>This period</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 2, background: '#00ff97', borderRadius: 1, opacity: 0.4, borderTop: '2px dashed #00ff97' }} />
          <span style={{ fontSize: '0.75rem', color: '#666', fontFamily: 'Barlow, sans-serif' }}>Projected</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 0, borderTop: '2px dashed #ccc' }} />
          <span style={{ fontSize: '0.75rem', color: '#666', fontFamily: 'Barlow, sans-serif' }}>Prior period</span>
        </div>
        {estEOM && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'rgba(0,255,151,0.08)', border: '1px solid rgba(0,255,151,0.25)', borderRadius: 6 }}>
            <span style={{ fontSize: '0.72rem', color: '#666', fontFamily: 'Barlow, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. EOM</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#00cc78', fontFamily: 'Barlow, sans-serif', letterSpacing: '-0.02em' }}>{fmt$(estEOM)}</span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `D${v}`} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={48} />
          <Tooltip content={<CustomTooltip />} />
          {/* Prior period — grey dashed */}
          <Line type="monotone" dataKey="previous" name={previousLabel} stroke="#ccc" strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 3, fill: '#ccc' }} connectNulls={false} />
          {/* Current period — solid green */}
          <Line type="monotone" dataKey="current" name="This period" stroke="#00ff97" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#00ff97' }} connectNulls={false} />
          {/* Projection — green dashed, more visible */}
          {hasProjection && (
            <Line type="monotone" dataKey="projection" name="Projected" stroke="#00ff97" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 3, fill: '#00ff97' }} connectNulls={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
