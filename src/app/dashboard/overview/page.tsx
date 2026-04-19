'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronRight, Building2, TrendingUp, TrendingDown, RefreshCw, Sparkles } from 'lucide-react'
import DateRangePicker, { DateRange, getComparisonPeriod } from '@/components/DateRangePicker'
import { Skeleton, SkeletonKpiCard } from '@/components/Skeleton'

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
function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
function fmtTs(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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
  cac: number
  prevCac: number
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
  const [isRefetching, setIsRefetching] = useState(false)
  const hasLoadedOnce = useRef(false)
  const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'roas' | 'adSpend'>('revenue')
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [syncingShopify, setSyncingShopify] = useState(false)
  const [shopifySyncResult, setShopifySyncResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [syncingMeta, setSyncingMeta] = useState(false)
  const [metaSyncResult, setMetaSyncResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [syncTimestamps, setSyncTimestamps] = useState<Record<string, string | null>>({ shopify: null, meta: null })
  const [yesterdayTable, setYesterdayTable] = useState<{
    data: { org_id: string; org_name: string; revenue: number; orders: number; ad_spend: number; roas: number; revenue_dod: number | null; orders_dod: number | null }[]
    date: string | null
  } | null>(null)
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
      const isFirstLoad = !hasLoadedOnce.current
      if (isFirstLoad) setLoadingOrgs(true)
      else setIsRefetching(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: prof } = await supabase.from('profiles').select('is_superadmin').eq('id', user.id).single()
      if (!cancelled) setIsSuperadmin(prof?.is_superadmin ?? false)

      let orgList: any[]
      if (isFirstLoad) {
        const viewAsUserId = localStorage.getItem('viewAsUserId')
        const orgRes = await fetch(`/api/overview${viewAsUserId ? `?viewAs=${viewAsUserId}` : ''}`)
        const orgData = await orgRes.json()
        if (!orgRes.ok) { setLoadingOrgs(false); return }
        orgList = orgData.orgs ?? []
      } else {
        orgList = orgs
      }

      if (cancelled) return

      const initial: OrgKpi[] = isFirstLoad
        ? orgList.map(o => ({
            ...o, revenue: 0, prevRevenue: 0, orders: 0, prevOrders: 0,
            aov: 0, prevAov: 0, adSpend: 0, prevAdSpend: 0, roas: 0, prevRoas: 0, cac: 0, prevCac: 0,
            shopifyRev: 0, amazonRev: 0, shopifyOrders: 0, prevShopifyOrders: 0,
            convRate: 0, prevConvRate: 0, loading: true,
          }))
        : orgList  // keep existing data visible during refetch

      if (isFirstLoad) {
        setOrgs(initial)
        setLoadingOrgs(false)
      }

      if (!cancelled) {
        await fetchAllKpis(initial, range, cancelled)
        refreshTimestamps(initial.map(o => o.id))
        hasLoadedOnce.current = true
        if (!cancelled) setIsRefetching(false)
      }
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
        const showWalmart = !isConfigured || ch.walmart !== false

        const filterEnabled = (orders: any[]) => orders.filter(o =>
          o.status !== 'refunded' && (
            (showShopify && o.source === 'shopify') ||
            (showAmazon  && o.source === 'amazon')  ||
            (showWalmart && o.source === 'walmart') ||
            (showShopify && !['shopify','amazon','walmart'].includes(o.source))
          )
        )

        const cur  = filterEnabled(fetched.curOrders ?? [])
        const prev = filterEnabled(fetched.prevOrders ?? [])

        const revenue     = cur.reduce((s, o)  => s + Number(o.total_price || 0), 0)
        const prevRevenue = prev.reduce((s, o) => s + Number(o.total_price || 0), 0)
        const countOrd = (ords: any[]) => ords.reduce((s: number, o: any) => s + ((o.source === 'amazon' || o.source === 'walmart') ? (Number(o.units) || 1) : 1), 0)
        const orders      = countOrd(cur)
        const prevOrdCnt  = countOrd(prev)
        // AOV uses subtotal (net after discounts) to match analytics exactly
        const netRev      = cur.reduce((s, o)  => s + Number(o.subtotal || o.total_price || 0), 0)
        const prevNetRev  = prev.reduce((s, o) => s + Number(o.subtotal || o.total_price || 0), 0)
        const aov         = orders > 0 ? netRev / orders : 0
        const prevAov     = prevOrdCnt > 0 ? prevNetRev / prevOrdCnt : 0
        const adSpend     = (fetched.curSpend ?? []).reduce((s: number, r: any) => s + Number(r.spend), 0)
        const prevAdSpend = (fetched.prevSpend ?? []).reduce((s: number, r: any) => s + Number(r.spend), 0)
        console.log(`[overview] ${org.name}: adSpend=$${adSpend.toFixed(2)}, rows=${(fetched.curSpend ?? []).length}, range=${orgCurStart}→${orgCurEnd}`)
        const roas        = adSpend > 0 ? revenue / adSpend : 0
        const prevRoas    = prevAdSpend > 0 ? prevRevenue / prevAdSpend : 0
        const cac         = adSpend > 0 && orders > 0 ? adSpend / orders : 0
        const prevCac     = prevAdSpend > 0 && prevOrdCnt > 0 ? prevAdSpend / prevOrdCnt : 0
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
          ? { ...o, revenue, prevRevenue, orders, prevOrders: prevOrdCnt, aov, prevAov, adSpend, prevAdSpend, roas, prevRoas, cac, prevCac, shopifyRev, amazonRev, shopifyOrders, prevShopifyOrders, convRate, prevConvRate, loading: false }
          : o
        ))
      } catch {
        if (!cancelled) setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, loading: false } : o))
      }
    }))
  }

  const refreshTimestamps = async (orgIds?: string[]) => {
    const ids = orgIds ?? orgs.map(o => o.id)
    // DB is source of truth — fetch fresh, pick latest across all orgs per source
    const latest: Record<string, string | null> = { shopify: null, meta: null }
    await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetch(`/api/sync/timestamps?org_id=${id}&_t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const rows: { source: string; last_synced_at: string }[] = await res.json()
        for (const row of rows) {
          if (row.source in latest && (!latest[row.source] || row.last_synced_at > latest[row.source]!)) {
            latest[row.source] = row.last_synced_at
          }
        }
      } catch {}
    }))
    setSyncTimestamps(latest)
  }

  const refreshKpis = async () => {
    console.log('[overview] refreshKpis called, orgs:', orgs.length, 'range:', range.label, range.start, range.end)
    const current = orgs.map(o => ({ ...o, loading: true }))
    setOrgs(current)
    await fetchAllKpis(current, range, false)
    console.log('[overview] refreshKpis complete')
  }

  const runShopifySync = async () => {
    setSyncingShopify(true)
    setShopifySyncResult(null)
    try {
      const res = await fetch('/api/cron/sync-shopify')
      const data = await res.json()
      console.log('[shopify-sync] response:', data)
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setShopifySyncResult({ ok: true, text: data.message })
    } catch (err: any) {
      setShopifySyncResult({ ok: false, text: err.message })
    }
    setSyncTimestamps(prev => ({ ...prev, shopify: new Date().toISOString() }))
    setSyncingShopify(false)
  }

  const runMetaSync = async () => {
    setSyncingMeta(true)
    setMetaSyncResult(null)
    let synced = 0, skipped = 0, failed = 0, emptyOk = 0
    const failures: string[] = []
    try {
      for (const org of orgs) {
        try {
          const res = await fetch('/api/sync/meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: org.id }),
          })
          const data = await res.json()
          console.log(`[meta-sync] ${org.name}:`, { status: res.status, ...data })
          if (!res.ok || data.error) {
            failed++
            const msg = (data.error ?? `HTTP ${res.status}`).toString()
            // Shorten noisy Meta API errors: keep just the human message
            const short = msg.match(/"message":"([^"]+)"/)?.[1] ?? msg.slice(0, 120)
            failures.push(`${org.name}: ${short}`)
            continue
          }
          if (data.skipped) { skipped++; continue }
          if (data.inserted > 0) { synced++; continue }
          emptyOk++
        } catch (err: any) {
          failed++
          failures.push(`${org.name}: ${err?.message ?? 'network error'}`)
          console.error(`[meta-sync] ${org.name} failed:`, err)
        }
      }
      const parts: string[] = []
      if (synced > 0) parts.push(`${synced} synced`)
      if (emptyOk > 0) parts.push(`${emptyOk} up-to-date`)
      if (skipped > 0) parts.push(`${skipped} not configured`)
      if (failed > 0) parts.push(`${failed} failed`)
      const ok = failed === 0
      const text = parts.length
        ? parts.join(' · ') + (failures.length ? ` — ${failures[0]}${failures.length > 1 ? ` (+${failures.length - 1} more)` : ''}` : '')
        : 'No orgs to sync'
      setMetaSyncResult({ ok, text })
    } catch (err: any) {
      setMetaSyncResult({ ok: false, text: err.message })
    }
    setSyncTimestamps(prev => ({ ...prev, meta: new Date().toISOString() }))
    setSyncingMeta(false)
  }

  const handleSyncShopify = async () => {
    await runShopifySync()
    await refreshKpis()
  }

  const handleSyncMeta = async () => {
    await runMetaSync()
    await refreshKpis()
  }

  const handleSyncAll = async () => {
    await Promise.all([runShopifySync(), runMetaSync()])
    await refreshKpis()
  }

  const openOrg = (org: OrgKpi) => {
    localStorage.setItem('activeOrgId', org.id)
    window.location.href = '/dashboard/analytics'
  }

  // Fetch compact yesterday table for all orgs on mount
  useEffect(() => {
    const viewAsUserId = localStorage.getItem('viewAsUserId')
    const url = `/api/insights/yesterday-all${viewAsUserId ? `?viewAs=${viewAsUserId}` : ''}`
    fetch(url, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(payload => { if (payload) setYesterdayTable(payload) })
      .catch(() => {})
  }, [])

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
  const blendedCac    = totalSpend > 0 && totalOrders > 0 ? totalSpend / totalOrders : 0
  const prevBlendedCac = totalPrevSp > 0 && totalPrevOrd > 0 ? totalPrevSp / totalPrevOrd : 0

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
      {isRefetching && <div className="page-loading-bar" />}

      {/* Topbar */}
      <div className="overview-topbar topbar">
        <div className="topbar-title" style={{ minWidth: 0, flex: 1 }}>
          <h1>Overview</h1>
          <div className="overview-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
            <p className="caption" style={{ whiteSpace: 'nowrap', margin: 0 }}>
              {loadingOrgs ? '…' : `${orgs.length} project${orgs.length !== 1 ? 's' : ''}`} · vs {fmtDate(prevStartLabel)} – {fmtDate(prevEndLabel)}
            </p>
          </div>
        </div>
        <div className="topbar-actions" style={{ flexShrink: 0 }}>
          <DateRangePicker value={range} onChange={r => setRange(r)} />
        </div>
      </div>

      <div className={`overview-content page-content${isRefetching ? ' is-refetching' : ''}`} style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 80px' }}>

        {/* Sync row — at the very top for quick access */}
        {isSuperadmin && !loadingOrgs && (
          <div className="overview-sync-row" style={{
            display: 'flex', alignItems: 'flex-start', gap: 16,
            marginBottom: 20, flexWrap: 'wrap',
          }}>
            <div className="sync-item sync-item-all" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={handleSyncAll}
                disabled={syncingShopify || syncingMeta}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 16px', background: C.ink, border: `1px solid ${C.ink}`, borderRadius: 8,
                  fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.8rem',
                  color: (syncingShopify || syncingMeta) ? '#888' : C.accent,
                  cursor: (syncingShopify || syncingMeta) ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <RefreshCw size={12} style={{ animation: (syncingShopify && syncingMeta) ? 'spin 1s linear infinite' : 'none' }} />
                {(syncingShopify && syncingMeta) ? 'Syncing all…' : 'Sync All'}
              </button>
              <div style={{ fontSize: '0.7rem', color: '#aaa', fontFamily: 'Barlow, sans-serif', lineHeight: 1.3 }}>
                Shopify + Meta
              </div>
            </div>
            <div className="sync-item" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={handleSyncShopify}
                disabled={syncingShopify || syncingMeta}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 14px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8,
                  fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.8rem',
                  color: syncingShopify ? C.muted : '#007a48',
                  cursor: syncingShopify || syncingMeta ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <RefreshCw size={12} style={{ animation: syncingShopify ? 'spin 1s linear infinite' : 'none' }} />
                {syncingShopify ? 'Syncing…' : 'Sync Shopify'}
              </button>
              <div style={{ fontSize: '0.7rem', color: '#aaa', fontFamily: 'Barlow, sans-serif', lineHeight: 1.3 }}>
                {shopifySyncResult && (
                  <span style={{ fontWeight: 600, color: shopifySyncResult.ok ? '#007a48' : '#b91c1c' }}>
                    {shopifySyncResult.text}
                  </span>
                )}
                {!shopifySyncResult && syncTimestamps.shopify && !syncingShopify && (
                  <>{fmtTs(syncTimestamps.shopify)} ({timeAgo(syncTimestamps.shopify)})</>
                )}
              </div>
            </div>

            <div className="sync-item" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={handleSyncMeta}
                disabled={syncingMeta || syncingShopify}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 14px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8,
                  fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.8rem',
                  color: syncingMeta ? C.muted : '#1877f2',
                  cursor: syncingMeta || syncingShopify ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <RefreshCw size={12} style={{ animation: syncingMeta ? 'spin 1s linear infinite' : 'none' }} />
                {syncingMeta ? 'Syncing…' : 'Sync Meta'}
              </button>
              <div style={{ fontSize: '0.7rem', color: '#aaa', fontFamily: 'Barlow, sans-serif', lineHeight: 1.3 }}>
                {metaSyncResult && (
                  <span style={{ fontWeight: 600, color: metaSyncResult.ok ? '#007a48' : '#b91c1c' }}>
                    {metaSyncResult.text}
                  </span>
                )}
                {!metaSyncResult && syncTimestamps.meta && !syncingMeta && (
                  <>{fmtTs(syncTimestamps.meta)} ({timeAgo(syncTimestamps.meta)})</>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Summary strip — only meaningful with 2+ orgs */}
        {!loadingOrgs && orgs.length > 1 && (
          <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}
               className="summary-grid">
            {[
              { label: 'Total Sales',  value: fmt$(totalRevenue), delta: pct(totalRevenue, totalPrevRev) },
              { label: 'Total Orders',   value: fmtN(totalOrders),  delta: pct(totalOrders, totalPrevOrd) },
              { label: 'Total Ad Spend', value: fmt$(totalSpend),   delta: pct(totalSpend, totalPrevSp), invert: true },
              { label: 'Blended ROAS',   value: blendedRoas > 0 ? `${blendedRoas.toFixed(2)}x` : '—', delta: pct(blendedRoas, prevRoas) },
              { label: 'Blended CAC',    value: blendedCac > 0 ? fmt$(blendedCac) : '—', delta: prevBlendedCac > 0 ? pct(blendedCac, prevBlendedCac) : 0, invert: true },
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

        {/* ── Yesterday table — placed below main KPIs ── */}
        {yesterdayTable && yesterdayTable.data.length > 0 && (() => {
          const rows = yesterdayTable.data
          const totalRev = rows.reduce((s, r) => s + r.revenue, 0)
          const totalOrd = rows.reduce((s, r) => s + r.orders, 0)
          const totalSp  = rows.reduce((s, r) => s + r.ad_spend, 0)
          const blendRoas = totalSp > 0 ? totalRev / totalSp : 0
          const headerLabel = yesterdayTable.date
            ? new Date(yesterdayTable.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            : ''

          const dodBadge = (v: number | null, invert = false) => {
            if (v === null || v === undefined) {
              return <span className="badge badge-gray" style={{ fontSize: '0.62rem' }}>—</span>
            }
            const up = v >= 0
            const good = invert ? !up : up
            return (
              <span className={`badge ${good ? 'pill-up' : 'pill-down'}`} style={{ fontSize: '0.62rem', padding: '1px 6px' }}>
                {up ? '↑' : '↓'} {Math.abs(v).toFixed(1)}%
              </span>
            )
          }

          const cellBase: React.CSSProperties = {
            padding: '6px 10px',
            fontFamily: 'var(--font-dm-mono), DM Mono, monospace',
            fontSize: '0.78rem',
            whiteSpace: 'nowrap',
            borderBottom: `1px solid ${C.border}`,
          }
          const numCenter: React.CSSProperties = { ...cellBase, textAlign: 'center' }
          const rowCenter: React.CSSProperties = {
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }

          return (
            <div className="card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.border}` }}>
                <Sparkles size={16} color={C.ink} />
                <span style={{ fontWeight: 800, fontSize: '1.05rem', fontFamily: 'Barlow, sans-serif', letterSpacing: '-0.01em' }}>Yesterday</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: C.muted, fontFamily: 'Barlow, sans-serif' }}>· {headerLabel}</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {[
                        { label: 'Brand',    align: 'left'   as const, hideMobile: false },
                        { label: 'Revenue',  align: 'center' as const, hideMobile: false },
                        { label: 'Orders',   align: 'center' as const, hideMobile: false },
                        { label: 'Ad Spend', align: 'center' as const, hideMobile: false },
                        { label: 'ROAS',     align: 'center' as const, hideMobile: true  },
                      ].map((h, i) => (
                        <th key={i} className={h.hideMobile ? 'yt-col-hide-mobile' : ''} style={{
                          textAlign: h.align,
                          padding: '8px 10px',
                          fontSize: '0.65rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: C.muted,
                          fontWeight: 700,
                          fontFamily: 'Barlow, sans-serif',
                          borderBottom: `1px solid ${C.border}`,
                          position: 'sticky',
                          top: 0,
                          background: C.paper,
                          zIndex: 1,
                        }}>{h.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.org_id}>
                        <td style={{ ...cellBase, textAlign: 'left', fontFamily: 'Barlow, sans-serif', fontWeight: 600 }}>
                          {r.org_name}
                        </td>
                        <td style={numCenter}>
                          <span style={rowCenter}>
                            {fmt$(r.revenue)}
                            {dodBadge(r.revenue_dod)}
                          </span>
                        </td>
                        <td style={numCenter}>
                          <span style={rowCenter}>
                            {fmtN(r.orders)}
                            {dodBadge(r.orders_dod)}
                          </span>
                        </td>
                        <td style={numCenter}>{fmt$(r.ad_spend)}</td>
                        <td className="yt-col-hide-mobile" style={numCenter}>{r.roas > 0 ? `${r.roas.toFixed(2)}x` : '—'}</td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr style={{ background: C.cream }}>
                      <td style={{ ...cellBase, textAlign: 'left', fontFamily: 'Barlow, sans-serif', fontWeight: 800, borderBottom: 'none' }}>
                        Total
                      </td>
                      <td style={{ ...numCenter, fontWeight: 800, borderBottom: 'none' }}>{fmt$(totalRev)}</td>
                      <td style={{ ...numCenter, fontWeight: 800, borderBottom: 'none' }}>{fmtN(totalOrd)}</td>
                      <td style={{ ...numCenter, fontWeight: 800, borderBottom: 'none' }}>{fmt$(totalSp)}</td>
                      <td className="yt-col-hide-mobile" style={{ ...numCenter, fontWeight: 800, borderBottom: 'none' }}>{blendRoas > 0 ? `${blendRoas.toFixed(2)}x` : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

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
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }} className="summary-grid">
              {[0, 1, 2, 3, 4].map(i => <SkeletonKpiCard key={i} />)}
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 12, padding: '16px 20px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Skeleton width={34} height={34} radius={8} />
                    <div style={{ flex: 1 }}>
                      <Skeleton width="70%" height={12} style={{ marginBottom: 4 }} />
                      <Skeleton width="40%" height={9} />
                    </div>
                  </div>
                  {[0, 1, 2, 3, 4, 5, 6].map(j => <Skeleton key={j} height={14} width="60%" />)}
                </div>
              ))}
            </div>
          </>
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
              <table style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    {['Project', 'Total Sales', 'Orders', 'AOV', 'Ad Spend', 'ROAS', 'CAC', 'Conv. Rate', ''].map((h, i) => (
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
                          ? <Skeleton height={14} width={80} />
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
                          ? <Skeleton height={14} width={60} />
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
                          ? <Skeleton height={14} width={60} />
                          : <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Barlow, sans-serif' }}>{org.aov > 0 ? fmt$(org.aov) : '—'}</span>
                              {org.aov > 0 && <DeltaBadge value={pct(org.aov, org.prevAov)} />}
                            </div>
                        }
                      </td>

                      {/* Ad Spend */}
                      <td style={{ padding: '16px 20px', minWidth: 110 }}>
                        {org.loading
                          ? <Skeleton height={14} width={60} />
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
                          ? <Skeleton height={14} width={50} />
                          : org.roas > 0
                            ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Barlow, sans-serif' }}>{org.roas.toFixed(2)}x</span>
                                <DeltaBadge value={pct(org.roas, org.prevRoas)} />
                              </div>
                            : <span style={{ fontSize: '0.8rem', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>—</span>
                        }
                      </td>

                      {/* CAC */}
                      <td style={{ padding: '16px 20px', minWidth: 100 }}>
                        {org.loading
                          ? <Skeleton height={14} width={50} />
                          : org.cac > 0
                            ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Barlow, sans-serif' }}>{fmt$(org.cac)}</span>
                                {org.prevCac > 0 && <DeltaBadge value={pct(org.cac, org.prevCac)} invert />}
                              </div>
                            : <span style={{ fontSize: '0.8rem', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>—</span>
                        }
                      </td>

                      {/* Conv. Rate */}
                      <td style={{ padding: '16px 20px', minWidth: 110 }}>
                        {org.loading
                          ? <Skeleton height={14} width={50} />
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
                      {[1,2,3,4,5,6].map(i => <Skeleton key={i} height={52} radius={6} />)}
                    </div>
                  ) : (
                    <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { label: 'Total Sales', value: fmt$(org.revenue),  delta: pct(org.revenue, org.prevRevenue), invert: false },
                        { label: 'Orders',  value: fmtN(org.orders),   delta: pct(org.orders, org.prevOrders), invert: false },
                        { label: 'AOV',     value: org.aov > 0 ? fmt$(org.aov) : '—', delta: org.aov > 0 ? pct(org.aov, org.prevAov) : null, invert: false },
                        { label: 'ROAS',    value: org.roas > 0 ? `${org.roas.toFixed(2)}x` : '—', delta: org.roas > 0 ? pct(org.roas, org.prevRoas) : null, invert: false },
                        { label: 'CAC',     value: org.cac > 0 ? fmt$(org.cac) : '—', delta: org.cac > 0 && org.prevCac > 0 ? pct(org.cac, org.prevCac) : null, invert: true },
                        { label: 'Conv. Rate', value: org.convRate > 0 ? `${org.convRate.toFixed(2)}%` : '—', delta: org.convRate > 0 && org.prevConvRate > 0 ? pct(org.convRate, org.prevConvRate) : null, invert: false },
                      ].map(k => (
                        <div key={k.label} style={{ background: C.cream, borderRadius: 8, padding: '10px 12px' }}>
                          <div className="kpi-label" style={{ marginBottom: 4 }}>{k.label}</div>
                          <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'Barlow, sans-serif', letterSpacing: '-0.02em', lineHeight: 1.1, color: C.ink, marginBottom: 4 }}>{k.value}</div>
                          {k.delta !== null && <DeltaBadge value={k.delta} invert={k.invert} />}
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
          .summary-grid     { grid-template-columns: 1fr 1fr !important; min-width: 0 !important; gap: 8px !important; }
          .summary-grid .kpi-card { padding: 14px 14px !important; }
          .overview-topbar  { flex-wrap: wrap !important; padding: 14px 16px 14px 60px !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 100 !important; }
          .overview-content { padding-top: 84px !important; }
          .overview-subtitle { flex-direction: column !important; align-items: flex-start !important; gap: 4px !important; }
          .overview-sync-row { flex-direction: row !important; flex-wrap: wrap !important; gap: 8px !important; align-items: stretch !important; margin-bottom: 16px !important; }
          .overview-sync-row .sync-item-all { flex: 1 1 100% !important; min-width: 0 !important; }
          .overview-sync-row .sync-item { flex: 1 1 0 !important; min-width: 0 !important; }
          .overview-sync-row .sync-item button { width: 100% !important; padding: 6px 10px !important; font-size: 0.72rem !important; }
          .overview-sync-row .sync-item > div { font-size: 0.62rem !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .overview-table { display: none !important; }
          .overview-cards { display: flex !important; }
        }
        @media (max-width: 640px) {
          .yt-col-hide-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
