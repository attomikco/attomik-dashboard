import { Skeleton, SkeletonKpiCard } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <div className="page-loading-bar" />
      <div className="topbar">
        <div className="topbar-title">
          <Skeleton width={140} height={26} style={{ marginBottom: 8 }} />
          <Skeleton width={200} height={12} />
        </div>
        <div className="topbar-actions">
          <Skeleton width={170} height={36} radius={8} />
        </div>
      </div>

      <div className="page-content" style={{ minWidth: 0, overflowX: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[0, 1, 2, 3].map(i => <SkeletonKpiCard key={i} />)}
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <Skeleton width={180} height={16} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={260} radius={8} />
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
            <Skeleton width={200} height={16} />
          </div>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 20px', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}>
              <Skeleton height={14} width="80%" />
              {[0, 1, 2, 3, 4].map(j => <Skeleton key={j} height={14} width="60%" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
