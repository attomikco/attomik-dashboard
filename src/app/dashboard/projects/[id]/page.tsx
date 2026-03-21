'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Trash2, ArrowLeft, Building2, CheckCircle, AlertCircle } from 'lucide-react'

interface Member { id: string; full_name: string | null; role: string; created_at: string; is_superadmin?: boolean }
interface Org { id: string; name: string; slug: string; created_at: string; shopify_domain: string | null; meta_ad_account_id: string | null; channels: Record<string, boolean>; timezone: string | null; logo_url: string | null; header_url: string | null }
interface PendingInvite { id: string; email: string; role: string; created_at: string; status: string }

const CHANNELS = [
  { key: 'shopify',  label: 'Shopify',     color: '#96bf48', desc: 'Orders, customers, revenue' },
  { key: 'amazon',   label: 'Amazon',      color: '#ff9900', desc: 'Marketplace sales & units' },
  { key: 'walmart',  label: 'Walmart',     color: '#0071ce', desc: 'Marketplace sales & units' },
  { key: 'meta',     label: 'Meta Ads',    color: '#1877f2', desc: 'Facebook & Instagram ads' },
  { key: 'google',   label: 'Google Ads',  color: '#4285f4', desc: 'Search & shopping campaigns' },
  { key: 'tiktok',   label: 'TikTok Ads',  color: '#000000', desc: 'TikTok campaigns' },
]

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin:  'Can manage settings and upload data',
  member: 'Can view all data and upload CSVs',
  viewer: 'Read-only access to analytics',
}


const US_TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern Time (ET) — New York, Miami' },
  { value: 'America/Chicago',     label: 'Central Time (CT) — Chicago, Dallas' },
  { value: 'America/Denver',      label: 'Mountain Time (MT) — Denver, Phoenix' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) — Los Angeles, Seattle' },
  { value: 'America/Anchorage',   label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii Time (HT)' },
  { value: 'America/Mexico_City', label: 'Central Mexico (CT) — Mexico City' },
  { value: 'America/Bogota',      label: 'Colombia Time — Bogotá' },
  { value: 'America/Sao_Paulo',   label: 'Brazil Time — São Paulo' },
  { value: 'Europe/London',       label: 'Greenwich Mean Time — London' },
  { value: 'Europe/Paris',        label: 'Central European Time — Paris, Madrid' },
  { value: 'Asia/Tokyo',          label: 'Japan Standard Time — Tokyo' },
  { value: 'Australia/Sydney',    label: 'Australian Eastern Time — Sydney' },
]

