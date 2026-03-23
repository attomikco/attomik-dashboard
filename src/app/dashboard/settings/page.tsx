'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, RefreshCw, Unplug, ShoppingBag } from 'lucide-react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginBottom: 24 }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
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
    }
  }

  const orgId = () => localStorage.getItem('activeOrgId') || org?.id

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
      const startYear = 2020
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
      <div style={{ padding: '20px 40px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 50 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'var(--font-barlow), Barlow, sans-serif' }}>
            {org?.name ? `${org.name} — ` : ''}Settings
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: 2 }}>Organization & integrations</p>
        </div>
      </div>

      <div style={{ padding: '32px 40px 80px', maxWidth: 640 }}>

        <Section title="Organization">
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Name</label>
              <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--cream)' }}>{org?.name || '—'}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Slug</label>
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
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
              padding: '3px 10px', borderRadius: 20,
              background: isConnected ? '#e6fff5' : '#fee2e2',
              color: isConnected ? '#007a48' : '#b91c1c',
            }}>
              {isConnected ? '● Connected' : '○ Not connected'}
            </span>
          </div>

          {saveMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: saveMsg.type === 'success' ? '#e6fff5' : '#fee2e2', border: `1px solid ${saveMsg.type === 'success' ? '#00cc78' : '#fca5a5'}` }}>
              {saveMsg.type === 'success' ? <CheckCircle size={16} color="#007a48" /> : <XCircle size={16} color="#b91c1c" />}
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: saveMsg.type === 'success' ? '#007a48' : '#b91c1c' }}>{saveMsg.text}</span>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Store domain</label>
              <input type="text" placeholder="your-store.myshopify.com" value={domain} onChange={e => setDomain(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                Client ID {isConnected && <span style={{ color: '#007a48', fontWeight: 400 }}>(leave blank to keep existing)</span>}
              </label>
              <input type="text" placeholder={isConnected ? '••••••••••••••••' : 'Client ID from Dev Dashboard'} value={clientId} onChange={e => setClientId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
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
            <button onClick={handleSaveShopify} disabled={saving || !domain || (!clientId && !isConnected)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: (saving || !domain || (!clientId && !isConnected)) ? 'var(--cream)' : 'var(--ink)', color: (saving || !domain || (!clientId && !isConnected)) ? 'var(--muted)' : 'var(--accent)', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: (saving || !domain || (!clientId && !isConnected)) ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Connecting…' : isConnected ? 'Update connection' : 'Connect Shopify'}
            </button>

            {isConnected && (<>
              <button onClick={() => handleSync(false)} disabled={syncing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--accent)', color: '#000', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: syncing ? 'not-allowed' : 'pointer' }}>
                <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                {syncing ? 'Syncing…' : 'Sync new orders'}
              </button>
              <button onClick={() => handleSync(true)} disabled={syncing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--ink)', color: 'var(--accent)', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: syncing ? 'not-allowed' : 'pointer' }}>
                <RefreshCw size={14} />
                Full sync
              </button>
              <button onClick={handleClean} disabled={cleaning}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'var(--cream)', color: 'var(--ink)', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: '1px solid var(--border)', borderRadius: 6, cursor: cleaning ? 'not-allowed' : 'pointer' }}>
                {cleaning ? '…' : '🧹'} {cleaning ? 'Cleaning…' : 'Clean duplicates'}
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#fee2e2', color: '#b91c1c', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginTop: 12, background: '#e6fff5', border: '1px solid #00cc78' }}>
              <CheckCircle size={16} color="#007a48" />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#007a48' }}>
                {syncResult.message || `Synced ${syncResult.synced} orders · ${syncResult.inserted} new`}
              </span>
            </div>
          )}
          {syncError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginTop: 12, background: '#fee2e2', border: '1px solid #fca5a5' }}>
              <XCircle size={16} color="#b91c1c" />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#b91c1c' }}>{syncError}</span>
            </div>
          )}
          {cleanResult !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginTop: 12, background: '#e6fff5', border: '1px solid #00cc78' }}>
              <CheckCircle size={16} color="#007a48" />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#007a48' }}>
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
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
              padding: '3px 10px', borderRadius: 20,
              background: gaPropertyId ? '#e6fff5' : '#fee2e2',
              color: gaPropertyId ? '#007a48' : '#b91c1c',
            }}>
              {gaPropertyId ? '● Connected' : '○ Not connected'}
            </span>
          </div>

          {gaMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: gaMsg.type === 'success' ? '#e6fff5' : '#fee2e2', border: `1px solid ${gaMsg.type === 'success' ? '#00cc78' : '#fca5a5'}` }}>
              {gaMsg.type === 'success' ? <CheckCircle size={16} color="#007a48" /> : <XCircle size={16} color="#b91c1c" />}
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: gaMsg.type === 'success' ? '#007a48' : '#b91c1c' }}>{gaMsg.text}</span>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>GA4 Property ID</label>
              <input type="text" placeholder="e.g. 482126930" value={gaPropertyId} onChange={e => setGaPropertyId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }} />
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                Find in: Google Analytics → Admin → Property Settings → Property ID. Make sure the Attomik service account has Viewer access to this property.
              </p>
            </div>
          </div>

          <button onClick={async () => {
            setSavingGa(true); setGaMsg(null)
            const { error } = await supabase.from('organizations').update({ ga_property_id: gaPropertyId || null }).eq('id', orgId())
            setSavingGa(false)
            if (error) setGaMsg({ type: 'error', text: error.message })
            else setGaMsg({ type: 'success', text: gaPropertyId ? 'GA4 Property ID saved' : 'GA4 disconnected' })
            loadData()
          }} disabled={savingGa}
            style={{ padding: '10px 20px', background: savingGa ? 'var(--cream)' : 'var(--ink)', color: savingGa ? 'var(--muted)' : 'var(--accent)', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: savingGa ? 'not-allowed' : 'pointer' }}>
            {savingGa ? 'Saving…' : gaPropertyId ? 'Save Property ID' : 'Disconnect GA4'}
          </button>
        </Section>

        <Section title="Other integrations">
          {[
            { name: 'Meta Ads', desc: 'Sync ad spend + ROAS', status: 'coming soon' },
            { name: 'Amazon', desc: 'Sync marketplace sales', status: 'coming soon' },
            { name: 'Google Ads', desc: 'Sync campaign performance', status: 'coming soon' },
          ].map(i => (
            <div key={i.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{i.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>{i.desc}</div>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '3px 9px', borderRadius: 20, background: 'var(--cream)', color: 'var(--muted)' }}>
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
