'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Building2, BarChart2, ChevronDown, ChevronRight, UserPlus, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react'

const C = { ink: '#000', paper: '#fff', cream: '#f2f2f2', accent: '#00ff97', muted: '#666', border: '#e0e0e0' }

const CHANNELS = [
  { key: 'shopify', label: 'Shopify',  color: '#96bf48' },
  { key: 'amazon',  label: 'Amazon',   color: '#ff9900' },
  { key: 'meta',    label: 'Meta Ads', color: '#1877f2' },
  { key: 'google',  label: 'Google',   color: '#4285f4' },
  { key: 'tiktok',  label: 'TikTok',   color: '#000' },
]

const TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern (ET)' },
  { value: 'America/Chicago',     label: 'Central (CT)' },
  { value: 'America/Denver',      label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (HT)' },
  { value: 'America/Mexico_City', label: 'Mexico City' },
  { value: 'America/Bogota',      label: 'Bogotá' },
  { value: 'America/Sao_Paulo',   label: 'São Paulo' },
  { value: 'Europe/London',       label: 'London (GMT)' },
  { value: 'Europe/Paris',        label: 'Paris (CET)' },
  { value: 'Asia/Tokyo',          label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney',    label: 'Sydney (AET)' },
]

interface Org {
  id: string; name: string; slug: string; created_at: string
  shopify_domain: string | null; channels: Record<string, boolean> | null; timezone: string | null
}
interface Member {
  id: string; full_name: string | null; email: string | null
  role: string; status: string; invited_at: string | null; last_seen_at: string | null
}

function fmtTime(ts: string | null) {
  if (!ts) return null
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function ProjectsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, 'channels' | 'members' | 'settings'>>({})
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [membersLoading, setMembersLoading] = useState<Record<string, boolean>>({})
  const [channels, setChannels] = useState<Record<string, Record<string, boolean>>>({})
  const [savingChannels, setSavingChannels] = useState<string | null>(null)
  const [settingsState, setSettingsState] = useState<Record<string, { name: string; timezone: string; logo_url: string; header_url: string }>>({})
  const [savingSettings, setSavingSettings] = useState<string | null>(null)
  const [settingsSaved, setSettingsSaved] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState<Record<string, boolean>>({})
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState<string | null>(null)
  const [inviteMsg, setInviteMsg] = useState<Record<string, { text: string; ok: boolean }>>({})
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { fetchOrgs() }, [])

  const fetchOrgs = async () => {
    setLoading(true)
    const { data } = await supabase.from('organizations')
      .select('id, name, slug, created_at, shopify_domain, channels, timezone, logo_url, header_url').order('name')
    setOrgs(data ?? [])
    const chMap: Record<string, Record<string, boolean>> = {}
    const sMap: Record<string, { name: string; timezone: string }> = {}
    ;(data ?? []).forEach((o: Org) => {
      chMap[o.id] = o.channels ?? {}
      sMap[o.id] = { name: o.name, timezone: o.timezone ?? 'America/New_York', logo_url: (o as any).logo_url ?? '', header_url: (o as any).header_url ?? '' }
    })
    setChannels(chMap)
    setSettingsState(sMap)
    setLoading(false)
  }

  const toggleExpand = async (orgId: string) => {
    if (expanded === orgId) { setExpanded(null); return }
    setExpanded(orgId)
    if (!members[orgId]) {
      setMembersLoading(p => ({ ...p, [orgId]: true }))
      const res = await fetch(`/api/members?org_id=${orgId}`)
      const data = await res.json()
      setMembers(p => ({ ...p, [orgId]: data.members ?? [] }))
      setMembersLoading(p => ({ ...p, [orgId]: false }))
    }
  }

  const saveChannels = async (orgId: string) => {
    setSavingChannels(orgId)
    await supabase.from('organizations').update({ channels: channels[orgId] }).eq('id', orgId)
    setSavingChannels(null)
  }

  const saveSettings = async (orgId: string) => {
    setSavingSettings(orgId)
    const s = settingsState[orgId]
    await supabase.from('organizations').update({ name: s.name, timezone: s.timezone }).eq('id', orgId)
    setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, name: s.name } : o))
    setSavingSettings(null)
    setSettingsSaved(orgId)
    setTimeout(() => setSettingsSaved(null), 2000)
  }

  const uploadImage = async (orgId: string, file: File, type: 'logo' | 'header') => {
    const key = `${orgId}-${type}`
    setUploadingImage(p => ({ ...p, [key]: true }))
    const ext = file.name.split('.').pop()
    const path = `${orgId}/${type}.${ext}`
    const { error } = await supabase.storage.from('org-assets').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('org-assets').getPublicUrl(path)
      const url = data.publicUrl
      const field = type === 'logo' ? 'logo_url' : 'header_url'
      await supabase.from('organizations').update({ [field]: url }).eq('id', orgId)
      setSettingsState(p => ({ ...p, [orgId]: { ...p[orgId], [field]: url } }))
    }
    setUploadingImage(p => ({ ...p, [key]: false }))
  }

  const handleInvite = async (e: React.FormEvent, orgId: string) => {
    e.preventDefault()
    setInviting(orgId)
    setInviteMsg(p => ({ ...p, [orgId]: { text: '', ok: false } }))
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, org_id: orgId, role: inviteRole, full_name: inviteName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInviteMsg(p => ({ ...p, [orgId]: { text: data.message, ok: true } }))
      setInviteEmail(''); setInviteName('')
      const mRes = await fetch(`/api/members?org_id=${orgId}`)
      const mData = await mRes.json()
      setMembers(p => ({ ...p, [orgId]: mData.members ?? [] }))
    } catch (err: any) {
      setInviteMsg(p => ({ ...p, [orgId]: { text: err.message, ok: false } }))
    }
    setInviting(null)
  }

  const removeMember = async (userId: string, orgId: string) => {
    if (!confirm('Remove this member?')) return
    await fetch('/api/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, org_id: orgId }),
    })
    setMembers(p => ({ ...p, [orgId]: (p[orgId] ?? []).filter(m => m.id !== userId) }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true); setCreateError('')
    const cleanSlug = newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const { data: newOrg, error } = await supabase.from('organizations')
      .insert({ name: newName, slug: cleanSlug }).select().single()
    if (error) { setCreateError(error.message); setCreating(false); return }
    setNewName(''); setNewSlug(''); setShowNewForm(false); setCreating(false)
    fetchOrgs()
    if (newOrg) setTimeout(() => setExpanded(newOrg.id), 300)
  }

  const inp: React.CSSProperties = {
    padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6,
    fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', outline: 'none',
    background: C.paper, color: C.ink,
  }

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>

      {/* Topbar */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: C.paper, zIndex: 50 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Barlow, sans-serif' }}>Projects</h1>
          <p style={{ fontSize: '0.8rem', color: C.muted, marginTop: 2, fontFamily: 'Barlow, sans-serif' }}>{orgs.length} client{orgs.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowNewForm(p => !p)} style={{ padding: '8px 16px', background: C.ink, color: C.accent, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          + New Project
        </button>
      </div>

      <div style={{ padding: '24px clamp(16px,4vw,40px) 80px' }}>

        {/* New project form */}
        {showNewForm && (
          <div style={{ background: C.paper, border: `2px solid ${C.accent}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontFamily: 'Barlow, sans-serif' }}>New project</div>
              <button onClick={() => { setShowNewForm(false); setCreateError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={16} /></button>
            </div>
            {createError && (
              <div style={{ background: '#fee2e2', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: '0.8rem', color: '#b91c1c', fontFamily: 'Barlow, sans-serif' }}>{createError}</div>
            )}
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</label>
                  <input style={{ ...inp, width: '100%' }} placeholder="Brand X" value={newName}
                    onChange={e => { setNewName(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')) }}
                    onFocus={e => (e.target.style.borderColor = C.accent)} onBlur={e => (e.target.style.borderColor = C.border)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Slug</label>
                  <input style={{ ...inp, width: '100%', fontFamily: 'DM Mono, monospace', background: C.cream }} value={newSlug}
                    onChange={e => setNewSlug(e.target.value)}
                    onFocus={e => (e.target.style.borderColor = C.accent)} onBlur={e => (e.target.style.borderColor = C.border)} required />
                </div>
                <button type="submit" disabled={creating} style={{ padding: '8px 20px', background: creating ? '#ccc' : C.accent, color: C.ink, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: creating ? 'not-allowed' : 'pointer' }}>
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted, fontFamily: 'Barlow, sans-serif' }}>Loading…</div>
        ) : (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {orgs.map((org, i) => {
              const isOpen = expanded === org.id
              const orgChannels = channels[org.id] ?? {}
              const orgMembers = members[org.id] ?? []
              const activeChannels = CHANNELS.filter(c => orgChannels[c.key])
              const tab = activeTab[org.id] ?? 'channels'

              return (
                <div key={org.id} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>

                  {/* Row */}
                  <div
                    onClick={() => toggleExpand(org.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer', background: isOpen ? '#fafafa' : C.paper, transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = '#fafafa' }}
                    onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = C.paper }}
                  >
                    <div style={{ flexShrink: 0, color: C.muted, display: 'flex' }}>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: C.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Building2 size={15} color={C.accent} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'Barlow, sans-serif' }}>{org.name}</div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: '#aaa' }}>{org.slug}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {activeChannels.length > 0
                        ? activeChannels.map(c => (
                            <span key={c.key} style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${c.color}18`, color: c.color, fontFamily: 'Barlow, sans-serif', border: `1px solid ${c.color}40` }}>
                              {c.label}
                            </span>
                          ))
                        : <span style={{ fontSize: '0.72rem', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>No channels</span>
                      }
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); localStorage.setItem('activeOrgId', org.id); router.push('/dashboard/analytics') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: C.ink, color: C.accent, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.75rem', border: 'none', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}
                    >
                      <BarChart2 size={12} /> Analytics
                    </button>
                  </div>

                  {/* Expanded panel */}
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${C.border}`, background: '#fafafa' }}>

                      {/* Tabs */}
                      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 24px' }}>
                        {(['channels', 'members', 'settings'] as const).map(t => (
                          <button key={t} onClick={() => setActiveTab(p => ({ ...p, [org.id]: t }))}
                            style={{ padding: '10px 16px', border: 'none', background: 'transparent', fontFamily: 'Barlow, sans-serif', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer', color: tab === t ? C.ink : C.muted, borderBottom: `2px solid ${tab === t ? C.accent : 'transparent'}`, marginBottom: -1, transition: '0.15s' }}>
                            {t}
                          </button>
                        ))}
                      </div>

                      <div style={{ padding: '20px 24px 24px' }}>

                        {/* ── Channels tab ── */}
                        {tab === 'channels' && (
                          <div style={{ maxWidth: 400 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                              {CHANNELS.map(ch => {
                                const enabled = orgChannels[ch.key] ?? false
                                return (
                                  <label key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1.5px solid ${enabled ? ch.color : C.border}`, borderRadius: 8, cursor: 'pointer', transition: '0.15s', background: C.paper, userSelect: 'none' }}>
                                    <input type="checkbox" checked={enabled}
                                      onChange={() => setChannels(p => ({ ...p, [org.id]: { ...(p[org.id] ?? {}), [ch.key]: !(p[org.id]?.[ch.key]) } }))}
                                      style={{ accentColor: ch.color, width: 15, height: 15, flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.875rem', fontWeight: enabled ? 700 : 400, fontFamily: 'Barlow, sans-serif', color: enabled ? C.ink : C.muted }}>{ch.label}</span>
                                    {enabled && <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: ch.color }} />}
                                  </label>
                                )
                              })}
                            </div>
                            <button onClick={() => saveChannels(org.id)} disabled={savingChannels === org.id}
                              style={{ padding: '7px 16px', background: savingChannels === org.id ? '#ccc' : C.accent, color: C.ink, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.8rem', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                              {savingChannels === org.id ? 'Saving…' : 'Save channels'}
                            </button>
                          </div>
                        )}

                        {/* ── Members tab ── */}
                        {tab === 'members' && (
                          <div style={{ maxWidth: 560 }}>
                            {inviteMsg[org.id]?.text && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 6, marginBottom: 10, background: inviteMsg[org.id].ok ? '#e6fff5' : '#fee2e2', border: `1px solid ${inviteMsg[org.id].ok ? '#00cc78' : '#fca5a5'}` }}>
                                {inviteMsg[org.id].ok ? <CheckCircle size={13} color="#007a48" /> : <AlertCircle size={13} color="#b91c1c" />}
                                <span style={{ fontSize: '0.78rem', color: inviteMsg[org.id].ok ? '#007a48' : '#b91c1c', fontFamily: 'Barlow, sans-serif' }}>{inviteMsg[org.id].text}</span>
                              </div>
                            )}
                            <form onSubmit={e => handleInvite(e, org.id)} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                <input placeholder="Name" value={inviteName} onChange={e => setInviteName(e.target.value)}
                                  style={{ ...inp, width: '100%' }} onFocus={e => (e.target.style.borderColor = C.accent)} onBlur={e => (e.target.style.borderColor = C.border)} />
                                <input type="email" placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
                                  style={{ ...inp, width: '100%' }} onFocus={e => (e.target.style.borderColor = C.accent)} onBlur={e => (e.target.style.borderColor = C.border)} />
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...inp, flex: 1, cursor: 'pointer' }}>
                                  <option value="viewer">Viewer</option>
                                  <option value="member">Member</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <button type="submit" disabled={inviting === org.id}
                                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: inviting === org.id ? '#ccc' : C.ink, color: inviting === org.id ? C.muted : C.accent, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.8rem', border: 'none', borderRadius: 6, cursor: inviting === org.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                                  <UserPlus size={13} />{inviting === org.id ? '…' : 'Invite'}
                                </button>
                              </div>
                            </form>
                            {membersLoading[org.id] ? (
                              <div style={{ color: C.muted, fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif' }}>Loading…</div>
                            ) : orgMembers.length === 0 ? (
                              <div style={{ color: '#ccc', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif' }}>No members yet.</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {orgMembers.map(m => (
                                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', background: C.paper, borderRadius: 6 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: C.cream, display: 'grid', placeItems: 'center', fontSize: '0.6rem', fontWeight: 700, color: C.muted, flexShrink: 0 }}>
                                      {(m.full_name || m.email || 'U').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Barlow, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {m.full_name || m.email}
                                      </div>
                                      <div style={{ fontSize: '0.65rem', color: '#aaa', fontFamily: 'Barlow, sans-serif' }}>
                                        {m.last_seen_at ? `Seen ${fmtTime(m.last_seen_at)}` : m.invited_at ? `Invited ${fmtTime(m.invited_at)}` : ''}
                                      </div>
                                    </div>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: m.role === 'admin' ? C.ink : C.cream, color: m.role === 'admin' ? C.accent : C.muted, fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase', flexShrink: 0 }}>
                                      {m.role}
                                    </span>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: 20, fontFamily: 'Barlow, sans-serif', flexShrink: 0, background: m.status === 'joined' ? '#e6fff5' : '#fff8e1', color: m.status === 'joined' ? '#007a48' : '#b45309' }}>
                                      {m.status === 'joined' ? '✓ Joined' : '⏳ Invited'}
                                    </span>
                                    <button onClick={() => removeMember(m.id, org.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', padding: 2, flexShrink: 0, transition: '0.15s' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = '#b91c1c')}
                                      onMouseLeave={e => (e.currentTarget.style.color = '#ddd')}>
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Settings tab ── */}
                        {tab === 'settings' && (
                          <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Barlow, sans-serif', display: 'block', marginBottom: 6 }}>Project name</label>
                              <input value={settingsState[org.id]?.name ?? org.name}
                                onChange={e => setSettingsState(p => ({ ...p, [org.id]: { ...p[org.id], name: e.target.value } }))}
                                style={{ ...inp, width: '100%' }}
                                onFocus={e => (e.target.style.borderColor = C.accent)}
                                onBlur={e => (e.target.style.borderColor = C.border)} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Barlow, sans-serif', display: 'block', marginBottom: 6 }}>Slug</label>
                              <div style={{ ...inp, background: C.cream, color: '#aaa', fontFamily: 'DM Mono, monospace', fontSize: '0.8rem' }}>{org.slug}</div>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Barlow, sans-serif', display: 'block', marginBottom: 6 }}>Timezone</label>
                              <p style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 8, fontFamily: 'Barlow, sans-serif' }}>
                                Match this to your Shopify store timezone so date filters line up correctly.
                              </p>
                              <select value={settingsState[org.id]?.timezone ?? 'America/New_York'}
                                onChange={e => setSettingsState(p => ({ ...p, [org.id]: { ...p[org.id], timezone: e.target.value } }))}
                                style={{ ...inp, width: '100%', cursor: 'pointer' }}
                                onFocus={e => (e.target.style.borderColor = C.accent)}
                                onBlur={e => (e.target.style.borderColor = C.border)}>
                                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                              </select>
                              <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 6, fontFamily: 'DM Mono, monospace' }}>
                                Now: {new Date().toLocaleString('en-US', { timeZone: settingsState[org.id]?.timezone ?? 'America/New_York', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <button onClick={() => saveSettings(org.id)} disabled={savingSettings === org.id}
                                style={{ padding: '8px 20px', background: savingSettings === org.id ? '#ccc' : C.accent, color: C.ink, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                {savingSettings === org.id ? 'Saving…' : 'Save settings'}
                              </button>
                              {settingsSaved === org.id && (
                                <span style={{ fontSize: '0.875rem', color: '#007a48', fontFamily: 'Barlow, sans-serif' }}>✓ Saved</span>
                              )}
                            </div>

                            {/* Branding */}
                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4 }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Barlow, sans-serif', marginBottom: 14 }}>Branding</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                {/* Logo */}
                                <div>
                                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: 8, fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Square Logo</label>
                                  <div
                                    onClick={() => document.getElementById(`logo-${org.id}`)?.click()}
                                    style={{ width: 72, height: 72, borderRadius: 10, border: `2px dashed ${C.border}`, background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8, cursor: 'pointer' }}>
                                    {settingsState[org.id]?.logo_url
                                      ? <img src={settingsState[org.id].logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      : <span style={{ fontSize: '0.65rem', color: '#bbb', fontFamily: 'Barlow, sans-serif', textAlign: 'center', padding: 6 }}>Click to upload</span>
                                    }
                                  </div>
                                  <input id={`logo-${org.id}`} type="file" accept="image/*" style={{ display: 'none' }}
                                    onChange={e => e.target.files?.[0] && uploadImage(org.id, e.target.files[0], 'logo')} />
                                  <button onClick={() => document.getElementById(`logo-${org.id}`)?.click()}
                                    disabled={uploadingImage[`${org.id}-logo`]}
                                    style={{ padding: '5px 12px', background: C.ink, color: C.paper, border: 'none', borderRadius: 6, fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
                                    {uploadingImage[`${org.id}-logo`] ? 'Uploading…' : settingsState[org.id]?.logo_url ? 'Replace' : 'Upload'}
                                  </button>
                                  <p style={{ fontSize: '0.65rem', color: '#bbb', marginTop: 4, fontFamily: 'Barlow, sans-serif' }}>Square, PNG/JPG</p>
                                </div>
                                {/* Header */}
                                <div>
                                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: 8, fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Header Image</label>
                                  <div
                                    onClick={() => document.getElementById(`header-${org.id}`)?.click()}
                                    style={{ width: '100%', height: 72, borderRadius: 10, border: `2px dashed ${C.border}`, background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8, cursor: 'pointer' }}>
                                    {settingsState[org.id]?.header_url
                                      ? <img src={settingsState[org.id].header_url} alt="Header" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      : <span style={{ fontSize: '0.65rem', color: '#bbb', fontFamily: 'Barlow, sans-serif' }}>Click to upload</span>
                                    }
                                  </div>
                                  <input id={`header-${org.id}`} type="file" accept="image/*" style={{ display: 'none' }}
                                    onChange={e => e.target.files?.[0] && uploadImage(org.id, e.target.files[0], 'header')} />
                                  <button onClick={() => document.getElementById(`header-${org.id}`)?.click()}
                                    disabled={uploadingImage[`${org.id}-header`]}
                                    style={{ padding: '5px 12px', background: C.ink, color: C.paper, border: 'none', borderRadius: 6, fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
                                    {uploadingImage[`${org.id}-header`] ? 'Uploading…' : settingsState[org.id]?.header_url ? 'Replace' : 'Upload'}
                                  </button>
                                  <p style={{ fontSize: '0.65rem', color: '#bbb', marginTop: 4, fontFamily: 'Barlow, sans-serif' }}>Wide, 1200×300px recommended</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .proj-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
