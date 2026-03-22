'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, RefreshCw, Unplug, ShoppingBag, ExternalLink } from 'lucide-react'

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
  const [shopDomain, setShopDomain] = useState('')

  const [syncing, setSyncing]       = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; inserted: number } | null>(null)
  const [syncError, setSyncError]   = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  // Handle success/error from OAuth callback
  const [oauthMsg, setOauthMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadData()
    // Check for OAuth callback result in URL
    const params = new URLSearchParams(window.location.search)
    if (params.get('shopify_success')) {
      setOauthMsg({ type: 'success', text: `Connected to ${decodeURIComponent(params.get('shopify_success')!)}!` })
      window.history.replaceState({}, '', '/dashboard/settings')
    } else if (params.get('shopify_error')) {
      setOauthMsg({ type: 'error', text: `Connection failed: ${params.get('shopify_error')}` })
      window.history.replaceState({}, '', '/dashboard/settings')
    }
  }, [])

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
    }
  }

  const orgId = () => localStorage.getItem('activeOrgId') || org?.id

  const handleConnectShopify = () => {
    if (!shopDomain) return
    const cleanDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').trim()
    const id = orgId()
    if (!id) return
    window.location.href = `/api/shopify/install?shop=${cleanDomain}&org_id=${id}`
  }

  const handleSync = async (fullSync = false) => {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    const res = await fetch('/api/sync/shopify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId(), full_sync: fullSync }),
    })
    const data = await res.json()
    if (!res.ok) setSyncError(data.error || 'Sync failed')
    else setSyncResult(data)
    setSyncing(false)
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Shopify? Your existing order data will remain.')) return
    setDisconnecting(true)
    await supabase.from('organizations').update({ shopify_domain: null, shopify_token: null }).eq('id', orgId())
    setOauthMsg(null)
    setSyncResult(null)
    setSyncError(null)
    loadData()
    setDisconnecting(false)
  }

  const isConnected = !!org?.shopify_domain

  return (
    <div>
      {/* Topbar */}
      <div style={{ padding: '20px 40px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 50 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'var(--font-barlow), Barlow, sans-serif' }}>
            {org?.name ? `${org.name} — ` : ''}Settings
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: 2 }}>Organization & integrations</p>
        </div>
      </div>

      <div style={{ padding: '32px 40px 80px', maxWidth: 640 }}>

        {/* Org info */}
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

        {/* Shopify */}
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

          {oauthMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: oauthMsg.type === 'success' ? '#e6fff5' : '#fee2e2', border: `1px solid ${oauthMsg.type === 'success' ? '#00cc78' : '#fca5a5'}` }}>
              {oauthMsg.type === 'success' ? <CheckCircle size={16} color="#007a48" /> : <XCircle size={16} color="#b91c1c" />}
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: oauthMsg.type === 'success' ? '#007a48' : '#b91c1c' }}>{oauthMsg.text}</span>
            </div>
          )}

          {!isConnected ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Store domain</label>
                <input
                  type="text"
                  placeholder="your-store.myshopify.com"
                  value={shopDomain}
                  onChange={e => setShopDomain(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConnectShopify()}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                  You'll be redirected to Shopify to approve the connection.
                </p>
              </div>
              <div>
                <button
                  onClick={handleConnectShopify}
                  disabled={!shopDomain}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: !shopDomain ? 'var(--cream)' : 'var(--ink)', color: !shopDomain ? 'var(--muted)' : 'var(--accent)', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: !shopDomain ? 'not-allowed' : 'pointer' }}
                >
                  <ExternalLink size={14} />
                  Connect Shopify
                </button>
              </div>
            </div>
          ) : (
            {org?.shopify_synced_at && (
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 12 }}>
                Last synced: {new Date(org.shopify_synced_at).toLocaleString()}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => handleSync(false)}
                disabled={syncing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--accent)', color: '#000', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: syncing ? 'not-allowed' : 'pointer' }}
              >
                <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                {syncing ? 'Syncing…' : 'Sync new orders'}
              </button>
              <button
                onClick={() => handleSync(true)}
                disabled={syncing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--ink)', color: 'var(--accent)', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: syncing ? 'not-allowed' : 'pointer' }}
              >
                <RefreshCw size={14} />
                Full sync
              </button>
              <button
                onClick={() => { setOrg({ ...org, shopify_domain: null }); setOauthMsg(null) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--ink)', color: 'var(--accent)', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                <ExternalLink size={14} />
                Reconnect
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#fee2e2', color: '#b91c1c', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                <Unplug size={14} />
                Disconnect
              </button>
            </div>
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
        </Section>

        {/* Other integrations */}
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

        {/* Account */}
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
