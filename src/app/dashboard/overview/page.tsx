'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronRight, Building2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import DateRangePicker, { DateRange, getComparisonPeriod } from '@/components/DateRangePicker'

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
function dateInTz(tz: string, offsetDays = 0): string {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const d = new Date(todayStr + 'T12:00:00')
  if (offsetDays) d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA')
}
const defaultRange: DateRange = {
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA'),
  end: new Date().toLocaleDateString('en-CA'),
  label: 'Month to date',
  compareMode: 'previous_month',
}

interface OrgKpi {
  id: string
  name: string
  slug: string
  timezone?: string
  channels?: Record<string, boolean>
  ga_property_id?: string
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
  shopifyRev: number
  amazonRev: number
  shopifyOrders: number
  prevShopifyOrders: number
  convRate: number
  prevConvRate: number
  loading: boolean
}

function DeltaBadge({ value, invert = false }: { value: number; invert?: boolean }) {
  const up = value >= 0
  const good = invert ? !up : up
  if (Math.abs(value) < 0.05) return <span style={{ fontSize: '0.72rem', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>—</span>
  return (
    <span className={`badge ${good ? 'pill-up' : 'pill-down'}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontFamily: 'Barlow, sans-serif',
    }}>
      {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}


export default function OverviewPage() {
  const [orgs, setOrgs] = useState<OrgKpi[]>([])
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'roas' | 'adSpend'>('revenue')
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; text: string } | null>(null)
  const supabase = createClient()
  const router = useRouter()

  // Topbar scroll shadow
  useEffect(() => {
    const handler = () => {
      document.querySelector('.topbar')?.classList.toggle('topbar-scrolled', window.scrollY > 4)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Single effect — re-runs when range changes, loads orgs fresh each time
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoadingOrgs(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: prof } = await supabase.from('profiles').select('is_superadmin').eq('id', user.id).single()
      if (!cancelled) setIsSuperadmin(prof?.is_superadmin ?? false)

      const viewAsUserId = localStorage.getItem('viewAsUserId')
      const orgRes = await fetch(`/api/overview${viewAsUserId ? `?viewAs=${viewAsUserId}` : ''}`)
      const orgData = await orgRes.json()
      if (!orgRes.ok) { setLoadingOrgs(false); return }
      const orgList: any[] = orgData.orgs ?? []

      if (cancelled) return

      const initial: OrgKpi[] = orgList.map(o => ({
        ...o, revenue: 0, prevRevenue: 0, orders: 0, prevOrders: 0,
        aov: 0, prevAov: 0, adSpend: 0, prevAdSpend: 0, roas: 0, prevRoas: 0,
        shopifyRev: 0, amazonRev: 0, shopifyOrders: 0, prevShopifyOrders: 0,
        convRate: 0, prevConvRate: 0, loading: true,
      }))
      setOrgs(initial)
      setLoadingOrgs(false)

      if (!cancelled) fetchAllKpis(initial, range, cancelled)
    }

    run()
    return () => { cancelled = true }
  }, [range])

  const fetchAllKpis = async (orgList: OrgKpi[], currentRange: DateRange, cancelled: boolean) => {
    if (cancelled) return

    const resolveOrgRange = (tz: string) => {
      const today = dateInTz(tz)
      const monthStart = (() => {
        const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
        const m = Object.fromEntries(p.filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
        return `${m.year}-${m.month}-01`
      })()
      switch (currentRange.label) {
        case 'Today':          return { start: today, end: today }
        case 'Yesterday':      return { start: dateInTz(tz,-1), end: dateInTz(tz,-1) }
        case 'Last 7 days':    return { start: dateInTz(tz,-7), end: today }
        case 'Last 30 days':   return { start: dateInTz(tz,-30), end: today }
        case 'Month to date':  return { start: monthStart, end: today }
        case 'Last 90 days':   return { start: dateInTz(tz,-90), end: today }
        case 'Last 12 months': return { start: dateInTz(tz,-365), end: today }
        case 'This year':      return { start: today.slice(0,4)+'-01-01', end: today }
        default:               return { start: currentRange.start, end: currentRange.end }
      }
    }
    await Promise.all(orgList.map(async (org) => {
      try {
        const tz = (org as any).timezone ?? 'America/New_York'
        const { start: orgCurStart, end: orgCurEnd } = resolveOrgRange(tz)
        const { prevStart, prevEnd } = getComparisonPeriod(orgCurStart, orgCurEnd, currentRange.compareMode, currentRange.customCompareStart, currentRange.customCompareEnd)
        const toUTC = (dateStr: string, endOfDay = false) => {
          const time = endOfDay ? '23:59:59' : '00:00:00'
          const utcMidnight = new Date(`${dateStr}T${time}Z`)
          const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
          })
          const parts = fmt.formatToParts(utcMidnight)
          const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
          const localAtUTCMidnight = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`)
          const targetLocal = new Date(`${dateStr}T${time}`)
          const diffMs = targetLocal.getTime() - localAtUTCMidnight.getTime()
          return new Date(utcMidnight.getTime() + diffMs).toISOString()
        }
        const res = await fetch('/api/overview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: org.id,
            start: toUTC(orgCurStart, false),
            end: toUTC(orgCurEnd, true),
            prevStart: toUTC(prevStart, false),
            prevEnd: toUTC(prevEnd, true),
            // Plain dates for ad_spend table (stores date, not timestamp)
            adSpendStart: orgCurStart,
            adSpendEnd: orgCurEnd,
            adSpendPrevStart: prevStart,
            adSpendPrevEnd: prevEnd,
          }),
        })
        const fetched = await res.json()
        if (!res.ok) throw new Error(fetched.error)

        const ch = (org as any).channels ?? {}
        const isConfigured = Object.keys(ch).length > 0
        const showShopify = !isConfigured || ch.shopify !== false
        const showAmazon  = !isConfigured || ch.amazon  !== false

        const filterEnabled = (orders: any[]) => orders.filter(o =>
          o.status !== 'refunded' && (
            (showShopify && o.source === 'shopify') ||
            (showAmazon  && o.source === 'amazon')  ||
            (showShopify && !['shopify','amazon'].includes(o.source))
          )
        )

        const cur  = filterEnabled(fetched.curOrders ?? [])
        const prev = filterEnabled(fetched.prevOrders ?? [])

        const revenue     = cur.reduce((s, o)  => s + Number(o.total_price || 0), 0)
        const prevRevenue = prev.reduce((s, o) => s + Number(o.total_price || 0), 0)
        const countOrd = (ords: any[]) => ords.reduce((s: number, o: any) => s + (o.source === 'amazon' ? (Number(o.units) || 1) : 1), 0)
        const orders      = countOrd(cur)
        const prevOrdCnt  = countOrd(prev)
        // AOV uses subtotal (net after discounts) to match analytics exactly
        const netRev      = cur.reduce((s, o)  => s + Number(o.subtotal || o.total_price || 0), 0)
        const prevNetRev  = prev.reduce((s, o) => s + Number(o.subtotal || o.total_price || 0), 0)
        const aov         = orders > 0 ? netRev / orders : 0
        const prevAov     = prevOrdCnt > 0 ? prevNetRev / prevOrdCnt : 0
        const adSpend     = (fetched.curSpend ?? []).reduce((s: number, r: any) => s + Number(r.spend), 0)
        const prevAdSpend = (fetched.prevSpend ?? []).reduce((s: number, r: any) => s + Number(r.spend), 0)
        const roas        = adSpend > 0 ? revenue / adSpend : 0
        const prevRoas    = prevAdSpend > 0 ? prevRevenue / prevAdSpend : 0
        const shopifyRev  = cur.filter(o => o.source === 'shopify').reduce((s, o) => s + Number(o.total_price || 0), 0)
        const amazonRev   = cur.filter(o => o.source === 'amazon').reduce((s, o) => s + Number(o.total_price || 0), 0)
        const shopifyOrders = cur.filter(o => o.source === 'shopify' && o.status !== 'refunded').length
        const prevShopifyOrders = prev.filter(o => o.source === 'shopify' && o.status !== 'refunded').length

        // Fetch GA4 traffic for conv rate if org has GA configured
        let convRate = 0
        let prevConvRate = 0
        const gaId = (org as any).ga_property_id
        if (gaId && shopifyOrders > 0) {
          try {
            const [curTraffic, prevTraffic] = await Promise.all([
              fetch('/api/analytics/traffic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_id: org.id, startDate: orgCurStart, endDate: orgCurEnd }),
              }).then(r => r.ok ? r.json() : null),
              fetch('/api/analytics/traffic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_id: org.id, startDate: prevStart, endDate: prevEnd }),
              }).then(r => r.ok ? r.json() : null),
            ])
            if (curTraffic?.users > 0) convRate = (shopifyOrders / curTraffic.users) * 100
            if (prevTraffic?.users > 0 && prevShopifyOrders > 0) prevConvRate = (prevShopifyOrders / prevTraffic.users) * 100
          } catch {}
        }

        if (!cancelled) setOrgs(prev => prev.map(o => o.id === org.id
          ? { ...o, revenue, prevRevenue, orders, prevOrders: prevOrdCnt, aov, prevAov, adSpend, prevAdSpend, roas, prevRoas, shopifyRev, amazonRev, shopifyOrders, prevShopifyOrders, convRate, prevConvRate, loading: false }
          : o
        ))
      } catch {
        if (!cancelled) setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, loading: false } : o))
      }
    }))
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/cron/sync-shopify')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setSyncResult({ ok: true, text: data.message })
      // Update synced_at timestamps locally
      const now = new Date().toISOString()
      setOrgs(prev => prev.map(o => ({ ...o, shopify_synced_at: now })))
    } catch (err: any) {
      setSyncResult({ ok: false, text: err.message })
    }
    setSyncingAll(false)
  }

  // Most recent Shopify sync across all orgs
  const lastSyncedAt = orgs.reduce((latest, o) => {
    const ts = (o as any).shopify_synced_at
    if (!ts) return latest
    return !latest || ts > latest ? ts : latest
  }, null as string | null)

  const openOrg = (org: OrgKpi) => {
    localStorage.setItem('activeOrgId', org.id)
    window.location.href = '/dashboard/analytics'
  }

  const sorted = [...orgs].sort((a, b) => b[sortBy] - a[sortBy])
  const loaded = orgs.filter(o => !o.loading)
  const totalRevenue  = loaded.reduce((s, o) => s + o.revenue, 0)
  const totalPrevRev  = loaded.reduce((s, o) => s + o.prevRevenue, 0)
  const totalOrders   = loaded.reduce((s, o) => s + o.orders, 0)
  const totalPrevOrd  = loaded.reduce((s, o) => s + o.prevOrders, 0)
  const totalSpend    = loaded.reduce((s, o) => s + o.adSpend, 0)
  const totalPrevSp   = loaded.reduce((s, o) => s + o.prevAdSpend, 0)
  const blendedRoas   = totalSpend > 0 ? totalRevenue / totalSpend : 0
  const prevRoas      = totalPrevSp > 0 ? totalPrevRev / totalPrevSp : 0

  const { prevStart: prevStartLabel, prevEnd: prevEndLabel } = getComparisonPeriod(range.start, range.end, range.compareMode, range.customCompareStart, range.customCompareEnd)
  const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const SortBtn = ({ field, label }: { field: typeof sortBy; label: string }) => (
    <button
      onClick={() => setSortBy(field)}
      className={`toggle-btn${sortBy === field ? ' active' : ''}`}
      style={{ cursor: 'pointer' }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>

      {/* Topbar */}
      <div className="overview-topbar topbar">
        <div className="topbar-title" style={{ minWidth: 0, flex: 1 }}>
          <h1>Overview</h1>
          <div className="overview-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
            <p className="caption" style={{ whiteSpace: 'nowrap', margin: 0 }}>
              {loadingOrgs ? '…' : `${orgs.length} project${orgs.length !== 1 ? 's' : ''}`} · vs {fmtDate(prevStartLabel)} – {fmtDate(prevEndLabel)}
            </p>
            {isSuperadmin && (
              <span className="overview-sync" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: C.border }}>·</span>
                <button
                  onClick={handleSyncAll}
                  disabled={syncingAll}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: 0, background: 'none', border: 'none',
                    fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.75rem',
                    color: syncingAll ? C.muted : '#007a48',
                    cursor: syncingAll ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <RefreshCw size={11} style={{ animation: syncingAll ? 'spin 1s linear infinite' : 'none' }} />
                  {syncingAll ? 'Syncing…' : 'Sync Shopify'}
                </button>
                {syncResult && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, fontFamily: 'Barlow, sans-serif', color: syncResult.ok ? '#007a48' : '#b91c1c', whiteSpace: 'nowrap' }}>
                    — {syncResult.text}
                  </span>
                )}
                {!syncResult && lastSyncedAt && !syncingAll && (
                  <span style={{ fontSize: '0.7rem', color: '#aaa', fontFamily: 'Barlow, sans-serif', whiteSpace: 'nowrap' }}>
                    last {new Date(lastSyncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="topbar-actions" style={{ flexShrink: 0 }}>
          <DateRangePicker value={range} onChange={r => setRange(r)} />
        </div>
      </div>

      <div className="overview-content page-content" style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 80px' }}>

        {/* Summary strip — only meaningful with 2+ orgs */}
        {!loadingOrgs && orgs.length > 1 && (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: 28, paddingBottom: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, minWidth: 480 }}
               className="summary-grid">
            {[
              { label: 'Total Sales',  value: fmt$(totalRevenue), delta: pct(totalRevenue, totalPrevRev) },
              { label: 'Total Orders',   value: fmtN(totalOrders),  delta: pct(totalOrders, totalPrevOrd) },
              { label: 'Total Ad Spend', value: fmt$(totalSpend),   delta: pct(totalSpend, totalPrevSp), invert: true },
              { label: 'Blended ROAS',   value: blendedRoas > 0 ? `${blendedRoas.toFixed(2)}x` : '—', delta: pct(blendedRoas, prevRoas) },
            ].map(k => (
              <div key={k.label} className="kpi-card" style={{ padding: '18px 20px' }}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ marginBottom: 6 }}>{k.value}</div>
                <DeltaBadge value={k.delta} invert={k.invert} />
              </div>
            ))}
          </div>
          </div>
        )}

        {/* Sort controls */}
        {!loadingOrgs && orgs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
            <span className="label">Sort</span>
            <div className="toggle-group">
              <SortBtn field="revenue"  label="Total Sales"  />
              <SortBtn field="orders"   label="Orders"   />
              <SortBtn field="roas"     label="ROAS"     />
              <SortBtn field="adSpend"  label="Ad Spend" />
            </div>
          </div>
        )}

        {loadingOrgs ? (
          <div className="text-muted" style={{ textAlign: 'center', padding: '80px 0', fontFamily: 'Barlow, sans-serif' }}>Loading projects…</div>
        ) : orgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', border: `2px dashed ${C.border}`, borderRadius: 10 }}>
            <Building2 size={32} style={{ color: '#ccc', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontWeight: 700, fontFamily: 'Barlow, sans-serif' }}>No projects found</p>
            <p style={{ fontSize: '0.875rem', color: C.muted, fontFamily: 'Barlow, sans-serif' }}>You haven't been added to any projects yet.</p>
          </div>
        ) : (
          <>
            {/* ── Desktop table ── */}
            <div className="overview-table table-wrapper"><div className="table-scroll">
              <table style={{ minWidth: 880 }}>
                <thead>
                  <tr>
                    {['Project', 'Total Sales', 'Orders', 'AOV', 'Ad Spend', 'ROAS', 'Conv. Rate', ''].map((h, i) => (
                      <th key={i} style={{
                        textAlign: h === '' ? 'right' : 'left',
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
                            <div className="mono" style={{ fontSize: '0.68rem', color: '#aaa' }}>{org.slug}</div>
                          </div>
                        </div>
                      </td>

                      {/* Total Sales */}
                      <td style={{ padding: '16px 20px', minWidth: 130 }}>
                        {org.loading
                          ? <div style={{ height: 14, width: 80, background: '#f0f0f0', borderRadius: 3 }} className="animate-pulse" />
                          : <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <span style={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: 'Barlow, sans-serif' }}>{fmt$(org.revenue)}</span>
                                <DeltaBadge value={pct(org.revenue, org.prevRevenue)} />
                              </div>
                              {org.revenue > 0 && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                  {org.shopifyRev > 0 && (
                                    <span className="badge badge-shopify" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                                      Shopify {fmt$(org.shopifyRev)} · {(org.shopifyRev / org.revenue * 100).toFixed(0)}%
                                    </span>
                                  )}
                                  {org.amazonRev > 0 && (
                                    <span className="badge badge-amazon" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                                      Amazon {fmt$(org.amazonRev)} · {(org.amazonRev / org.revenue * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              )}
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

                      {/* Conv. Rate */}
                      <td style={{ padding: '16px 20px', minWidth: 110 }}>
                        {org.loading
                          ? <div style={{ height: 14, width: 50, background: '#f0f0f0', borderRadius: 3 }} className="animate-pulse" />
                          : org.convRate > 0
                            ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{org.convRate.toFixed(2)}%</span>
                                {org.prevConvRate > 0 && <DeltaBadge value={pct(org.convRate, org.prevConvRate)} />}
                              </div>
                            : <span style={{ fontSize: '0.8rem', color: '#ccc' }}>—</span>
                        }
                      </td>

                      {/* Arrow */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <ChevronRight size={16} color={C.muted} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div>

            {/* ── Mobile cards ── */}
            <div className="overview-cards" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
              {sorted.map(org => (
                <div
                  key={org.id}
                  onClick={() => openOrg(org)}
                  className="card"
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: C.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Building2 size={15} color={C.accent} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'Barlow, sans-serif' }}>{org.name}</div>
                        <div className="mono" style={{ fontSize: '0.68rem', color: '#aaa' }}>{org.slug}</div>
                      </div>
                    </div>
                    <ArrowRight size={16} color={C.muted} />
                  </div>

                  {org.loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[1,2,3,4].map(i => <div key={i} style={{ height: 52, background: '#f0f0f0', borderRadius: 6 }} className="animate-pulse" />)}
                    </div>
                  ) : (
                    <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { label: 'Total Sales', value: fmt$(org.revenue),  delta: pct(org.revenue, org.prevRevenue) },
                        { label: 'Orders',  value: fmtN(org.orders),   delta: pct(org.orders, org.prevOrders) },
                        { label: 'AOV',     value: org.aov > 0 ? fmt$(org.aov) : '—', delta: org.aov > 0 ? pct(org.aov, org.prevAov) : null },
                        { label: 'ROAS',    value: org.roas > 0 ? `${org.roas.toFixed(2)}x` : '—', delta: org.roas > 0 ? pct(org.roas, org.prevRoas) : null },
                        { label: 'Conv. Rate', value: org.convRate > 0 ? `${org.convRate.toFixed(2)}%` : '—', delta: org.convRate > 0 && org.prevConvRate > 0 ? pct(org.convRate, org.prevConvRate) : null },
                      ].map(k => (
                        <div key={k.label} style={{ background: C.cream, borderRadius: 8, padding: '10px 12px' }}>
                          <div className="kpi-label" style={{ marginBottom: 4 }}>{k.label}</div>
                          <div className="kpi-value" style={{ fontSize: '1rem', marginBottom: 4 }}>{k.value}</div>
                          {k.delta !== null && <DeltaBadge value={k.delta} />}
                        </div>
                      ))}
                    </div>
                    {org.revenue > 0 && (org.shopifyRev > 0 || org.amazonRev > 0) && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {org.shopifyRev > 0 && (
                          <span className="badge badge-shopify" style={{ fontSize: '0.68rem' }}>
                            Shopify {fmt$(org.shopifyRev)} · {(org.shopifyRev / org.revenue * 100).toFixed(0)}%
                          </span>
                        )}
                        {org.amazonRev > 0 && (
                          <span className="badge badge-amazon" style={{ fontSize: '0.68rem' }}>
                            Amazon {fmt$(org.amazonRev)} · {(org.amazonRev / org.revenue * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 680px) {
          .summary-grid     { min-width: 0 !important; }
          .overview-topbar  { flex-wrap: wrap !important; padding: 14px 16px 14px 60px !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 100 !important; }
          .overview-content { padding-top: 100px !important; }
          .overview-subtitle { flex-direction: column !important; align-items: flex-start !important; gap: 4px !important; }
          .overview-sync    { margin-left: 0 !important; }
          .overview-table { display: none !important; }
          .overview-cards { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
