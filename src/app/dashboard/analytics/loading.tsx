import { Skeleton, SkeletonKpiCard } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <div className="page-loading-bar" />
      <div className="analytics-topbar topbar">
        <div className="topbar-title" style={{ minWidth: 0, flex: 1 }}>
          <Skeleton width={160} height={26} style={{ marginBottom: 8 }} />
          <Skeleton width={260} height={12} />
        </div>
        <div className="topbar-actions">
          <Skeleton width={170} height={36} radius={8} />
        </div>
      </div>

      <div className="analytics-content page-content" style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 80px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto' }}>
          {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} width={96} height={34} radius={8} />)}
        </div>

        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[0, 1, 2, 3].map(i => <SkeletonKpiCard key={i} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[0, 1, 2, 3].map(i => <SkeletonKpiCard key={i} />)}
        </div>

        {/* Chart placeholders */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 20 }}>
            <Skeleton width={160} height={16} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={240} radius={8} />
          </div>
          <div className="card" style={{ padding: 20 }}>
            <Skeleton width={160} height={16} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={240} radius={8} />
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <Skeleton width={200} height={16} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={280} radius={8} />
        </div>
      </div>
    </div>
  )
}
