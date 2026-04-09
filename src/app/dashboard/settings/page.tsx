'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, RefreshCw, Unplug, ShoppingBag } from 'lucide-react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="kpi-label">
        {title}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const supabase = createClient()

  const [user, setUser]       = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [org, setOrg]         = useState<any>(null)

  const [domain, setDomain]         = useState('')
  const [clientId, setClientId]     = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving]         = useState(false)
  const [saveMsg, setSaveMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [syncing, setSyncing]       = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; inserted: number; message?: string } | null>(null)
  const [syncError, setSyncError]   = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [cleaning, setCleaning]       = useState(false)
  const [cleanResult, setCleanResult] = useState<number | null>(null)
  const [gaPropertyId, setGaPropertyId] = useState('')
  const [savingGa, setSavingGa]       = useState(false)
  const [gaMsg, setGaMsg]             = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [metaAdAccountId, setMetaAdAccountId] = useState('')
  const [metaAccessToken, setMetaAccessToken] = useState('')
  const [metaTokenSet, setMetaTokenSet]       = useState(false)
  const [savingMeta, setSavingMeta]           = useState(false)
  const [metaMsg, setMetaMsg]                 = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [targetYear, setTargetYear]   = useState(new Date().getFullYear())
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1)
  const [targets, setTargets]         = useState({ sales_target: '', aov_target: '', cac_target: '', roas_target: '', ad_spend_budget: '' })
  const [savingTargets, setSavingTargets] = useState(false)
  const [targetMsg, setTargetMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [amzYear, setAmzYear]       = useState(new Date().getFullYear())
  const [amzMonth, setAmzMonth]     = useState(new Date().getMonth() + 1)
  const [amzSpend, setAmzSpend]     = useState('')
  const [savingAmz, setSavingAmz]   = useState(false)
  const [amzMsg, setAmzMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles').select('*, organizations(*)').eq('id', user.id).single()
    setProfile(prof)

    const activeOrgId = localStorage.getItem('activeOrgId') || (prof as any)?.org_id
    if (activeOrgId) {
      const { data: activeOrg } = await supabase
        .from('organizations').select('*').eq('id', activeOrgId).single()
      setOrg(activeOrg)
      if (activeOrg?.name) document.title = `${activeOrg.name} Settings | Attomik`
      if (activeOrg?.shopify_domain) setDomain(activeOrg.shopify_domain)
      else setDomain('')
      if (activeOrg?.ga_property_id) setGaPropertyId(activeOrg.ga_property_id)
      else setGaPropertyId('')
      if (activeOrg?.meta_ad_account_id) setMetaAdAccountId(activeOrg.meta_ad_account_id)
      else setMetaAdAccountId('')
      setMetaTokenSet(!!activeOrg?.meta_access_token)
      setMetaAccessToken('')
      loadTargets(targetYear, targetMonth)
      loadAmzSpend(amzYear, amzMonth)
    }
  }

  const orgId = () => localStorage.getItem('activeOrgId') || org?.id

  const loadTargets = async (year: number, month: number) => {
    const id = orgId()
    if (!id) return
    try {
      const res = await fetch(`/api/targets?org_id=${id}&year=${year}&month=${month}`)
      const data = res.ok ? await res.json() : null
      if (data) {
        setTargets({
          sales_target: data.sales_target?.toString() ?? '',
          aov_target: data.aov_target?.toString() ?? '',
          cac_target: data.cac_target?.toString() ?? '',
          roas_target: data.roas_target?.toString() ?? '',
          ad_spend_budget: data.ad_spend_budget?.toString() ?? '',
        })
      } else {
        setTargets({ sales_target: '', aov_target: '', cac_target: '', roas_target: '', ad_spend_budget: '' })
      }
    } catch { setTargets({ sales_target: '', aov_target: '', cac_target: '', roas_target: '', ad_spend_budget: '' }) }
  }

  const loadAmzSpend = async (year: number, month: number) => {
    const id = orgId()
    if (!id) return
    try {
      const res = await fetch(`/api/ad-spend/amazon?org_id=${id}&year=${year}&month=${month}`, {
        headers: { 'x-active-org': id },
      })
      const data = res.ok ? await res.json() : null
      setAmzSpend(data?.total ? data.total.toString() : '')
    } catch { setAmzSpend('') }
  }

  const handleSaveAmzSpend = async () => {
    setSavingAmz(true); setAmzMsg(null)
    const id = orgId()
    if (!id) { setAmzMsg({ type: 'error', text: 'No active org found' }); setSavingAmz(false); return }
    try {
      const res = await fetch('/api/ad-spend/amazon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-active-org': id },
        body: JSON.stringify({ year: amzYear, month: amzMonth, total_spend: amzSpend || '0' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][amzMonth - 1]
      setAmzMsg({ type: 'success', text: `Amazon ad spend saved for ${monthName} ${amzYear} — $${parseFloat(amzSpend || '0').toLocaleString()}` })
    } catch (e: any) {
      setAmzMsg({ type: 'error', text: e.message })
    }
    setSavingAmz(false)
  }

  const handleSaveTargets = async () => {
    setSavingTargets(true); setTargetMsg(null)
    const id = orgId()
    if (!id) { setTargetMsg({ type: 'error', text: 'No active org found' }); setSavingTargets(false); return }
    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: id,
          year: targetYear,
          month: targetMonth,
          sales_target: targets.sales_target ? parseFloat(targets.sales_target) : null,
          aov_target: targets.aov_target ? parseFloat(targets.aov_target) : null,
          cac_target: targets.cac_target ? parseFloat(targets.cac_target) : null,
          roas_target: targets.roas_target ? parseFloat(targets.roas_target) : null,
          ad_spend_budget: targets.ad_spend_budget ? parseFloat(targets.ad_spend_budget) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setTargetMsg({ type: 'success', text: `Targets saved for ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][targetMonth - 1]} ${targetYear}` })
    } catch (e: any) {
      setTargetMsg({ type: 'error', text: e.message })
    }
    setSavingTargets(false)
  }

  const handleSaveShopify = async () => {
    setSaving(true)
    setSaveMsg(null)
    const id = orgId()
    if (!id) { setSaveMsg({ type: 'error', text: 'No active org found' }); setSaving(false); return }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').trim()

    // Test connection
    const testRes = await fetch('/api/shopify/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: cleanDomain, client_id: clientId, client_secret: clientSecret }),
    })
    const testData = await testRes.json()
    if (!testRes.ok) {
      setSaveMsg({ type: 'error', text: testData.error || 'Could not connect. Check your credentials.' })
      setSaving(false)
      return
    }

    // Save to DB
    const { error } = await supabase
      .from('organizations')
      .update({
        shopify_domain: cleanDomain,
        shopify_client_id: clientId,
        shopify_client_secret: clientSecret,
        shopify_token: null, // clear old token
      })
      .eq('id', id)

    if (error) {
      setSaveMsg({ type: 'error', text: error.message })
    } else {
      setSaveMsg({ type: 'success', text: `Connected to ${testData.shop_name}!` })
      setClientId('')
      setClientSecret('')
      loadData()
    }
    setSaving(false)
  }

  const [syncProgress, setSyncProgress] = useState('')

  const handleSync = async (fullSync = false) => {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    setSyncProgress('')

    if (fullSync) {
      // Batched full sync — month by month to avoid timeout
      let totalSynced = 0
      const startYear = 2024
      const now = new Date()
      const endYear = now.getFullYear()
      const endMonth = now.getMonth()

      for (let y = startYear; y <= endYear; y++) {
        const maxM = y === endYear ? endMonth : 11
        for (let m = 0; m <= maxM; m++) {
          const syncStart = `${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00Z`
          const syncEnd = m === 11
            ? `${y + 1}-01-01T00:00:00Z`
            : `${y}-${String(m + 2).padStart(2, '0')}-01T00:00:00Z`
          const label = new Date(y, m).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          setSyncProgress(`Syncing ${label}...`)

          try {
            const res = await fetch('/api/sync/shopify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ org_id: orgId(), full_sync: true, sync_start: syncStart, sync_end: syncEnd }),
            })
            const data = await res.json()
            if (res.ok) totalSynced += data.synced ?? 0
          } catch {}
        }
      }

      setSyncResult({ synced: totalSynced, inserted: totalSynced, message: `Full sync complete — ${totalSynced} orders imported` })
      setSyncProgress('')
    } else {
      const res = await fetch('/api/sync/shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId() }),
      })
      const data = await res.json()
      if (!res.ok) setSyncError(data.error || 'Sync failed')
      else setSyncResult(data)
    }
    setSyncing(false)
  }

  const handleClean = async () => {
    if (!confirm('This will delete all CSV-imported Shopify orders that have been replaced by API-synced ones. Continue?')) return
    setCleaning(true)
    setCleanResult(null)
    const res = await fetch('/api/shopify/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId() }),
    })
    const data = await res.json()
    if (res.ok) setCleanResult(data.deleted)
    setCleaning(false)
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Shopify? Your existing order data will remain.')) return
    setDisconnecting(true)
    await supabase.from('organizations')
      .update({ shopify_domain: null, shopify_token: null, shopify_client_id: null, shopify_client_secret: null })
      .eq('id', orgId())
    setDomain('')
    setClientId('')
    setClientSecret('')
    setSaveMsg(null)
    setSyncResult(null)
    setSyncError(null)
    loadData()
    setDisconnecting(false)
  }

  const isConnected = !!org?.shopify_domain

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">
          <h1>{org?.name ? `${org.name} — ` : ''}Settings</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: 2 }}>Organization & integrations</p>
        </div>
      </div>

      <div className="settings-content" style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 80px', maxWidth: 640 }}>

        <Section title="Organization">
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Name</label>
              <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--cream)' }}>{org?.name || '—'}</div>
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Slug</label>
              <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--cream)', fontFamily: 'var(--font-mono)' }}>{org?.slug || '—'}</div>
            </div>
          </div>
        </Section>

        <Section title="Shopify">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#96bf48', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <ShoppingBag size={18} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Shopify</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                {isConnected ? `Connected · ${org.shopify_domain}` : 'Not connected'}
              </div>
            </div>
            <span className={`badge ${isConnected ? 'badge-paid' : 'badge-failed'}`}>
              {isConnected ? '● Connected' : '○ Not connected'}
            </span>
          </div>

          {saveMsg && (
            <div className={`alert ${saveMsg.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
              {saveMsg.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span style={{ fontWeight: 600 }}>{saveMsg.text}</span>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Store domain</label>
              <input type="text" placeholder="your-store.myshopify.com" value={domain} onChange={e => setDomain(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }} />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>
                Client ID {isConnected && <span style={{ color: '#007a48', fontWeight: 400 }}>(leave blank to keep existing)</span>}
              </label>
              <input type="text" placeholder={isConnected ? '••••••••••••••••' : 'Client ID from Dev Dashboard'} value={clientId} onChange={e => setClientId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }} />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>
                Client Secret {isConnected && <span style={{ color: '#007a48', fontWeight: 400 }}>(leave blank to keep existing)</span>}
              </label>
              <input type="password" placeholder={isConnected ? '••••••••••••••••' : 'Client Secret from Dev Dashboard'} value={clientSecret} onChange={e => setClientSecret(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }} />
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                Get from: Shopify Admin → Settings → Apps → Develop apps → Create app → Settings → Credentials. Install the app on the store first.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="btn btn-dark" onClick={handleSaveShopify} disabled={saving || !domain || (!clientId && !isConnected)}>
              {saving ? 'Connecting…' : isConnected ? 'Update connection' : 'Connect Shopify'}
            </button>

            {isConnected && (<>
              <button className="btn btn-primary" onClick={() => handleSync(false)} disabled={syncing}>
                <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                {syncing ? 'Syncing…' : 'Sync new orders'}
              </button>
              <button className="btn btn-dark" onClick={() => handleSync(true)} disabled={syncing}>
                <RefreshCw size={14} />
                Full sync
              </button>
              <button className="btn btn-secondary" onClick={handleClean} disabled={cleaning}>
                {cleaning ? '…' : '🧹'} {cleaning ? 'Cleaning…' : 'Clean duplicates'}
              </button>
              <button className="btn btn-danger" onClick={handleDisconnect} disabled={disconnecting}>
                <Unplug size={14} />
                Disconnect
              </button>
            </>)}
          </div>

          {syncProgress && (
            <p style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-barlow)', marginBottom: 4 }}>
              {syncProgress}
            </p>
          )}
          {org?.shopify_synced_at && !syncProgress && (
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              Last synced: {new Date(org.shopify_synced_at).toLocaleString()}
            </p>
          )}

          {syncResult && (
            <div className="alert alert-success" style={{ marginTop: 12 }}>
              <CheckCircle size={16} />
              <span style={{ fontWeight: 600 }}>
                {syncResult.message || `Synced ${syncResult.synced} orders · ${syncResult.inserted} new`}
              </span>
            </div>
          )}
          {syncError && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              <XCircle size={16} />
              <span style={{ fontWeight: 600 }}>{syncError}</span>
            </div>
          )}
          {cleanResult !== null && (
            <div className="alert alert-success" style={{ marginTop: 12 }}>
              <CheckCircle size={16} />
              <span style={{ fontWeight: 600 }}>
                {cleanResult === 0 ? 'No duplicates found — data is clean!' : `Removed ${cleanResult} duplicate orders`}
              </span>
            </div>
          )}
        </Section>

        <Section title="Google Analytics">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#4285f4', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>GA</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Google Analytics 4</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                {gaPropertyId ? `Connected · Property ${gaPropertyId}` : 'Not connected'}
              </div>
            </div>
            <span className={`badge ${gaPropertyId ? 'badge-paid' : 'badge-failed'}`}>
              {gaPropertyId ? '● Connected' : '○ Not connected'}
            </span>
          </div>

          {gaMsg && (
            <div className={`alert ${gaMsg.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
              {gaMsg.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span style={{ fontWeight: 600 }}>{gaMsg.text}</span>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>GA4 Property ID</label>
              <input type="text" placeholder="e.g. 482126930" value={gaPropertyId} onChange={e => setGaPropertyId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }} />
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                Find in: Google Analytics → Admin → Property Settings → Property ID. Make sure the Attomik service account has Viewer access to this property.
              </p>
            </div>
          </div>

          <button className="btn btn-dark" onClick={async () => {
            setSavingGa(true); setGaMsg(null)
            const { error } = await supabase.from('organizations').update({ ga_property_id: gaPropertyId || null }).eq('id', orgId())
            setSavingGa(false)
            if (error) setGaMsg({ type: 'error', text: error.message })
            else setGaMsg({ type: 'success', text: gaPropertyId ? 'GA4 Property ID saved' : 'GA4 disconnected' })
            loadData()
          }} disabled={savingGa}>
            {savingGa ? 'Saving…' : gaPropertyId ? 'Save Property ID' : 'Disconnect GA4'}
          </button>
        </Section>

        <Section title="Meta Ads">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1877f2', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>META</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Meta Ads</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                {metaAdAccountId ? `Connected · Account ${metaAdAccountId}` : 'Not connected'}
              </div>
            </div>
            <span className={`badge ${metaAdAccountId && metaTokenSet ? 'badge-paid' : 'badge-failed'}`}>
              {metaAdAccountId && metaTokenSet ? '● Connected' : '○ Not connected'}
            </span>
          </div>

          {metaMsg && (
            <div className={`alert ${metaMsg.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
              {metaMsg.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span style={{ fontWeight: 600 }}>{metaMsg.text}</span>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Ad Account ID</label>
              <input type="text" placeholder="123456789" value={metaAdAccountId} onChange={e => setMetaAdAccountId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }} />
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                Just the number — no &quot;act_&quot; prefix. Find in: Meta Business Suite → Ad Account Settings → Ad Account ID.
              </p>
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>
                Access Token {metaTokenSet && <span style={{ color: '#007a48', fontWeight: 400 }}>(leave blank to keep existing)</span>}
              </label>
              <input type="password" placeholder={metaTokenSet ? '••••••••••••••••' : 'Long-lived access token'} value={metaAccessToken} onChange={e => setMetaAccessToken(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }} />
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                Generate a long-lived token from the Meta Graph API Explorer or a System User in Business Manager.
              </p>
            </div>
          </div>

          <button className="btn btn-dark" onClick={async () => {
            setSavingMeta(true); setMetaMsg(null)
            const id = orgId()
            if (!id) { setMetaMsg({ type: 'error', text: 'No active org found' }); setSavingMeta(false); return }
            const updates: any = { meta_ad_account_id: metaAdAccountId.replace(/^act_/i, '').trim() || null }
            if (metaAccessToken) updates.meta_access_token = metaAccessToken
            else if (!metaAdAccountId.trim()) updates.meta_access_token = null
            const { error } = await supabase.from('organizations').update(updates).eq('id', id)
            setSavingMeta(false)
            if (error) setMetaMsg({ type: 'error', text: error.message })
            else setMetaMsg({ type: 'success', text: metaAdAccountId ? 'Meta Ads credentials saved' : 'Meta Ads disconnected' })
            loadData()
          }} disabled={savingMeta}>
            {savingMeta ? 'Saving…' : metaAdAccountId ? 'Save Meta Ads' : 'Disconnect Meta Ads'}
          </button>
        </Section>

        <Section title="Amazon Ad Spend">
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Enter your total Amazon ad spend for a month. The full amount will be included in all ad spend calculations (Total Ad Spend, ROAS, CAC).
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <select value={amzMonth} onChange={e => { const m = Number(e.target.value); setAmzMonth(m); loadAmzSpend(amzYear, m) }}
              style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', outline: 'none' }}>
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select value={amzYear} onChange={e => { const y = Number(e.target.value); setAmzYear(y); loadAmzSpend(y, amzMonth) }}
              style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', outline: 'none' }}>
              {[amzYear - 1, amzYear, amzYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {amzMsg && (
            <div className={`alert ${amzMsg.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
              {amzMsg.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span style={{ fontWeight: 600 }}>{amzMsg.text}</span>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Total Amazon Ad Spend ($)</label>
            <input type="number" step="any" placeholder="e.g. 5000"
              value={amzSpend}
              onChange={e => setAmzSpend(e.target.value)}
              style={{ width: '100%', maxWidth: 280, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }} />
          </div>

          <button className="btn btn-dark" onClick={handleSaveAmzSpend} disabled={savingAmz}>
            {savingAmz ? 'Saving…' : 'Save Amazon Ad Spend'}
          </button>
        </Section>

        <Section title="Monthly Targets">
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
            Set monthly targets for key metrics. Progress will show on KPI cards in the analytics page.
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <select value={targetMonth} onChange={e => { const m = Number(e.target.value); setTargetMonth(m); loadTargets(targetYear, m) }}
              style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', outline: 'none' }}>
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select value={targetYear} onChange={e => { const y = Number(e.target.value); setTargetYear(y); loadTargets(y, targetMonth) }}
              style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', outline: 'none' }}>
              {[targetYear - 1, targetYear, targetYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {targetMsg && (
            <div className={`alert ${targetMsg.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
              {targetMsg.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span style={{ fontWeight: 600 }}>{targetMsg.text}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { key: 'sales_target', label: 'Sales Target ($)', placeholder: 'e.g. 50000' },
              { key: 'ad_spend_budget', label: 'Ad Spend Budget ($)', placeholder: 'e.g. 10000' },
              { key: 'roas_target', label: 'ROAS Target (x)', placeholder: 'e.g. 4.0' },
              { key: 'aov_target', label: 'AOV Target ($)', placeholder: 'e.g. 65' },
              { key: 'cac_target', label: 'CAC Target ($)', placeholder: 'e.g. 15' },
            ].map(f => (
              <div key={f.key}>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type="number" step="any" placeholder={f.placeholder}
                  value={targets[f.key as keyof typeof targets]}
                  onChange={e => setTargets(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }} />
              </div>
            ))}
          </div>

          <button className="btn btn-dark" onClick={handleSaveTargets} disabled={savingTargets}>
            {savingTargets ? 'Saving…' : 'Save Targets'}
          </button>
        </Section>

        <Section title="Other integrations">
          {[
            { name: 'Amazon', desc: 'Sync marketplace sales', status: 'coming soon' },
            { name: 'Google Ads', desc: 'Sync campaign performance', status: 'coming soon' },
          ].map(i => (
            <div key={i.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{i.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>{i.desc}</div>
              </div>
              <span className="badge badge-gray">
                {i.status}
              </span>
            </div>
          ))}
        </Section>

        <Section title="Account">
          <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
            Signed in as <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{user?.email}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
            Role: <span style={{ fontWeight: 600 }}>{profile?.role ?? 'viewer'}</span>
          </div>
        </Section>

      </div>
    </div>
  )
}
