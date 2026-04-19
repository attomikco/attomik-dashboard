'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangePicker, { DateRange, getComparisonPeriod } from '@/components/DateRangePicker'
import { Skeleton, SkeletonKpiCard } from '@/components/Skeleton'
import RevenueRoasChart from '@/components/RevenueRoasChart'
import SpendVsSalesChart from '@/components/SpendVsSalesChart'
import RoasChart from '@/components/RoasChart'
import SalesByChannelChart from '@/components/SalesByChannelChart'
import MoMSummaryTable from '@/components/MoMSummaryTable'
import PacingChart from '@/components/PacingChart'
import DayOfWeekHeatmap from '@/components/DayOfWeekHeatmap'
import CacTrendChart from '@/components/CacTrendChart'
import RetentionChart from '@/components/RetentionChart'
import ReturnGrowthChart from '@/components/ReturnGrowthChart'
import EmailInsights from '@/components/EmailInsights'
import AskAttomik from '@/components/AskAttomik'
import ChannelSalesChart from '@/components/ChannelSalesChart'
import { Sparkles } from 'lucide-react'

function pct(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0
  return ((current - prev) / prev) * 100
}
function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n/1_000).toFixed(2)}k`
  return `$${n.toFixed(2)}`
}
function fmtN(n: number) { return n >= 1_000 ? `${(n/1_000).toFixed(1)}k` : n.toLocaleString() }
function fmtX(n: number) { return `${n.toFixed(2)}x` }
function fmtPct(n: number) { return `${n.toFixed(1)}%` }
function chg(cur: number, prev: number) {
  const p = pct(cur, prev)
  return `${p >= 0 ? '↑' : '↓'} ${Math.abs(p).toFixed(1)}%`
}
function getPrevPeriod(start: string, end: string, mode?: import('@/components/DateRangePicker').CompareMode, customCompareStart?: string, customCompareEnd?: string) {
  return getComparisonPeriod(start, end, mode, customCompareStart, customCompareEnd)
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── BRAND KIT TOKENS ──
const C = {
  ink:     '#000000',
  paper:   '#ffffff',
  cream:   '#f2f2f2',
  accent:  '#00ff97',
  muted:   '#666666',
  border:  '#e0e0e0',
  success: '#00cc78',
}

function KpiCard({ label, value, change, invertColors, subtitle, children, target }: { label: string; value: string; change?: number; invertColors?: boolean; subtitle?: string; children?: React.ReactNode; target?: { value: number; current: number; label?: string; format?: (n: number) => string } }) {
  const up = change === undefined ? null : change >= 0
  const isGood = up === null ? null : (invertColors ? !up : up)
  // Progress against target. Formula is current/target for every metric so the
  // bar always reads "how much of the line have we crossed". Direction is
  // encoded via color:
  //   invertColors=false (higher is better, e.g. Revenue): at/over = green
  //   invertColors=true  (lower is better, e.g. Ad Spend): over = red (over budget)
  const tRatio = target && target.value > 0 ? (target.current / target.value) * 100 : 0
  const tBarWidth = Math.min(tRatio, 100)
  const tOver = tRatio > 100
  const tBarColor = invertColors
    ? (tOver ? '#ef4444' : C.accent)
    : (tOver ? C.success : C.accent)
  const tIsBad = invertColors && tOver
  const tFmt = target?.format || fmt$
  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {label}
      </div>
      <div className="kpi-value" style={{ marginBottom: 8 }}>
        {value}
      </div>
      {/* Always render the subtitle slot so cards line up even when some rows mix cards with/without subtitles */}
      <div style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 8, fontFamily: 'Barlow, sans-serif', minHeight: '1.15em', lineHeight: 1.35 }}>
        {subtitle || '\u00a0'}
      </div>
      {change !== undefined && (
        <span className={`badge ${isGood ? 'pill-up' : 'pill-down'}`}>
          {up ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
        </span>
      )}
      {target && target.value > 0 && (
        <div style={{ marginTop: 8, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: tIsBad ? '#b91c1c' : C.muted, marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>
            <span style={{ fontWeight: tIsBad ? 700 : 400 }}>
              {tIsBad ? `over ${target.label || 'target'} · ${tRatio.toFixed(0)}%` : `${tRatio.toFixed(0)}% of ${target.label || 'target'}`}
            </span>
            <span>{tFmt(target.value)}</span>
          </div>
          <div style={{ height: 4, background: C.cream, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${tBarWidth}%`,
              background: tBarColor,
              borderRadius: 2,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

