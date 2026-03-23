'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangePicker, { DateRange } from '@/components/DateRangePicker'
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
import AIInsights from '@/components/AIInsights'
import AskAttomik from '@/components/AskAttomik'

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
  return `${p >= 0 ? '↑' : '↓'} ${Math.abs(p).toFixed(1)}% vs prev`
}
function getPrevPeriod(start: string, end: string) {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  const diff = e - s + 864e5
  return { prevStart: new Date(s - diff).toISOString().split('T')[0], prevEnd: new Date(s - 1).toISOString().split('T')[0] }
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

function KpiCard({ label, value, change, invertColors, subtitle, children }: { label: string; value: string; change?: number; invertColors?: boolean; subtitle?: string; children?: React.ReactNode }) {
  const up = change === undefined ? null : change >= 0
  const isGood = up === null ? null : (invertColors ? !up : up)
  return (
    <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1.1, marginBottom: 8 }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 8, fontFamily: 'Barlow, sans-serif' }}>{subtitle}</div>
      )}
      {change !== undefined && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.875rem', fontWeight: 700, fontFamily: 'Barlow, sans-serif', padding: '4px 10px', borderRadius: 6, background: isGood ? '#e6fff5' : '#fee2e2', color: isGood ? '#007a48' : '#b91c1c' }}>
          {up ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
        </span>
      )}
      {children}
    </div>
  )
}

