import { Skeleton, SkeletonKpiCard } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <div className="page-loading-bar" />
      <div className="page-content" style={{ padding: '32px 40px 48px' }}>
        <Skeleton width={180} height={28} style={{ marginBottom: 8 }} />
        <Skeleton width={260} height={12} style={{ marginBottom: 28 }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[0, 1, 2, 3].map(i => <SkeletonKpiCard key={i} />)}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: 16, padding: '14px 20px', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}>
              <Skeleton height={14} width="80%" />
              {[0, 1, 2, 3].map(j => <Skeleton key={j} height={14} width="60%" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
