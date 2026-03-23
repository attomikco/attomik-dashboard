'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, TrendingUp, TrendingDown } from 'lucide-react'
import DateRangePicker, { DateRange } from '@/components/DateRangePicker'

// ── helpers ──────────────────────────────────────────────────────────
const C = {
  ink: '#000', paper: '#fff', cream: '#f2f2f2', accent: '#00ff97',
  muted: '#666', border: '#e0e0e0',
}
function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}
function fmtN(n: number) { return n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n) }
function pct(a: number, b: number) { return b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100 }
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().split('T')[0]

const defaultRange: DateRange = {
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  end: new Date().toISOString().split('T')[0],
  label: 'Month to date',
}

interface OrgKpi {
  id: string
  name: string
  slug: string
  revenue: number
  prevRevenue: number
  orders: number
  prevOrders: number
  aov: number
  prevAov: number
  adSpend: number
  prevAdSpend: number
  roas: number
  prevRoas: number
  loading: boolean
}

function DeltaBadge({ value, invert = false }: { value: number; invert?: boolean }) {
  const up = value >= 0
  const good = invert ? !up : up
  if (Math.abs(value) < 0.05) return <span style={{ fontSize: '0.72rem', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>—</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: '0.72rem', fontWeight: 700, fontFamily: 'Barlow, sans-serif',
      padding: '2px 6px', borderRadius: 5,
      background: good ? '#e6fff5' : '#fee2e2',
      color: good ? '#007a48' : '#b91c1c',
    }}>
      {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ width: '100%', height: 3, background: '#f0f0f0', borderRadius: 2, marginTop: 5 }}>
      <div style={{ width: `${w}%`, height: '100%', background: C.accent, borderRadius: 2, transition: 'width 0.6s ease' }} />
    </div>
  )
}

