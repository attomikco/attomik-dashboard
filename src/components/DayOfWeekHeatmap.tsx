'use client'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const COLORS = ['#f2f2f2', '#ccffe8', '#80ffcc', '#33ffaa', '#00ff97']

interface Props {
  data: { dayOfWeek: number; revenue: number; orders: number; weeks: number }[]
}

export default function DayOfWeekHeatmap({ data }: Props) {
  const ordered = [1,2,3,4,5,6,0].map(dow =>
    data.find(d => d.dayOfWeek === dow) ?? { dayOfWeek: dow, revenue: 0, orders: 0, weeks: 1 }
  )
  const avgRevs = ordered.map(d => d.revenue / Math.max(d.weeks, 1))

  // Rank-based coloring — always uses full color range regardless of spread
  const sorted = [...avgRevs].sort((a, b) => a - b)
  const getColorIndex = (v: number) => {
    const rank = sorted.indexOf(v) // 0 = lowest, 6 = highest
    return Math.floor((rank / (sorted.length - 1)) * (COLORS.length - 1))
  }

  const fmt$ = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${n.toFixed(0)}`

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {ordered.map((d, i) => {
          const avg = avgRevs[i]
          const avgOrd = d.orders / Math.max(d.weeks, 1)
          const colorIdx = getColorIndex(avg)
          const bg = COLORS[colorIdx]
          const isDark = colorIdx >= 3
          return (
            <div key={i} style={{ borderRadius: 8, padding: '16px 10px', background: bg, border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', transition: '0.15s' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? '#000' : '#666', marginBottom: 8 }}>
                {DAYS[i]}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#000', marginBottom: 4 }}>
                {fmt$(avg)}
              </div>
              <div style={{ fontSize: '0.72rem', color: isDark ? '#000' : '#666', opacity: 0.7 }}>
                {Math.round(avgOrd)} orders
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '0.72rem', color: '#999' }}>Low</span>
        {COLORS.map(c => (
          <div key={c} style={{ width: 18, height: 8, borderRadius: 2, background: c, border: '1px solid rgba(0,0,0,0.08)' }} />
        ))}
        <span style={{ fontSize: '0.72rem', color: '#999' }}>High</span>
      </div>
    </div>
  )
}
