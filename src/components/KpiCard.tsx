interface KpiCardProps {
  label: string
  value: string
  change?: number
  subtext?: string
  accent?: boolean
}

export default function KpiCard({ label, value, change, subtext, accent }: KpiCardProps) {
  const isUp = change !== undefined && change >= 0

  return (
    <div className={`kpi-card${accent ? ' accent' : ''}`}>
      <div className="kpi-label">
        {label}
      </div>
      <div className="kpi-value" style={{ fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      {change !== undefined && (
        <span className={`badge ${isUp ? 'pill-up' : 'pill-down'}`} style={{ marginTop: 'var(--sp-2)' }}>
          {isUp ? '↑' : '↓'} {Math.abs(change)}%
        </span>
      )}
      {subtext && (
        <div className="kpi-sub">
          {subtext}
        </div>
      )}
    </div>
  )
}