export default function OverviewPage() {
  const [orgs, setOrgs] = useState<OrgKpi[]>([])
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'roas' | 'adSpend'>('revenue')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { bootstrap() }, [])
  useEffect(() => { if (orgs.length > 0) fetchAllKpis(orgs) }, [range])

  const bootstrap = async () => {
    setLoadingOrgs(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles').select('is_superadmin').eq('id', user.id).single()

    let orgList: { id: string; name: string; slug: string }[] = []

    if (prof?.is_superadmin) {
      const { data } = await supabase.from('organizations').select('id, name, slug').order('name')
      orgList = data ?? []
    } else {
      const { data: memberships } = await supabase
        .from('org_memberships')
        .select('org_id, organizations(id, name, slug)')
        .eq('user_id', user.id)
      orgList = (memberships ?? []).map((m: any) => m.organizations).filter(Boolean)
    }

    const initial: OrgKpi[] = orgList.map(o => ({
      ...o, revenue: 0, prevRevenue: 0, orders: 0, prevOrders: 0,
      aov: 0, prevAov: 0, adSpend: 0, prevAdSpend: 0, roas: 0, prevRoas: 0, loading: true,
    }))
    setOrgs(initial)
    setLoadingOrgs(false)
    fetchAllKpis(initial)
  }

  const fetchAllKpis = async (orgList: OrgKpi[]) => {
    setOrgs(prev => prev.map(o => ({ ...o, loading: true })))

    const curStart = range.start
    const curEnd   = range.end
    const diffDays = Math.round((new Date(curEnd).getTime() - new Date(curStart).getTime()) / 864e5) + 1
    const prevEnd   = daysAgo(diffDays)
    const prevStart = daysAgo(diffDays * 2)

    await Promise.all(orgList.map(async (org) => {
      try {
        const [curOrders, prevOrders, curSpend, prevSpend] = await Promise.all([
          supabase.from('orders').select('total_price, status, subtotal')
            .eq('org_id', org.id)
            .gte('created_at', `${curStart}T00:00:00Z`)
            .lte('created_at', `${curEnd}T23:59:59Z`)
            .limit(5000),
          supabase.from('orders').select('total_price, status, subtotal')
            .eq('org_id', org.id)
            .gte('created_at', `${prevStart}T00:00:00Z`)
            .lte('created_at', `${prevEnd}T23:59:59Z`)
            .limit(5000),
          supabase.from('ad_spend').select('spend')
            .eq('org_id', org.id).gte('date', curStart).lte('date', curEnd),
          supabase.from('ad_spend').select('spend')
            .eq('org_id', org.id).gte('date', prevStart).lte('date', prevEnd),
        ])

        const cur  = (curOrders.data  ?? []).filter(o => o.status !== 'refunded')
        const prev = (prevOrders.data ?? []).filter(o => o.status !== 'refunded')

        const revenue     = cur.reduce((s, o)  => s + Number(o.subtotal || o.total_price || 0), 0)
        const prevRevenue = prev.reduce((s, o) => s + Number(o.subtotal || o.total_price || 0), 0)
        const orders      = cur.length
        const prevOrdCnt  = prev.length
        const aov         = orders > 0 ? revenue / orders : 0
        const prevAov     = prevOrdCnt > 0 ? prevRevenue / prevOrdCnt : 0
        const adSpend     = (curSpend.data  ?? []).reduce((s, r) => s + Number(r.spend), 0)
        const prevAdSpend = (prevSpend.data ?? []).reduce((s, r) => s + Number(r.spend), 0)
        const roas        = adSpend > 0 ? revenue / adSpend : 0
        const prevRoas    = prevAdSpend > 0 ? prevRevenue / prevAdSpend : 0

        setOrgs(prev => prev.map(o => o.id === org.id
          ? { ...o, revenue, prevRevenue, orders, prevOrders: prevOrdCnt, aov, prevAov, adSpend, prevAdSpend, roas, prevRoas, loading: false }
          : o
        ))
      } catch {
        setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, loading: false } : o))
      }
    }))
  }

  const openOrg = (org: OrgKpi) => {
    localStorage.setItem('activeOrgId', org.id)
    router.push('/dashboard/analytics')
  }

  const sorted = [...orgs].sort((a, b) => b[sortBy] - a[sortBy])
  const maxRevenue = Math.max(...orgs.map(o => o.revenue), 1)
  const maxOrders  = Math.max(...orgs.map(o => o.orders), 1)
  const maxSpend   = Math.max(...orgs.map(o => o.adSpend), 1)

  const loaded = orgs.filter(o => !o.loading)
  const totalRevenue  = loaded.reduce((s, o) => s + o.revenue, 0)
  const totalPrevRev  = loaded.reduce((s, o) => s + o.prevRevenue, 0)
  const totalOrders   = loaded.reduce((s, o) => s + o.orders, 0)
  const totalPrevOrd  = loaded.reduce((s, o) => s + o.prevOrders, 0)
  const totalSpend    = loaded.reduce((s, o) => s + o.adSpend, 0)
  const totalPrevSp   = loaded.reduce((s, o) => s + o.prevAdSpend, 0)
  const blendedRoas   = totalSpend > 0 ? totalRevenue / totalSpend : 0
  const prevRoas      = totalPrevSp > 0 ? totalPrevRev / totalPrevSp : 0

  const dayCount = Math.round((new Date(range.end).getTime() - new Date(range.start).getTime()) / 864e5) + 1

  const SortBtn = ({ field, label }: { field: typeof sortBy; label: string }) => (
    <button
      onClick={() => setSortBy(field)}
      style={{
        padding: '4px 10px', border: 'none', borderRadius: 5, cursor: 'pointer',
        fontFamily: 'Barlow, sans-serif', fontSize: '0.75rem', fontWeight: 700,
        background: sortBy === field ? C.ink : C.cream,
        color: sortBy === field ? C.accent : C.muted,
        transition: '0.15s',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>

      {/* Topbar */}
      <div style={{
        padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        position: 'sticky', top: 0, background: C.paper, zIndex: 50,
      }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.6rem)', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Barlow, sans-serif', color: C.ink }}>
            Overview
          </h1>
          <p style={{ fontSize: '0.8rem', color: C.muted, marginTop: 2, fontFamily: 'Barlow, sans-serif' }}>
            {loadingOrgs ? '…' : `${orgs.length} project${orgs.length !== 1 ? 's' : ''}`} · vs previous {dayCount} days
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <DateRangePicker value={range} onChange={r => setRange(r)} />
        </div>
      </div>

      <div style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 80px' }}>

        {/* Summary strip — only meaningful with 2+ orgs */}
        {!loadingOrgs && orgs.length > 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}
               className="summary-grid">
            {[
              { label: 'Total Revenue',  value: fmt$(totalRevenue), delta: pct(totalRevenue, totalPrevRev) },
              { label: 'Total Orders',   value: fmtN(totalOrders),  delta: pct(totalOrders, totalPrevOrd) },
              { label: 'Total Ad Spend', value: fmt$(totalSpend),   delta: pct(totalSpend, totalPrevSp), invert: true },
              { label: 'Blended ROAS',   value: blendedRoas > 0 ? `${blendedRoas.toFixed(2)}x` : '—', delta: pct(blendedRoas, prevRoas) },
            ].map(k => (
              <div key={k.label} style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Barlow, sans-serif', marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Barlow, sans-serif', marginBottom: 6 }}>{k.value}</div>
                <DeltaBadge value={k.delta} invert={k.invert} />
              </div>
            ))}
          </div>
        )}

        {/* Sort controls */}
        {!loadingOrgs && orgs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Barlow, sans-serif' }}>Sort</span>
            <SortBtn field="revenue"  label="Revenue"  />
            <SortBtn field="orders"   label="Orders"   />
            <SortBtn field="roas"     label="ROAS"     />
            <SortBtn field="adSpend"  label="Ad Spend" />
          </div>
        )}

        {loadingOrgs ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted, fontFamily: 'Barlow, sans-serif' }}>Loading projects…</div>
        ) : orgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', border: `2px dashed ${C.border}`, borderRadius: 10 }}>
            <Building2 size={32} style={{ color: '#ccc', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontWeight: 700, fontFamily: 'Barlow, sans-serif' }}>No projects found</p>
            <p style={{ fontSize: '0.875rem', color: C.muted, fontFamily: 'Barlow, sans-serif' }}>You haven't been added to any projects yet.</p>
          </div>
        ) : (
          <>
            {/* ── Desktop table ── */}
            <div className="overview-table" style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.cream }}>
                    {['Project', 'Revenue', 'Orders', 'AOV', 'Ad Spend', 'ROAS', ''].map((h, i) => (
                      <th key={i} style={{
                        padding: '11px 20px', textAlign: h === '' ? 'right' : 'left',
                        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: C.muted, fontFamily: 'Barlow, sans-serif',
                        borderBottom: `1px solid ${C.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((org, i) => (
                    <tr
                      key={org.id}
                      style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                      onClick={() => openOrg(org)}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Project */}
                      <td style={{ padding: '16px 20px', minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: C.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <Building2 size={15} color={C.accent} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Barlow, sans-serif' }}>{org.name}</div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: '#aaa' }}>{org.slug}</div>
                          </div>
                        </div>
                      </td>

                      {/* Revenue */}
                      <td style={{ padding: '16px 20px', minWidth: 130 }}>
                        {org.loading
                          ? <div style={{ height: 14, width: 80, background: '#f0f0f0', borderRadius: 3 }} className="animate-pulse" />
                          : <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <span style={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: 'Barlow, sans-serif' }}>{fmt$(org.revenue)}</span>
                                <DeltaBadge value={pct(org.revenue, org.prevRevenue)} />
                              </div>
                              <MiniBar value={org.revenue} max={maxRevenue} />
                            </>
                        }
                      </td>

                      {/* Orders */}
                      <td style={{ padding: '16px 20px', minWidth: 110 }}>
                        {org.loading
                          ? <div style={{ height: 14, width: 60, background: '#f0f0f0', borderRadius: 3 }} className="animate-pulse" />
                          : <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Barlow, sans-serif' }}>{fmtN(org.orders)}</span>
                                <DeltaBadge value={pct(org.orders, org.prevOrders)} />
                              </div>
                              <MiniBar value={org.orders} max={maxOrders} />
                            </>
                        }
                      </td>

                      {/* AOV */}
                      <td style={{ padding: '16px 20px', minWidth: 100 }}>
                        {org.loading
                          ? <div style={{ height: 14, width: 60, background: '#f0f0f0', borderRadius: 3 }} className="animate-pulse" />
                          : <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Barlow, sans-serif' }}>{org.aov > 0 ? fmt$(org.aov) : '—'}</span>
                              {org.aov > 0 && <DeltaBadge value={pct(org.aov, org.prevAov)} />}
                            </div>
                        }
                      </td>

                      {/* Ad Spend */}
                      <td style={{ padding: '16px 20px', minWidth: 110 }}>
                        {org.loading
                          ? <div style={{ height: 14, width: 60, background: '#f0f0f0', borderRadius: 3 }} className="animate-pulse" />
                          : org.adSpend > 0
                            ? <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Barlow, sans-serif' }}>{fmt$(org.adSpend)}</span>
                                  <DeltaBadge value={pct(org.adSpend, org.prevAdSpend)} invert />
                                </div>
                                <MiniBar value={org.adSpend} max={maxSpend} />
                              </>
                            : <span style={{ fontSize: '0.8rem', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>—</span>
                        }
                      </td>

                      {/* ROAS */}
                      <td style={{ padding: '16px 20px', minWidth: 90 }}>
                        {org.loading
                          ? <div style={{ height: 14, width: 50, background: '#f0f0f0', borderRadius: 3 }} className="animate-pulse" />
                          : org.roas > 0
                            ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Barlow, sans-serif' }}>{org.roas.toFixed(2)}x</span>
                                <DeltaBadge value={pct(org.roas, org.prevRoas)} />
                              </div>
                            : <span style={{ fontSize: '0.8rem', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>—</span>
                        }
                      </td>

                      {/* Arrow */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 700, color: C.muted, fontFamily: 'Barlow, sans-serif' }}>
                          Open <ArrowRight size={13} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="overview-cards" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
              {sorted.map(org => (
                <div
                  key={org.id}
                  onClick={() => openOrg(org)}
                  style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: C.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Building2 size={15} color={C.accent} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'Barlow, sans-serif' }}>{org.name}</div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: '#aaa' }}>{org.slug}</div>
                      </div>
                    </div>
                    <ArrowRight size={16} color={C.muted} />
                  </div>

                  {org.loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[1,2,3,4].map(i => <div key={i} style={{ height: 52, background: '#f0f0f0', borderRadius: 6 }} className="animate-pulse" />)}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { label: 'Revenue', value: fmt$(org.revenue),  delta: pct(org.revenue, org.prevRevenue) },
                        { label: 'Orders',  value: fmtN(org.orders),   delta: pct(org.orders, org.prevOrders) },
                        { label: 'AOV',     value: org.aov > 0 ? fmt$(org.aov) : '—', delta: org.aov > 0 ? pct(org.aov, org.prevAov) : null },
                        { label: 'ROAS',    value: org.roas > 0 ? `${org.roas.toFixed(2)}x` : '—', delta: org.roas > 0 ? pct(org.roas, org.prevRoas) : null },
                      ].map(k => (
                        <div key={k.label} style={{ background: C.cream, borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Barlow, sans-serif', marginBottom: 4 }}>{k.label}</div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'Barlow, sans-serif', marginBottom: 4 }}>{k.value}</div>
                          {k.delta !== null && <DeltaBadge value={k.delta} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 680px) {
          .overview-table   { display: none !important; }
          .overview-cards   { display: flex !important; }
          .summary-grid     { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}
