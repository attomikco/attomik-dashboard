'use client'

interface MetricSummaryRow {
  label: string
  current: number
  previous: number
  format: 'currency' | 'number' | 'percent' | 'multiplier'
  invertColors?: boolean
  sparkline?: number[]
}

function fmt(n: number, type: MetricSummaryRow['format'], forceK?: boolean): string {
  if (type === 'currency') {
    if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`
    if (n >= 1_000 || forceK) return `$${(n/1_000).toFixed(2)}k`
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
    <div className="table-wrapper table-sticky"><div className="table-scroll">
      <table style={{ minWidth: 520 }}>
        <thead>
          <tr>
            {[
              { label: 'Metric',       align: 'left'  },
              { label: currentLabel,   align: 'right' },
              { label: previousLabel,  align: 'right' },
              { label: 'Change',       align: 'right' },
              { label: 'Trend',        align: 'right' },
            ].map(h => (
              <th key={h.label} style={{ textAlign: h.align as any }}>
                {h.label}
              </th>
            ))}
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
                  <td colSpan={5} className="label" style={{
                    padding: '8px 20px 4px', background: '#fafafa',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    whiteSpace: 'nowrap', color: 'var(--subtle)',
                  }}>
                    {row.label}
                  </td>
                </tr>
              )
            }

            return (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {row.label}
                </td>
                <td className="td-mono td-right td-strong" style={{ whiteSpace: 'nowrap' }}>
                  {fmt(row.current, row.format, row.format === 'currency' && (row.current >= 1000 || row.previous >= 1000))}
                </td>
                <td className="td-mono td-right td-muted" style={{ whiteSpace: 'nowrap' }}>
                  {fmt(row.previous, row.format, row.format === 'currency' && (row.current >= 1000 || row.previous >= 1000))}
                </td>
                <td className="td-right" style={{ whiteSpace: 'nowrap' }}>
                  <span className={`badge ${isGood ? 'pill-up' : 'pill-down'}`}>
                    {isUp ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
                  </span>
                </td>
                <td className="td-right">
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
    </div></div>
  )
}
