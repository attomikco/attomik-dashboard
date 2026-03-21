import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import KpiCard from '@/components/KpiCard'
import RevenueChart from '@/components/RevenueChart'
import OrdersTable from '@/components/OrdersTable'
import type { Order } from '@/types'

async function getRevenueData(orgId: string) {
  const supabase = createClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const [currentOrders, prevOrders, recentOrders] = await Promise.all([
    supabase.from('orders').select('total_price, created_at, status, units')
      .eq('org_id', orgId).gte('created_at', thirtyDaysAgo),
    supabase.from('orders').select('total_price')
      .eq('org_id', orgId).gte('created_at', sixtyDaysAgo).lt('created_at', thirtyDaysAgo),
    supabase.from('orders').select('*')
      .eq('org_id', orgId).order('created_at', { ascending: false }).limit(20),
  ])

  const current = currentOrders.data ?? []
  const prev = prevOrders.data ?? []

  const revenue = current.reduce((s, o) => s + Number(o.total_price), 0)
  const prevRevenue = prev.reduce((s, o) => s + Number(o.total_price), 0)
  const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0

  const orders = current.reduce((s, o) => s + ((o as any).units ?? 1), 0)
  const prevOrders2 = prev.length
  const ordersChange = prevOrders2 > 0 ? ((orders - prevOrders2) / prevOrders2) * 100 : 0

  const aov = orders > 0 ? revenue / orders : 0
  const prevAov = prevOrders2 > 0 ? (prevRevenue / prevOrders2) : 0
  const aovChange = prevAov > 0 ? ((aov - prevAov) / prevAov) * 100 : 0

  const refunds = current.filter(o => o.status === 'refunded').length
  const refundRate = orders > 0 ? (refunds / orders) * 100 : 0

  // Build daily chart data for last 30 days
  const days: Record<string, { revenue: number; orders: number }> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    days[key] = { revenue: 0, orders: 0 }
  }
  current.forEach(o => {
    const key = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (days[key]) {
      days[key].revenue += Number(o.total_price)
      days[key].orders += 1
    }
  })
  const chartData = Object.entries(days).map(([date, v]) => ({ date, ...v }))

  return {
    revenue, revenueChange,
    orders, ordersChange,
    aov, aovChange,
    refundRate,
    chartData,
    recentOrders: recentOrders.data ?? [],
  }
}

export default async function RevenuePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles').select('org_id').eq('id', user.id).single()

  // If no org yet, show empty state
  if (!profile?.org_id) {
    return (
      <div>
        <Topbar title="Revenue & Sales" subtitle="No organization linked yet" />
        <div style={{ padding: '80px 40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: 16 }}>
            Your account isn't linked to an organization yet.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Ask your admin to add you, or set up your org in Settings.
          </p>
        </div>
      </div>
    )
  }

  const data = await getRevenueData(profile.org_id)

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`

  return (
    <div>
      <Topbar
        title="Revenue & Sales"
        subtitle="Last 30 days"
        action={{ label: '↑ Import CSV', href: '/dashboard/import' }}
      />

      <div style={{ padding: '32px 40px 48px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <KpiCard
            label="Total Revenue" value={fmt(data.revenue)}
            change={Math.round(data.revenueChange * 10) / 10}
            subtext="vs prev 30 days" accent
          />
          <KpiCard
            label="Total Orders" value={data.orders.toLocaleString()}
            change={Math.round(data.ordersChange * 10) / 10}
          />
          <KpiCard
            label="Avg Order Value" value={`$${data.aov.toFixed(2)}`}
            change={Math.round(data.aovChange * 10) / 10}
          />
          <KpiCard
            label="Refund Rate" value={`${data.refundRate.toFixed(1)}%`}
          />
        </div>

        {/* Chart */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Revenue Over Time</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>Daily revenue + order volume</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ color: '#00ff97', label: 'Revenue' }, { color: '#e0e0e0', label: 'Orders' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--muted)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
          <RevenueChart data={data.chartData} />
        </div>

        {/* Orders table */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Recent Orders</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>Last 20 transactions</div>
            </div>
          </div>
          <OrdersTable orders={data.recentOrders as Order[]} />
        </div>
      </div>
    </div>
  )
}
