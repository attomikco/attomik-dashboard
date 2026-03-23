'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Building2, BarChart2, ChevronDown, ChevronRight, UserPlus, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react'

const C = { ink: '#000', paper: '#fff', cream: '#f2f2f2', accent: '#00ff97', muted: '#666', border: '#e0e0e0' }

const CHANNELS = [
  { key: 'shopify', label: 'Shopify', color: '#96bf48' },
  { key: 'amazon',  label: 'Amazon',  color: '#ff9900' },
  { key: 'meta',    label: 'Meta Ads', color: '#1877f2' },
  { key: 'google',  label: 'Google',  color: '#4285f4' },
  { key: 'tiktok',  label: 'TikTok',  color: '#000' },
]

interface Org {
  id: string; name: string; slug: string; created_at: string
  shopify_domain: string | null; channels: Record<string, boolean> | null
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
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [membersLoading, setMembersLoading] = useState<Record<string, boolean>>({})
  const [channels, setChannels] = useState<Record<string, Record<string, boolean>>>({})
  const [savingChannels, setSavingChannels] = useState<string | null>(null)
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
    const { data } = await supabase.from('organizations').select('id, name, slug, created_at, shopify_domain, channels').order('name')
    setOrgs(data ?? [])
    const chMap: Record<string, Record<string, boolean>> = {}
    ;(data ?? []).forEach((o: Org) => { chMap[o.id] = o.channels ?? {} })
    setChannels(chMap)
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
    const { data: newOrg, error } = await supabase.from('organizations').insert({ name: newName, slug: cleanSlug }).select().single()
    if (error) { setCreateError(error.message); setCreating(false); return }
    setNewName(''); setNewSlug(''); setShowNewForm(false); setCreating(false)
    fetchOrgs()
    if (newOrg) setTimeout(() => setExpanded(newOrg.id), 300)
  }

  const inp: React.CSSProperties = {
    padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6,
    fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', outline: 'none', background: C.paper, color: C.ink,
  }

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>
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

        {showNewForm && (
          <div style={{ background: C.paper, border: `2px solid ${C.accent}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontFamily: 'Barlow, sans-serif' }}>New project</div>
              <button onClick={() => { setShowNewForm(false); setCreateError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={16} /></button>
            </div>
            {createError && <div style={{ background: '#fee2e2', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: '0.8rem', color: '#b91c1c', fontFamily: 'Barlow, sans-serif' }}>{createError}</div>}
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

              return (
                <div key={org.id} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                  <div
                    onClick={() => toggleExpand(org.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer', background: isOpen ? '#fafafa' : C.paper, transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#fafafa' }}
                    onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = C.paper }}
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

                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${C.border}`, background: '#fafafa', padding: '20px 24px 24px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }} className="proj-grid">

                        {/* Channels */}
                        <div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Barlow, sans-serif', marginBottom: 10 }}>Channels</div>
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

                        {/* Members */}
                        <div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Barlow, sans-serif', marginBottom: 10 }}>
                            Members {orgMembers.length > 0 && `(${orgMembers.length})`}
                          </div>

                          {inviteMsg[org.id]?.text && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 6, marginBottom: 8, background: inviteMsg[org.id].ok ? '#e6fff5' : '#fee2e2', border: `1px solid ${inviteMsg[org.id].ok ? '#00cc78' : '#fca5a5'}` }}>
                              {inviteMsg[org.id].ok ? <CheckCircle size={13} color="#007a48" /> : <AlertCircle size={13} color="#b91c1c" />}
                              <span style={{ fontSize: '0.78rem', color: inviteMsg[org.id].ok ? '#007a48' : '#b91c1c', fontFamily: 'Barlow, sans-serif' }}>{inviteMsg[org.id].text}</span>
                            </div>
                          )}

                          <form onSubmit={e => handleInvite(e, org.id)} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
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
