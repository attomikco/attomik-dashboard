'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangePicker, { DateRange } from '@/components/DateRangePicker'
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import AIInsights from '@/components/AIInsights'

function pct(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return ((cur - prev) / prev) * 100
}
function PctPill({ cur, prev, invertColors }: { cur: number; prev: number; invertColors?: boolean }) {
  if (prev === 0) return null
  const p = pct(cur, prev)
  const isUp = p >= 0
  const isGood = invertColors ? !isUp : isUp
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 6,
      padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 700,
      fontFamily: 'Barlow, sans-serif',
      background: isGood ? '#e6fff5' : '#fee2e2',
      color: isGood ? '#007a48' : '#b91c1c',
    }}>
      {isUp ? '↑' : '↓'} {Math.abs(p).toFixed(1)}%
    </span>
  )
}

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n/1_000).toFixed(2)}k`
  return `$${n.toFixed(2)}`
}
function fmtN(n: number) { return n >= 1_000 ? `${(n/1_000).toFixed(1)}k` : n.toLocaleString() }
function fmtX(n: number) { return n > 0 ? `${n.toFixed(2)}x` : '—' }
function fmtPct(n: number) { return n > 0 ? `${n.toFixed(2)}%` : '—' }
function fmt2(n: number) { return n > 0 ? `$${n.toFixed(2)}` : '—' }

const defaultRange: DateRange = {
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  end: new Date().toISOString().split('T')[0],
  label: 'Month to date',
}

const TH: React.CSSProperties = {
  padding: '10px 14px', background: '#f2f2f2', fontSize: '0.72rem',
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: '#666', whiteSpace: 'nowrap', fontFamily: 'Barlow, sans-serif',
  borderBottom: '1px solid #e0e0e0', userSelect: 'none',
}
const TD: React.CSSProperties = {
  padding: '11px 14px', fontSize: '0.875rem', fontFamily: 'Barlow, sans-serif',
  borderBottom: '1px solid #f2f2f2', verticalAlign: 'middle',
}
const MONO: React.CSSProperties = { fontFamily: 'DM Mono, monospace', fontSize: '0.82rem' }

interface AdRow {
  campaign_name: string; adset_name: string | null; ad_name: string | null
  spend: number; impressions: number; reach: number; clicks: number
  conversions: number; conversion_value: number; cpc: number; cpm: number; ctr: number
  date: string
}

interface Aggregated {
  name: string; spend: number; impressions: number; reach: number
  clicks: number; conversions: number; conversionValue: number
  roas: number; cpc: number; cpm: number; ctr: number
  isActive: boolean; lastSeen: string
  children?: Record<string, Aggregated>
  ads?: Aggregated[]
}

type SortKey = 'spend' | 'impressions' | 'clicks' | 'conversions' | 'conversionValue' | 'roas' | 'cpc' | 'cpm' | 'ctr' | 'reach'
type SortDir = 'asc' | 'desc'

function aggregate(rows: AdRow[], today: string, activeThreshold: string): Record<string, Aggregated> {
  const campaigns: Record<string, Aggregated> = {}
  rows.forEach(row => {
    const c = row.campaign_name
    const a = row.adset_name ?? 'Unknown Ad Set'
    const ad = row.ad_name ?? 'Unknown Ad'
    if (!campaigns[c]) campaigns[c] = { name: c, spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, conversionValue: 0, roas: 0, cpc: 0, cpm: 0, ctr: 0, isActive: false, lastSeen: '', children: {} }
    campaigns[c].spend += row.spend; campaigns[c].impressions += row.impressions
    campaigns[c].reach += row.reach; campaigns[c].clicks += row.clicks
    campaigns[c].conversions += row.conversions; campaigns[c].conversionValue += row.conversion_value
    if (row.date > campaigns[c].lastSeen) campaigns[c].lastSeen = row.date

    const adsets = campaigns[c].children!
    if (!adsets[a]) adsets[a] = { name: a, spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, conversionValue: 0, roas: 0, cpc: 0, cpm: 0, ctr: 0, isActive: false, lastSeen: '', ads: [] }
    adsets[a].spend += row.spend; adsets[a].impressions += row.impressions
    adsets[a].reach += row.reach; adsets[a].clicks += row.clicks
    adsets[a].conversions += row.conversions; adsets[a].conversionValue += row.conversion_value
    if (row.date > adsets[a].lastSeen) adsets[a].lastSeen = row.date

    adsets[a].ads!.push({ name: ad, spend: row.spend, impressions: row.impressions, reach: row.reach, clicks: row.clicks, conversions: row.conversions, conversionValue: row.conversion_value, roas: 0, cpc: 0, cpm: 0, ctr: 0, isActive: false, lastSeen: row.date })
  })

  const calc = (x: Aggregated) => {
    x.roas = x.spend > 0 ? x.conversionValue / x.spend : 0
    x.cpc  = x.clicks > 0 ? x.spend / x.clicks : 0
    x.cpm  = x.impressions > 0 ? (x.spend / x.impressions) * 1000 : 0
    x.ctr  = x.impressions > 0 ? (x.clicks / x.impressions) * 100 : 0
    x.isActive = x.lastSeen >= activeThreshold
  }

  Object.values(campaigns).forEach(camp => {
    calc(camp)
    Object.values(camp.children!).forEach(adset => {
      calc(adset)
      const adMap: Record<string, Aggregated> = {}
      adset.ads!.forEach(ad => {
        if (!adMap[ad.name]) adMap[ad.name] = { ...ad, spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, conversionValue: 0, roas: 0, cpc: 0, cpm: 0, ctr: 0, isActive: false, lastSeen: '' }
        adMap[ad.name].spend += ad.spend; adMap[ad.name].impressions += ad.impressions
        adMap[ad.name].reach += ad.reach; adMap[ad.name].clicks += ad.clicks
        adMap[ad.name].conversions += ad.conversions; adMap[ad.name].conversionValue += ad.conversionValue
        if (ad.lastSeen > adMap[ad.name].lastSeen) adMap[ad.name].lastSeen = ad.lastSeen
      })
      adset.ads = Object.values(adMap).map(ad => { calc(ad); return ad }).sort((a, b) => b.spend - a.spend)
    })
  })
  return campaigns
}

function RoasBadge({ roas }: { roas: number }) {
  if (roas === 0) return <span style={{ color: '#999', ...MONO }}>—</span>
  const color = roas >= 2 ? '#007a48' : roas >= 1 ? '#856404' : '#b91c1c'
  const bg = roas >= 2 ? '#e6fff5' : roas >= 1 ? '#fffbeb' : '#fee2e2'
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 4, fontWeight: 700, ...MONO }}>{fmtX(roas)}</span>
}

function ActiveBadge({ isActive, lastSeen }: { isActive: boolean; lastSeen: string }) {
  return (
    <span title={`Last seen: ${lastSeen}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
      borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, fontFamily: 'Barlow, sans-serif',
      background: isActive ? '#e6fff5' : '#f2f2f2',
      color: isActive ? '#007a48' : '#999',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#00cc78' : '#ccc', display: 'inline-block' }} />
      {isActive ? 'Active' : 'Paused'}
    </span>
  )
}

