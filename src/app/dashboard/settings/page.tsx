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

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{label}</label>
      <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--cream)', fontFamily: mono ? 'var(--font-mono)' : undefined }}>
        {value || '—'}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const supabase = createClient()

  const [user, setUser]       = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [org, setOrg]         = useState<any>(null)

  const [domain, setDomain]   = useState('')
  const [token, setToken]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [syncing, setSyncing]       = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; inserted: number } | null>(null)
  const [syncError, setSyncError]   = useState<string | null>(null)

  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) return
    const { data: prof } = await supabase
      .from('profiles').select('*, organizations(*)').eq('id', user.id).single()
    setProfile(prof)
    const o = (prof as any)?.organizations
    setOrg(o)
    if (o?.shopify_domain) setDomain(o.shopify_domain)
  }

  const orgId = () => localStorage.getItem('activeOrgId') || org?.id

  const handleSaveShopify = async () => {
    setSaving(true)
    setSaveMsg(null)
    const id = orgId()
    if (!id) { setSaveMsg({ type: 'error', text: 'No active org found' }); setSaving(false); return }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').trim()

    const testRes = await fetch('/api/shopify/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: cleanDomain, token }),
    })
    const testData = await testRes.json()
    if (!testRes.ok) {
      setSaveMsg({ type: 'error', text: testData.error || 'Could not connect to Shopify. Check your domain and token.' })
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('organizations')
      .update({ shopify_domain: cleanDomain, shopify_token: token })
      .eq('id', id)

    if (error) {
      setSaveMsg({ type: 'error', text: error.message })
    } else {
      setSaveMsg({ type: 'success', text: `Connected to ${testData.shop_name}!` })
      setDomain(cleanDomain)
      setToken('')
      loadData()
    }
    setSaving(false)
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    const res = await fetch('/api/sync/shopify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId() }),
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
    setDomain('')
    setToken('')
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
            <Field label="Name" value={org?.name} />
            <Field label="Slug" value={org?.slug} mono />
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
                {isConnected ? `Connected · ${org.shopify_domain}` : 'Not connected · Enter your store details below'}
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

          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Store domain</label>
              <input
                type="text"
                placeholder="your-store.myshopify.com"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                Admin API token {isConnected && <span style={{ color: '#007a48' }}>(leave blank to keep existing)</span>}
              </label>
              <input
                type="password"
                placeholder={isConnected ? '••••••••••••••••' : 'shpat_xxxxxxxxxxxxxxxx'}
                value={token}
                onChange={e => setToken(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                Shopify Admin → Settings → Apps → Develop apps → Create app → Admin API access token
              </p>
            </div>
          </div>

          {saveMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: saveMsg.type === 'success' ? '#e6fff5' : '#fee2e2', border: `1px solid ${saveMsg.type === 'success' ? '#00cc78' : '#fca5a5'}` }}>
              {saveMsg.type === 'success' ? <CheckCircle size={16} color="#007a48" /> : <XCircle size={16} color="#b91c1c" />}
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: saveMsg.type === 'success' ? '#007a48' : '#b91c1c' }}>{saveMsg.text}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleSaveShopify}
              disabled={saving || !domain || (!token && !isConnected)}
              style={{ padding: '10px 20px', background: saving ? 'var(--cream)' : 'var(--ink)', color: saving ? 'var(--muted)' : 'var(--accent)', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Connecting…' : isConnected ? 'Update connection' : 'Connect Shopify'}
            </button>

            {isConnected && (<>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--accent)', color: '#000', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: syncing ? 'not-allowed' : 'pointer' }}
              >
                <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#fee2e2', color: '#b91c1c', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                <Unplug size={14} />
                Disconnect
              </button>
            </>)}
          </div>

          {syncResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginTop: 12, background: '#e6fff5', border: '1px solid #00cc78' }}>
              <CheckCircle size={16} color="#007a48" />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#007a48' }}>
                Synced {syncResult.synced} orders · {syncResult.inserted} new
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

        <Section title="Other integrations">
          {[
            { name: 'Meta Ads', desc: 'Sync ad spend + ROAS', status: org?.meta_ad_account_id ? 'connected' : 'coming soon' },
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