function SettingsTab({ org, onSaved, supabase }: { org: Org; onSaved: () => void; supabase: any }) {
  const [name, setName] = useState(org.name)
  const [timezone, setTimezone] = useState(org.timezone ?? 'America/New_York')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoUrl, setLogoUrl] = useState(org.logo_url ?? '')
  const [headerUrl, setHeaderUrl] = useState(org.header_url ?? '')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingHeader, setUploadingHeader] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('organizations').update({ name, timezone }).eq('id', org.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved()
  }

  const uploadImage = async (file: File, type: 'logo' | 'header') => {
    const setter = type === 'logo' ? setUploadingLogo : setUploadingHeader
    setter(true)
    const ext = file.name.split('.').pop()
    const path = `${org.id}/${type}.${ext}`
    const { error } = await supabase.storage.from('org-assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('org-assets').getPublicUrl(path)
      const url = data.publicUrl
      if (type === 'logo') { setLogoUrl(url); await supabase.from('organizations').update({ logo_url: url }).eq('id', org.id) }
      else { setHeaderUrl(url); await supabase.from('organizations').update({ header_url: url }).eq('id', org.id) }
      onSaved()
    }
    setter(false)
  }

  const input: React.CSSProperties = { padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 6, fontFamily: 'Barlow, sans-serif', fontSize: '0.9375rem', outline: 'none', background: '#fff', color: '#000', width: '100%' }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 24 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20, fontFamily: 'Barlow, sans-serif' }}>Organization</div>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif' }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={input} onFocus={e => (e.target.style.borderColor = '#00ff97')} onBlur={e => (e.target.style.borderColor = '#e0e0e0')} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif' }}>Slug</label>
            <div style={{ padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 6, background: '#f2f2f2', fontFamily: 'DM Mono, monospace', fontSize: '0.875rem', color: '#999' }}>{org.slug}</div>
            <p style={{ fontSize: '0.75rem', color: '#999', marginTop: 4, fontFamily: 'Barlow, sans-serif' }}>Slug cannot be changed after creation</p>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif' }}>Org ID</label>
            <div style={{ padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 6, background: '#f2f2f2', fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', color: '#999' }}>{org.id}</div>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 24 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'Barlow, sans-serif' }}>Timezone</div>
        <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: 16, fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
          Match this to the timezone in your Shopify store settings. All date filters will use this timezone so sales line up correctly.
        </p>
        <select value={timezone} onChange={e => setTimezone(e.target.value)}
          style={{ ...input, cursor: 'pointer' }}
          onFocus={e => (e.target.style.borderColor = '#00ff97')}
          onBlur={e => (e.target.style.borderColor = '#e0e0e0')}>
          {US_TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#999', fontFamily: 'DM Mono, monospace' }}>
          Current: {new Date().toLocaleString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 24 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20, fontFamily: 'Barlow, sans-serif' }}>Branding</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Logo */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif' }}>Square Logo</label>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 80, height: 80, borderRadius: 12, border: '2px dashed #e0e0e0', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 10, cursor: 'pointer' }}
                onClick={() => document.getElementById('logo-upload')?.click()}>
                {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.72rem', color: '#999', fontFamily: 'Barlow, sans-serif', textAlign: 'center', padding: 8 }}>Click to upload</span>}
              </div>
              <input id="logo-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'logo')} />
              <button onClick={() => document.getElementById('logo-upload')?.click()} disabled={uploadingLogo} style={{ padding: '6px 14px', background: '#000', color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                {uploadingLogo ? 'Uploading…' : logoUrl ? 'Replace' : 'Upload logo'}
              </button>
              <p style={{ fontSize: '0.72rem', color: '#999', marginTop: 6, fontFamily: 'Barlow, sans-serif' }}>PNG or JPG, square recommended</p>
            </div>
          </div>
          {/* Header */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif' }}>Header Image</label>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '100%', height: 80, borderRadius: 12, border: '2px dashed #e0e0e0', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 10, cursor: 'pointer' }}
                onClick={() => document.getElementById('header-upload')?.click()}>
                {headerUrl ? <img src={headerUrl} alt="Header" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.72rem', color: '#999', fontFamily: 'Barlow, sans-serif' }}>Click to upload</span>}
              </div>
              <input id="header-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'header')} />
              <button onClick={() => document.getElementById('header-upload')?.click()} disabled={uploadingHeader} style={{ padding: '6px 14px', background: '#000', color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                {uploadingHeader ? 'Uploading…' : headerUrl ? 'Replace' : 'Upload header'}
              </button>
              <p style={{ fontSize: '0.72rem', color: '#999', marginTop: 6, fontFamily: 'Barlow, sans-serif' }}>Wide image, 1200×300px recommended</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', background: saving ? '#ccc' : '#00ff97', color: '#000', fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.9375rem', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', transition: '0.15s' }}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#007a48', fontSize: '0.875rem', fontFamily: 'Barlow, sans-serif' }}>
            <CheckCircle size={16} /> Saved
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [org, setOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState<Record<string, boolean>>({})
  const [savingChannels, setSavingChannels] = useState(false)
  const [channelsSaved, setChannelsSaved] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [inviteMsg, setInviteMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'access' | 'channels' | 'settings'>('channels')

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    setLoading(true)
    const { data: orgData } = await supabase.from('organizations').select('*').eq('id', id).single()
    setOrg(orgData)
    setChannels(orgData?.channels ?? {})
    const { data: profileData } = await supabase.from('profiles').select('id, full_name, role, created_at, is_superadmin').eq('org_id', id)
    const { data: superadmins } = await supabase.from('profiles').select('id, full_name, role, created_at, is_superadmin').eq('is_superadmin', true)
    // Merge: org members + superadmins, deduplicated
    const allMembers = [...(profileData ?? []), ...(superadmins ?? [])].filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
    setMembers(allMembers)
    const { data: inviteData } = await supabase.from('invites').select('*').eq('org_id', id).eq('status', 'pending').order('created_at', { ascending: false })
    setInvites(inviteData ?? [])
    setLoading(false)
  }

  const saveChannels = async () => {
    setSavingChannels(true)
    await supabase.from('organizations').update({ channels }).eq('id', id)
    setSavingChannels(false)
    setChannelsSaved(true)
    setTimeout(() => setChannelsSaved(false), 2000)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteStatus('idle')
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, org_id: id, role: inviteRole, full_name: inviteName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invite failed')
      setInviteMsg(data.message)
      setInviteStatus('success')
      setInviteEmail('')
      setInviteName('')
      fetchData()
    } catch (err: any) {
      setInviteMsg(err.message)
      setInviteStatus('error')
    }
    setInviting(false)
  }

  const handleRemoveMember = async (profileId: string) => {
    if (!confirm('Remove this member from the project?')) return
    await supabase.from('profiles').update({ org_id: null, role: 'viewer' }).eq('id', profileId)
    fetchData()
  }

  const handleCancelInvite = async (inviteId: string) => {
    await supabase.from('invites').update({ status: 'cancelled' }).eq('id', inviteId)
    fetchData()
  }

  const input: React.CSSProperties = { padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 6, fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', outline: 'none', background: '#fff', color: '#000' }

  if (loading) return <div style={{ padding: '80px 40px', textAlign: 'center', color: '#666', fontFamily: 'Barlow, sans-serif' }}>Loading…</div>
  if (!org) return <div style={{ padding: '80px 40px', textAlign: 'center', color: '#666', fontFamily: 'Barlow, sans-serif' }}>Project not found.</div>

  return (
    <div>
      <div style={{ padding: '20px 40px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, background: '#fff', zIndex: 50 }}>
        <button onClick={() => router.push('/dashboard/projects')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', padding: 0 }}>
          <ArrowLeft size={16} /> Projects
        </button>
        <span style={{ color: '#e0e0e0' }}>/</span>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Barlow, sans-serif' }}>{org.name}</h1>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', color: '#999', background: '#f2f2f2', padding: '2px 8px', borderRadius: 4 }}>{org.slug}</span>
      </div>

      <div style={{ padding: '32px 40px 64px', maxWidth: 720 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid #e0e0e0' }}>
          {([['channels', 'Channels'], ['access', 'Access & Members'], ['settings', 'Settings']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', border: 'none', background: 'transparent', fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', fontWeight: 600, color: activeTab === tab ? '#000' : '#666', borderBottom: activeTab === tab ? '2px solid #00ff97' : '2px solid transparent', cursor: 'pointer', marginBottom: -1, transition: '0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── CHANNELS TAB ── */}
        {activeTab === 'channels' && (
          <div>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: 24, fontFamily: 'Barlow, sans-serif', lineHeight: 1.6 }}>
              Select which platforms this client uses. The dashboard will only show sections for enabled channels.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {CHANNELS.map(ch => {
                const enabled = channels[ch.key] ?? false
                return (
                  <div key={ch.key} onClick={() => setChannels(prev => ({ ...prev, [ch.key]: !prev[ch.key] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', border: `2px solid ${enabled ? ch.color : '#e0e0e0'}`, borderRadius: 10, cursor: 'pointer', background: enabled ? '#fafafa' : '#fff', transition: '0.15s', userSelect: 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: enabled ? ch.color : '#f2f2f2', display: 'grid', placeItems: 'center', flexShrink: 0, transition: '0.15s' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: enabled ? '#fff' : '#999', fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        {ch.label.slice(0, 2)}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, fontFamily: 'Barlow, sans-serif', color: enabled ? '#000' : '#444' }}>{ch.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#999', fontFamily: 'Barlow, sans-serif' }}>{ch.desc}</div>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${enabled ? ch.color : '#e0e0e0'}`, background: enabled ? ch.color : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0, transition: '0.15s' }}>
                      {enabled && <span style={{ color: '#fff', fontSize: '12px', lineHeight: 1 }}>✓</span>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={saveChannels} disabled={savingChannels} style={{ padding: '10px 24px', background: savingChannels ? '#ccc' : '#00ff97', color: '#000', fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: savingChannels ? 'not-allowed' : 'pointer', transition: '0.15s' }}>
                {savingChannels ? 'Saving…' : 'Save channels'}
              </button>
              {channelsSaved && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#007a48', fontSize: '0.875rem', fontFamily: 'Barlow, sans-serif' }}>
                  <CheckCircle size={16} /> Saved
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ACCESS TAB ── */}
        {activeTab === 'access' && (
          <div>
            {/* Invite form */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16, fontFamily: 'Barlow, sans-serif' }}>Invite someone</div>

              {inviteStatus === 'success' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#e6fff5', border: '1px solid #00cc78', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
                  <CheckCircle size={16} color="#007a48" />
                  <span style={{ fontSize: '0.875rem', color: '#007a48', fontFamily: 'Barlow, sans-serif' }}>{inviteMsg}</span>
                </div>
              )}
              {inviteStatus === 'error' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
                  <AlertCircle size={16} color="#b91c1c" />
                  <span style={{ fontSize: '0.875rem', color: '#b91c1c', fontFamily: 'Barlow, sans-serif' }}>{inviteMsg}</span>
                </div>
              )}

              <form onSubmit={handleInvite}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, alignItems: 'end', marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>Full name</label>
                    <input type="text" required placeholder="Jane Smith" value={inviteName} onChange={e => setInviteName(e.target.value)} style={{ ...input, width: '100%' }} onFocus={e => (e.target.style.borderColor = '#00ff97')} onBlur={e => (e.target.style.borderColor = '#e0e0e0')} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>Email address</label>
                    <input type="email" required placeholder="client@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ ...input, width: '100%' }} onFocus={e => (e.target.style.borderColor = '#00ff97')} onBlur={e => (e.target.style.borderColor = '#e0e0e0')} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>Role</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button type="submit" disabled={inviting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: inviting ? '#ccc' : '#00ff97', color: '#000', fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: inviting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                    <UserPlus size={15} />{inviting ? 'Sending…' : 'Invite'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
                    <div key={role} onClick={() => setInviteRole(role)} style={{ padding: '10px 12px', borderRadius: 6, border: `1px solid ${inviteRole === role ? '#00ff97' : '#e0e0e0'}`, cursor: 'pointer', background: inviteRole === role ? '#e6fff5' : '#fff', transition: '0.15s' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'Barlow, sans-serif', marginBottom: 2, textTransform: 'capitalize' }}>{role}</div>
                      <div style={{ fontSize: '0.72rem', color: '#666', fontFamily: 'Barlow, sans-serif' }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </form>
            </div>

            {/* Members table */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '14px 24px', borderBottom: '1px solid #e0e0e0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif' }}>Members ({members.length})</div>
              </div>
              {members.length === 0 ? (
                <div style={{ padding: '32px 24px', textAlign: 'center', color: '#999', fontSize: '0.875rem', fontFamily: 'Barlow, sans-serif' }}>No members yet. Invite someone above.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Member', 'Role', 'Joined', ''].map(h => <th key={h} style={{ padding: '10px 24px', background: '#f2f2f2', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', textAlign: 'left', fontFamily: 'Barlow, sans-serif' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id} style={{ borderTop: '1px solid #f2f2f2' }} onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '13px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f2f2f2', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#666', flexShrink: 0 }}>
                              {(m.full_name || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 500, fontFamily: 'Barlow, sans-serif' }}>{m.full_name || 'Unnamed user'}</div>
                              {m.is_superadmin && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#000', color: '#00ff97', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em', fontFamily: 'Barlow, sans-serif' }}>ATTOMIK</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '13px 24px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: m.role === 'admin' ? '#000' : '#f2f2f2', color: m.role === 'admin' ? '#00ff97' : '#666', fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase' }}>{m.role}</span>
                        </td>
                        <td style={{ padding: '13px 24px', fontSize: '0.875rem', color: '#999', fontFamily: 'Barlow, sans-serif' }}>
                          {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '13px 24px', textAlign: 'right' }}>
                          <button onClick={() => handleRemoveMember(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, transition: '0.15s' }} onMouseEnter={e => (e.currentTarget.style.color = '#b91c1c')} onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pending invites */}
            {invites.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '14px 24px', borderBottom: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif' }}>Pending invites ({invites.length})</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Email', 'Role', 'Invited', ''].map(h => <th key={h} style={{ padding: '10px 24px', background: '#f2f2f2', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', textAlign: 'left', fontFamily: 'Barlow, sans-serif' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {invites.map(inv => (
                      <tr key={inv.id} style={{ borderTop: '1px solid #f2f2f2' }}>
                        <td style={{ padding: '13px 24px', fontSize: '0.875rem', fontFamily: 'DM Mono, monospace' }}>{inv.email}</td>
                        <td style={{ padding: '13px 24px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#f2f2f2', color: '#666', fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase' }}>{inv.role}</span>
                        </td>
                        <td style={{ padding: '13px 24px', fontSize: '0.875rem', color: '#999', fontFamily: 'Barlow, sans-serif' }}>
                          {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td style={{ padding: '13px 24px', textAlign: 'right' }}>
                          <button onClick={() => handleCancelInvite(inv.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '0.75rem', fontFamily: 'Barlow, sans-serif', transition: '0.15s' }} onMouseEnter={e => (e.currentTarget.style.color = '#b91c1c')} onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>Cancel</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === 'settings' && (
          <SettingsTab org={org} onSaved={fetchData} supabase={supabase} />
        )}
      </div>
    </div>
  )
}