function SortTH({ label, sortKey, currentSort, currentDir, onSort, align = 'right' }: {
  label: string; sortKey: SortKey; currentSort: SortKey; currentDir: SortDir; onSort: (k: SortKey) => void; align?: string
}) {
  const active = currentSort === sortKey
  return (
    <th onClick={() => onSort(sortKey)} style={{ ...TH, textAlign: align as any, cursor: 'pointer', color: active ? '#000' : '#666', background: active ? '#e8e8e8' : '#f2f2f2' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        {label}
        {active ? (currentDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={10} style={{ opacity: 0.3 }} />}
      </div>
    </th>
  )
}

function MetricCells({ row }: { row: Aggregated }) {
  return (
    <>
      <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmt$(row.spend)}</td>
      <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmtN(row.impressions)}</td>
      <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmtN(row.clicks)}</td>
      <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmtPct(row.ctr)}</td>
      <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmt2(row.cpc)}</td>
      <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmtN(row.conversions)}</td>
      <td style={{ ...TD, ...MONO, textAlign: 'right' }}>{fmt$(row.conversionValue)}</td>
      <td style={{ ...TD, textAlign: 'right' }}><RoasBadge roas={row.roas} /></td>
    </>
  )
}

const SORT_COLS: { label: string; key: SortKey }[] = [
  { label: 'Spend', key: 'spend' },
  { label: 'Impressions', key: 'impressions' },
  { label: 'Clicks', key: 'clicks' },
  { label: 'CTR', key: 'ctr' },
  { label: 'CPC', key: 'cpc' },
  { label: 'Purchases', key: 'conversions' },
  { label: 'Conv. Value', key: 'conversionValue' },
  { label: 'ROAS', key: 'roas' },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#000', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.dataKey === 'roas' ? '#00ff97' : '#fff', fontFamily: 'Barlow, sans-serif', fontWeight: 600 }}>
          {p.dataKey === 'spend' ? fmt$(p.value) : p.dataKey === 'roas' ? fmtX(p.value) : fmtN(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function MetaAdsPage() {
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<Record<string, Aggregated>>({})
  const [expandedCamps, setExpandedCamps] = useState<Set<string>>(new Set())
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'paused'>('all')
  const [dailyData, setDailyData] = useState<any[]>([])
  const [orgName, setOrgName] = useState<string>('this account')
  const [prevMetaData, setPrevMetaData] = useState<any>({})
  const supabase = createClient()

  useEffect(() => { fetchData() }, [range])

  const fetchData = async () => {
    setLoading(true)
    const orgId = localStorage.getItem('activeOrgId')
    if (!orgId) { setLoading(false); return }

    const { data: orgData } = await supabase.from('organizations').select('name').eq('id', orgId).single()
    if (orgData?.name) setOrgName(orgData.name)

    // Calc prev period dates
    const dayCount = Math.round((new Date(range.end).getTime() - new Date(range.start).getTime()) / 864e5) + 1
    const prevEnd = new Date(new Date(range.start).getTime() - 864e5).toISOString().split('T')[0]
    const prevStart = new Date(new Date(prevEnd).getTime() - (dayCount - 1) * 864e5).toISOString().split('T')[0]

    const [{ data }, { data: prevData }] = await Promise.all([
      supabase.from('ad_spend').select('campaign_name, adset_name, ad_name, spend, impressions, reach, clicks, conversions, conversion_value, cpc, cpm, ctr, date')
        .eq('org_id', orgId).eq('platform', 'meta').gte('date', range.start).lte('date', range.end),
      supabase.from('ad_spend').select('spend, clicks, conversions, conversion_value, impressions')
        .eq('org_id', orgId).eq('platform', 'meta').gte('date', prevStart).lte('date', prevEnd),
    ])

    const rows = (data ?? []) as AdRow[]
    const prevRows = prevData ?? []
    const prevTotals = prevRows.reduce((acc: any, r: any) => ({
      spend: acc.spend + Number(r.spend),
      clicks: acc.clicks + Number(r.clicks),
      conversions: acc.conversions + Number(r.conversions),
      convVal: acc.convVal + Number(r.conversion_value),
      impressions: acc.impressions + Number(r.impressions),
    }), { spend: 0, clicks: 0, conversions: 0, convVal: 0, impressions: 0 })
    const prevRoas = prevTotals.spend > 0 ? prevTotals.convVal / prevTotals.spend : 0
    const prevCpc = prevMetaData.cpc ?? 0
    const prevCtr = prevMetaData.ctr ?? 0
    setPrevMetaData({ ...prevTotals, roas: prevRoas, cpc: prevCpc, ctr: prevCtr })

    // Active = had spend in last 3 days of the range
    const dates = rows.map(r => r.date).sort()
    const lastDate = dates[dates.length - 1] ?? range.end
    const activeThreshold = new Date(new Date(lastDate).getTime() - 3 * 864e5).toISOString().split('T')[0]

    setCampaigns(aggregate(rows, range.end, activeThreshold))

    // Daily chart data
    const dayMap: Record<string, { spend: number; clicks: number; conversions: number; roas: number; convVal: number }> = {}
    rows.forEach(r => {
      if (!dayMap[r.date]) dayMap[r.date] = { spend: 0, clicks: 0, conversions: 0, roas: 0, convVal: 0 }
      dayMap[r.date].spend += r.spend
      dayMap[r.date].clicks += r.clicks
      dayMap[r.date].conversions += r.conversions
      dayMap[r.date].convVal += r.conversion_value
    })
    const daily = Object.entries(dayMap).sort(([a],[b]) => a.localeCompare(b)).map(([date, v]) => ({
      date: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      spend: Math.round(v.spend * 100) / 100,
      clicks: v.clicks,
      roas: v.spend > 0 ? Math.round((v.convVal / v.spend) * 100) / 100 : 0,
    }))
    setDailyData(daily)
    setLoading(false)
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortedCampaigns = Object.values(campaigns)
    .filter(c => filterActive === 'all' || (filterActive === 'active' ? c.isActive : !c.isActive))
    .sort((a, b) => sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey])

  const totals = Object.values(campaigns).reduce((acc, c) => ({
    spend: acc.spend + c.spend, impressions: acc.impressions + c.impressions,
    clicks: acc.clicks + c.clicks, conversions: acc.conversions + c.conversions,
    conversionValue: acc.conversionValue + c.conversionValue, reach: acc.reach + c.reach,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0, reach: 0 })
  const totalRoas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0
  const totalCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  const totalCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const activeCampaigns = Object.values(campaigns).filter(c => c.isActive).length

  const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const dayCount = Math.round((new Date(range.end).getTime() - new Date(range.start).getTime()) / 864e5) + 1

  return (
    <div>
      {/* Topbar */}
      <div style={{ padding: '20px 40px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 50 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'var(--font-barlow), Barlow, sans-serif', color: '#000' }}>{orgName} — Meta Ads</h1>
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: 2, fontFamily: 'Barlow, sans-serif' }}>
            {fmtDate(range.start)} – {fmtDate(range.end)} · vs previous {dayCount} days
          </p>
        </div>
        <DateRangePicker value={range} onChange={r => setRange(r)} />
      </div>

      <div style={{ padding: '28px 40px 64px', minWidth: 0, overflowX: 'hidden' }}>
        {loading ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '80px 0', fontFamily: 'Barlow, sans-serif' }}>Loading…</div>
        ) : Object.keys(campaigns).length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '80px 0', fontFamily: 'Barlow, sans-serif' }}>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>No Meta Ads data for this period</p>
            <p style={{ fontSize: '0.875rem' }}>Upload a Meta CSV with Day breakdown from the Import page.</p>
          </div>
        ) : (
          <>
            {/* AI Insights */}
            <div style={{ marginBottom: 24 }}>
              <AIInsights
                period={`${fmtDate(range.start)} – ${fmtDate(range.end)}`}
                preset={range.label ?? 'custom'}
                orgName={orgName}
                metrics={{
                  totalRev: fmt$(totals.conversionValue),
                  totalRevP: '—', totalRevChg: '0',
                  totalSp: fmt$(totals.spend), totalSpChg: '0',
                  roas: fmtX(totalRoas), roasP: '—',
                  orders: totals.conversions, ordersChg: '0',
                  aov: fmt$(totals.conversions > 0 ? totals.conversionValue / totals.conversions : 0), aovChg: '0',
                  cac: fmt$(totalCpc), cacChg: '0',
                  newCust: totals.clicks, retCust: 0,
                  retRate: '0',
                  shopifyGross: null, shopifyNet: null, discountRate: '0',
                  metaSp: fmt$(totals.spend),
                  metaConv: totals.conversions,
                  impressions: fmtN(totals.impressions),
                  ctr: fmtPct(totalCtr),
                  cpc: fmt2(totalCpc),
                  cpm: fmt2(totalCpm),
                  activeCampaigns,
                  totalCampaigns: Object.keys(campaigns).length,
                  topCampaign: sortedCampaigns[0]?.name ?? '—',
                  topCampaignRoas: fmtX(sortedCampaigns[0]?.roas ?? 0),
                  topCampaignSpend: fmt$(sortedCampaigns[0]?.spend ?? 0),
                  prevSpend: fmt$(prevMetaData.spend ?? 0),
                  prevRoas: fmtX(prevMetaData.roas ?? 0),
                  prevConversions: prevMetaData.conversions ?? 0,
                  prevCpc: fmt2(prevMetaData.cpc ?? 0),
                  prevCtr: fmtPct(prevMetaData.ctr ?? 0),
                  roasTrend: prevMetaData.roas > 0 ? (((totalRoas - prevMetaData.roas) / prevMetaData.roas) * 100).toFixed(1) : null,
                  spendTrend: prevMetaData.spend > 0 ? (((totals.spend - prevMetaData.spend) / prevMetaData.spend) * 100).toFixed(1) : null,
                  convTrend: prevMetaData.conversions > 0 ? (((totals.conversions - prevMetaData.conversions) / prevMetaData.conversions) * 100).toFixed(1) : null,
                }}
                platform="meta"
              />
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'Total Spend',  value: fmt$(totals.spend),          cur: totals.spend,           prev: prevMetaData.spend ?? 0,                invertColors: true },
                { label: 'Impressions',  value: fmtN(totals.impressions),    cur: totals.impressions,     prev: prevMetaData.impressions ?? 0 },
                { label: 'Reach',        value: fmtN(totals.reach),          cur: totals.reach,           prev: prevMetaData.reach ?? 0 },
                { label: 'Clicks',       value: fmtN(totals.clicks),         cur: totals.clicks,          prev: prevMetaData.clicks ?? 0 },
                { label: 'CTR',          value: fmtPct(totalCtr),            cur: totalCtr,               prev: prevMetaData.ctr ?? 0 },
                { label: 'CPC',          value: fmt2(totalCpc),              cur: totalCpc,               prev: prevMetaData.cpc ?? 0,                       invertColors: true },
                { label: 'CPM',          value: fmt2(totalCpm),              cur: totalCpm,               prev: (prevMetaData.impressions ?? 0) > 0 ? ((prevMetaData.spend ?? 0) / prevMetaData.impressions) * 1000 : 0,                       invertColors: true },
                { label: 'Purchases',    value: fmtN(totals.conversions),    cur: totals.conversions,     prev: prevMetaData.conversions ?? 0 },
                { label: 'Conv. Value',  value: fmt$(totals.conversionValue),cur: totals.conversionValue, prev: prevMetaData.conversionValue ?? 0 },
                { label: 'ROAS',         value: fmtX(totalRoas),             cur: totalRoas,              prev: prevMetaData.roas ?? 0 },
                { label: 'Active Camps', value: `${activeCampaigns} / ${Object.keys(campaigns).length}`, cur: 0, prev: 0 },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>{k.label}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.02em', fontFamily: 'Barlow, sans-serif', color: '#000' }}>{k.value}</div>
                  <PctPill cur={k.cur} prev={k.prev} invertColors={k.invertColors} />
                </div>
              ))}
            </div>

            {/* Charts */}
            {dailyData.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 20 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', fontFamily: 'Barlow, sans-serif', marginBottom: 4 }}>Daily Spend</div>
                  <div style={{ fontSize: '0.75rem', color: '#999', fontFamily: 'Barlow, sans-serif', marginBottom: 12 }}>Ad spend per day</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={dailyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} width={44} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      <Bar dataKey="spend" fill="#00cc78" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 20 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', fontFamily: 'Barlow, sans-serif', marginBottom: 4 }}>Daily ROAS</div>
                  <div style={{ fontSize: '0.75rem', color: '#999', fontFamily: 'Barlow, sans-serif', marginBottom: 12 }}>Return on ad spend per day</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={dailyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#999', fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}x`} width={36} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="roas" stroke="#00ff97" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#00ff97' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Filter + Table */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', minWidth: 0 }}>
              {/* Filter bar */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', color: '#666', fontFamily: 'Barlow, sans-serif', marginRight: 4 }}>Show:</span>
                {(['all', 'active', 'paused'] as const).map(f => (
                  <button key={f} onClick={() => setFilterActive(f)} style={{
                    padding: '4px 12px', borderRadius: 6, border: '1px solid', fontSize: '0.8rem', fontWeight: 600,
                    fontFamily: 'Barlow, sans-serif', cursor: 'pointer', transition: '0.15s',
                    background: filterActive === f ? '#000' : '#fff',
                    borderColor: filterActive === f ? '#000' : '#e0e0e0',
                    color: filterActive === f ? '#fff' : '#666',
                  }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {f === 'active' && <span style={{ marginLeft: 4, background: '#00cc78', color: '#000', borderRadius: 10, padding: '0 5px', fontSize: '0.65rem' }}>{activeCampaigns}</span>}
                    {f === 'paused' && <span style={{ marginLeft: 4, background: '#e0e0e0', color: '#666', borderRadius: 10, padding: '0 5px', fontSize: '0.65rem' }}>{Object.keys(campaigns).length - activeCampaigns}</span>}
                  </button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#999', fontFamily: 'Barlow, sans-serif' }}>Click column headers to sort · Click rows to expand</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, minWidth: 300, textAlign: 'left' }}>Campaign / Ad Set / Ad</th>
                      <th style={{ ...TH, textAlign: 'center', minWidth: 90 }}>Status</th>
                      {SORT_COLS.map(col => (
                        <SortTH key={col.key} label={col.label} sortKey={col.key} currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCampaigns.map(camp => {
                      const campExpanded = expandedCamps.has(camp.name)
                      const sortedAdsets = Object.values(camp.children!).sort((a, b) =>
                        sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]
                      )
                      return (
                        <>
                          <tr key={camp.name} style={{ cursor: 'pointer', background: campExpanded ? '#fafafa' : '#fff' }}
                            onClick={() => setExpandedCamps(prev => { const s = new Set(prev); s.has(camp.name) ? s.delete(camp.name) : s.add(camp.name); return s })}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f9')}
                            onMouseLeave={e => (e.currentTarget.style.background = campExpanded ? '#fafafa' : '#fff')}>
                            <td style={{ ...TD, fontWeight: 700 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {campExpanded ? <ChevronDown size={14} color="#666" /> : <ChevronRight size={14} color="#666" />}
                                <span style={{ fontSize: '0.875rem', fontFamily: 'Barlow, sans-serif', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{camp.name}</span>
                              </div>
                            </td>
                            <td style={{ ...TD, textAlign: 'center' }}>
                              <ActiveBadge isActive={camp.isActive} lastSeen={camp.lastSeen} />
                            </td>
                            <MetricCells row={camp} />
                          </tr>

                          {campExpanded && sortedAdsets.map(adset => {
                            const adsetKey = `${camp.name}||${adset.name}`
                            const adsetExpanded = expandedAdsets.has(adsetKey)
                            const sortedAds = [...(adset.ads ?? [])].sort((a, b) =>
                              sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]
                            )
                            return (
                              <>
                                <tr key={adsetKey} style={{ cursor: 'pointer', background: adsetExpanded ? '#f5f5f5' : '#f9f9f9' }}
                                  onClick={() => setExpandedAdsets(prev => { const s = new Set(prev); s.has(adsetKey) ? s.delete(adsetKey) : s.add(adsetKey); return s })}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                                  onMouseLeave={e => (e.currentTarget.style.background = adsetExpanded ? '#f5f5f5' : '#f9f9f9')}>
                                  <td style={{ ...TD, paddingLeft: 40 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      {adsetExpanded ? <ChevronDown size={12} color="#999" /> : <ChevronRight size={12} color="#999" />}
                                      <span style={{ fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif', color: '#333', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adset.name}</span>
                                    </div>
                                  </td>
                                  <td style={{ ...TD, textAlign: 'center' }}>
                                    <ActiveBadge isActive={adset.isActive} lastSeen={adset.lastSeen} />
                                  </td>
                                  <MetricCells row={adset} />
                                </tr>

                                {adsetExpanded && sortedAds.map(ad => (
                                  <tr key={ad.name} style={{ background: '#fafafa' }}>
                                    <td style={{ ...TD, paddingLeft: 64 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ccc', flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.78rem', fontFamily: 'Barlow, sans-serif', color: '#666', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.name}</span>
                                      </div>
                                    </td>
                                    <td style={{ ...TD, textAlign: 'center' }}>
                                      <ActiveBadge isActive={ad.isActive} lastSeen={ad.lastSeen} />
                                    </td>
                                    <MetricCells row={ad} />
                                  </tr>
                                ))}
                              </>
                            )
                          })}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