function SectionHeader({ title, color = C.accent, platform }: { title: string; color?: string; platform?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '40px 0 20px' }}>
      <div style={{ width: 4, height: 28, background: color, borderRadius: 2, flexShrink: 0 }} />
      <div style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'var(--font-barlow), Barlow, sans-serif', color: C.ink }}>{title}</div>
      {platform && (
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 6, background: C.cream, color: C.muted, fontFamily: 'var(--font-barlow), Barlow, sans-serif' }}>
          {platform}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: C.border }} />
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
          const subColor = isGood === true ? '#007a48' : isGood === false ? '#b91c1c' : '#999'
          const subBg = isGood === true ? '#e6fff5' : isGood === false ? '#fee2e2' : 'transparent'
          return (
            <div key={i} style={{ background: C.paper, padding: '18px 20px', minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'var(--font-barlow), Barlow, sans-serif' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', color: C.ink }}>{item.value}</div>
              {item.sub && (
                <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 6, padding: '2px 8px', borderRadius: 4, background: subBg, fontSize: '0.8rem', fontWeight: 600, color: subColor, fontFamily: 'var(--font-barlow), Barlow, sans-serif', whiteSpace: 'nowrap' }}>
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
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
      {rows.map((row, i) => {
        const isTotal = row.label === 'Total sales' || row.label === 'Net sales'
        const p = row.prevValue !== undefined ? pct(row.value, row.prevValue) : undefined
        const up = p !== undefined ? p >= 0 : null
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 24px', borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : 'none', background: isTotal ? C.cream : C.paper }}>
            <div style={{ fontSize: '0.95rem', fontWeight: isTotal ? 800 : 400, fontFamily: 'var(--font-barlow), Barlow, sans-serif', color: C.ink }}>{row.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {p !== undefined && (
                <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: up ? '#e6fff5' : '#fee2e2', color: up ? '#007a48' : '#b91c1c', fontFamily: 'var(--font-barlow), Barlow, sans-serif' }}>
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
  const d = new Date()
  if (offsetDays) d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: tz })
}
function monthStartInTz(tz: string): string {
  const d = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-01`
}

// Default range uses UTC until we know the org timezone (updated after fetch)
const defaultRange: DateRange = {
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA'),
  end: new Date().toLocaleDateString('en-CA'),
  label: 'Month to date',
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [revenueRoasData, setRevenueRoasData] = useState<any[]>([])
  const [spendSalesData, setSpendSalesData] = useState<any[]>([])
  const [roasData, setRoasData] = useState<any[]>([])
  const [channelData, setChannelData] = useState<any[]>([])
  const [pacingData, setPacingData] = useState<any[]>([])
  const [dowData, setDowData] = useState<any[]>([])
  const [cacData, setCacData] = useState<any[]>([])
  const [channels, setChannels] = useState<Record<string, boolean>>({})
  const [trafficData, setTrafficData] = useState<{ users: number; sessions: number; newUsers: number; usersP: number; sessionsP: number; newUsersP: number } | null>(null)
  const [orgName, setOrgName] = useState<string>('your store')
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [estEOM, setEstEOM] = useState<number | null>(null)
  const supabase = createClient()

  useEffect(() => { fetchData() }, [range])

  const fetchData = async () => {
    setLoading(true)
    const orgId = localStorage.getItem('activeOrgId')
    if (!orgId) { setLoading(false); return }

    // Fetch user name for personalized greeting
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser && !userName) {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', authUser.id).single()
      if (prof?.full_name) setUserName(prof.full_name)
    }

    // Fetch org config (channels + timezone)
    const { data: orgData } = await supabase
      .from('organizations').select('channels, timezone, name, shopify_synced_at, ga_property_id').eq('id', orgId).single()
    if (orgData?.name) { setOrgName(orgData.name); document.title = `${orgData.name} Analytics | Attomik` }
    if (orgData?.shopify_synced_at) setLastSynced(orgData.shopify_synced_at)
    const orgTimezone = orgData?.timezone ?? 'America/New_York'
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
    const gaPrev = getPrevPeriod(resolvedRange.start, resolvedRange.end)
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
    const { prevStart, prevEnd } = getPrevPeriod(resolvedRange.start, resolvedRange.end)
    const prevStartISO = toUTC(prevStart, false)
    const prevEndISO   = toUTC(prevEnd, true)
    const sixMonthsAgo = '2020-01-01T00:00:00.000Z' // fetch full history for accurate returning customer calc

    // Paginated fetch to bypass Supabase 1000 row default limit
    const fetchAllOrders = async (gteDate: string, lteDate: string, cols: string) => {
      const size = 1000
      let from = 0, all: any[] = []
      while (true) {
        const { data } = await supabase.from('orders').select(cols)
          .eq('org_id', orgId).gte('created_at', gteDate).lte('created_at', lteDate)
          .range(from, from + size - 1)
        if (!data || data.length === 0) break
        all = all.concat(data)
        if (data.length < size) break
        from += size
      }
      return all
    }

    const orderCols = 'total_price,status,source,customer_email,created_at,units,subtotal,discount_amount,shipping_amount,tax_amount,refunded_amount,is_subscription'
    const orderColsLight = 'total_price,source,customer_email,created_at,units,is_subscription'

    const [cur, prev, curS, prevS, allOrdRaw, allSpRaw] = await Promise.all([
      fetchAllOrders(thisStart, thisEnd, orderCols),
      fetchAllOrders(prevStartISO, prevEndISO, orderCols),
      supabase.from('ad_spend').select('spend,platform,impressions,clicks,conversions,date').eq('org_id', orgId).gte('date', resolvedRange.start).lte('date', resolvedRange.end).limit(5000),
      supabase.from('ad_spend').select('spend,platform,impressions,clicks,conversions').eq('org_id', orgId).gte('date', prevStart).lte('date', prevEnd).limit(5000),
      fetchAllOrders(sixMonthsAgo, new Date().toISOString(), orderColsLight),
      supabase.from('ad_spend').select('spend,date').eq('org_id', orgId).gte('date', sixMonthsAgo.split('T')[0]).limit(5000),
    ])

    const cSpend = curS.data ?? [], pSpend = prevS.data ?? []
    const allOrd = allOrdRaw ?? []
    const allSp = allSpRaw?.data ?? []
    const shopAllC = cur.filter(o => o.source === 'shopify')
    const shopAllP = prev.filter(o => o.source === 'shopify')
    // Exclude fully refunded orders from revenue calculations (match Shopify's gross sales)
    const shopC = shopAllC.filter(o => o.status !== 'refunded')
    const shopP = shopAllP.filter(o => o.status !== 'refunded')
    // But keep all orders for returns calculation
    const shopReturnsC = shopAllC.filter(o => o.status === 'refunded')
    const shopReturnsP = shopAllP.filter(o => o.status === 'refunded')
    const amzC  = cur.filter(o => o.source === 'amazon'),  amzP  = prev.filter(o => o.source === 'amazon')

    // Filter orders by enabled channels for overview metrics
    const enabledOrders = cur.filter(o =>
      (showShopify && o.source === 'shopify') ||
      (showAmazon  && o.source === 'amazon')  ||
      (showShopify && !['shopify','amazon'].includes(o.source)) // fallback for uncategorized
    )
    const enabledOrdersP = prev.filter(o =>
      (showShopify && o.source === 'shopify') ||
      (showAmazon  && o.source === 'amazon')  ||
      (showShopify && !['shopify','amazon'].includes(o.source))
    )
    const totalRevC = enabledOrders.reduce((s, o) => s + Number(o.total_price), 0)
    const totalRevP = enabledOrdersP.reduce((s, o) => s + Number(o.total_price), 0)
    const totalSpC  = cSpend.reduce((s, o) => s + Number(o.spend), 0)
    const totalSpP  = pSpend.reduce((s, o) => s + Number(o.spend), 0)
    const roasC = totalSpC > 0 ? totalRevC / totalSpC : 0
    const roasP = totalSpP > 0 ? totalRevP / totalSpP : 0
    // Order count: for Amazon daily aggregates, use units field; for Shopify, count 1 per row
    const countOrders = (orders: any[]) => orders.reduce((s, o) =>
      s + (o.source === 'amazon' ? (Number(o.units) || 1) : 1), 0)
    const ordC  = countOrders(enabledOrders)
    const ordP  = countOrders(enabledOrdersP)
    const netRevC = enabledOrders.reduce((s, o) => s + Number(o.subtotal || o.total_price || 0), 0)
    const netRevP = enabledOrdersP.reduce((s, o) => s + Number(o.subtotal || o.total_price || 0), 0)
    const aovC  = ordC > 0 ? netRevC / ordC : 0
    const aovP  = ordP > 0 ? netRevP / ordP : 0
    const prevEmails = new Set(enabledOrdersP.map(o => o.customer_email).filter(Boolean))
    const curEmails  = [...new Set(enabledOrders.map(o => o.customer_email).filter(Boolean))]
    const newCustC   = curEmails.filter(e => !prevEmails.has(e)).length
    const newCustP   = [...new Set(prev.map(o => o.customer_email).filter(Boolean))].length
    const cacC = ordC > 0 ? totalSpC / ordC : 0
    const cacP = ordP > 0 ? totalSpP / ordP : 0
    const retCustC   = curEmails.filter(e => prevEmails.has(e)).length
    const totalCustC = curEmails.length
    const rcrC = totalCustC > 0 ? (retCustC / totalCustC) * 100 : 0
    const prevPrevEmails = new Set(cur.map(o => o.customer_email).filter(Boolean))
    const retCustP = [...new Set(prev.map(o => o.customer_email).filter(Boolean))].filter(e => prevPrevEmails.has(e)).length
    const rcrP = newCustP > 0 ? (retCustP / newCustP) * 100 : 0
    const retRevC = enabledOrders.filter(o => o.customer_email && prevEmails.has(o.customer_email)).reduce((s, o) => s + Number(o.total_price), 0)
    const newRevC  = enabledOrders.filter(o => o.customer_email && !prevEmails.has(o.customer_email)).reduce((s, o) => s + Number(o.total_price), 0)

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

    // Monthly subscription data for churn calculation (last 6 months)
    const monthlySubscribers: { month: string; subscribers: number; revenue: number; pctOfRev: number }[] = []
    for (let m = 5; m >= 0; m--) {
      const dt = new Date(); dt.setMonth(dt.getMonth() - m)
      const mStart = new Date(dt.getFullYear(), dt.getMonth(), 1).toISOString()
      const mEnd = new Date(dt.getFullYear(), dt.getMonth() + 1, 0, 23, 59, 59).toISOString()
      const mLabel = new Date(dt.getFullYear(), dt.getMonth(), 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
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

    const days: Record<string, any> = {}
    // Build day keys in org timezone so chart matches KPI dates exactly
    for (let d = new Date(resolvedRange.start + 'T12:00:00'); ; d.setDate(d.getDate() + 1)) {
      const k = d.toLocaleDateString('en-CA', { timeZone: orgTimezone })
      const label = d.toLocaleDateString('en-US', { timeZone: orgTimezone, month: 'short', day: 'numeric' })
      days[k] = { date: label, revenue: 0, shopify: 0, amazon: 0, spend: 0, roas: 0 }
      if (k >= resolvedRange.end) break
    }
    enabledOrders.filter(o => o.status !== 'refunded').forEach(o => {
      const k = utcToOrgDate(o.created_at)
      if (!days[k]) return
      days[k].revenue += Number(o.total_price)
      if (o.source === 'shopify') days[k].shopify += Number(o.total_price)
      if (o.source === 'amazon')  days[k].amazon  += Number(o.total_price)
    })
    cSpend.forEach(s => { if (days[s.date]) days[s.date].spend += Number(s.spend) })
    Object.values(days).forEach((d: any) => { d.roas = d.spend > 0 ? d.revenue / d.spend : 0 })
    const dayArr = Object.values(days) as any[]

    setRevenueRoasData(dayArr.map(d => ({ date: d.date, revenue: d.revenue, roas: d.roas })))
    setSpendSalesData(dayArr.map(d => ({ date: d.date, revenue: d.revenue, spend: d.spend })))
    setRoasData(dayArr.filter(d => d.roas > 0).map(d => ({ date: d.date, roas: d.roas })))
    setChannelData(dayArr.map(d => ({ date: d.date, shopify: showShopify ? d.shopify : 0, amazon: showAmazon ? d.amazon : 0 })))

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
      monthMap[key].orders += 1
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
      const wOrdCount = wOrds.reduce((s, o) => s + (Number(o.units) || 1), 0)

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
      const d = new Date()
      d.setMonth(d.getMonth() - m)
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const mStartISO = mStart.toISOString()
      const mEndISO = mEnd.toISOString()
      const mLabel = mStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

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

    setData({ showShopify, showAmazon, showMeta, showGoogle, showAds,
      totalRevC, totalRevP, totalSpC, totalSpP, roasC, roasP,
      ordC, ordP, aovC: finalAovC, aovP: finalAovP, cacC, cacP,
      newCustC, newCustP, retCustC, totalCustC, rcrC, rcrP, retRevC, newRevC, cltvC, cltvP,
      shGrossC, shGrossP, shDiscountC, shDiscountP, shReturnsC, shReturnsP,
      shNetC, shNetP, shShippingC, shShippingP, shTaxC, shTaxP, shTotalC, shTotalP,
      shOrdC, shOrdP, shCustC, shCustP, shAovC, shAovP,
      shRetCustC, shRetCustP, shRcrC, shRcrP, shRoasC, shRoasP,
      shDiscRateC, shDiscRateP, shRefRateC, shRefRateP,
      amzRevC, amzRevP, amzUnitC, amzUnitP, amzDaysC: amzC.length, amzDaysP: amzP.length, amzAovC, amzAovP,
      metaSpC, metaSpP, metaImprC, metaImprP, metaClkC, metaClkP, metaConvC, metaConvP, metaRoasC, metaRoasP,
      weekRevs, weekSpend, weekOrders, weekCac, weekAov, weekRoas, weekNewCusts, weekRetCusts, weekRetRate,
      monthlyRetention,
      subRevC, subRevP, subCountC, subCountP, subCustsC, subCustsP, subPctRevC, subPctRevP, monthlySubscribers,
    })
    setLoading(false)
  }

  const d = data
  const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const dayCount = Math.round((new Date(range.end).getTime() - new Date(range.start).getTime()) / 864e5) + 1
  const { prevStart, prevEnd: prevEndLabel } = getPrevPeriod(range.start, range.end)
  const prevLabel = `${fmtDate(prevStart)} – ${fmtDate(prevEndLabel)}`

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>
      {/* Sticky topbar */}
      <div className="analytics-topbar" style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'sticky', top: 0, background: C.paper, zIndex: 50 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: 'clamp(1.1rem, 4vw, 2rem)', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'var(--font-barlow), Barlow, sans-serif', color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{orgName} — Analytics</h1>
          <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2, fontFamily: 'var(--font-barlow), Barlow, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {fmtDate(range.start)} – {fmtDate(range.end)} · vs previous {dayCount} days
            {lastSynced && <span style={{ color: '#ccc' }}> · Synced {new Date(lastSynced).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <DateRangePicker value={range} onChange={r => setRange(r)} />
        </div>
      </div>

      <div className="analytics-content" style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 80px' }}>
        {loading ? (
          <div style={{ color: C.muted, textAlign: 'center', padding: '80px 0', fontFamily: 'var(--font-barlow), Barlow, sans-serif', fontSize: '1rem' }}>Loading analytics…</div>
        ) : !d ? (
          <div style={{ color: C.muted, textAlign: 'center', padding: '80px 0', fontFamily: 'var(--font-barlow), Barlow, sans-serif', fontSize: '1rem' }}>No data yet. Upload a CSV to get started.</div>
        ) : (<>

          {/* ── AI INSIGHTS ── */}
          <AIInsights
            period={`${fmtDate(range.start)} – ${fmtDate(range.end)}`}
            preset={range.label ?? 'custom'}
            orgName={orgName}
            metrics={{
              totalRev: fmt$(d.totalRevC), totalRevP: fmt$(d.totalRevP), totalRevChg: pct(d.totalRevC, d.totalRevP).toFixed(1),
              totalSp: fmt$(d.totalSpC), totalSpChg: pct(d.totalSpC, d.totalSpP).toFixed(1),
              roas: d.roasC.toFixed(2), roasP: d.roasP.toFixed(2),
              orders: d.ordC, ordersChg: pct(d.ordC, d.ordP).toFixed(1),
              aov: fmt$(d.aovC), aovChg: pct(d.aovC, d.aovP).toFixed(1),
              cac: fmt$(d.cacC), cacChg: pct(d.cacC, d.cacP).toFixed(1),
              newCust: d.newCustC, retCust: d.retCustC,
              retRate: d.shRcrC.toFixed(1),
              // Channel breakdown
              shopifyRev: d.showShopify ? fmt$(d.shTotalC) : null,
              shopifyRevP: d.showShopify ? fmt$(d.shTotalP) : null,
              shopifyRevChg: d.shTotalP > 0 ? pct(d.shTotalC, d.shTotalP).toFixed(1) : null,
              shopifyPctOfTotal: d.totalRevC > 0 ? (d.shTotalC / d.totalRevC * 100).toFixed(1) : null,
              shopifyGross: d.showShopify ? fmt$(d.shGrossC) : null,
              shopifyNet: d.showShopify ? fmt$(d.shNetC) : null,
              shopifyOrders: d.shOrdC,
              shopifyCust: d.shCustC,
              shopifyAov: fmt$(d.shAovC),
              shopifyRoas: d.shRoasC > 0 ? d.shRoasC.toFixed(2) : null,
              discountRate: d.shDiscRateC.toFixed(1),
              refundRate: d.shRefRateC.toFixed(1),
              // Amazon
              amazonRev: d.showAmazon && d.amzRevC > 0 ? fmt$(d.amzRevC) : null,
              amazonRevP: d.showAmazon && d.amzRevP > 0 ? fmt$(d.amzRevP) : null,
              amazonRevChg: d.amzRevP > 0 ? pct(d.amzRevC, d.amzRevP).toFixed(1) : null,
              amazonPctOfTotal: d.totalRevC > 0 && d.amzRevC > 0 ? (d.amzRevC / d.totalRevC * 100).toFixed(1) : null,
              amazonUnits: d.amzUnitC,
              amazonAov: d.amzAovC > 0 ? fmt$(d.amzAovC) : null,
              // Ad Spend detail
              metaSp: d.showMeta ? fmt$(d.metaSpC) : null,
              metaSpChg: d.metaSpP > 0 ? pct(d.metaSpC, d.metaSpP).toFixed(1) : null,
              metaRoas: d.metaRoasC > 0 ? d.metaRoasC.toFixed(2) : null,
              metaImpr: d.metaImprC, metaClicks: d.metaClkC, metaConv: d.metaConvC,
              // CLTV
              cltv: d.cltvC > 0 ? fmt$(d.cltvC) : null,
              cltvP: d.cltvP > 0 ? fmt$(d.cltvP) : null,
              cltvChg: d.cltvP > 0 ? pct(d.cltvC, d.cltvP).toFixed(1) : null,
              cltvCacRatio: d.cltvC > 0 && d.cacC > 0 ? (d.cltvC / d.cacC).toFixed(2) : null,
              // Subscriptions
              subRev: d.subRevC > 0 ? fmt$(d.subRevC) : null,
              subRevChg: d.subRevP > 0 ? pct(d.subRevC, d.subRevP).toFixed(1) : null,
              subOrders: d.subCountC,
              subOrdersChg: d.subCountP > 0 ? pct(d.subCountC, d.subCountP).toFixed(1) : null,
              subCusts: d.subCustsC,
              subPctRev: d.subPctRevC > 0 ? d.subPctRevC.toFixed(1) : null,
            }}
          />

          <AskAttomik
            userName={userName}
            orgName={orgName}
            period={`${fmtDate(range.start)} – ${fmtDate(range.end)}`}
            metrics={{
              totalRev: fmt$(d.totalRevC), totalRevChg: pct(d.totalRevC, d.totalRevP).toFixed(1),
              totalSp: fmt$(d.totalSpC), totalSpChg: pct(d.totalSpC, d.totalSpP).toFixed(1),
              roas: d.roasC.toFixed(2), roasP: d.roasP.toFixed(2),
              orders: d.ordC, ordersChg: pct(d.ordC, d.ordP).toFixed(1),
              aov: fmt$(d.aovC), aovChg: pct(d.aovC, d.aovP).toFixed(1),
              cac: fmt$(d.cacC), cacChg: pct(d.cacC, d.cacP).toFixed(1),
              newCust: d.newCustC, retCust: d.retCustC, retRate: d.shRcrC.toFixed(1),
              shopifyRev: d.showShopify ? fmt$(d.shTotalC) : null,
              shopifyPctOfTotal: d.totalRevC > 0 ? (d.shTotalC / d.totalRevC * 100).toFixed(1) : null,
              shopifyRevChg: d.shTotalP > 0 ? pct(d.shTotalC, d.shTotalP).toFixed(1) : null,
              shopifyOrders: d.shOrdC, shopifyCust: d.shCustC, shopifyAov: fmt$(d.shAovC),
              discountRate: d.shDiscRateC.toFixed(1), refundRate: d.shRefRateC.toFixed(1),
              amazonRev: d.amzRevC > 0 ? fmt$(d.amzRevC) : null,
              amazonPctOfTotal: d.totalRevC > 0 && d.amzRevC > 0 ? (d.amzRevC / d.totalRevC * 100).toFixed(1) : null,
              amazonRevChg: d.amzRevP > 0 ? pct(d.amzRevC, d.amzRevP).toFixed(1) : null,
              cltv: d.cltvC > 0 ? fmt$(d.cltvC) : null,
              cltvChg: d.cltvP > 0 ? pct(d.cltvC, d.cltvP).toFixed(1) : null,
              cltvCacRatio: d.cltvC > 0 && d.cacC > 0 ? (d.cltvC / d.cacC).toFixed(2) : null,
              metaSp: d.showMeta ? fmt$(d.metaSpC) : null,
              metaRoas: d.metaRoasC > 0 ? d.metaRoasC.toFixed(2) : null,
              metaImpr: d.metaImprC, metaClicks: d.metaClkC, metaConv: d.metaConvC,
              trafficSessions: trafficData?.sessions ?? null,
              trafficSessionsP: trafficData?.sessionsP ?? null,
              trafficUsers: trafficData?.users ?? null,
              trafficUsersP: trafficData?.usersP ?? null,
              trafficNewUsers: trafficData?.newUsers ?? null,
              trafficNewUsersP: trafficData?.newUsersP ?? null,
              convRateSessions: trafficData && trafficData.sessions > 0 ? (d.ordC / trafficData.sessions * 100).toFixed(2) : null,
              convRateUsers: trafficData && trafficData.users > 0 ? (d.ordC / trafficData.users * 100).toFixed(2) : null,
              convRateNewUsers: trafficData && trafficData.newUsers > 0 ? (d.ordC / trafficData.newUsers * 100).toFixed(2) : null,
              // Subscriptions
              subRev: d.subRevC > 0 ? fmt$(d.subRevC) : null,
              subRevChg: d.subRevP > 0 ? pct(d.subRevC, d.subRevP).toFixed(1) : null,
              subOrders: d.subCountC,
              subCusts: d.subCustsC,
              subPctRev: d.subPctRevC > 0 ? d.subPctRevC.toFixed(1) : null,
            }}
          />

          {/* ── OVERVIEW KPIs ── */}
          <SectionHeader title="Overview" />
          <div className="kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <KpiCard label="Total Sales"    value={fmt$(d.totalRevC)} change={pct(d.totalRevC, d.totalRevP)} />
            <KpiCard label="Total Ad Spend" value={fmt$(d.totalSpC)}  change={pct(d.totalSpC, d.totalSpP)} invertColors />
            <KpiCard label="ROAS"           value={fmtX(d.roasC)}     change={pct(d.roasC, d.roasP)} />
          </div>
          <div className="kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <KpiCard label="Orders" value={fmtN(d.ordC)} change={pct(d.ordC, d.ordP)} />
            <KpiCard label="CAC"    value={d.cacC > 0 ? fmt$(d.cacC) : '—'} change={d.cacP > 0 ? pct(d.cacC, d.cacP) : undefined} invertColors />
            <KpiCard label="AOV"    value={fmt$(d.aovC)} change={pct(d.aovC, d.aovP)} />
          </div>

          {/* ── CLTV & CLTV/CAC ── */}
          {d.cltvC > 0 && (
            <div className="kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
              <KpiCard label="CLTV" value={fmt$(d.cltvC)} change={d.cltvP > 0 ? pct(d.cltvC, d.cltvP) : undefined} subtitle="Shopify · ACL (2) × AOV × Freq" />
              {d.cacC > 0 && <KpiCard label="CLTV / CAC" value={`${(d.cltvC / d.cacC).toFixed(2)}x`} change={d.cltvP > 0 && d.cacP > 0 ? pct(d.cltvC / d.cacC, d.cltvP / d.cacP) : undefined} />}
            </div>
          )}

          {/* ── SALES BY CHANNEL ── */}
          {(d.shTotalC > 0 || d.amzRevC > 0) && (() => {
            const shPctC = d.totalRevC > 0 ? (d.shTotalC / d.totalRevC * 100) : 0
            const shPctP = d.totalRevP > 0 ? (d.shTotalP / d.totalRevP * 100) : 0
            const amzPctC = d.totalRevC > 0 ? (d.amzRevC / d.totalRevC * 100) : 0
            const amzPctP = d.totalRevP > 0 ? (d.amzRevP / d.totalRevP * 100) : 0
            return (
              <MetricRow items={[
                ...(d.shTotalC > 0 ? [{
                  label: 'Shopify',
                  value: fmt$(d.shTotalC),
                  sub: d.shTotalP > 0 ? chg(d.shTotalC, d.shTotalP) : '',
                }] : []),
                ...(d.shTotalC > 0 && d.totalRevC > 0 ? [{
                  label: 'Shopify % of Total',
                  value: `${shPctC.toFixed(1)}%`,
                  sub: shPctP > 0 ? chg(shPctC, shPctP) : '',
                }] : []),
                ...(d.amzRevC > 0 ? [{
                  label: 'Amazon',
                  value: fmt$(d.amzRevC),
                  sub: d.amzRevP > 0 ? chg(d.amzRevC, d.amzRevP) : '',
                }] : []),
                ...(d.amzRevC > 0 && d.totalRevC > 0 ? [{
                  label: 'Amazon % of Total',
                  value: `${amzPctC.toFixed(1)}%`,
                  sub: amzPctP > 0 ? chg(amzPctC, amzPctP) : '',
                }] : []),
              ]} />
            )
          })()}

          {/* ── PERFORMANCE ── */}
          <SectionHeader title="Performance" />

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

          {/* ── DAY OF WEEK ── */}
          <div style={{ marginBottom: 32 }}>
            <ChartCard title="Revenue by Day of Week" subtitle="Average daily revenue — darker = higher">
              <DayOfWeekHeatmap data={dowData} />
            </ChartCard>
          </div>

          {/* ── CUSTOMER REVENUE ── */}
          <SectionHeader title="Customer Revenue" />
          <div className="kpi-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <KpiCard label="New Customer Rev."       value={fmt$(d.newRevC)} subtitle={d.totalRevC > 0 ? `${((d.newRevC/d.totalRevC)*100).toFixed(1)}% of total` : ''} />
            <KpiCard label="Returning Customer Rev." value={fmt$(d.retRevC)} subtitle={d.totalRevC > 0 ? `${((d.retRevC/d.totalRevC)*100).toFixed(1)}% of total` : ''} />
            <KpiCard label="Returning Customer Rate"             value={fmtPct(d.shRcrC)} change={pct(d.shRcrC, d.shRcrP)} />
            <KpiCard label="CAC"                     value={d.cacC > 0 ? fmt$(d.cacC) : '—'} change={d.cacP > 0 ? pct(d.cacC, d.cacP) : undefined} invertColors />
          </div>
          {d.monthlyRetention?.length > 0 && (<>
            <ChartCard title="Customer Retention" subtitle="Returning (green) vs New (gray) customers · Return rate line · Last 6 months">
              <RetentionChart data={d.monthlyRetention} />
            </ChartCard>
            <div style={{ marginTop: 16 }}>
              <ChartCard title="Returning Customers Growth" subtitle="Number of returning customers per month · Last 6 months">
                <div style={{ width: '100%', height: 180 }}>
                  <ReturnGrowthChart data={d.monthlyRetention} />
                </div>
              </ChartCard>
            </div>
          </>)}
          <div style={{ marginBottom: 32 }} />

          {/* ── TRAFFIC (GA4) ── */}
          {trafficData && (
            <>
              <SectionHeader title="Traffic" color="#4285f4" platform="google analytics" />
              <MetricRow items={[
                { label: 'Sessions', value: fmtN(trafficData.sessions), sub: trafficData.sessionsP > 0 ? chg(trafficData.sessions, trafficData.sessionsP) : '' },
                { label: 'Users', value: fmtN(trafficData.users), sub: trafficData.usersP > 0 ? chg(trafficData.users, trafficData.usersP) : '' },
                { label: 'New Users', value: fmtN(trafficData.newUsers), sub: trafficData.newUsersP > 0 ? chg(trafficData.newUsers, trafficData.newUsersP) : '' },
              ]} />
              <MetricRow items={[
                ...(trafficData.sessions > 0 ? [{ label: 'Conv. Rate (Sessions)', value: fmtPct(d.ordC / trafficData.sessions * 100), sub: trafficData.sessionsP > 0 && d.ordP > 0 ? chg(d.ordC / trafficData.sessions * 100, d.ordP / trafficData.sessionsP * 100) : '', desc: 'Orders ÷ Sessions' }] : []),
                ...(trafficData.users > 0 ? [{ label: 'Conv. Rate (Users)', value: fmtPct(d.ordC / trafficData.users * 100), sub: trafficData.usersP > 0 && d.ordP > 0 ? chg(d.ordC / trafficData.users * 100, d.ordP / trafficData.usersP * 100) : '', desc: 'Orders ÷ Users' }] : []),
                ...(trafficData.newUsers > 0 ? [{ label: 'Conv. Rate (New Users)', value: fmtPct(d.ordC / trafficData.newUsers * 100), sub: trafficData.newUsersP > 0 && d.ordP > 0 ? chg(d.ordC / trafficData.newUsers * 100, d.ordP / trafficData.newUsersP * 100) : '', desc: 'Orders ÷ New Users' }] : []),
              ]} />
            </>
          )}

          {/* ── SHOPIFY ── */}
          {d.showShopify && <SectionHeader title="Shopify" color="#96bf48" platform="shopify" />}
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
          <SectionHeader title="Subscriptions" color="#7c3aed" platform="paywhirl" />
          <MetricRow items={[
            { label: 'Sub. Revenue', value: fmt$(d.subRevC), sub: d.subRevP > 0 ? chg(d.subRevC, d.subRevP) : '' },
            { label: '% of Total Revenue', value: fmtPct(d.subPctRevC), sub: d.subPctRevP > 0 ? chg(d.subPctRevC, d.subPctRevP) : '' },
            { label: 'Sub. Orders', value: fmtN(d.subCountC), sub: d.subCountP > 0 ? chg(d.subCountC, d.subCountP) : '' },
            { label: 'Subscribers', value: fmtN(d.subCustsC), sub: d.subCustsP > 0 ? chg(d.subCustsC, d.subCustsP) : '' },
          ]} />
          </> }

          {/* ── AMAZON ── */}
          {d.showAmazon && <SectionHeader title="Amazon" color="#00cc78" platform="amazon" />}
          {d.showAmazon && <>
          <MetricRow items={[
            { label: 'Gross Sales',       value: fmt$(d.amzRevC),  sub: chg(d.amzRevC, d.amzRevP) },
            { label: 'Total Order Items', value: fmtN(d.amzUnitC), sub: chg(d.amzUnitC, d.amzUnitP) },
            { label: 'Days Reported',     value: fmtN(d.amzDaysC) },
            { label: 'AOV',           value: fmt$(d.amzAovC),  sub: chg(d.amzAovC, d.amzAovP) },
          ]} />

          </> }

          {/* ── AD SPEND ── */}
          {d.showAds && <SectionHeader title="Ad Spend" color="#000" />}
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
          <SectionHeader title="Scoreboard" />
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
          .analytics-content { padding-top: 80px !important; }
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
