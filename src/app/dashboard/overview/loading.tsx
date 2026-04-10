import { Skeleton, SkeletonKpiCard, SkeletonCard } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <div className="page-loading-bar" />
      <div className="overview-topbar topbar">
        <div className="topbar-title" style={{ minWidth: 0, flex: 1 }}>
          <Skeleton width={140} height={26} style={{ marginBottom: 8 }} />
          <Skeleton width={220} height={12} />
        </div>
        <div className="topbar-actions" style={{ flexShrink: 0 }}>
          <Skeleton width={170} height={36} radius={8} />
        </div>
      </div>

      <div className="overview-content page-content" style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }} className="summary-grid">
          {[0, 1, 2, 3].map(i => <SkeletonKpiCard key={i} />)}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <Skeleton width={130} height={36} radius={8} />
          <Skeleton width={110} height={36} radius={8} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Skeleton width={50} height={14} />
          <Skeleton width={240} height={30} radius={8} />
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 12, padding: '16px 20px', borderTop: i > 0 ? '1px solid #e0e0e0' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Skeleton width={34} height={34} radius={8} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="70%" height={12} style={{ marginBottom: 4 }} />
                  <Skeleton width="40%" height={9} />
                </div>
              </div>
              {[0, 1, 2, 3, 4, 5].map(j => <Skeleton key={j} height={14} width="60%" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
