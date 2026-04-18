'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader, Trash2 } from 'lucide-react'
import Topbar from '@/components/Topbar'
import { createClient } from '@/lib/supabase/client'

const ALL_PLATFORMS = [
  { id: 'amazon',   label: 'Amazon',      channelKey: 'amazon',  color: '#00cc78', description: 'Business Report from Seller Central', instructions: 'Seller Central → Reports → Business Reports → Sales & Traffic → Download', endpoint: '/api/upload/amazon', columns: ['Date', 'Ordered Product Sales', 'Ordered Product Sales - B2B', 'Units Ordered', 'Total Order Items'] },
  { id: 'shopify',  label: 'Shopify',     channelKey: 'shopify', color: '#96bf48', description: 'Orders export from Shopify admin', instructions: 'Shopify Admin → Orders → Export → All orders → CSV', endpoint: '/api/upload/shopify', columns: ['Name', 'Email', 'Financial Status', 'Created at', 'Subtotal', 'Shipping', 'Taxes', 'Total', 'Discount Amount', 'Refunded Amount'] },
  { id: 'walmart',  label: 'Walmart',     channelKey: 'walmart', color: '#0071ce', description: 'Seller Center sales report', instructions: 'Walmart Seller Center → Analytics → Sales Report → Export', endpoint: '/api/upload/csv', columns: ['Order Date', 'Net Sales', 'Units Sold', 'Customer Name'] },
  { id: 'meta',     label: 'Meta Ads',    channelKey: 'meta',    color: '#1877f2', description: 'Campaign performance — export with Day breakdown', instructions: 'Meta Ads Manager → Reports → Breakdown: Day → Export CSV', endpoint: '/api/upload/meta', columns: ['Day', 'Campaign name', 'Ad set name', 'Ad name', 'Amount spent (USD)', 'Impressions', 'Link clicks', 'Purchases'] },
  { id: 'google',   label: 'Google Ads',  channelKey: 'google',  color: '#4285f4', description: 'Campaign report from Google Ads', instructions: 'Google Ads → Reports → Download → CSV (include Day column)', endpoint: '/api/upload/google', columns: ['Day', 'Campaign', 'Ad group', 'Cost', 'Impressions', 'Clicks', 'Conversions'] },
  { id: 'tiktok',   label: 'TikTok Ads',  channelKey: 'tiktok',  color: '#666666', description: 'Campaign report from TikTok Ads Manager', instructions: 'TikTok Ads Manager → Reporting → Export', endpoint: '/api/upload/csv', columns: ['Date', 'Campaign Name', 'Spend', 'Impressions', 'Clicks', 'Conversions'] },
]

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

