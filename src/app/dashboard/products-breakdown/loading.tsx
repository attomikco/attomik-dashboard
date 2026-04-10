import { Skeleton, SkeletonKpiCard } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <div className="page-loading-bar" />
      <div className="topbar">
        <div className="topbar-title" style={{ minWidth: 0, flex: 1 }}>
          <Skeleton width={200} height={26} style={{ marginBottom: 8 }} />
          <Skeleton width={160} height={12} />
        </div>
        <div className="topbar-actions">
          <Skeleton width={170} height={36} radius={8} />
        </div>
      </div>

      <div className="page-content">
        <div className="products-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[0, 1, 2].map(i => <SkeletonKpiCard key={i} />)}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
            <Skeleton width={180} height={16} />
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr', gap: 16, padding: '14px 20px', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Skeleton width={40} height={40} radius={6} />
                <Skeleton width="70%" height={12} />
              </div>
              {[0, 1, 2, 3].map(j => <Skeleton key={j} height={14} width="55%" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
