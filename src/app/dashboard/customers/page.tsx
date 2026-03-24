import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'
import KpiCard from '@/components/KpiCard'

async function getCustomerData(orgId: string) {
  const supabase = createClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: orders } = await supabase
    .from('orders').select('customer_email, customer_name, total_price, created_at, source, units')
    .eq('org_id', orgId)

  const all = orders ?? []

  // Build customer map
  const customerMap: Record<string, { name: string; orders: number; ltv: number; lastOrder: string }> = {}
  all.forEach(o => {
    const key = o.customer_email || o.customer_name || 'unknown'
    if (!customerMap[key]) customerMap[key] = { name: o.customer_name || o.customer_email || 'Unknown', orders: 0, ltv: 0, lastOrder: o.created_at }
    customerMap[key].orders += o.source === 'amazon' ? (Number(o.units) || 1) : 1
    customerMap[key].ltv += Number(o.total_price)
    if (o.created_at > customerMap[key].lastOrder) customerMap[key].lastOrder = o.created_at
  })

  const customers = Object.values(customerMap)
  const total = customers.length
  const newCustomers = all.filter(o => o.created_at >= thirtyDaysAgo)
    .reduce((acc, o) => { acc.add(o.customer_email || o.customer_name || ''); return acc }, new Set()).size
  const returning = customers.filter(c => c.orders > 1).length
  const repeatRate = total > 0 ? (returning / total) * 100 : 0
  const avgLtv = total > 0 ? customers.reduce((s, c) => s + c.ltv, 0) / total : 0

  const topCustomers = customers
    .sort((a, b) => b.ltv - a.ltv)
    .slice(0, 10)

  return { total, newCustomers, repeatRate, avgLtv, topCustomers }
}

export default async function CustomersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles').select('org_id').eq('id', user.id).single()

  if (!profile?.org_id) {
    return (
      <div>
        <Topbar title="Customers & Retention" />
        <div style={{ padding: '80px 40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No organization linked yet.</p>
        </div>
      </div>
    )
  }

  const data = await getCustomerData(profile.org_id)

  return (
    <div>
      <Topbar title="Customers & Retention" subtitle="Last 30 days" action={{ label: '↑ Import CSV', href: '/dashboard/import' }} />

      <div style={{ padding: '32px 40px 48px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <KpiCard label="Total Customers" value={data.total.toLocaleString()} accent />
          <KpiCard label="New (30d)" value={data.newCustomers.toLocaleString()} />
          <KpiCard label="Repeat Rate" value={`${data.repeatRate.toFixed(1)}%`} />
          <KpiCard label="Avg LTV" value={`$${data.avgLtv.toFixed(0)}`} />
        </div>

        {/* Top customers table */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Top Customers</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>By lifetime value</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Customer', 'Orders', 'LTV', 'Last Order', 'Segment'].map(h => (
                    <th key={h} style={{ padding: '10px 24px', background: 'var(--cream)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>No customers yet. Upload a CSV to get started.</td></tr>
                ) : data.topCustomers.map((c, i) => {
                  const seg = c.orders >= 5 ? 'vip' : c.orders > 1 ? 'returning' : 'new'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: '0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '13px 24px', fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: '13px 24px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{c.orders}</td>
                      <td style={{ padding: '13px 24px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>${c.ltv.toFixed(2)}</td>
                      <td style={{ padding: '13px 24px', color: 'var(--muted)', fontSize: '0.875rem' }}>
                        {new Date(c.lastOrder).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '13px 24px' }}>
                        <span className={`badge badge-${seg}`}>{seg}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
