'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DateRangePicker, { DateRange } from '@/components/DateRangePicker'
import { Package, ArrowUpDown } from 'lucide-react'

const C = { ink: '#000', paper: '#fff', cream: '#f2f2f2', accent: '#00ff97', muted: '#666', border: '#e0e0e0' }
function fmt$(n: number) { if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`; if (n >= 1_000) return `$${(n/1_000).toFixed(1)}k`; return `$${n.toFixed(2)}` }
function fmtN(n: number) { return n >= 1_000 ? `${(n/1_000).toFixed(1)}k` : n.toLocaleString() }

const defaultRange: DateRange = {
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA'),
  end: new Date().toLocaleDateString('en-CA'),
  label: 'Month to date',
}

type SortField = 'revenue' | 'units' | 'pctOfTotal' | 'aov' | 'product'
type Product = { product: string; variant: string; sku: string; units: number; revenue: number; pctOfTotal: number; aov: number }

export default function ProductsBreakdownPage() {
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalUnits, setTotalUnits] = useState(0)
  const [sortBy, setSortBy] = useState<SortField>('revenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showAll, setShowAll] = useState(false)
  const supabase = createClient()

  useEffect(() => { fetchData() }, [range])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    const orgId = localStorage.getItem('activeOrgId')
    if (!orgId) { setLoading(false); return }

    try {
      const { data: orgData } = await supabase
        .from('organizations').select('name, timezone').eq('id', orgId).single()
      if (orgData?.name) { setOrgName(orgData.name); document.title = `${orgData.name} Products | Attomik` }

      const startDate = `${range.start}T00:00:00.000Z`
      const endDate = `${range.end}T23:59:59.999Z`

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, startDate, endDate }),
      })
      if (!res.ok) throw new Error(`Failed to fetch products (${res.status})`)
      const data = await res.json()
      setProducts(data.products ?? [])
      setTotalRevenue(data.totalRevenue ?? 0)
      setTotalUnits(data.totalUnits ?? 0)
    } catch (err: any) {
      console.error('Products fetch error:', err)
      setError(err?.message || 'Something went wrong loading products.')
    } finally {
      setLoading(false)
    }
  }

  const toggleSort = (field: SortField) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('desc') }
  }

  const sorted = [...products].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortBy === 'product') return mul * a.product.localeCompare(b.product)
    return mul * ((a[sortBy] as number) - (b[sortBy] as number))
  })

  const displayed = showAll ? sorted : sorted.slice(0, 20)
  const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // Top 5 products by revenue for the bar chart
  const top5 = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  const maxRevenue = top5.length > 0 ? top5[0].revenue : 0

  // Top 5 products by units for the bar chart
  const top5Units = [...products].sort((a, b) => b.units - a.units).slice(0, 5)
  const maxUnits = top5Units.length > 0 ? top5Units[0].units : 0

  const SortHeader = ({ field, label, align = 'left' }: { field: SortField; label: string; align?: string }) => (
    <th
      onClick={() => toggleSort(field)}
      style={{
        textAlign: align as any, cursor: 'pointer',
        color: sortBy === field ? C.ink : undefined,
        userSelect: 'none', whiteSpace: 'nowrap',
      }}
    >
      {label} {sortBy === field && (sortDir === 'desc' ? '↓' : '↑')}
    </th>
  )

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-title" style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.6rem)', fontWeight: 800, letterSpacing: '-0.04em' }}>{orgName} — Products</h1>
          <p className="caption" style={{ marginTop: 2 }}>
            {fmtDate(range.start)} – {fmtDate(range.end)} · {fmtN(products.length)} product{products.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="topbar-actions">
          <DateRangePicker value={range} onChange={r => setRange(r)} />
        </div>
      </div>

      <div className="page-content">
        {error ? (
          <div className="alert alert-error" style={{ flexDirection: 'column', marginBottom: 24 }}>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>Error loading products</p>
            <p style={{ fontSize: '0.85rem' }}>{error}</p>
            <button
              onClick={() => fetchData()}
              className="btn btn-danger btn-sm"
              style={{ marginTop: 12 }}
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div style={{ color: C.muted, textAlign: 'center', padding: '80px 0', fontFamily: 'Barlow, sans-serif' }}>Loading products…</div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', border: `2px dashed ${C.border}`, borderRadius: 10 }}>
            <Package size={32} style={{ color: '#ccc', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontWeight: 700, fontFamily: 'Barlow, sans-serif' }}>No product data</p>
            <p style={{ fontSize: '0.875rem', color: C.muted, fontFamily: 'Barlow, sans-serif' }}>Run a Shopify sync to populate product breakdown.</p>
          </div>
        ) : (<>
          {/* Summary cards */}
          <div className="products-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="kpi-card">
              <div className="kpi-label">Total Revenue</div>
              <div className="kpi-value">{fmt$(totalRevenue)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Units</div>
              <div className="kpi-value">{fmtN(totalUnits)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Unique Products</div>
              <div className="kpi-value">{products.length}</div>
            </div>
          </div>

          {/* Top 5 charts grid */}
          {top5.length > 0 && (
            <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {/* Top 5 by Revenue */}
              <div className="card">
                <div className="kpi-label" style={{ marginBottom: 16 }}>Top 5 Products by Revenue</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {top5.map((p, i) => (
                    <div key={`top-rev-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 120, minWidth: 80, fontFamily: 'Barlow, sans-serif', fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={p.product}>
                        {p.product}
                      </div>
                      <div style={{ flex: 1, height: 24, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: maxRevenue > 0 ? `${(p.revenue / maxRevenue) * 100}%` : '0%', height: '100%', background: C.accent, borderRadius: 4, transition: 'width 0.3s ease' }} />
                      </div>
                      <div style={{ fontFamily: 'Barlow, sans-serif', fontSize: '0.82rem', fontWeight: 700, minWidth: 70, textAlign: 'right', flexShrink: 0 }}>
                        {fmt$(p.revenue)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 5 by Units */}
              <div className="card">
                <div className="kpi-label" style={{ marginBottom: 16 }}>Top 5 Products by Units Sold</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {top5Units.map((p, i) => (
                    <div key={`top-units-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 120, minWidth: 80, fontFamily: 'Barlow, sans-serif', fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={p.product}>
                        {p.product}
                      </div>
                      <div style={{ flex: 1, height: 24, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: maxUnits > 0 ? `${(p.units / maxUnits) * 100}%` : '0%', height: '100%', background: '#000', borderRadius: 4, transition: 'width 0.3s ease' }} />
                      </div>
                      <div style={{ fontFamily: 'Barlow, sans-serif', fontSize: '0.82rem', fontWeight: 700, minWidth: 50, textAlign: 'right', flexShrink: 0 }}>
                        {fmtN(p.units)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Product table */}
          <div className="products-table-wrap table-wrapper">
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.cream }}>
                    <SortHeader field="product" label="Product" />
                    <th>Variant</th>
                    <th>SKU</th>
                    <SortHeader field="units" label="Units" align="right" />
                    <SortHeader field="revenue" label="Revenue" align="right" />
                    <SortHeader field="pctOfTotal" label="% of Total" align="right" />
                    <SortHeader field="aov" label="Price/Unit" align="right" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((p, i) => (
                    <tr key={`${p.product}-${p.variant}-${i}`}
                      style={{ borderTop: `1px solid ${C.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ fontWeight: 600 }}>{p.product}</td>
                      <td className="td-muted">{p.variant || '—'}</td>
                      <td className="td-mono" style={{ color: '#aaa' }}>{p.sku || '—'}</td>
                      <td className="td-right" style={{ fontWeight: 600 }}>{fmtN(p.units)}</td>
                      <td className="td-right td-strong">{fmt$(p.revenue)}</td>
                      <td className="td-right">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <div style={{ width: 50, height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(p.pctOfTotal, 100)}%`, height: '100%', background: C.accent, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontFamily: 'Barlow, sans-serif', fontSize: '0.8rem', color: C.muted, minWidth: 40, textAlign: 'right' }}>{p.pctOfTotal.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="td-mono td-right">{fmt$(p.aov)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {products.length > 20 && !showAll && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => setShowAll(true)} className="btn btn-ghost">
                Show all {products.length} products
              </button>
            </div>
          )}
          {showAll && products.length > 20 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => setShowAll(false)} className="btn btn-ghost">
                Show top 20
              </button>
            </div>
          )}
        </>)}
      </div>

    </div>
  )
}
