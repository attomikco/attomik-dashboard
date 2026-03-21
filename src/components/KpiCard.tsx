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
    <div style={{
      background: accent ? 'var(--ink)' : 'var(--paper)',
      border: `1px solid ${accent ? 'var(--ink)' : 'var(--border)'}`,
      borderRadius: 10,
      padding: 24,
    }}>
      <div style={{
        fontSize: '0.75rem', fontWeight: 600,
        color: accent ? 'rgba(255,255,255,0.4)' : 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em',
        fontFamily: 'var(--font-mono)',
        color: accent ? 'var(--accent)' : 'var(--ink)',
      }}>
        {value}
      </div>
      {change !== undefined && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          marginTop: 8, fontSize: '0.75rem', fontWeight: 600,
          padding: '3px 8px', borderRadius: 20,
          background: isUp ? 'var(--accent-light)' : '#fee2e2',
          color: isUp ? '#007a48' : '#b91c1c',
        }}>
          {isUp ? '↑' : '↓'} {Math.abs(change)}%
        </span>
      )}
      {subtext && (
        <div style={{
          fontSize: '0.75rem', marginTop: 6,
          color: accent ? 'rgba(255,255,255,0.3)' : 'var(--muted)',
        }}>
          {subtext}
        </div>
      )}
    </div>
  )
}
