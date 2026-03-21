'use client'

interface MetricSummaryRow {
  label: string
  current: number
  previous: number
  format: 'currency' | 'number' | 'percent' | 'multiplier'
  invertColors?: boolean
  sparkline?: number[]
}

function fmt(n: number, type: MetricSummaryRow['format']): string {
  if (type === 'currency') {
    if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`
    if (n >= 1_000) return `$${(n/1_000).toFixed(2)}k`
    return `$${n.toFixed(2)}`
  }
  if (type === 'number') return n >= 1_000 ? `${(n/1_000).toFixed(1)}k` : n.toLocaleString()
  if (type === 'percent') return `${n.toFixed(1)}%`
  if (type === 'multiplier') return `${n.toFixed(2)}x`
  return String(n)
}

function Sparkline({ values, isGood }: { values: number[]; isGood: boolean | null }) {
  if (!values || values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const w = 80, h = 28, pad = 2
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  const color = isGood === false ? '#b91c1c' : '#00cc78'
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

interface Props {
  rows: MetricSummaryRow[]
  currentLabel: string
  previousLabel: string
}

export default function MoMSummaryTable({ rows, currentLabel, previousLabel }: Props) {
  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: '10px 24px', background: '#f2f2f2', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', textAlign: 'left', fontFamily: 'Barlow, sans-serif' }}>
              Metric
            </th>
            <th style={{ padding: '10px 24px', background: '#f2f2f2', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', textAlign: 'right', fontFamily: 'Barlow, sans-serif' }}>
              {currentLabel}
            </th>
            <th style={{ padding: '10px 24px', background: '#f2f2f2', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', textAlign: 'right', fontFamily: 'Barlow, sans-serif' }}>
              {previousLabel}
            </th>
            <th style={{ padding: '10px 24px', background: '#f2f2f2', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', textAlign: 'right', fontFamily: 'Barlow, sans-serif' }}>
              Change
            </th>
            <th style={{ padding: '10px 24px', background: '#f2f2f2', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', textAlign: 'right', fontFamily: 'Barlow, sans-serif' }}>
              Trend
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const pct = row.previous === 0
              ? (row.current > 0 ? 100 : 0)
              : ((row.current - row.previous) / row.previous) * 100
            const isUp = pct >= 0
            const isGood = row.invertColors ? !isUp : isUp
            const isSection = row.current === -1

            if (isSection) {
              return (
                <tr key={i}>
                  <td colSpan={5} style={{ padding: '8px 24px 4px', background: '#fafafa', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', fontFamily: 'Barlow, sans-serif', borderTop: i > 0 ? '1px solid #e0e0e0' : 'none' }}>
                    {row.label}
                  </td>
                </tr>
              )
            }

            return (
              <tr key={i} style={{ borderTop: '1px solid #f2f2f2' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '13px 24px', fontSize: '0.875rem', fontFamily: 'Barlow, sans-serif', color: '#000' }}>
                  {row.label}
                </td>
                <td style={{ padding: '13px 24px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '0.875rem', fontWeight: 600 }}>
                  {fmt(row.current, row.format)}
                </td>
                <td style={{ padding: '13px 24px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '0.875rem', color: '#999' }}>
                  {fmt(row.previous, row.format)}
                </td>
                <td style={{ padding: '13px 24px', textAlign: 'right' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontSize: '0.8rem', fontWeight: 700,
                    fontFamily: 'Barlow, sans-serif',
                    padding: '3px 8px', borderRadius: 4,
                    background: isGood ? '#e6fff5' : '#fee2e2',
                    color: isGood ? '#007a48' : '#b91c1c',
                  }}>
                    {isUp ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
                  </span>
                </td>
                <td style={{ padding: '13px 24px', textAlign: 'right' }}>
                  {row.sparkline && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Sparkline values={row.sparkline} isGood={isGood} />
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