function YesterdayPill({ label, value, wow, invert, skeleton }: { label: string; value?: string; wow?: number | null; invert?: boolean; skeleton?: boolean }) {
  const isUp = typeof wow === 'number' ? wow >= 0 : null
  const isGood = typeof wow !== 'number' ? null : (invert ? !isUp : isUp)
  return (
    <div style={{
      background: C.paper, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: '14px 16px', minWidth: 0,
    }}>
      <div style={{ fontSize: '0.7rem', color: C.muted, fontFamily: 'var(--font-barlow), Barlow, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-dm-mono), DM Mono, monospace', fontSize: '1.3rem', fontWeight: 700, color: skeleton ? '#bbb' : C.ink, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {skeleton ? '—' : value}
      </div>
      {skeleton ? (
        <span style={{ fontSize: '0.68rem', color: '#bbb', fontFamily: 'var(--font-barlow), Barlow, sans-serif' }}>pending</span>
      ) : typeof wow === 'number' ? (
        <span className={`badge ${isGood ? 'pill-up' : 'pill-down'}`}>
          {isUp ? '↑' : '↓'} {Math.abs(wow).toFixed(1)}% DoD
        </span>
      ) : (
        <span className="badge badge-gray">no comparison</span>
      )}
    </div>
  )
}

function YesterdayInsightCard({ insight }: { insight: any | null }) {
  const fmtDateLong = (d: string) => {
    const dt = new Date(d + 'T12:00:00')
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }
  const fmtMoney = (n: number) => {
    if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`
    if (n >= 1_000) return `$${(n/1_000).toFixed(1)}k`
    return `$${n.toFixed(0)}`
  }

  const ydate = new Date(); ydate.setDate(ydate.getDate() - 1)
  const dateStr = insight?.date ?? ydate.toLocaleDateString('en-CA')
  const m = insight?.metrics ?? {}
  const pills = [
    { label: 'Revenue',  value: fmtMoney(Number(m.revenue ?? 0)),  wow: typeof m.revenue_dod  === 'number' ? m.revenue_dod  : null },
    { label: 'Orders',   value: Number(m.orders ?? 0).toLocaleString('en-US'), wow: typeof m.orders_dod === 'number' ? m.orders_dod : null },
    { label: 'Ad Spend', value: fmtMoney(Number(m.ad_spend ?? 0)), wow: typeof m.ad_spend_dod === 'number' ? m.ad_spend_dod : null, invert: true },
    { label: 'ROAS',     value: `${Number(m.roas ?? 0).toFixed(2)}x`, wow: typeof m.roas_dod === 'number' ? m.roas_dod : null },
  ]

  return (
    <div className="card yesterday-card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(0,255,151,0.18)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Sparkles size={13} color="#007a48" />
        </div>
        <span style={{ fontFamily: 'var(--font-barlow), Barlow, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: C.ink, letterSpacing: '-0.01em' }}>Yesterday</span>
        <span style={{ fontSize: '0.8rem', color: C.muted, fontFamily: 'var(--font-barlow), Barlow, sans-serif' }}>· {fmtDateLong(dateStr)}</span>
      </div>
      <div style={{ padding: '0 22px 20px' }}>
        <div className="yesterday-pills" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {pills.map(p => <YesterdayPill key={p.label} {...p} />)}
        </div>
      </div>
      <style>{`
        @media (max-width: 640px) {
          .yesterday-pills { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}

function SectionHeader({ title, color = C.accent, platform }: { title: string; color?: string; platform?: string }) {
  return (
    <div className="section-header">
      <div className="section-header-bar" style={color !== C.accent ? { background: color } : undefined} />
      <div className="section-header-title">{title}</div>
      {platform && (
        <span className="badge badge-gray">
          {platform}
        </span>
      )}
      <div className="section-header-line" />
    </div>
  )
}

function MetricRow({ items }: { items: { label: string; value: string; sub?: string; invertColors?: boolean; desc?: string }[] }) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(130px, 1fr))`, gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', minWidth: items.length > 3 ? 520 : 'auto' }}>
        {items.map((item, i) => {
          const isUp = item.sub?.startsWith('↑')
          const isDown = item.sub?.startsWith('↓')
          const hasChange = isUp || isDown
          const isGood = hasChange ? (item.invertColors ? isDown : isUp) : null
          return (
            <div key={i} style={{ background: C.paper, padding: '18px 20px', minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'var(--font-barlow), Barlow, sans-serif' }}>
                {item.label}
              </div>
              <div className="kpi-value" style={{ fontSize: '1.4rem' }}>{item.value}</div>
              {item.sub && (
                <div className={`badge ${isGood ? 'pill-up' : isGood === false ? 'pill-down' : ''}`} style={{ marginTop: 6, ...(isGood === null ? { background: 'transparent', color: '#999' } : {}) }}>
                  {item.sub}
                </div>
              )}
              {item.desc && (
                <div style={{ marginTop: 6, fontSize: '0.68rem', color: '#bbb', fontFamily: 'var(--font-barlow), Barlow, sans-serif', lineHeight: 1.4 }}>
                  {item.desc}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FinanceBreakdown({ rows }: { rows: { label: string; value: number; prevValue?: number; negative?: boolean }[] }) {
  return (
    <div className="table-wrapper" style={{ marginBottom: 12 }}>
      {rows.map((row, i) => {
        const isTotal = row.label === 'Total sales' || row.label === 'Net sales'
        const p = row.prevValue !== undefined ? pct(row.value, row.prevValue) : undefined
        const up = p !== undefined ? p >= 0 : null
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 24px', borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none', background: isTotal ? C.cream : C.paper }}>
            <div style={{ fontSize: '0.95rem', fontWeight: isTotal ? 800 : 400, fontFamily: 'var(--font-barlow), Barlow, sans-serif', color: C.ink }}>{row.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {p !== undefined && (
                <span className={`badge ${up ? 'pill-up' : 'pill-down'}`}>
                  {up ? '↑' : '↓'} {Math.abs(p).toFixed(1)}%
                </span>
              )}
              <div style={{ fontSize: '0.95rem', fontWeight: isTotal ? 800 : 500, fontFamily: 'var(--font-dm-mono), DM Mono, monospace', color: row.negative && row.value > 0 ? '#b91c1c' : C.ink, minWidth: 110, textAlign: 'right' }}>
                {row.negative && row.value > 0 ? `-${fmt$(row.value)}` : fmt$(row.value)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PeriodBreakdownTable({ rows }: { rows: { date: string; revenue: number; spend: number; roas: number }[] }) {
  if (!rows.length) {
    return (
      <div style={{ color: C.muted, fontSize: '0.85rem', fontFamily: 'var(--font-barlow), Barlow, sans-serif', padding: '24px 0', textAlign: 'center' }}>
        No data for this period.
      </div>
    )
  }
  return (
    <div className="table-wrapper table-sticky"><div className="table-scroll">
      <table style={{ minWidth: 480 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Date</th>
            <th style={{ textAlign: 'right' }}>Revenue</th>
            <th style={{ textAlign: 'right' }}>Ad Spend</th>
            <th style={{ textAlign: 'right' }}>ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
              <td className="td-mono td-right td-strong" style={{ whiteSpace: 'nowrap' }}>{fmt$(r.revenue)}</td>
              <td className="td-mono td-right td-muted" style={{ whiteSpace: 'nowrap' }}>{r.spend > 0 ? fmt$(r.spend) : '—'}</td>
              <td className="td-mono td-right" style={{ whiteSpace: 'nowrap' }}>{r.roas > 0 ? fmtX(r.roas) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div></div>
  )
}

function ChartCard({ title, subtitle, children, dark }: { title: string; subtitle?: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div style={{ background: dark ? C.ink : C.paper, border: `1px solid ${dark ? C.ink : C.border}`, borderRadius: 10, padding: '24px 24px 20px' }}>
      <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-barlow), Barlow, sans-serif', letterSpacing: '-0.02em', marginBottom: 4, color: dark ? C.paper : C.ink }}>{title}</div>
      {subtitle && <div style={{ fontSize: '0.875rem', color: dark ? 'rgba(255,255,255,0.45)' : C.muted, fontFamily: 'var(--font-barlow), Barlow, sans-serif', marginBottom: 20 }}>{subtitle}</div>}
      {children}
    </div>
  )
}

// Get YYYY-MM-DD date string in a specific timezone
function dateInTz(tz: string, offsetDays = 0): string {
  // Get today's date string in the org's timezone first, then apply offset
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD in org tz
  const d = new Date(todayStr + 'T12:00:00') // noon to avoid DST edge cases
  if (offsetDays) d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA') // format back to YYYY-MM-DD
}
function monthStartInTz(tz: string): string {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  return todayStr.slice(0, 8) + '01'
}

// Default range uses UTC until we know the org timezone (updated after fetch)
const defaultRange: DateRange = {
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA'),
  end: new Date().toLocaleDateString('en-CA'),
  label: 'Month to date',
  compareMode: 'previous_month',
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [loading, setLoading] = useState(true)
  const [isRefetching, setIsRefetching] = useState(false)
  const hasLoadedOnce = useRef(false)
  const [data, setData] = useState<any>(null)
  const [revenueRoasData, setRevenueRoasData] = useState<any[]>([])
  const [spendSalesData, setSpendSalesData] = useState<any[]>([])
  const [roasData, setRoasData] = useState<any[]>([])
  const [channelData, setChannelData] = useState<any[]>([])
  const [chartGranularity, setChartGranularity] = useState<'day' | 'week' | 'month'>('day')
  const [pacingData, setPacingData] = useState<any[]>([])
  const [dowData, setDowData] = useState<any[]>([])
  const [cacData, setCacData] = useState<any[]>([])
  const [channels, setChannels] = useState<Record<string, boolean>>({})
  const [trafficData, setTrafficData] = useState<{ users: number; sessions: number; newUsers: number; usersP: number; sessionsP: number; newUsersP: number } | null>(null)
  const [orgName, setOrgName] = useState<string>('your store')
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [timezone, setTimezone] = useState<string>('America/New_York')
  const [estEOM, setEstEOM] = useState<number | null>(null)
  const [activeOrgId, setActiveOrgId] = useState<string>('')
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [syncTimestamps, setSyncTimestamps] = useState<Record<string, string | null>>({ shopify: null, amazon: null, walmart: null, meta: null })
  const [monthlyTarget, setMonthlyTarget] = useState<any>(null)
  const [yesterdayInsight, setYesterdayInsight] = useState<any | null>(null)
  const [insightFetched, setInsightFetched] = useState(false)
  const supabase = createClient()

  useEffect(() => { fetchData() }, [range])

  // Sync timestamps — fetched independently of the heavy fetchData flow so a
  // stall upstream can't leave the topbar showing stale values. Fires on
  // mount and whenever activeOrgId changes.
  useEffect(() => {
    const orgId = activeOrgId || localStorage.getItem('activeOrgId')
    if (!orgId) return
    let cancelled = false
    fetch(`/api/sync/timestamps?org_id=${orgId}&_t=${Date.now()}`, {
      cache: 'no-store' as RequestCache,
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    })
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        if (cancelled) return
        const ts: Record<string, string | null> = { shopify: null, amazon: null, walmart: null, meta: null }
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (row?.source && row?.last_synced_at) ts[row.source] = row.last_synced_at
          }
        }
        setSyncTimestamps(ts)
      })
      .catch(() => { if (!cancelled) setSyncTimestamps({ shopify: null, amazon: null, walmart: null, meta: null }) })
    return () => { cancelled = true }
  }, [activeOrgId])

  // Topbar scroll shadow
  useEffect(() => {
    const handler = () => {
      document.querySelector('.topbar')?.classList.toggle('topbar-scrolled', window.scrollY > 4)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const fetchData = async () => {
    if (hasLoadedOnce.current) setIsRefetching(true)
    else setLoading(true)
    let orgId = localStorage.getItem('activeOrgId')
    // After fresh login, Sidebar may not have set activeOrgId yet — resolve it
    if (!orgId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: mem } = await supabase
          .from('org_memberships').select('org_id').eq('user_id', user.id).limit(1).single()
        if (mem?.org_id) {
          orgId = mem.org_id
          localStorage.setItem('activeOrgId', orgId)
        }
      }
    }
    if (!orgId) { setLoading(false); setIsRefetching(false); return }
    setActiveOrgId(orgId)

    // Fetch user name for personalized greeting (use view-as name if active)
    const viewAsName = localStorage.getItem('viewAsUserName')
    if (viewAsName) {
      setUserName(viewAsName)
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser && !userName) {
        const { data: prof } = await supabase.from('profiles').select('full_name, is_superadmin').eq('id', authUser.id).single()
        if (prof?.full_name) setUserName(prof.full_name)
        if (prof?.is_superadmin) setIsSuperadmin(true)
      }
    }

    // Fetch org config (channels + timezone)
    const { data: orgData } = await supabase
      .from('organizations').select('channels, timezone, name, shopify_synced_at, ga_property_id').eq('id', orgId).single()
    if (orgData?.name) { setOrgName(orgData.name); document.title = `${orgData.name} Analytics | Attomik` }
    if (orgData?.shopify_synced_at) setLastSynced(orgData.shopify_synced_at)

    // Sync timestamps are fetched by a dedicated useEffect keyed on activeOrgId.

    // Fetch yesterday's metrics for the Yesterday card (DoD comparison)
    fetch(`/api/insights/yesterday?org_id=${orgId}&_t=${Date.now()}`, { cache: 'no-store' as RequestCache })
      .then(r => r.ok ? r.json() : { data: null })
      .then(({ data }) => setYesterdayInsight(data ?? null))
      .catch(() => setYesterdayInsight(null))
      .finally(() => setInsightFetched(true))

    // Fetch monthly targets for the selected period (via API to bypass RLS)
    // Parse YYYY-MM-DD directly to avoid UTC-vs-local timezone shift
    const [tYear, tMonth] = range.start.split('-').map(Number)
    console.log('[monthly-targets] fetching', { orgId, tYear, tMonth, rangeStart: range.start })
    fetch(`/api/targets?org_id=${orgId}&year=${tYear}&month=${tMonth}`)
      .then(r => { console.log('[monthly-targets] response status:', r.status); return r.ok ? r.json() : null })
      .then(mt => { console.log('[monthly-targets] data:', mt); setMonthlyTarget(mt) })
      .catch(e => { console.error('[monthly-targets] error:', e); setMonthlyTarget(null) })

    const orgTimezone = orgData?.timezone ?? 'America/New_York'
    setTimezone(orgTimezone)
    // Compute org-timezone-aware dates for this fetch (don't mutate range state)
    const orgToday = dateInTz(orgTimezone)
    const orgMonthStart = monthStartInTz(orgTimezone)
    const resolvedRange = (() => {
      switch (range.label) {
        case 'Month to date':  return { start: orgMonthStart, end: orgToday }
        case 'Today':          return { start: orgToday, end: orgToday }
        case 'Yesterday':      return { start: dateInTz(orgTimezone, -1), end: dateInTz(orgTimezone, -1) }
        case 'Last 7 days':    return { start: dateInTz(orgTimezone, -7), end: orgToday }
        case 'Last 30 days':   return { start: dateInTz(orgTimezone, -30), end: orgToday }
        case 'Last 90 days':   return { start: dateInTz(orgTimezone, -90), end: orgToday }
        case 'Last 12 months': return { start: dateInTz(orgTimezone, -365), end: orgToday }
        case 'This year':      return { start: orgToday.slice(0,4) + '-01-01', end: orgToday }
        default: return { start: range.start, end: range.end }
      }
    })()

    // Fetch GA4 traffic data if property is configured (current + previous period)
    const gaPrev = getPrevPeriod(resolvedRange.start, resolvedRange.end, range.compareMode, range.customCompareStart, range.customCompareEnd)
    if (orgData?.ga_property_id) {
      const fetchTraffic = (start: string, end: string) =>
        fetch('/api/analytics/traffic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: orgId, startDate: start, endDate: end }),
        }).then(r => r.ok ? r.json() : null)

      Promise.all([
        fetchTraffic(resolvedRange.start, resolvedRange.end),
        fetchTraffic(gaPrev.prevStart, gaPrev.prevEnd),
      ]).then(([cur, prev]) => {
        if (cur) setTrafficData({
          sessions: cur.sessions, users: cur.users, newUsers: cur.newUsers,
          sessionsP: prev?.sessions ?? 0, usersP: prev?.users ?? 0, newUsersP: prev?.newUsers ?? 0,
        })
      }).catch(() => setTrafficData(null))
    } else {
      setTrafficData(null)
    }

    const ch = orgData?.channels ?? {}
    // If channels column is null/empty object (never configured), show all
    // If it has keys (even all false), respect the individual values
    const isConfigured = Object.keys(ch).length > 0
    const showShopify = !isConfigured || ch.shopify !== false
    const showAmazon  = !isConfigured || ch.amazon  !== false
    const showWalmart = !isConfigured || ch.walmart !== false
    const showMeta    = !isConfigured || ch.meta    !== false
    const showGoogle  = !isConfigured || ch.google  !== false
    const showAds     = showMeta || showGoogle
    setChannels(ch)

    // Convert date strings to UTC using the org's timezone
    // Convert a YYYY-MM-DD date to UTC ISO string treating it as midnight/end-of-day
    // in the org's local timezone (e.g. 'America/Los_Angeles' = UTC-8 = T08:00:00Z)
    const toUTC = (dateStr: string, endOfDay = false) => {
      const time = endOfDay ? '23:59:59' : '00:00:00'
      const utcMidnight = new Date(`${dateStr}T${time}Z`)
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: orgTimezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      })
      const parts = fmt.formatToParts(utcMidnight)
      const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
      const localAtUTCMidnight = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`)
      const targetLocal = new Date(`${dateStr}T${time}`)
      const diffMs = targetLocal.getTime() - localAtUTCMidnight.getTime()
      return new Date(utcMidnight.getTime() + diffMs).toISOString()
    }

    const thisStart = toUTC(resolvedRange.start, false)
    const thisEnd   = toUTC(resolvedRange.end, true)
    const { prevStart, prevEnd } = getPrevPeriod(resolvedRange.start, resolvedRange.end, range.compareMode, range.customCompareStart, range.customCompareEnd)
    const prevStartISO = toUTC(prevStart, false)
    const prevEndISO   = toUTC(prevEnd, true)
    const sixMonthsAgo = '2020-01-01T00:00:00.000Z' // fetch full history for accurate returning customer calc

    // Paginated fetch to bypass Supabase 1000 row default limit
    const fetchAllOrders = async (gteDate: string, lteDate: string, cols: string) => {
      const size = 1000
      let from = 0, all: any[] = []
      while (true) {
        const { data, error } = await supabase.from('orders').select(cols)
          .eq('org_id', orgId).gte('created_at', gteDate).lte('created_at', lteDate)
          .order('created_at', { ascending: true }).range(from, from + size - 1)
        if (error) { console.error('[fetchAllOrders] Supabase error:', error, { from, gteDate, lteDate }); break }
        if (!data || data.length === 0) break
        all = all.concat(data)
        if (data.length < size) break
        from += size
      }
      return all
    }

    const orderCols = 'total_price,status,source,customer_email,created_at,units,subtotal,discount_amount,shipping_amount,tax_amount,refunded_amount,is_subscription'
    const orderColsLight = 'total_price,source,customer_email,created_at,units,is_subscription'

    // Amazon orders are stored at midnight UTC — fetch them with plain date boundaries
    // so timezone offsets don't cause them to be missed
    const amazonCurStart = `${resolvedRange.start}T00:00:00.000Z`
    const amazonCurEnd   = `${resolvedRange.end}T23:59:59.999Z`
    const amazonPrevStart = `${prevStart}T00:00:00.000Z`
    const amazonPrevEnd   = `${prevEnd}T23:59:59.999Z`

    const fetchNonAmazon = (gte: string, lte: string, cols: string) =>
      fetchAllOrders(gte, lte, cols).then(orders => orders.filter(o => o.source !== 'amazon'))
    const fetchAmazon = (gte: string, lte: string, cols: string) =>
      fetchAllOrders(gte, lte, cols).then(orders => orders.filter(o => o.source === 'amazon'))

    // Fetch ad_spend via API route (uses service client to bypass RLS)
    const fetchAllAdSpend = async (cols: string, gteDate: string, lteDate: string) => {
      console.log('[fetchAllAdSpend] v2 — calling /api/ad-spend/query', { orgId, cols, gteDate, lteDate })
      try {
        const res = await fetch('/api/ad-spend/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: orgId, cols, gte_date: gteDate, lte_date: lteDate }),
        })
        const json = await res.json()
        if (!res.ok) {
          console.error('[fetchAllAdSpend] API error:', res.status, json)
          return { data: [] }
        }
        console.log('[fetchAllAdSpend] got', json.data?.length ?? 0, 'rows')
        return json
      } catch (err) {
        console.error('[fetchAllAdSpend] fetch error:', err)
        return { data: [] }
      }
    }

    const [curNonAmazon, curAmazon, prevNonAmazon, prevAmazon, curS, prevS, allOrdRaw, allSpRaw] = await Promise.all([
      fetchNonAmazon(thisStart, thisEnd, orderCols),
      fetchAmazon(amazonCurStart, amazonCurEnd, orderCols),
      fetchNonAmazon(prevStartISO, prevEndISO, orderCols),
      fetchAmazon(amazonPrevStart, amazonPrevEnd, orderCols),
      fetchAllAdSpend('spend,platform,impressions,clicks,conversions,date', resolvedRange.start, resolvedRange.end),
      fetchAllAdSpend('spend,platform,impressions,clicks,conversions', prevStart, prevEnd),
      fetchAllOrders(sixMonthsAgo, new Date().toISOString(), orderColsLight),
      fetchAllAdSpend('spend,date', sixMonthsAgo.split('T')[0], resolvedRange.end),
    ])

    const cur  = [...curNonAmazon, ...curAmazon]
    const prev = [...prevNonAmazon, ...prevAmazon]
    const cSpend = curS.data ?? [], pSpend = prevS.data ?? []
    const allOrd = allOrdRaw ?? []
    const allSp = allSpRaw?.data ?? []

    // Debug: log ad spend query results
    const metaRows = cSpend.filter((o: any) => o.platform === 'meta')
    const metaTotal = metaRows.reduce((s: number, o: any) => s + Number(o.spend), 0)
    console.log('[analytics] ad_spend query:', {
      dateRange: { start: resolvedRange.start, end: resolvedRange.end },
      totalAdSpendRows: cSpend.length,
      metaRows: metaRows.length,
      metaTotalSpend: metaTotal,
      metaDates: Array.from(new Set(metaRows.map((o: any) => o.date))),
      allSpendTotal: cSpend.reduce((s: number, o: any) => s + Number(o.spend), 0),
    })

    const shopAllC = cur.filter(o => o.source === 'shopify')
    const shopAllP = prev.filter(o => o.source === 'shopify')
    // Exclude fully refunded orders from revenue calculations (match Shopify's gross sales)
    const shopC = shopAllC.filter(o => o.status !== 'refunded')
    const shopP = shopAllP.filter(o => o.status !== 'refunded')
    // But keep all orders for returns calculation
    const shopReturnsC = shopAllC.filter(o => o.status === 'refunded')
    const shopReturnsP = shopAllP.filter(o => o.status === 'refunded')
    const amzC  = cur.filter(o => o.source === 'amazon'),  amzP  = prev.filter(o => o.source === 'amazon')
    const wmC   = cur.filter(o => o.source === 'walmart'), wmP   = prev.filter(o => o.source === 'walmart')

    // Filter orders by enabled channels for overview metrics
    const enabledOrders = cur.filter(o =>
      (showShopify && o.source === 'shopify') ||
      (showAmazon  && o.source === 'amazon')  ||
      (showWalmart && o.source === 'walmart') ||
      (showShopify && !['shopify','amazon','walmart'].includes(o.source)) // fallback for uncategorized
    )
    const enabledOrdersP = prev.filter(o =>
      (showShopify && o.source === 'shopify') ||
      (showAmazon  && o.source === 'amazon')  ||
      (showWalmart && o.source === 'walmart') ||
      (showShopify && !['shopify','amazon','walmart'].includes(o.source))
    )
    const totalRevC = enabledOrders.reduce((s, o) => s + Number(o.total_price), 0)
    const totalRevP = enabledOrdersP.reduce((s, o) => s + Number(o.total_price), 0)
    const totalSpC  = cSpend.reduce((s, o) => s + Number(o.spend), 0)
    const totalSpP  = pSpend.reduce((s, o) => s + Number(o.spend), 0)
    const roasC = totalSpC > 0 ? totalRevC / totalSpC : 0
    const roasP = totalSpP > 0 ? totalRevP / totalSpP : 0
    // Order count: for Amazon daily aggregates, use units field; for Shopify, count 1 per row
    const countOrders = (orders: any[]) => orders.reduce((s, o) =>
      s + ((o.source === 'amazon' || o.source === 'walmart') ? (Number(o.units) || 1) : 1), 0)
    const ordC  = countOrders(enabledOrders)
    const ordP  = countOrders(enabledOrdersP)
    // Shopify-only PAID order counts for conversion rate (GA4 traffic is Shopify-only)
    const shopOrdC = shopC.length
    const shopOrdP = shopP.length
    const netRevC = enabledOrders.reduce((s, o) => s + Number(o.subtotal || o.total_price || 0), 0)
    const netRevP = enabledOrdersP.reduce((s, o) => s + Number(o.subtotal || o.total_price || 0), 0)
    const aovC  = ordC > 0 ? netRevC / ordC : 0
    const aovP  = ordP > 0 ? netRevP / ordP : 0
    // Returning = ordered ANY time before the current period (uses full history)
    const allEmailsBeforeCur = new Set(allOrd.filter(o => o.created_at < thisStart).map(o => o.customer_email).filter(Boolean))
    const allEmailsBeforePrev = new Set(allOrd.filter(o => o.created_at < prevStartISO).map(o => o.customer_email).filter(Boolean))
    const curEmails  = [...new Set(enabledOrders.map(o => o.customer_email).filter(Boolean))]
    const prevEmailsList = [...new Set(enabledOrdersP.map(o => o.customer_email).filter(Boolean))]
    const retCustC   = curEmails.filter(e => allEmailsBeforeCur.has(e)).length
    const newCustC   = curEmails.filter(e => !allEmailsBeforeCur.has(e)).length
    const totalCustC = curEmails.length
    const retCustP   = prevEmailsList.filter(e => allEmailsBeforePrev.has(e)).length
    const newCustP   = prevEmailsList.filter(e => !allEmailsBeforePrev.has(e)).length
    const rcrC = totalCustC > 0 ? (retCustC / totalCustC) * 100 : 0
    const rcrP = prevEmailsList.length > 0 ? (retCustP / prevEmailsList.length) * 100 : 0
    const cacC = ordC > 0 ? totalSpC / ordC : 0
    const cacP = ordP > 0 ? totalSpP / ordP : 0
    const retRevC = enabledOrders.filter(o => o.customer_email && allEmailsBeforeCur.has(o.customer_email)).reduce((s, o) => s + Number(o.total_price), 0)
    const newRevC  = enabledOrders.filter(o => o.customer_email && !allEmailsBeforeCur.has(o.customer_email)).reduce((s, o) => s + Number(o.total_price), 0)

    const shGrossC    = shopC.reduce((s, o) => s + (Number(o.subtotal)||0) + (Number(o.discount_amount)||0), 0)
    const shGrossP    = shopP.reduce((s, o) => s + (Number(o.subtotal)||0) + (Number(o.discount_amount)||0), 0)
    const shDiscountC = shopC.reduce((s, o) => s + Number(o.discount_amount||0), 0)
    const shDiscountP = shopP.reduce((s, o) => s + Number(o.discount_amount||0), 0)
    const shReturnsC  = shopAllC.reduce((s, o) => s + Number(o.refunded_amount||0), 0)
    const shReturnsP  = shopAllP.reduce((s, o) => s + Number(o.refunded_amount||0), 0)
    const shNetC      = shopC.reduce((s, o) => s + Number(o.subtotal||o.total_price||0), 0)
    const shNetP      = shopP.reduce((s, o) => s + Number(o.subtotal||o.total_price||0), 0)
    const shShippingC = shopC.reduce((s, o) => s + Number(o.shipping_amount||0), 0)
    const shShippingP = shopP.reduce((s, o) => s + Number(o.shipping_amount||0), 0)
    const shTaxC      = shopC.reduce((s, o) => s + Number(o.tax_amount||0), 0)
    const shTaxP      = shopP.reduce((s, o) => s + Number(o.tax_amount||0), 0)
    const shTotalC    = shopC.reduce((s, o) => s + Number(o.total_price||0), 0)
    const shTotalP    = shopP.reduce((s, o) => s + Number(o.total_price||0), 0)
    const shOrdC      = shopC.filter(o => o.status !== 'refunded').length
    const shOrdP      = shopP.filter(o => o.status !== 'refunded').length
    const shCustC     = new Set(shopC.map(o => o.customer_email).filter(Boolean)).size
    const shCustP     = new Set(shopP.map(o => o.customer_email).filter(Boolean)).size
    const shAovC      = shOrdC > 0 ? shNetC / shOrdC : 0
    const shAovP      = shOrdP > 0 ? shNetP / shOrdP : 0
    // Shopify defines returning = customer has ANY prior order in history (not just prev period)
    const allHistoricalEmails = new Set(allOrd.filter(o => o.source === 'shopify').map(o => o.customer_email).filter(Boolean))
    // For current period: returning = ordered before the period start
    const ordersBeforeCur = allOrd.filter(o => o.source === 'shopify' && o.created_at < thisStart)
    const emailsBeforeCur = new Set(ordersBeforeCur.map(o => o.customer_email).filter(Boolean))
    const shRetCustC = new Set(shopC.filter(o => o.customer_email && emailsBeforeCur.has(o.customer_email)).map(o => o.customer_email)).size
    // For prev period: returning = ordered before the prev period start
    const ordersBeforePrev = allOrd.filter(o => o.source === 'shopify' && o.created_at < prevStartISO)
    const emailsBeforePrev = new Set(ordersBeforePrev.map(o => o.customer_email).filter(Boolean))
    const shRetCustP = new Set(shopP.filter(o => o.customer_email && emailsBeforePrev.has(o.customer_email)).map(o => o.customer_email)).size
    const shCurEmails = new Set(shopC.map(o => o.customer_email).filter(Boolean))
    const shRcrC = shCustC > 0 ? (shRetCustC / shCustC) * 100 : 0
    const shRcrP = shCustP > 0 ? (shRetCustP / shCustP) * 100 : 0

    // CLTV (Shopify only) — ACL (2) × Customer Value, where CV = APFR × AOV
    const apfrC = shCustC > 0 ? shOrdC / shCustC : 0
    const apfrP = shCustP > 0 ? shOrdP / shCustP : 0
    const cltvC = 2 * apfrC * shAovC
    const cltvP = 2 * apfrP * shAovP

    const metaSpC    = cSpend.filter(o => o.platform === 'meta').reduce((s, o) => s + Number(o.spend), 0)
    const metaSpP    = pSpend.filter(o => o.platform === 'meta').reduce((s, o) => s + Number(o.spend), 0)
    const shRoasC    = metaSpC > 0 ? shNetC / metaSpC : 0
    const shRoasP    = metaSpP > 0 ? shNetP / metaSpP : 0
    const shDiscRateC = shGrossC > 0 ? (shDiscountC / shGrossC) * 100 : 0
    const shDiscRateP = shGrossP > 0 ? (shDiscountP / shGrossP) * 100 : 0
    const shRefRateC  = shOrdC > 0 ? (shopC.filter(o => o.status === 'refunded').length / shOrdC) * 100 : 0
    const shRefRateP  = shOrdP > 0 ? (shopP.filter(o => o.status === 'refunded').length / shOrdP) * 100 : 0

    // Subscription metrics (Shopify only)
    const subOrdsC = shopC.filter(o => o.is_subscription)
    const subOrdsP = shopP.filter(o => o.is_subscription)
    const subRevC = subOrdsC.reduce((s, o) => s + Number(o.total_price || 0), 0)
    const subRevP = subOrdsP.reduce((s, o) => s + Number(o.total_price || 0), 0)
    const subCountC = subOrdsC.length
    const subCountP = subOrdsP.length
    const subCustsC = new Set(subOrdsC.map(o => o.customer_email).filter(Boolean)).size
    const subCustsP = new Set(subOrdsP.map(o => o.customer_email).filter(Boolean)).size
    const subPctRevC = totalRevC > 0 ? (subRevC / totalRevC) * 100 : 0
    const subPctRevP = totalRevP > 0 ? (subRevP / totalRevP) * 100 : 0
    const subAovC = subCountC > 0 ? subRevC / subCountC : 0
    const subAovP = subCountP > 0 ? subRevP / subCountP : 0
    const subRevPerCustC = subCustsC > 0 ? subRevC / subCustsC : 0
    const subRevPerCustP = subCustsP > 0 ? subRevP / subCustsP : 0
    // Sub LTV: ACL (2) × AOV × frequency (orders per subscriber)
    const subFreqC = subCustsC > 0 ? subCountC / subCustsC : 0
    const subFreqP = subCustsP > 0 ? subCountP / subCustsP : 0
    const subLtvC = 2 * subAovC * subFreqC
    const subLtvP = 2 * subAovP * subFreqP

    // Monthly subscription data (last 6 months) — use UTC boundaries
    const monthlySubscribers: { month: string; subscribers: number; revenue: number; pctOfRev: number }[] = []
    for (let m = 5; m >= 0; m--) {
      const dt = new Date(); dt.setMonth(dt.getMonth() - m)
      const y = dt.getFullYear(), mo = dt.getMonth()
      const mStart = `${y}-${String(mo + 1).padStart(2, '0')}-01T00:00:00.000Z`
      const mEnd = mo === 11 ? `${y + 1}-01-01T00:00:00.000Z` : `${y}-${String(mo + 2).padStart(2, '0')}-01T00:00:00.000Z`
      const mLabel = new Date(y, mo).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const mOrd = allOrd.filter(o => o.source === 'shopify' && o.is_subscription && o.created_at >= mStart && o.created_at < mEnd)
      const mSubs = new Set(mOrd.map(o => o.customer_email).filter(Boolean)).size
      const mRev = mOrd.reduce((s, o) => s + Number(o.total_price || 0), 0)
      const mAllRev = allOrd.filter(o => o.created_at >= mStart && o.created_at < mEnd).reduce((s, o) => s + Number(o.total_price || 0), 0)
      monthlySubscribers.push({ month: mLabel, subscribers: mSubs, revenue: mRev, pctOfRev: mAllRev > 0 ? (mRev / mAllRev) * 100 : 0 })
    }

    const amzRevC  = amzC.reduce((s, o) => s + Number(o.total_price), 0)
    const amzRevP  = amzP.reduce((s, o) => s + Number(o.total_price), 0)
    const amzUnitC = amzC.reduce((s, o) => s + (Number(o.units)||0), 0)
    const amzUnitP = amzP.reduce((s, o) => s + (Number(o.units)||0), 0)
    const amzAovC  = amzUnitC > 0 ? amzRevC / amzUnitC : 0
    const amzAovP  = amzUnitP > 0 ? amzRevP / amzUnitP : 0

    const wmRevC   = wmC.reduce((s, o) => s + Number(o.total_price), 0)
    const wmRevP   = wmP.reduce((s, o) => s + Number(o.total_price), 0)
    const wmUnitC  = wmC.reduce((s, o) => s + (Number(o.units)||0), 0)
    const wmUnitP  = wmP.reduce((s, o) => s + (Number(o.units)||0), 0)
    const wmAovC   = wmUnitC > 0 ? wmRevC / wmUnitC : 0
    const wmAovP   = wmUnitP > 0 ? wmRevP / wmUnitP : 0

    const metaImprC = cSpend.filter(o => o.platform === 'meta').reduce((s, o) => s + Number(o.impressions), 0)
    const metaClkC  = cSpend.filter(o => o.platform === 'meta').reduce((s, o) => s + Number(o.clicks), 0)
    const metaConvC = cSpend.filter(o => o.platform === 'meta').reduce((s, o) => s + Number(o.conversions), 0)
    const metaImprP = pSpend.filter((o: any) => o.platform === 'meta').reduce((s: number, o: any) => s + Number(o.impressions ?? 0), 0)
    const metaClkP  = pSpend.filter((o: any) => o.platform === 'meta').reduce((s: number, o: any) => s + Number(o.clicks ?? 0), 0)
    const metaConvP = pSpend.filter((o: any) => o.platform === 'meta').reduce((s: number, o: any) => s + Number(o.conversions ?? 0), 0)
    const metaRoasC = metaSpC > 0 ? totalRevC / metaSpC : 0
    const metaRoasP = metaSpP > 0 ? totalRevP / metaSpP : 0

    // Convert a UTC ISO timestamp to YYYY-MM-DD in the org's timezone
    const utcToOrgDate = (iso: string) =>
      new Date(iso).toLocaleDateString('en-CA', { timeZone: orgTimezone })

    // Auto-granularity: day for short ranges, week for medium, month for long
    const rangeDays = Math.round(
      (new Date(resolvedRange.end).getTime() - new Date(resolvedRange.start).getTime()) / 864e5
    ) + 1
    const granularity: 'day' | 'week' | 'month' =
      rangeDays <= 60 ? 'day' : rangeDays <= 180 ? 'week' : 'month'
    setChartGranularity(granularity)

    // Monday-starting ISO week key (returns YYYY-MM-DD of the Monday in UTC)
    const weekKeyFrom = (ymd: string) => {
      const d = new Date(ymd + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      return d.toISOString().slice(0, 10)
    }
    const toBucket = (ymd: string) =>
      granularity === 'day' ? ymd
      : granularity === 'week' ? weekKeyFrom(ymd)
      : ymd.slice(0, 7)
    const bucketLabel = (key: string) => {
      if (granularity === 'month') {
        const [y, m] = key.split('-').map(Number)
        return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      }
      return new Date(key + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const buildBuckets = (start: string, end: string) => {
      const out: Record<string, any> = {}
      const init = (key: string, label: string) => {
        out[key] = { date: label, revenue: 0, shopify: 0, amazon: 0, spend: 0, roas: 0 }
      }
      if (granularity === 'month') {
        const [sy, sm] = start.split('-').map(Number)
        const [ey, em] = end.split('-').map(Number)
        let y = sy, m = sm
        while (y < ey || (y === ey && m <= em)) {
          const key = `${y}-${String(m).padStart(2, '0')}`
          init(key, bucketLabel(key))
          if (++m > 12) { m = 1; y++ }
        }
      } else if (granularity === 'week') {
        let cur = weekKeyFrom(start)
        const endW = weekKeyFrom(end)
        while (cur <= endW) {
          init(cur, bucketLabel(cur))
          const d = new Date(cur + 'T12:00:00Z')
          d.setUTCDate(d.getUTCDate() + 7)
          cur = d.toISOString().slice(0, 10)
        }
      } else {
        // Day mode: iterate in org timezone so bucket keys match KPI dates exactly
        for (let d = new Date(start + 'T12:00:00'); ; d.setDate(d.getDate() + 1)) {
          const k = d.toLocaleDateString('en-CA', { timeZone: orgTimezone })
          const label = d.toLocaleDateString('en-US', { timeZone: orgTimezone, month: 'short', day: 'numeric' })
          init(k, label)
          if (k >= end) break
        }
      }
      return out
    }

    const fillBuckets = (buckets: Record<string, any>, orders: any[], spend: any[]) => {
      orders.filter(o => o.status !== 'refunded').forEach(o => {
        if (!o.created_at) return
        const k = toBucket(utcToOrgDate(o.created_at))
        if (!buckets[k]) return
        buckets[k].revenue += Number(o.total_price)
        if (o.source === 'shopify') buckets[k].shopify += Number(o.total_price)
        if (o.source === 'amazon')  buckets[k].amazon  += Number(o.total_price)
      })
      spend.forEach((s: any) => {
        if (!s?.date) return
        const k = toBucket(s.date)
        if (buckets[k]) buckets[k].spend += Number(s.spend)
      })
      // ROAS recomputed from bucket sums — not an average of daily ratios
      Object.values(buckets).forEach((b: any) => { b.roas = b.spend > 0 ? b.revenue / b.spend : 0 })
    }

    const curBuckets = buildBuckets(resolvedRange.start, resolvedRange.end)
    fillBuckets(curBuckets, enabledOrders, cSpend)
    const dayArr = Object.values(curBuckets) as any[]

    setRevenueRoasData(dayArr.map(d => ({ date: d.date, revenue: d.revenue, roas: d.roas })))
    setSpendSalesData(dayArr.map(d => ({ date: d.date, revenue: d.revenue, spend: d.spend })))
    setRoasData(dayArr.filter(d => d.roas > 0).map(d => ({ date: d.date, roas: d.roas })))
    setChannelData(dayArr.map(d => ({
      date: d.date,
      shopify: showShopify ? d.shopify : 0,
      amazon: showAmazon ? d.amazon : 0,
    })))

    // Pacing: cumulative revenue by day index within the period
    // Day 1 = first day of current period, Day 1 of prev = first day of prev period
    const curStart = new Date(resolvedRange.start)
    const prevStartDate = new Date(prevStart)

    const curDayRevs: Record<number, number> = {}
    cur.forEach(o => {
      // Use org timezone date to compute day index so pacing matches KPI
      const orderDate = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: orgTimezone })
      const dayIdx = Math.round((new Date(orderDate).getTime() - curStart.getTime()) / 864e5) + 1
      if (dayIdx >= 1) curDayRevs[dayIdx] = (curDayRevs[dayIdx] || 0) + Number(o.total_price)
    })

    const prevDayRevs: Record<number, number> = {}
    prev.forEach(o => {
      const orderDate = new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: orgTimezone })
      const dayIdx = Math.round((new Date(orderDate).getTime() - prevStartDate.getTime()) / 864e5) + 1
      if (dayIdx >= 1) prevDayRevs[dayIdx] = (prevDayRevs[dayIdx] || 0) + Number(o.total_price)
    })

    const totalDays = Math.round((new Date(resolvedRange.end).getTime() - curStart.getTime()) / 864e5) + 1
    const prevTotalDays = Math.round((new Date(prevEnd).getTime() - prevStartDate.getTime()) / 864e5) + 1
    const maxDay = Math.max(totalDays, prevTotalDays, 28)

    let cumCur = 0, cumPrev = 0
    const pacingArr = Array.from({ length: maxDay }, (_, i) => {
      const day = i + 1
      cumCur  += curDayRevs[day]  || 0
      cumPrev += prevDayRevs[day] || 0
      return { day, current: day <= totalDays ? cumCur : null, previous: day <= prevTotalDays ? cumPrev : null, projection: null as number | null }
    })

    // Add projection: daily run rate from current period × remaining days
    const currentTotal = cumCur
    const dailyRate = totalDays > 0 ? currentTotal / totalDays : 0
    const remainingDays = maxDay - totalDays
    if (dailyRate > 0 && remainingDays > 0) {
      // Projection starts at the last actual data point
      pacingArr[totalDays - 1].projection = currentTotal
      for (let i = totalDays; i < maxDay; i++) {
        pacingArr[i].projection = currentTotal + dailyRate * (i - totalDays + 1)
      }
    }
    const estEOM = dailyRate > 0 ? currentTotal + dailyRate * remainingDays : null

    setPacingData(pacingArr)
    setEstEOM(estEOM)

    const dowMap: Record<number, { revenue: number; orders: number; weeks: Set<string> }> = {}
    for (let i = 0; i < 7; i++) dowMap[i] = { revenue: 0, orders: 0, weeks: new Set() }
    cur.forEach(o => {
      // Use org timezone for day-of-week so Mon/Tue etc match local business days
      const localDate = new Date(new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: orgTimezone }) + 'T12:00:00')
      dowMap[localDate.getDay()].revenue += Number(o.total_price)
      dowMap[localDate.getDay()].orders  += Number(o.units) || 1
      dowMap[localDate.getDay()].weeks.add(`${localDate.getFullYear()}-${Math.floor(localDate.getDate()/7)}`)
    })
    setDowData(Object.entries(dowMap).map(([dow, v]) => ({ dayOfWeek: Number(dow), revenue: v.revenue, orders: v.orders, weeks: Math.max(v.weeks.size, 1) })))

    // allOrd and allSp already defined above
    const monthMap: Record<string, { customers: Set<string>; spend: number; orders: number }> = {}
    allOrd.forEach(o => {
      const d = new Date(o.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      if (!monthMap[key]) monthMap[key] = { customers: new Set(), spend: 0, orders: 0 }
      monthMap[key].orders += (o.source === 'amazon' || o.source === 'walmart') ? (Number(o.units) || 1) : 1
      if (o.customer_email) monthMap[key].customers.add(o.customer_email)
    })
    allSp.forEach(s => { const key = s.date.slice(0,7); if (monthMap[key]) monthMap[key].spend += Number(s.spend) })
    const sortedMonths = Object.keys(monthMap).sort()
    // Use same CAC formula as KPI card: new = never ordered in any prior month
    // Only show last 6 months relative to selected range end
    const rangeEndMonth = resolvedRange.end.slice(0, 7)
    const last6Months = sortedMonths.filter(k => k <= rangeEndMonth).slice(-6)

    setCacData(last6Months.map((key) => {
      const [year, month] = key.split('-')
      const orders = monthMap[key].orders
      const spend = monthMap[key].spend
      return {
        period: new Date(Number(year), Number(month)-1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        cac: orders > 0 ? spend / orders : 0,
        orders,
        spend,
      }
    }).filter(d => d.spend > 0))

    // Weekly sparklines for scoreboard
    const weekRevs: number[] = []
    const weekSpend: number[] = []
    const weekOrders: number[] = []
    const weekCac: number[] = []
    const weekAov: number[] = []
    const weekRoas: number[] = []
    const weekNewCusts: number[] = []
    const weekRetCusts: number[] = []
    const weekRetRate: number[] = []

    for (let w = 7; w >= 0; w--) {
      const wStart = new Date(Date.now() - (w+1)*7*864e5)
      const wEnd   = new Date(Date.now() - w*7*864e5)
      const wStartISO = wStart.toISOString()
      const wEndISO   = wEnd.toISOString()

      const wOrds = allOrd.filter(o => o.created_at >= wStartISO && o.created_at < wEndISO)
      const wRev  = wOrds.reduce((s, o) => s + Number(o.total_price), 0)
      const wOrdCount = wOrds.reduce((s, o) => s + ((o.source === 'amazon' || o.source === 'walmart') ? (Number(o.units) || 1) : 1), 0)

      const wSp = allSp.filter((s: any) => s.date >= wStart.toISOString().split('T')[0] && s.date < wEnd.toISOString().split('T')[0])
      const wSpend = wSp.reduce((s: any, o: any) => s + Number(o.spend), 0)

      const wRoas = wSpend > 0 ? wRev / wSpend : 0
      const wShopOrds = wOrds.filter(o => o.source === 'shopify')
      const wAllCusts = new Set(wOrds.map(o => o.customer_email).filter(Boolean))
      const wPriorEmails = new Set(allOrd.filter(o => o.created_at < wStartISO).map(o => o.customer_email).filter(Boolean))
      const wNewCusts = [...wAllCusts].filter(e => !wPriorEmails.has(e)).length
      const wRetCusts = [...wAllCusts].filter(e => wPriorEmails.has(e)).length
      const wRetRate = wAllCusts.size > 0 ? (wRetCusts / wAllCusts.size) * 100 : 0

      weekRevs.push(wRev)
      weekSpend.push(wSpend)
      weekOrders.push(wOrdCount)
      weekCac.push(wOrdCount > 0 && wSpend > 0 ? wSpend / wOrdCount : 0)
      weekAov.push(wOrdCount > 0 ? wRev / wOrdCount : 0)
      weekRoas.push(wRoas)
      weekNewCusts.push(wNewCusts)
      weekRetCusts.push(wRetCusts)
      weekRetRate.push(wRetRate)
    }

    // Monthly retention data (last 6 months)
    const monthlyRetention: { month: string; total: number; returning: number; new: number; retRate: number }[] = []
    for (let m = 5; m >= 0; m--) {
      const dt = new Date()
      dt.setMonth(dt.getMonth() - m)
      const y = dt.getFullYear(), mo = dt.getMonth()
      // Use UTC boundaries to match how created_at is stored
      const mStartISO = `${y}-${String(mo + 1).padStart(2, '0')}-01T00:00:00.000Z`
      const mEndISO = mo === 11
        ? `${y + 1}-01-01T00:00:00.000Z`
        : `${y}-${String(mo + 2).padStart(2, '0')}-01T00:00:00.000Z`
      const mLabel = new Date(y, mo).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

      const mOrds = allOrd.filter(o => o.created_at >= mStartISO && o.created_at < mEndISO)
      const mCusts = new Set(mOrds.map(o => o.customer_email).filter(Boolean))
      const mPrior = new Set(allOrd.filter(o => o.created_at < mStartISO).map(o => o.customer_email).filter(Boolean))
      const mRet = [...mCusts].filter(e => mPrior.has(e)).length
      const mNew = [...mCusts].filter(e => !mPrior.has(e)).length
      const mTotal = mCusts.size
      monthlyRetention.push({ month: mLabel, total: mTotal, returning: mRet, new: mNew, retRate: mTotal > 0 ? (mRet / mTotal) * 100 : 0 })
    }

    // If only Shopify enabled, use Shopify-specific calcs for accuracy
    const finalAovC = (showShopify && !showAmazon) ? shAovC : aovC
    const finalAovP = (showShopify && !showAmazon) ? shAovP : aovP

    setData({ showShopify, showAmazon, showWalmart, showMeta, showGoogle, showAds,
      totalRevC, totalRevP, totalSpC, totalSpP, roasC, roasP,
      ordC, ordP, shopOrdC, shopOrdP, aovC: finalAovC, aovP: finalAovP, cacC, cacP,
      newCustC, newCustP, retCustC, totalCustC, rcrC, rcrP, retRevC, newRevC, cltvC, cltvP,
      shGrossC, shGrossP, shDiscountC, shDiscountP, shReturnsC, shReturnsP,
      shNetC, shNetP, shShippingC, shShippingP, shTaxC, shTaxP, shTotalC, shTotalP,
      shOrdC, shOrdP, shCustC, shCustP, shAovC, shAovP,
      shRetCustC, shRetCustP, shRcrC, shRcrP, shRoasC, shRoasP,
      shDiscRateC, shDiscRateP, shRefRateC, shRefRateP,
      amzRevC, amzRevP, amzUnitC, amzUnitP, amzDaysC: amzC.length, amzDaysP: amzP.length, amzAovC, amzAovP,
      wmRevC, wmRevP, wmUnitC, wmUnitP, wmDaysC: wmC.length, wmDaysP: wmP.length, wmAovC, wmAovP,
      metaSpC, metaSpP, metaImprC, metaImprP, metaClkC, metaClkP, metaConvC, metaConvP, metaRoasC, metaRoasP,
      weekRevs, weekSpend, weekOrders, weekCac, weekAov, weekRoas, weekNewCusts, weekRetCusts, weekRetRate,
      monthlyRetention,
      subRevC, subRevP, subCountC, subCountP, subCustsC, subCustsP, subPctRevC, subPctRevP,
      subAovC, subAovP, subRevPerCustC, subRevPerCustP, subLtvC, subLtvP, monthlySubscribers,
    })
    setLoading(false)
    setIsRefetching(false)
    hasLoadedOnce.current = true
  }

  const d = data
  const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const { prevStart, prevEnd: prevEndLabel } = getPrevPeriod(range.start, range.end, range.compareMode, range.customCompareStart, range.customCompareEnd)
  const prevLabel = `${fmtDate(prevStart)} – ${fmtDate(prevEndLabel)}`
  const periodLabel = range.label ?? `${fmtDate(range.start)} – ${fmtDate(range.end)}`
  const sec = (title: string) => `${periodLabel} — ${title}`

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>
      {/* Sticky topbar */}
      <div className="analytics-topbar topbar">
        <div className="topbar-title" style={{ minWidth: 0, flex: 1 }}>
          <h1 className="analytics-title">{orgName}<span className="analytics-title-sep"> — </span><span className="analytics-title-sub">Analytics</span></h1>
          <p className="caption" style={{ marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {range.label && <span style={{ fontWeight: 700 }}>{range.label}: </span>}
            {fmtDate(range.start)} – {fmtDate(range.end)} <span style={{ opacity: 0.6 }}>· vs {fmtDate(prevStart)} – {fmtDate(prevEndLabel)}</span>
          </p>
          <p className="caption" style={{ marginTop: 2, fontSize: '0.72rem', opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {([
              { key: 'shopify', label: 'Shopify' },
              { key: 'amazon',  label: 'Amazon'  },
              { key: 'walmart', label: 'Walmart' },
              { key: 'meta',    label: 'Meta'    },
            ] as const).map(({ key, label }, i) => {
              const ts = syncTimestamps[key]
              const formatted = ts
                ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                : 'Never'
              return (
                <span key={key}>
                  {i > 0 && <span style={{ margin: '0 10px', opacity: 0.5 }}>·</span>}
                  {label} · {formatted}
                </span>
              )
            })}
          </p>
        </div>
        <div className="topbar-actions">
          {isSuperadmin && d && <EmailInsights
            period={`${fmtDate(range.start)} – ${fmtDate(range.end)}`}
            preset={range.label ?? 'custom'}
            orgName={orgName}
            orgId={activeOrgId}
            metrics={{
              totalRev: fmt$(d.totalRevC), totalRevP: fmt$(d.totalRevP), totalRevChg: pct(d.totalRevC, d.totalRevP).toFixed(1),
              totalSp: fmt$(d.totalSpC), totalSpChg: pct(d.totalSpC, d.totalSpP).toFixed(1),
              roas: d.roasC.toFixed(2), roasP: d.roasP.toFixed(2),
              orders: d.ordC, ordersChg: pct(d.ordC, d.ordP).toFixed(1),
              aov: fmt$(d.aovC), aovChg: pct(d.aovC, d.aovP).toFixed(1),
              cac: fmt$(d.cacC), cacChg: pct(d.cacC, d.cacP).toFixed(1),
              newCust: d.newCustC, retCust: d.retCustC,
              shopifyRev: d.showShopify ? fmt$(d.shTotalC) : null,
              shopifyPctOfTotal: d.totalRevC > 0 ? (d.shTotalC / d.totalRevC * 100).toFixed(1) : null,
              amazonRev: d.showAmazon && d.amzRevC > 0 ? fmt$(d.amzRevC) : null,
              amazonPctOfTotal: d.totalRevC > 0 && d.amzRevC > 0 ? (d.amzRevC / d.totalRevC * 100).toFixed(1) : null,
              metaSp: d.showMeta ? fmt$(d.metaSpC) : null,
              metaRoas: d.metaRoasC > 0 ? d.metaRoasC.toFixed(2) : null,
              cltv: d.cltvC > 0 ? fmt$(d.cltvC) : null,
              convRate: trafficData && trafficData.users > 0 ? (d.shopOrdC / trafficData.users * 100).toFixed(2) : null,
              convRateP: trafficData && trafficData.usersP > 0 && d.shopOrdP > 0 ? (d.shopOrdP / trafficData.usersP * 100).toFixed(2) : null,
            }}
          />}
          <DateRangePicker value={range} onChange={r => setRange(r)} />
        </div>
      </div>

      {isRefetching && <div className="page-loading-bar" />}
      <div className={`analytics-content page-content${isRefetching ? ' is-refetching' : ''}`} style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 80px' }}>
        {loading ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[0, 1, 2, 3].map(i => <SkeletonKpiCard key={i} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
              {[0, 1, 2, 3].map(i => <SkeletonKpiCard key={i} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[0, 1].map(i => (
                <div key={i} className="card" style={{ padding: 20 }}>
                  <Skeleton width={160} height={16} style={{ marginBottom: 16 }} />
                  <Skeleton width="100%" height={240} radius={8} />
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 20 }}>
              <Skeleton width={200} height={16} style={{ marginBottom: 16 }} />
              <Skeleton width="100%" height={280} radius={8} />
            </div>
          </>
        ) : !d ? (
          <div style={{ color: C.muted, textAlign: 'center', padding: '80px 0', fontFamily: 'var(--font-barlow), Barlow, sans-serif', fontSize: '1rem' }}>No data yet. Upload a CSV to get started.</div>
        ) : (<>

          {/* ── YESTERDAY + ASK ATTOMIK (separate light cards) ── */}
          {insightFetched && (() => {
            const m = yesterdayInsight?.metrics
            const contextualSuggestions: string[] = []
            if (m) {
              if (typeof m.roas_dod === 'number' && m.roas_dod <= -5) contextualSuggestions.push('Why did ROAS drop yesterday?')
              else if (typeof m.roas_dod === 'number' && m.roas_dod >= 10) contextualSuggestions.push('What drove ROAS up yesterday?')
              if (typeof m.revenue_dod === 'number' && m.revenue_dod <= -5) contextualSuggestions.push('Where did we lose revenue yesterday?')
              else if (typeof m.revenue_dod === 'number' && m.revenue_dod >= 10) contextualSuggestions.push('What fueled yesterday\u2019s revenue bump?')
              if (typeof m.ad_spend_dod === 'number' && m.ad_spend_dod >= 15) contextualSuggestions.push('Why did ad spend spike vs the day before?')
              if (typeof m.orders_dod === 'number' && m.orders_dod <= -5) contextualSuggestions.push('Why are orders down vs the day before?')
            }
            const suggestions = contextualSuggestions.length > 0
              ? [...contextualSuggestions, 'How are we trending this month?']
              : undefined
            return (
              <>
                <div style={{ marginBottom: 16 }}>
                <AskAttomik
                  userName={userName}
                  orgName={orgName}
                  timezone={timezone}
                  period={`${fmtDate(range.start)} – ${fmtDate(range.end)}`}
                  periodLabel={range.label ?? undefined}
                  preset={range.label ?? 'custom'}
                  suggestions={suggestions}
                  metrics={{
                    totalRev: fmt$(d.totalRevC), totalRevP: fmt$(d.totalRevP), totalRevChg: pct(d.totalRevC, d.totalRevP).toFixed(1),
                    totalSp: fmt$(d.totalSpC), totalSpChg: pct(d.totalSpC, d.totalSpP).toFixed(1),
                    roas: d.roasC.toFixed(2), roasP: d.roasP.toFixed(2),
                    orders: d.ordC, ordersChg: pct(d.ordC, d.ordP).toFixed(1),
                    aov: fmt$(d.aovC), aovChg: pct(d.aovC, d.aovP).toFixed(1),
                    cac: fmt$(d.cacC), cacChg: pct(d.cacC, d.cacP).toFixed(1),
                    newCust: d.newCustC, retCust: d.retCustC, retRate: d.shRcrC.toFixed(1),
                    shopifyRev: d.showShopify ? fmt$(d.shTotalC) : null,
                    shopifyRevP: d.showShopify ? fmt$(d.shTotalP) : null,
                    shopifyPctOfTotal: d.totalRevC > 0 ? (d.shTotalC / d.totalRevC * 100).toFixed(1) : null,
                    shopifyRevChg: d.shTotalP > 0 ? pct(d.shTotalC, d.shTotalP).toFixed(1) : null,
                    shopifyGross: d.showShopify ? fmt$(d.shGrossC) : null,
                    shopifyNet: d.showShopify ? fmt$(d.shNetC) : null,
                    shopifyOrders: d.shOrdC, shopifyCust: d.shCustC, shopifyAov: fmt$(d.shAovC),
                    shopifyRoas: d.shRoasC > 0 ? d.shRoasC.toFixed(2) : null,
                    discountRate: d.shDiscRateC.toFixed(1), refundRate: d.shRefRateC.toFixed(1),
                    amazonRev: d.amzRevC > 0 ? fmt$(d.amzRevC) : null,
                    amazonRevP: d.showAmazon && d.amzRevP > 0 ? fmt$(d.amzRevP) : null,
                    amazonPctOfTotal: d.totalRevC > 0 && d.amzRevC > 0 ? (d.amzRevC / d.totalRevC * 100).toFixed(1) : null,
                    amazonRevChg: d.amzRevP > 0 ? pct(d.amzRevC, d.amzRevP).toFixed(1) : null,
                    amazonUnits: d.amzUnitC,
                    amazonAov: d.amzAovC > 0 ? fmt$(d.amzAovC) : null,
                    cltv: d.cltvC > 0 ? fmt$(d.cltvC) : null,
                    cltvP: d.cltvP > 0 ? fmt$(d.cltvP) : null,
                    cltvChg: d.cltvP > 0 ? pct(d.cltvC, d.cltvP).toFixed(1) : null,
                    cltvCacRatio: d.cltvC > 0 && d.cacC > 0 ? (d.cltvC / d.cacC).toFixed(2) : null,
                    metaSp: d.showMeta ? fmt$(d.metaSpC) : null,
                    metaSpChg: d.metaSpP > 0 ? pct(d.metaSpC, d.metaSpP).toFixed(1) : null,
                    metaRoas: d.metaRoasC > 0 ? d.metaRoasC.toFixed(2) : null,
                    metaImpr: d.metaImprC, metaClicks: d.metaClkC, metaConv: d.metaConvC,
                    trafficSessions: trafficData?.sessions ?? null,
                    trafficSessionsP: trafficData?.sessionsP ?? null,
                    trafficUsers: trafficData?.users ?? null,
                    trafficUsersP: trafficData?.usersP ?? null,
                    trafficNewUsers: trafficData?.newUsers ?? null,
                    trafficNewUsersP: trafficData?.newUsersP ?? null,
                    convRate: trafficData && trafficData.users > 0 ? (d.shopOrdC / trafficData.users * 100).toFixed(2) : null,
                    convRateP: trafficData && trafficData.usersP > 0 && d.shopOrdP > 0 ? (d.shopOrdP / trafficData.usersP * 100).toFixed(2) : null,
                    convRateSessions: trafficData && trafficData.sessions > 0 ? (d.shopOrdC / trafficData.sessions * 100).toFixed(2) : null,
                    convRateUsers: trafficData && trafficData.users > 0 ? (d.shopOrdC / trafficData.users * 100).toFixed(2) : null,
                    convRateNewUsers: trafficData && trafficData.newUsers > 0 ? (d.shopOrdC / trafficData.newUsers * 100).toFixed(2) : null,
                    gaUsers: trafficData?.users ?? null,
                    gaSessions: trafficData?.sessions ?? null,
                    subRev: d.subRevC > 0 ? fmt$(d.subRevC) : null,
                    subRevChg: d.subRevP > 0 ? pct(d.subRevC, d.subRevP).toFixed(1) : null,
                    subOrders: d.subCountC,
                    subOrdersChg: d.subCountP > 0 ? pct(d.subCountC, d.subCountP).toFixed(1) : null,
                    subCusts: d.subCustsC,
                    subPctRev: d.subPctRevC > 0 ? d.subPctRevC.toFixed(1) : null,
                  }}
                />
                </div>
              </>
            )
          })()}

          {/* ── YESTERDAY ── */}
          {insightFetched && <YesterdayInsightCard insight={yesterdayInsight} />}

          {/* ── OVERVIEW KPIs ── */}
          <SectionHeader title={sec('Overview')} />
          <div className="kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <KpiCard label="Total Sales"    value={fmt$(d.totalRevC)} change={pct(d.totalRevC, d.totalRevP)} subtitle="Blended revenue"
              target={monthlyTarget?.sales_target ? { value: monthlyTarget.sales_target, current: d.totalRevC, label: 'target' } : undefined} />
            <KpiCard label="Total Ad Spend" value={fmt$(d.totalSpC)}  change={pct(d.totalSpC, d.totalSpP)} invertColors subtitle="Paid media"
              target={monthlyTarget?.ad_spend_budget ? { value: monthlyTarget.ad_spend_budget, current: d.totalSpC, label: 'budget' } : undefined} />
            <KpiCard label="ROAS"           value={fmtX(d.roasC)}     change={pct(d.roasC, d.roasP)} subtitle="Return on Ad Spend"
              target={monthlyTarget?.roas_target ? { value: monthlyTarget.roas_target, current: d.roasC, label: 'target', format: fmtX } : undefined} />
          </div>
          <div className="kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <KpiCard label="Orders" value={fmtN(d.ordC)} change={pct(d.ordC, d.ordP)} subtitle="Total orders · all channels" />
            <KpiCard label="AOV"    value={fmt$(d.aovC)} change={pct(d.aovC, d.aovP)} subtitle="Average Order Value"
              target={monthlyTarget?.aov_target ? { value: monthlyTarget.aov_target, current: d.aovC, label: 'target' } : undefined} />
            {trafficData && trafficData.users > 0 ? (
              <KpiCard label="Conv. Rate (Users)" value={fmtPct(d.shopOrdC / trafficData.users * 100)} change={trafficData.usersP > 0 && d.shopOrdP > 0 ? pct(d.shopOrdC / trafficData.users * 100, d.shopOrdP / trafficData.usersP * 100) : undefined} subtitle="Shopify Orders ÷ Users" />
            ) : (
              <KpiCard label="CAC" value={d.cacC > 0 ? fmt$(d.cacC) : '—'} change={d.cacP > 0 ? pct(d.cacC, d.cacP) : undefined} invertColors subtitle="Customer Acquisition Cost"
                target={monthlyTarget?.cac_target ? { value: monthlyTarget.cac_target, current: d.cacC, label: 'target' } : undefined} />
            )}
          </div>

          {/* ── CLTV, CAC & CLTV/CAC ── */}
          {(d.cltvC > 0 || (trafficData && trafficData.users > 0 && d.cacC > 0)) && (
            <div className="kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
              {d.cltvC > 0 && <KpiCard label="CLTV" value={fmt$(d.cltvC)} change={d.cltvP > 0 ? pct(d.cltvC, d.cltvP) : undefined} subtitle="ACL (2) × AOV × Freq" />}
              {trafficData && trafficData.users > 0 && <KpiCard label="CAC" value={d.cacC > 0 ? fmt$(d.cacC) : '—'} change={d.cacP > 0 ? pct(d.cacC, d.cacP) : undefined} invertColors subtitle="Customer Acquisition Cost"
                target={monthlyTarget?.cac_target ? { value: monthlyTarget.cac_target, current: d.cacC, label: 'target' } : undefined} />}
              {d.cltvC > 0 && d.cacC > 0 && <KpiCard label="CLTV / CAC" value={`${(d.cltvC / d.cacC).toFixed(2)}x`} change={d.cltvP > 0 && d.cacP > 0 ? pct(d.cltvC / d.cacC, d.cltvP / d.cacP) : undefined} subtitle="Lifetime Value vs. Acquisition Cost" />}
            </div>
          )}

          {/* ── SALES BY CHANNEL ── */}
          {(d.shTotalC > 0 || d.amzRevC > 0 || (d.showWalmart && d.wmRevC > 0)) && (() => {
            const shPctC = d.totalRevC > 0 ? (d.shTotalC / d.totalRevC * 100) : 0
            const shPctP = d.totalRevP > 0 ? (d.shTotalP / d.totalRevP * 100) : 0
            const amzPctC = d.totalRevC > 0 ? (d.amzRevC / d.totalRevC * 100) : 0
            const amzPctP = d.totalRevP > 0 ? (d.amzRevP / d.totalRevP * 100) : 0
            const wmPctC  = d.totalRevC > 0 ? (d.wmRevC  / d.totalRevC * 100) : 0
            const wmPctP  = d.totalRevP > 0 ? (d.wmRevP  / d.totalRevP * 100) : 0
            return (
              <MetricRow items={[
                ...(d.shTotalC > 0 ? [{
                  label: 'Shopify',
                  value: fmt$(d.shTotalC),
                  sub: d.shTotalP > 0 ? chg(d.shTotalC, d.shTotalP) : '',
                  desc: 'Shopify channel revenue',
                }] : []),
                ...(d.shTotalC > 0 && d.totalRevC > 0 ? [{
                  label: 'Shopify % of Total',
                  value: `${shPctC.toFixed(1)}%`,
                  sub: shPctP > 0 ? chg(shPctC, shPctP) : '',
                  desc: 'Shopify share of blended revenue',
                }] : []),
                ...(d.amzRevC > 0 ? [{
                  label: 'Amazon',
                  value: fmt$(d.amzRevC),
                  sub: d.amzRevP > 0 ? chg(d.amzRevC, d.amzRevP) : '',
                  desc: 'Amazon channel revenue',
                }] : []),
                ...(d.amzRevC > 0 && d.totalRevC > 0 ? [{
                  label: 'Amazon % of Total',
                  value: `${amzPctC.toFixed(1)}%`,
                  sub: amzPctP > 0 ? chg(amzPctC, amzPctP) : '',
                  desc: 'Amazon share of blended revenue',
                }] : []),
                ...(d.showWalmart && d.wmRevC > 0 ? [{
                  label: 'Walmart',
                  value: fmt$(d.wmRevC),
                  sub: d.wmRevP > 0 ? chg(d.wmRevC, d.wmRevP) : '',
                  desc: 'Walmart channel revenue',
                }] : []),
                ...(d.showWalmart && d.wmRevC > 0 && d.totalRevC > 0 ? [{
                  label: 'Walmart % of Total',
                  value: `${wmPctC.toFixed(1)}%`,
                  sub: wmPctP > 0 ? chg(wmPctC, wmPctP) : '',
                  desc: 'Walmart share of blended revenue',
                }] : []),
              ]} />
            )
          })()}

          {/* ── PERFORMANCE ── */}
          <SectionHeader title={sec('Performance')} />

          {/* ── CHARTS ROW 1 ── */}
          <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <ChartCard title="Revenue & ROAS" subtitle="Revenue bars (dark) · ROAS line (bright)">
              <RevenueRoasChart data={revenueRoasData} />
            </ChartCard>
            <ChartCard title="Revenue Pacing" subtitle="Cumulative vs previous period">
              <PacingChart data={pacingData} currentLabel={range.label} previousLabel={prevLabel} />
            </ChartCard>
          </div>

          {/* ── CHARTS ROW 2 ── */}
          <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <ChartCard title="Ad Spend vs Sales" subtitle="Spend bars · Revenue line">
              <SpendVsSalesChart data={spendSalesData} />
            </ChartCard>
            <ChartCard title="ROAS Over Time" subtitle="Daily return on ad spend">
              <RoasChart data={roasData} />
            </ChartCard>
          </div>

          {/* ── CHARTS ROW 3 ── */}
          <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <ChartCard title="Sales by Channel" subtitle={[d.showShopify ? "Shopify (green)" : "", d.showAmazon ? "Amazon (darker green)" : ""].filter(Boolean).join(" · ")}>
              <SalesByChannelChart data={channelData} />
            </ChartCard>
            <ChartCard title="CAC Trend" subtitle="Cost per new customer · bars = new customers">
              <CacTrendChart data={cacData} />
            </ChartCard>
          </div>

          {/* ── CHARTS ROW 4 ── */}
          <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {d.showShopify && (
              <ChartCard title="Shopify Sales" subtitle="Daily revenue from Shopify">
                <ChannelSalesChart data={channelData.map(c => ({ date: c.date, sales: c.shopify }))} color="#00ff97" />
              </ChartCard>
            )}
            {d.showAmazon && (
              <ChartCard title="Amazon Sales" subtitle="Daily revenue from Amazon">
                <ChannelSalesChart data={channelData.map(c => ({ date: c.date, sales: c.amazon }))} color="#00cc78" />
              </ChartCard>
            )}
          </div>

          {/* ── PERIOD BREAKDOWN TABLE ── */}
          <div style={{ marginBottom: 16 }}>
            <ChartCard
              title="Period Breakdown"
              subtitle={`Grouped by ${chartGranularity} · most recent first`}
            >
              <PeriodBreakdownTable
                rows={[...spendSalesData].reverse().map(r => ({
                  date: r.date,
                  revenue: r.revenue,
                  spend: r.spend,
                  roas: r.spend > 0 ? r.revenue / r.spend : 0,
                }))}
              />
            </ChartCard>
          </div>

          {/* ── DAY OF WEEK ── */}
          <div style={{ marginBottom: 32 }}>
            <ChartCard title="Revenue by Day of Week" subtitle="Average daily revenue — darker = higher">
              <DayOfWeekHeatmap data={dowData} />
            </ChartCard>
          </div>

          {/* ── CUSTOMER REVENUE ── */}
          <SectionHeader title={sec('Customer Revenue')} />
          <div className="kpi-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <KpiCard label="New Customer Rev."       value={fmt$(d.newRevC)} subtitle={d.totalRevC > 0 ? `${((d.newRevC/d.totalRevC)*100).toFixed(1)}% of total` : ''} />
            <KpiCard label="Returning Customer Rev." value={fmt$(d.retRevC)} subtitle={d.totalRevC > 0 ? `${((d.retRevC/d.totalRevC)*100).toFixed(1)}% of total` : ''} />
            <KpiCard label="Returning Customer Rate"             value={fmtPct(d.shRcrC)} change={pct(d.shRcrC, d.shRcrP)} />
            <KpiCard label="CAC"                     value={d.cacC > 0 ? fmt$(d.cacC) : '—'} change={d.cacP > 0 ? pct(d.cacC, d.cacP) : undefined} invertColors subtitle="Customer Acquisition Cost" />
          </div>
          {d.monthlyRetention?.length > 0 && (
            <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ChartCard title="Customer Retention" subtitle="Returning (green) vs New (gray) · Return rate line">
                <RetentionChart data={d.monthlyRetention} />
              </ChartCard>
              <ChartCard title="Returning Customers Growth" subtitle="Returning customers per month">
                <div style={{ width: '100%', height: 220 }}>
                  <ReturnGrowthChart data={d.monthlyRetention} />
                </div>
              </ChartCard>
            </div>
          )}
          <div style={{ marginBottom: 32 }} />

          {/* ── TRAFFIC (GA4) ── */}
          {trafficData && (
            <>
              <SectionHeader title={sec('Traffic')} color="#4285f4" platform="google analytics" />
              <MetricRow items={[
                { label: 'Sessions', value: fmtN(trafficData.sessions), sub: trafficData.sessionsP > 0 ? chg(trafficData.sessions, trafficData.sessionsP) : '' },
                { label: 'Users', value: fmtN(trafficData.users), sub: trafficData.usersP > 0 ? chg(trafficData.users, trafficData.usersP) : '' },
                { label: 'New Users', value: fmtN(trafficData.newUsers), sub: trafficData.newUsersP > 0 ? chg(trafficData.newUsers, trafficData.newUsersP) : '' },
              ]} />
              <MetricRow items={[
                ...(trafficData.sessions > 0 ? [{ label: 'Conv. Rate (Sessions)', value: fmtPct(d.shopOrdC / trafficData.sessions * 100), sub: trafficData.sessionsP > 0 && d.shopOrdP > 0 ? chg(d.shopOrdC / trafficData.sessions * 100, d.shopOrdP / trafficData.sessionsP * 100) : '', desc: 'Shopify Orders ÷ Sessions' }] : []),
                ...(trafficData.users > 0 ? [{ label: 'Conv. Rate (Users)', value: fmtPct(d.shopOrdC / trafficData.users * 100), sub: trafficData.usersP > 0 && d.shopOrdP > 0 ? chg(d.shopOrdC / trafficData.users * 100, d.shopOrdP / trafficData.usersP * 100) : '', desc: 'Shopify Orders ÷ Users' }] : []),
                ...(trafficData.newUsers > 0 ? [{ label: 'Conv. Rate (New Users)', value: fmtPct(d.shopOrdC / trafficData.newUsers * 100), sub: trafficData.newUsersP > 0 && d.shopOrdP > 0 ? chg(d.shopOrdC / trafficData.newUsers * 100, d.shopOrdP / trafficData.newUsersP * 100) : '', desc: 'Shopify Orders ÷ New Users' }] : []),
              ]} />
            </>
          )}

          {/* ── SHOPIFY ── */}
          {d.showShopify && <SectionHeader title={sec('Shopify')} color="#96bf48" platform="shopify" />}
          {d.showShopify && <>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-barlow), Barlow, sans-serif', marginBottom: 8 }}>Finance</div>
          <FinanceBreakdown rows={[
            { label: 'Gross sales',      value: d.shGrossC,    prevValue: d.shGrossP },
            { label: 'Discounts',        value: d.shDiscountC, prevValue: d.shDiscountP, negative: true },
            { label: 'Returns',          value: d.shReturnsC,  prevValue: d.shReturnsP,  negative: true },
            { label: 'Net sales',        value: d.shNetC,      prevValue: d.shNetP },
            { label: 'Shipping charges', value: d.shShippingC, prevValue: d.shShippingP },
            { label: 'Taxes',            value: d.shTaxC,      prevValue: d.shTaxP },
            { label: 'Total sales',      value: d.shTotalC,    prevValue: d.shTotalP },
          ]} />
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-barlow), Barlow, sans-serif', marginBottom: 8, marginTop: 24 }}>Behavior</div>
          <MetricRow items={[
            { label: 'Orders',      value: fmtN(d.shOrdC),     sub: chg(d.shOrdC, d.shOrdP) },
            { label: 'Customers',   value: fmtN(d.shCustC),    sub: chg(d.shCustC, d.shCustP) },
            { label: 'Returning',   value: fmtN(d.shRetCustC), sub: chg(d.shRetCustC, d.shRetCustP) },
            { label: 'Returning Customer Rate', value: fmtPct(d.shRcrC),   sub: chg(d.shRcrC, d.shRcrP) },
            { label: 'AOV',         value: fmt$(d.shAovC),     sub: chg(d.shAovC, d.shAovP) },
            { label: 'ROAS',        value: d.shRoasC > 0 ? fmtX(d.shRoasC) : '—', sub: d.shRoasP > 0 ? chg(d.shRoasC, d.shRoasP) : '' },
          ]} />

          </> }

          {/* ── SUBSCRIPTIONS ── */}
          {d.showShopify && d.subCountC > 0 && <>
          <SectionHeader title={sec('Subscriptions')} color="#7c3aed" platform="paywhirl" />
          <MetricRow items={[
            { label: 'Sub. Revenue', value: fmt$(d.subRevC), sub: d.subRevP > 0 ? chg(d.subRevC, d.subRevP) : '' },
            { label: '% of Total Revenue', value: fmtPct(d.subPctRevC), sub: d.subPctRevP > 0 ? chg(d.subPctRevC, d.subPctRevP) : '' },
            { label: 'Sub. Orders', value: fmtN(d.subCountC), sub: d.subCountP > 0 ? chg(d.subCountC, d.subCountP) : '' },
            { label: 'Subscribers', value: fmtN(d.subCustsC), sub: d.subCustsP > 0 ? chg(d.subCustsC, d.subCustsP) : '' },
          ]} />
          <MetricRow items={[
            { label: 'Sub. AOV', value: fmt$(d.subAovC), sub: d.subAovP > 0 ? chg(d.subAovC, d.subAovP) : '' },
            { label: 'Rev / Subscriber', value: fmt$(d.subRevPerCustC), sub: d.subRevPerCustP > 0 ? chg(d.subRevPerCustC, d.subRevPerCustP) : '' },
            { label: 'Sub. LTV', value: fmt$(d.subLtvC), sub: d.subLtvP > 0 ? chg(d.subLtvC, d.subLtvP) : '', desc: 'ACL (2) × AOV × Frequency' },
          ]} />
          {d.monthlySubscribers?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <ChartCard title="Monthly Subscribers" subtitle="Unique subscription customers per month · Last 6 months">
                <div style={{ width: '100%', height: 180 }}>
                  <ReturnGrowthChart data={d.monthlySubscribers.map((m: any) => ({ month: m.month, returning: m.subscribers }))} />
                </div>
              </ChartCard>
            </div>
          )}
          </> }

          {/* ── AMAZON ── */}
          {d.showAmazon && <SectionHeader title={sec('Amazon')} color="#00cc78" platform="amazon" />}
          {d.showAmazon && <>
          <MetricRow items={[
            { label: 'Gross Sales',       value: fmt$(d.amzRevC),  sub: chg(d.amzRevC, d.amzRevP) },
            { label: 'Total Order Items', value: fmtN(d.amzUnitC), sub: chg(d.amzUnitC, d.amzUnitP) },
            { label: 'Days Reported',     value: fmtN(d.amzDaysC) },
            { label: 'AOV',           value: fmt$(d.amzAovC),  sub: chg(d.amzAovC, d.amzAovP) },
          ]} />

          </> }

          {/* ── WALMART ── */}
          {d.showWalmart && d.wmRevC > 0 && <SectionHeader title={sec('Walmart')} color="#0071ce" platform="walmart" />}
          {d.showWalmart && d.wmRevC > 0 && <>
          <MetricRow items={[
            { label: 'Gross Sales',       value: fmt$(d.wmRevC),  sub: chg(d.wmRevC, d.wmRevP) },
            { label: 'Total Order Items', value: fmtN(d.wmUnitC), sub: chg(d.wmUnitC, d.wmUnitP) },
            { label: 'Days Reported',     value: fmtN(d.wmDaysC) },
            { label: 'AOV',               value: fmt$(d.wmAovC),  sub: chg(d.wmAovC, d.wmAovP) },
          ]} />

          </> }

          {/* ── AD SPEND ── */}
          {d.showAds && <SectionHeader title={sec('Ad Spend')} color="#000" />}
          {d.showAds && <>
          <MetricRow items={[
            { label: 'Total Spend', value: fmt$(d.totalSpC),  sub: chg(d.totalSpC, d.totalSpP), invertColors: true },
            { label: 'Meta Spend',  value: fmt$(d.metaSpC),   sub: chg(d.metaSpC, d.metaSpP), invertColors: true },
            { label: 'Meta ROAS',   value: d.metaRoasC > 0 ? fmtX(d.metaRoasC) : '—', sub: d.metaRoasP > 0 ? chg(d.metaRoasC, d.metaRoasP) : '' },
            { label: 'Impressions', value: fmtN(d.metaImprC), sub: d.metaImprP > 0 ? chg(d.metaImprC, d.metaImprP) : '' },
            { label: 'Clicks',      value: fmtN(d.metaClkC),  sub: d.metaClkP > 0 ? chg(d.metaClkC, d.metaClkP) : '' },
            { label: 'Purchases',   value: fmtN(d.metaConvC), sub: d.metaConvP > 0 ? chg(d.metaConvC, d.metaConvP) : '' },
          ]} />
          </> }

          {/* ── SCOREBOARD ── */}
          <SectionHeader title={sec('Scoreboard')} />
          <MoMSummaryTable
            currentLabel={range.label}
            previousLabel={prevLabel}
            rows={[
              { label: 'Revenue & Profitability', current: -1, previous: 0, format: 'currency' },
              { label: 'Total Sales',         current: d.totalRevC,   previous: d.totalRevP,   format: 'currency',    sparkline: d.weekRevs },
              ...(d.showAds ? [{ label: 'Total Ad Spend', current: d.totalSpC, previous: d.totalSpP, format: 'currency' as const, invertColors: true, sparkline: d.weekSpend }] : []),
              ...(d.showAds ? [{ label: 'ROAS', current: d.roasC, previous: d.roasP, format: 'multiplier' as const, sparkline: d.weekRoas }] : []),
              { label: 'AOV',                 current: d.aovC,        previous: d.aovP,        format: 'currency' as const, sparkline: d.weekAov },
              ...(d.showAds ? [{ label: 'CAC', current: d.cacC, previous: d.cacP, format: 'currency' as const, invertColors: true, sparkline: d.weekCac }] : []),
              { label: 'Orders & Customers',  current: -1, previous: 0, format: 'number' },
              { label: 'Total Orders',        current: d.ordC,        previous: d.ordP,        format: 'number' as const,   sparkline: d.weekOrders },
              { label: 'New Customers',       current: d.newCustC,    previous: d.newCustP,    format: 'number' as const,     sparkline: d.weekNewCusts },
              { label: 'Returning Customers', current: d.retCustC,    previous: 0,             format: 'number' as const,     sparkline: d.weekRetCusts },
              { label: 'Returning Customer Rate',         current: d.shRcrC,      previous: d.shRcrP,      format: 'percent' as const,    sparkline: d.weekRetRate },
              ...(d.showShopify ? [
                { label: 'Shopify',          current: -1,            previous: 0,             format: 'currency' as const },
                { label: 'Gross Sales',      current: d.shGrossC,    previous: d.shGrossP,    format: 'currency' as const },
                { label: 'Discounts',        current: d.shDiscountC, previous: d.shDiscountP, format: 'currency' as const, invertColors: true },
                { label: 'Returns',          current: d.shReturnsC,  previous: d.shReturnsP,  format: 'currency' as const, invertColors: true },
                { label: 'Net Sales',        current: d.shNetC,      previous: d.shNetP,      format: 'currency' as const },
                { label: 'Shipping Charges', current: d.shShippingC, previous: d.shShippingP, format: 'currency' as const },
                { label: 'Taxes',            current: d.shTaxC,      previous: d.shTaxP,      format: 'currency' as const },
                { label: 'Total Sales',      current: d.shTotalC,    previous: d.shTotalP,    format: 'currency' as const },
                { label: 'Discount Rate',    current: d.shDiscRateC, previous: d.shDiscRateP, format: 'percent' as const,  invertColors: true },
                { label: 'Refund Rate',      current: d.shRefRateC,  previous: d.shRefRateP,  format: 'percent' as const,  invertColors: true },
              ] : []),
              ...(d.showAmazon ? [
                { label: 'Amazon',        current: -1,           previous: 0,            format: 'currency' as const },
                { label: 'Gross Sales',   current: d.amzRevC,    previous: d.amzRevP,    format: 'currency' as const },
                { label: 'Units Ordered', current: d.amzUnitC,   previous: d.amzUnitP,   format: 'number' as const },
                { label: 'AOV',           current: d.amzAovC,    previous: d.amzAovP,    format: 'currency' as const },
              ] : []),
              ...(d.showMeta ? [
                { label: 'Meta Ads',  current: -1,          previous: 0,           format: 'currency' as const },
                { label: 'Spend',     current: d.metaSpC,   previous: d.metaSpP,   format: 'currency' as const, invertColors: true },
                { label: 'ROAS',      current: d.metaRoasC, previous: d.metaRoasP, format: 'multiplier' as const },
                { label: 'Purchases', current: d.metaConvC, previous: 0,           format: 'number' as const },
              ] : []),
            ]}
          />

        </>)}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .analytics-topbar {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding-left: 60px !important;
            z-index: 100 !important;
            border-bottom: 1px solid #e0e0e0 !important;
          }
          .analytics-content { padding-top: 90px !important; }
          .analytics-title { white-space: normal !important; line-height: 1.2 !important; }
          .analytics-title-sep { display: none !important; }
          .analytics-title-sub { display: block !important; font-size: 0.75rem !important; font-weight: 600 !important; color: #999 !important; letter-spacing: 0.04em !important; text-transform: uppercase !important; margin-top: 2px !important; }
          .kpi-grid-3 { grid-template-columns: 1fr 1fr !important; }
          .kpi-grid-4 { grid-template-columns: 1fr 1fr !important; }
          .chart-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .kpi-grid-3 { grid-template-columns: 1fr !important; }
          .kpi-grid-4 { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}
