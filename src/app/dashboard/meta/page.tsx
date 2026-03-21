'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangePicker, { DateRange } from '@/components/DateRangePicker'
import { ChevronDown, ChevronRight } from 'lucide-react'

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n/1_000).toFixed(1)}k`
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

const TH_STYLE: React.CSSProperties = {
  padding: '10px 16px',
  background: '#f2f2f2',
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#666',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  fontFamily: 'Barlow, sans-serif',
  borderBottom: '1px solid #e0e0e0',
}

const TD_STYLE: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '0.875rem',
  fontFamily: 'Barlow, sans-serif',
  borderBottom: '1px solid #f2f2f2',
  verticalAlign: 'middle',
}

const MONO: React.CSSProperties = {
  fontFamily: 'DM Mono, monospace',
  fontSize: '0.82rem',
}

interface AdRow {
  campaign_name: string
  adset_name: string | null
  ad_name: string | null
  spend: number
  impressions: number
  reach: number
  clicks: number
  conversions: number
  conversion_value: number
  cpc: number
  cpm: number
  ctr: number
}

interface Aggregated {
  name: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  conversions: number
  conversionValue: number
  roas: number
  cpc: number
  cpm: number
  ctr: number
  children?: Record<string, Aggregated>
  ads?: Aggregated[]
}

function aggregate(rows: AdRow[]): Record<string, Aggregated> {
  const campaigns: Record<string, Aggregated> = {}

  rows.forEach(row => {
    const c = row.campaign_name
    const a = row.adset_name ?? 'Unknown Ad Set'
    const ad = row.ad_name ?? 'Unknown Ad'

    if (!campaigns[c]) campaigns[c] = { name: c, spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, conversionValue: 0, roas: 0, cpc: 0, cpm: 0, ctr: 0, children: {} }
    campaigns[c].spend           += row.spend
    campaigns[c].impressions     += row.impressions
    campaigns[c].reach           += row.reach
    campaigns[c].clicks          += row.clicks
    campaigns[c].conversions     += row.conversions
    campaigns[c].conversionValue += row.conversion_value

    const adsets = campaigns[c].children!
    if (!adsets[a]) adsets[a] = { name: a, spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, conversionValue: 0, roas: 0, cpc: 0, cpm: 0, ctr: 0, ads: [] }
    adsets[a].spend           += row.spend
    adsets[a].impressions     += row.impressions
    adsets[a].reach           += row.reach
    adsets[a].clicks          += row.clicks
    adsets[a].conversions     += row.conversions
    adsets[a].conversionValue += row.conversion_value

    adsets[a].ads!.push({
      name: ad,
      spend: row.spend,
      impressions: row.impressions,
      reach: row.reach,
      clicks: row.clicks,
      conversions: row.conversions,
      conversionValue: row.conversion_value,
      roas: row.spend > 0 ? row.conversion_value / row.spend : 0,
      cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
      cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
    })
  })

  // Recalculate derived metrics
  Object.values(campaigns).forEach(camp => {
    camp.roas = camp.spend > 0 ? camp.conversionValue / camp.spend : 0
    camp.cpc  = camp.clicks > 0 ? camp.spend / camp.clicks : 0
    camp.cpm  = camp.impressions > 0 ? (camp.spend / camp.impressions) * 1000 : 0
    camp.ctr  = camp.impressions > 0 ? (camp.clicks / camp.impressions) * 100 : 0

    Object.values(camp.children!).forEach(adset => {
      adset.roas = adset.spend > 0 ? adset.conversionValue / adset.spend : 0
      adset.cpc  = adset.clicks > 0 ? adset.spend / adset.clicks : 0
      adset.cpm  = adset.impressions > 0 ? (adset.spend / adset.impressions) * 1000 : 0
      adset.ctr  = adset.impressions > 0 ? (adset.clicks / adset.impressions) * 100 : 0

      // Deduplicate ads by name (sum across days)
      const adMap: Record<string, Aggregated> = {}
      adset.ads!.forEach(ad => {
        if (!adMap[ad.name]) adMap[ad.name] = { ...ad, spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, conversionValue: 0, roas: 0, cpc: 0, cpm: 0, ctr: 0 }
        adMap[ad.name].spend           += ad.spend
        adMap[ad.name].impressions     += ad.impressions
        adMap[ad.name].reach           += ad.reach
        adMap[ad.name].clicks          += ad.clicks
        adMap[ad.name].conversions     += ad.conversions
        adMap[ad.name].conversionValue += ad.conversionValue
      })
      Object.values(adMap).forEach(ad => {
        ad.roas = ad.spend > 0 ? ad.conversionValue / ad.spend : 0
        ad.cpc  = ad.clicks > 0 ? ad.spend / ad.clicks : 0
        ad.cpm  = ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000 : 0
        ad.ctr  = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0
      })
      adset.ads = Object.values(adMap).sort((a, b) => b.spend - a.spend)
    })
  })

  return campaigns
}

function MetricCells({ row }: { row: Aggregated }) {
  return (
    <>
      <td style={{ ...TD_STYLE, ...MONO, textAlign: 'right' }}>{fmt$(row.spend)}</td>
      <td style={{ ...TD_STYLE, ...MONO, textAlign: 'right' }}>{fmtN(row.impressions)}</td>
      <td style={{ ...TD_STYLE, ...MONO, textAlign: 'right' }}>{fmtN(row.reach)}</td>
      <td style={{ ...TD_STYLE, ...MONO, textAlign: 'right' }}>{fmtN(row.clicks)}</td>
      <td style={{ ...TD_STYLE, ...MONO, textAlign: 'right' }}>{fmtPct(row.ctr)}</td>
      <td style={{ ...TD_STYLE, ...MONO, textAlign: 'right' }}>{fmt2(row.cpc)}</td>
      <td style={{ ...TD_STYLE, ...MONO, textAlign: 'right' }}>{fmt2(row.cpm)}</td>
      <td style={{ ...TD_STYLE, ...MONO, textAlign: 'right' }}>{fmtN(row.conversions)}</td>
      <td style={{ ...TD_STYLE, ...MONO, textAlign: 'right' }}>{fmt$(row.conversionValue)}</td>
      <td style={{ ...TD_STYLE, fontWeight: 700, textAlign: 'right' }}>
        <span style={{ color: row.roas >= 2 ? '#007a48' : row.roas >= 1 ? '#856404' : '#b91c1c', fontFamily: 'DM Mono, monospace', fontSize: '0.82rem' }}>
          {fmtX(row.roas)}
        </span>
      </td>
    </>
  )
}

const COLS = ['Spend', 'Impressions', 'Reach', 'Clicks', 'CTR', 'CPC', 'CPM', 'Purchases', 'Conv. Value', 'ROAS']

export default function MetaAdsPage() {
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<Record<string, Aggregated>>({})
  const [expandedCamps, setExpandedCamps] = useState<Set<string>>(new Set())
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => { fetchData() }, [range])

  const fetchData = async () => {
    setLoading(true)
    const orgId = localStorage.getItem('activeOrgId')
    if (!orgId) { setLoading(false); return }

    const { data } = await supabase
      .from('ad_spend')
      .select('campaign_name, adset_name, ad_name, spend, impressions, reach, clicks, conversions, conversion_value, cpc, cpm, ctr')
      .eq('org_id', orgId)
      .eq('platform', 'meta')
      .gte('date', range.start)
      .lte('date', range.end)

    const rows = (data ?? []) as AdRow[]
    setCampaigns(aggregate(rows))
    setLoading(false)
  }

  const toggleCamp  = (name: string) => setExpandedCamps(prev  => { const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s })
  const toggleAdset = (key: string)  => setExpandedAdsets(prev => { const s = new Set(prev); s.has(key)  ? s.delete(key)  : s.add(key);  return s })

  const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const totals = Object.values(campaigns).reduce((acc, c) => ({
    spend: acc.spend + c.spend,
    impressions: acc.impressions + c.impressions,
    clicks: acc.clicks + c.clicks,
    conversions: acc.conversions + c.conversions,
    conversionValue: acc.conversionValue + c.conversionValue,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 })
  const totalRoas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0

  return (
    <div>
      {/* Topbar */}
      <div style={{ padding: '20px 40px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 50 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Barlow, sans-serif' }}>Meta Ads</h1>
          <p style={{ fontSize: '0.8rem', color: '#666', marginTop: 2, fontFamily: 'Barlow, sans-serif' }}>
            {fmtDate(range.start)} – {fmtDate(range.end)} · Campaign → Ad Set → Ad
          </p>
        </div>
        <DateRangePicker value={range} onChange={r => setRange(r)} />
      </div>

      <div style={{ padding: '28px 40px 64px' }}>
        {/* Summary KPIs */}
        {!loading && Object.keys(campaigns).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Total Spend',      value: fmt$(totals.spend) },
              { label: 'Impressions',      value: fmtN(totals.impressions) },
              { label: 'Clicks',           value: fmtN(totals.clicks) },
              { label: 'Purchases',        value: fmtN(totals.conversions) },
              { label: 'ROAS',             value: fmtX(totalRoas) },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'Barlow, sans-serif' }}>{k.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Barlow, sans-serif' }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '80px 0', fontFamily: 'Barlow, sans-serif' }}>Loading Meta Ads data…</div>
        ) : Object.keys(campaigns).length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '80px 0', fontFamily: 'Barlow, sans-serif' }}>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>No Meta Ads data for this period</p>
            <p style={{ fontSize: '0.875rem' }}>Upload a Meta Ads CSV with the Day breakdown from the Import page.</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...TH_STYLE, minWidth: 280 }}>Campaign / Ad Set / Ad</th>
                    {COLS.map(c => <th key={c} style={{ ...TH_STYLE, textAlign: 'right' }}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Object.values(campaigns).sort((a, b) => b.spend - a.spend).map(camp => {
                    const campExpanded = expandedCamps.has(camp.name)
                    return (
                      <>
                        {/* Campaign row */}
                        <tr key={camp.name} style={{ cursor: 'pointer', background: campExpanded ? '#fafafa' : '#fff' }}
                          onClick={() => toggleCamp(camp.name)}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f9')}
                          onMouseLeave={e => (e.currentTarget.style.background = campExpanded ? '#fafafa' : '#fff')}>
                          <td style={{ ...TD_STYLE, fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {campExpanded ? <ChevronDown size={14} color="#666" /> : <ChevronRight size={14} color="#666" />}
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1877f2', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.875rem', fontFamily: 'Barlow, sans-serif' }}>{camp.name}</span>
                            </div>
                          </td>
                          <MetricCells row={camp} />
                        </tr>

                        {/* Ad Set rows */}
                        {campExpanded && Object.values(camp.children!).sort((a, b) => b.spend - a.spend).map(adset => {
                          const adsetKey = `${camp.name}||${adset.name}`
                          const adsetExpanded = expandedAdsets.has(adsetKey)
                          return (
                            <>
                              <tr key={adsetKey} style={{ cursor: 'pointer', background: adsetExpanded ? '#f5f5f5' : '#f9f9f9' }}
                                onClick={() => toggleAdset(adsetKey)}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                                onMouseLeave={e => (e.currentTarget.style.background = adsetExpanded ? '#f5f5f5' : '#f9f9f9')}>
                                <td style={{ ...TD_STYLE, paddingLeft: 40 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {adsetExpanded ? <ChevronDown size={12} color="#999" /> : <ChevronRight size={12} color="#999" />}
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff97', flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif', color: '#333', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adset.name}</span>
                                  </div>
                                </td>
                                <MetricCells row={adset} />
                              </tr>

                              {/* Ad rows */}
                              {adsetExpanded && adset.ads!.map(ad => (
                                <tr key={ad.name} style={{ background: '#fafafa' }}>
                                  <td style={{ ...TD_STYLE, paddingLeft: 64 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ccc', flexShrink: 0 }} />
                                      <span style={{ fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif', color: '#666', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.name}</span>
                                    </div>
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
        )}
      </div>
    </div>
  )
}
