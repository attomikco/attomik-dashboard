import React from 'react'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: number | string
  style?: React.CSSProperties
  className?: string
}

export function Skeleton({ width = '100%', height = 14, radius = 6, style, className }: SkeletonProps) {
  return (
    <div
      className={`skeleton${className ? ' ' + className : ''}`}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}

export function SkeletonText({ lines = 1, width = '100%' }: { lines?: number; width?: number | string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 && lines > 1 ? '60%' : width} height={12} />
      ))}
    </div>
  )
}

export function SkeletonKpiCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="kpi-card" style={{ padding: compact ? '14px 16px' : '18px 20px' }}>
      <Skeleton width={72} height={10} style={{ marginBottom: 10 }} />
      <Skeleton width="60%" height={24} style={{ marginBottom: 8 }} />
      <Skeleton width={44} height={12} />
    </div>
  )
}

export function SkeletonRow({ cols = 6, cellHeight = 14 }: { cols?: number; cellHeight?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '16px 20px' }}>
          <Skeleton height={cellHeight} width={i === 0 ? '80%' : '60%'} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonCard({ children }: { children?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      {children ?? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Skeleton width={34} height={34} radius={8} />
            <div style={{ flex: 1 }}>
              <Skeleton width="50%" height={14} style={{ marginBottom: 6 }} />
              <Skeleton width="30%" height={10} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ background: '#f2f2f2', borderRadius: 8, padding: '10px 12px' }}>
                <Skeleton width={50} height={10} style={{ marginBottom: 6 }} />
                <Skeleton width="70%" height={16} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