function PlatformUploader({ platform, orgName }: { platform: typeof ALL_PLATFORMS[0]; orgName: string }) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'last' | 'all' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const executePurge = async (mode: 'last' | 'all') => {
    setConfirmAction(null)
    setPurging(true); setPurgeResult(null)
    try {
      const activeOrgId = localStorage.getItem('activeOrgId') ?? ''
      const res = await fetch('/api/upload/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-active-org': activeOrgId },
        body: JSON.stringify({ platform: platform.channelKey, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Purge failed')
      setPurgeResult(`Deleted ${data.deleted} ${platform.label} records.`)
    } catch (err: any) { setPurgeResult(`Error: ${err.message}`) }
    setPurging(false)
  }

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) { setError('Please upload a .csv file'); setStatus('error'); return }
    setStatus('uploading'); setError(''); setResult(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const activeOrgId = localStorage.getItem('activeOrgId') ?? ''
      const res = await fetch(platform.endpoint, { method: 'POST', body: formData, headers: { 'x-active-org': activeOrgId } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setResult({ ...data, filename: file.name }); setStatus('success')
    } catch (err: any) { setError(err.message); setStatus('error') }
  }

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }
  const reset = () => { setStatus('idle'); setResult(null); setError('') }

  return (
    <div>
      <div className="card-muted" style={{ borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: platform.color, flexShrink: 0, marginTop: 5 }} />
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 2, fontFamily: 'Barlow, sans-serif' }}>How to export</div>
          <div style={{ fontSize: '0.8rem', color: '#666', fontFamily: 'DM Mono, monospace' }}>{platform.instructions}</div>
        </div>
      </div>

      {status === 'idle' || status === 'error' ? (
        <div onClick={() => inputRef.current?.click()} onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
          style={{ border: `2px dashed ${dragging ? platform.color : status === 'error' ? '#fca5a5' : '#e0e0e0'}`, borderRadius: 10, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', transition: '0.15s', background: dragging ? '#f9f9f9' : status === 'error' ? '#fff5f5' : '#f2f2f2' }}>
          <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <Upload size={28} style={{ color: dragging ? platform.color : '#999', display: 'block', margin: '0 auto 10px' }} />
          <p style={{ fontWeight: 700, marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>{dragging ? 'Drop it!' : `Drop your ${platform.label} CSV here`}</p>
          <p style={{ fontSize: '0.8rem', color: '#666', fontFamily: 'Barlow, sans-serif' }}>or click to browse</p>
          {orgName && <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#000', fontFamily: 'Barlow, sans-serif', marginTop: 12, padding: '4px 12px', background: '#e6fff5', borderRadius: 4, display: 'inline-block' }}>Uploading for {orgName}</p>}
          {status === 'error' && <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#b91c1c', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif' }}><AlertCircle size={14} />{error}</div>}
        </div>
      ) : status === 'uploading' ? (
        <div style={{ border: '2px dashed #e0e0e0', borderRadius: 10, padding: '40px 24px', textAlign: 'center', background: '#f2f2f2' }}>
          <Loader size={28} style={{ color: '#00ff97', display: 'block', margin: '0 auto 10px', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>Processing {platform.label} CSV…</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <div style={{ border: '1px solid #00cc78', borderRadius: 10, padding: 20, background: '#e6fff5' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <CheckCircle size={20} style={{ color: '#007a48', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>{result?.filename} imported</p>
              <div style={{ fontSize: '0.8rem', color: '#007a48', fontFamily: 'Barlow, sans-serif' }}>
                {Object.entries(result ?? {}).filter(([k]) => !['filename','inserted','skipped'].includes(k)).map(([k, v]) => (
                  <span key={k} style={{ marginRight: 12 }}>{k.replace(/_/g, ' ')}: <strong>{String(v)}</strong></span>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#007a48', marginTop: 4, fontFamily: 'Barlow, sans-serif' }}>{result?.inserted} rows added · {result?.skipped ?? 0} skipped</p>
            </div>
            <button onClick={reset} className="btn btn-dark btn-xs" style={{ whiteSpace: 'nowrap' }}>Upload another</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'Barlow, sans-serif' }}>Expected columns</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {platform.columns.map(col => (
            <span key={col} className="badge badge-gray" style={{ fontFamily: 'DM Mono, monospace', textTransform: 'none', letterSpacing: 'normal' }}>{col}</span>
          ))}
        </div>
      </div>

      {/* Undo / Purge */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e0e0e0' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', fontFamily: 'Barlow, sans-serif', marginBottom: 10 }}>Wrong data?</div>

        {confirmAction ? (
          <div className={confirmAction === 'all' ? 'alert alert-error' : 'alert alert-warning'} style={{ borderRadius: 8, padding: '14px 16px', flexDirection: 'column', alignItems: 'stretch' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'Barlow, sans-serif', marginBottom: 8 }}>
              {confirmAction === 'all'
                ? `Delete ALL ${platform.label} data for this project? This cannot be undone.`
                : `Undo the last ${platform.label} import?`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => executePurge(confirmAction)}
                className={`btn ${confirmAction === 'all' ? 'btn-danger' : 'btn-dark'} btn-sm`}>
                Yes, {confirmAction === 'all' ? 'purge everything' : 'undo it'}
              </button>
              <button onClick={() => setConfirmAction(null)}
                className="btn btn-ghost btn-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setConfirmAction('last')} disabled={purging}
              className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: purging ? 'not-allowed' : 'pointer' }}>
              <Trash2 size={13} />{purging ? 'Deleting…' : 'Undo last import'}
            </button>
            <button onClick={() => setConfirmAction('all')} disabled={purging}
              className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: purging ? 'not-allowed' : 'pointer', border: '1px solid #fca5a5', color: '#b91c1c' }}>
              <Trash2 size={13} />{purging ? 'Deleting…' : `Purge all ${platform.label} data`}
            </button>
          </div>
        )}

        {purgeResult && (
          <div style={{ marginTop: 8, fontSize: '0.75rem', fontFamily: 'Barlow, sans-serif', color: purgeResult.startsWith('Error') ? '#b91c1c' : '#007a48' }}>{purgeResult}</div>
        )}
      </div>
    </div>
  )
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState('')
  const [enabledChannels, setEnabledChannels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const orgId = localStorage.getItem('activeOrgId')
      if (!orgId) { setLoading(false); return }
      const { data } = await supabase.from('organizations').select('channels, name').eq('id', orgId).single()
      if (data?.name) { setOrgName(data.name); document.title = `${data.name} Import | Attomik` }
      const ch = data?.channels ?? {}
      // If channels object has keys, respect values. If empty/null, show all.
      const isConfigured = Object.keys(ch).length > 0
      const enabled = isConfigured
        ? ALL_PLATFORMS.filter(p => ch[p.channelKey] === true).map(p => p.id)
        : ALL_PLATFORMS.map(p => p.id)
      const show = enabled.length > 0 ? enabled : ALL_PLATFORMS.map(p => p.id)
      setEnabledChannels(show)
      setActiveTab(show[0] ?? 'amazon')
      setLoading(false)
    }
    load()
  }, [])

  const visiblePlatforms = ALL_PLATFORMS.filter(p => enabledChannels.includes(p.id))
  const activePlatform = visiblePlatforms.find(p => p.id === activeTab)

  return (
    <div>
      <Topbar title="Import Data" subtitle={orgName ? `Uploading for ${orgName}` : 'Upload exports from each platform'} className="analytics-topbar" />
      <div className="import-content" style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 48px', maxWidth: 720 }}>
        {loading ? (
          <div style={{ color: '#666', fontFamily: 'Barlow, sans-serif' }}>Loading…</div>
        ) : (
          <>
            <div className="tabs" style={{ marginBottom: 28 }}>
              {visiblePlatforms.map(p => (
                <button key={p.id} onClick={() => setActiveTab(p.id)} className={`tab-btn${activeTab === p.id ? ' active' : ''}`} style={activeTab === p.id ? { borderBottomColor: p.color } : undefined}>
                  {p.label}
                </button>
              ))}
            </div>
            {activePlatform && (
              <>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: 20, fontFamily: 'Barlow, sans-serif' }}>{activePlatform.description}</div>
                <PlatformUploader key={activeTab} platform={activePlatform} orgName={orgName} />
              </>
            )}
            {enabledChannels.length === ALL_PLATFORMS.length && (
              <div className="card-muted" style={{ marginTop: 24, padding: '12px 16px', borderRadius: 8, fontSize: '0.8rem', color: '#666', fontFamily: 'Barlow, sans-serif' }}>
                Showing all platforms. Configure which channels each client uses in <strong>Projects → [Client] → Channels</strong>.
              </div>
            )}
          </>
        )}
      </div>

    </div>
  )
}
