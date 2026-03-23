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
        padding: '12px 16px', textAlign: align as any, fontSize: '0.72rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em', color: sortBy === field ? C.ink : C.muted,
        fontFamily: 'Barlow, sans-serif', borderBottom: `1px solid ${C.border}`, cursor: 'pointer',
        userSelect: 'none', whiteSpace: 'nowrap',
      }}
    >
      {label} {sortBy === field && (sortDir === 'desc' ? '↓' : '↑')}
    </th>
  )

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>
      {/* Topbar */}
      <div className="analytics-topbar" style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'sticky', top: 0, background: C.paper, zIndex: 50 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.6rem)', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Barlow, sans-serif', color: C.ink }}>{orgName} — Products</h1>
          <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2, fontFamily: 'Barlow, sans-serif' }}>
            {fmtDate(range.start)} – {fmtDate(range.end)} · {fmtN(products.length)} product{products.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <DateRangePicker value={range} onChange={r => setRange(r)} />
        </div>
      </div>

      <div style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 80px' }}>
        {error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
            <p style={{ color: '#dc2626', fontWeight: 700, fontFamily: 'Barlow, sans-serif', fontSize: '0.95rem', marginBottom: 4 }}>Error loading products</p>
            <p style={{ color: '#b91c1c', fontFamily: 'Barlow, sans-serif', fontSize: '0.85rem' }}>{error}</p>
            <button
              onClick={() => fetchData()}
              style={{ marginTop: 12, padding: '8px 20px', background: '#dc2626', color: '#fff', fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.8rem', border: 'none', borderRadius: 6, cursor: 'pointer' }}
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
            <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif', marginBottom: 8 }}>Total Revenue</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Barlow, sans-serif' }}>{fmt$(totalRevenue)}</div>
            </div>
            <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif', marginBottom: 8 }}>Total Units</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Barlow, sans-serif' }}>{fmtN(totalUnits)}</div>
            </div>
            <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif', marginBottom: 8 }}>Unique Products</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Barlow, sans-serif' }}>{products.length}</div>
            </div>
          </div>

          {/* Top 5 charts grid */}
          {top5.length > 0 && (
            <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {/* Top 5 by Revenue */}
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif', marginBottom: 16 }}>Top 5 Products by Revenue</div>
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
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif', marginBottom: 16 }}>Top 5 Products by Units Sold</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {top5Units.map((p, i) => (
                    <div key={`top-units-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 120, minWidth: 80, fontFamily: 'Barlow, sans-serif', fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={p.product}>
                        {p.product}
                      </div>
                      <div style={{ flex: 1, height: 24, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: maxUnits > 0 ? `${(p.units / maxUnits) * 100}%` : '0%', height: '100%', background: '#a78bfa', borderRadius: 4, transition: 'width 0.3s ease' }} />
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
          <div className="products-table-wrap" style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.cream }}>
                    <SortHeader field="product" label="Product" />
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, fontFamily: 'Barlow, sans-serif', borderBottom: `1px solid ${C.border}` }}>Variant</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, fontFamily: 'Barlow, sans-serif', borderBottom: `1px solid ${C.border}` }}>SKU</th>
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
                      <td style={{ padding: '12px 16px', fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.85rem' }}>{p.product}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'Barlow, sans-serif', fontSize: '0.8rem', color: C.muted }}>{p.variant || '—'}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: '#aaa' }}>{p.sku || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.85rem' }}>{fmtN(p.units)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.85rem' }}>{fmt$(p.revenue)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <div style={{ width: 50, height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(p.pctOfTotal, 100)}%`, height: '100%', background: C.accent, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontFamily: 'Barlow, sans-serif', fontSize: '0.8rem', color: C.muted, minWidth: 40, textAlign: 'right' }}>{p.pctOfTotal.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '0.8rem' }}>{fmt$(p.aov)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {products.length > 20 && !showAll && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => setShowAll(true)} style={{ padding: '10px 24px', background: C.ink, color: C.accent, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.85rem', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Show all {products.length} products
              </button>
            </div>
          )}
          {showAll && products.length > 20 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => setShowAll(false)} style={{ padding: '10px 24px', background: C.cream, color: C.muted, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.85rem', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Show top 20
              </button>
            </div>
          )}
        </>)}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .products-summary-grid {
            grid-template-columns: 1fr !important;
          }
          .analytics-topbar {
            position: fixed !important;
            top: 0;
            left: 0;
            right: 0;
            z-index: 100;
          }
          .chart-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
