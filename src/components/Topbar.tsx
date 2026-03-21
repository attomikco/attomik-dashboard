'use client'

import { useRouter } from 'next/navigation'

interface TopbarProps {
  title: string
  subtitle?: string
  period?: string
  onPeriodChange?: (p: string) => void
  action?: { label: string; href?: string; onClick?: () => void }
}

const periods = ['7D', '30D', '90D', '1Y']

export default function Topbar({ title, subtitle, period, onPeriodChange, action }: TopbarProps) {
  const router = useRouter()

  return (
    <div style={{
      padding: '20px 40px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 50,
    }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>{subtitle}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onPeriodChange && (
          <div style={{ display: 'flex', gap: 4 }}>
            {periods.map(p => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                  cursor: 'pointer', border: 'none', fontFamily: 'var(--font-barlow)',
                  background: period === p ? 'var(--ink)' : 'transparent',
                  color: period === p ? 'var(--accent)' : 'var(--muted)',
                  transition: '0.15s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {action && (
          <button
            onClick={() => action.href ? router.push(action.href) : action.onClick?.()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: 'var(--accent)', color: '#000',
              fontFamily: 'var(--font-barlow)', fontSize: '0.8rem', fontWeight: 700,
              border: 'none', borderRadius: 6, cursor: 'pointer', transition: '0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#00e085')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
