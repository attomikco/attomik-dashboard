'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TopbarProps {
  title: string
  subtitle?: string
  period?: string
  onPeriodChange?: (p: string) => void
  action?: { label: string; href?: string; onClick?: () => void }
  className?: string
}

const periods = ['7D', '30D', '90D', '1Y']

export default function Topbar({ title, subtitle, period, onPeriodChange, action, className }: TopbarProps) {
  const router = useRouter()

  useEffect(() => {
    const handler = () => {
      document.querySelector('.topbar')?.classList.toggle('topbar-scrolled', window.scrollY > 4)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className={`topbar${className ? ` ${className}` : ''}`}>
      <div className="topbar-title">
        <h1>{title}</h1>
        {subtitle && <p className="caption" style={{ marginTop: 2 }}>{subtitle}</p>}
      </div>
      <div className="topbar-actions">
        {onPeriodChange && (
          <div className="toggle-group">
            {periods.map(p => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`toggle-btn${period === p ? ' active' : ''}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {action && (
          <button
            onClick={() => action.href ? router.push(action.href) : action.onClick?.()}
            className="btn btn-primary btn-sm"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
