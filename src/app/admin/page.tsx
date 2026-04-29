'use client'

import { useEffect, useMemo, useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Building2, UserPlus, ChevronDown, ChevronRight, CheckCircle, XCircle,
  Copy, Settings as SettingsIcon, Users,
} from 'lucide-react'

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

interface AdminOrg {
  id: string
  name: string
  slug: string
  timezone: string | null
  created_at: string
  user_count: number
  shopify_connected: boolean
  meta_connected: boolean
}

interface Member {
  id: string
  full_name: string | null
  email: string | null
  role: string
  status: string
  invited_at: string | null
  joined_at: string | null
  last_seen_at: string | null
  is_superadmin?: boolean
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'var(--font-barlow)' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2, fontFamily: 'var(--font-barlow)' }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  // Create org
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newTz, setNewTz]     = useState('America/New_York')
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string; orgId?: string } | null>(null)

  // Invite user
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName]   = useState('')
  const [inviteOrg, setInviteOrg]     = useState('')
  const [inviteRole, setInviteRole]   = useState<'admin' | 'viewer'>('viewer')
  const [inviting, setInviting]       = useState(false)
  const [inviteMsg, setInviteMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Orgs list
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [membersByOrg, setMembersByOrg] = useState<Record<string, Member[]>>({})
  const [loadingMembers, setLoadingMembers] = useState<Record<string, boolean>>({})

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles').select('is_superadmin').eq('id', user.id).single()
      if (!(profile as any)?.is_superadmin) {
        router.replace('/dashboard/overview')
        return
      }
      setReady(true)
      fetchOrgs()
    })()
  }, [])

  const fetchOrgs = async () => {
    setLoadingOrgs(true)
    try {
      const res = await fetch('/api/admin/orgs')
      const data = await res.json()
      if (res.ok) setOrgs(data.orgs ?? [])
    } finally {
      setLoadingOrgs(false)
    }
  }

  const fetchMembers = async (orgId: string) => {
    if (membersByOrg[orgId]) return
    setLoadingMembers(p => ({ ...p, [orgId]: true }))
    try {
      const res = await fetch(`/api/members?org_id=${orgId}`)
      const data = await res.json()
      setMembersByOrg(p => ({ ...p, [orgId]: data.members ?? [] }))
    } finally {
      setLoadingMembers(p => ({ ...p, [orgId]: false }))
    }
  }

  const toggleExpand = (orgId: string) => {
    if (expanded === orgId) { setExpanded(null); return }
    setExpanded(orgId)
    fetchMembers(orgId)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true); setCreateMsg(null)
    try {
      const res = await fetch('/api/admin/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, slug: newSlug || slugify(newName), timezone: newTz }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      setCreateMsg({ type: 'success', text: `Created "${data.org.name}"`, orgId: data.org.id })
      setInviteOrg(data.org.id)
      setNewName(''); setNewSlug('')
      fetchOrgs()
    } catch (err: any) {
      setCreateMsg({ type: 'error', text: err.message })
    }
    setCreating(false)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true); setInviteMsg(null)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, org_id: inviteOrg, role: inviteRole, full_name: inviteName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invite failed')
      setInviteMsg({ type: 'success', text: data.message })
      setInviteEmail(''); setInviteName('')
      fetchOrgs()
      if (expanded) {
        setMembersByOrg(p => { const n = { ...p }; delete n[inviteOrg]; return n })
        if (expanded === inviteOrg) fetchMembers(inviteOrg)
      }
    } catch (err: any) {
      setInviteMsg({ type: 'error', text: err.message })
    }
    setInviting(false)
  }

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text)
  }

  const editCredentials = (orgId: string) => {
    localStorage.setItem('activeOrgId', orgId)
    router.push('/dashboard/settings')
  }

  const selectedOrg = useMemo(() => orgs.find(o => o.id === inviteOrg), [orgs, inviteOrg])

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)', fontFamily: 'var(--font-barlow)' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="topbar">
        <div className="topbar-title">
          <h1>Admin</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: 2 }}>Onboard new clients</p>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard/overview')}>
            ← Back to dashboard
          </button>
        </div>
      </div>

      <div style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 40px) 80px', maxWidth: 960, margin: '0 auto' }}>

        {/* ── 1. Create New Org ─────────────────────────────── */}
        <Section title="Create new org" subtitle="Spin up a new client project">
          {createMsg && (
            <div className={`alert ${createMsg.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
              {createMsg.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{createMsg.text}</div>
                {createMsg.orgId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: '#007a48' }}>org_id:</span>
                    <span>{createMsg.orgId}</span>
                    <button onClick={() => copyToClipboard(createMsg.orgId!)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007a48', padding: 2, display: 'inline-flex' }}
                      title="Copy org_id">
                      <Copy size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleCreate} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="form-grid-2">
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Org name</label>
                <input type="text" required value={newName}
                  placeholder="Brand X"
                  onChange={e => {
                    const v = e.target.value
                    setNewName(v)
                    setNewSlug(prev => (prev === '' || prev === slugify(newName)) ? slugify(v) : prev)
                  }}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Slug</label>
                <input type="text" required value={newSlug}
                  placeholder="brand-x"
                  onChange={e => setNewSlug(e.target.value)}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Timezone</label>
              <select value={newTz} onChange={e => setNewTz(e.target.value)} style={{ width: '100%', cursor: 'pointer' }}>
                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                Now: {new Date().toLocaleString('en-US', { timeZone: newTz, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
              </p>
            </div>
            <div>
              <button type="submit" disabled={creating || !newName} className="btn btn-dark">
                <Building2 size={14} />
                {creating ? 'Creating…' : 'Create org'}
              </button>
            </div>
          </form>
        </Section>

        {/* ── 2. Invite User ────────────────────────────────── */}
        <Section title="Invite user" subtitle="Send a magic link — creates the user if new">
          {inviteMsg && (
            <div className={`alert ${inviteMsg.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
              {inviteMsg.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span style={{ fontWeight: 600 }}>{inviteMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleInvite} style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="form-grid-2">
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Email</label>
                <input type="email" required value={inviteEmail}
                  placeholder="user@company.com"
                  onChange={e => setInviteEmail(e.target.value)}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Full name (optional)</label>
                <input type="text" value={inviteName}
                  placeholder="Jane Doe"
                  onChange={e => setInviteName(e.target.value)}
                  style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }} className="form-grid-2">
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Org</label>
                <select value={inviteOrg} required onChange={e => setInviteOrg(e.target.value)}
                  style={{ width: '100%', cursor: 'pointer' }}>
                  <option value="">Select an org…</option>
                  {orgs.map(o => (
                    <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>
                  ))}
                </select>
                {selectedOrg && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    {selectedOrg.id}
                  </p>
                )}
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'admin' | 'viewer')}
                  style={{ width: '100%', cursor: 'pointer' }}>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div>
              <button type="submit" disabled={inviting || !inviteEmail || !inviteOrg} className="btn btn-dark">
                <UserPlus size={14} />
                {inviting ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </form>
        </Section>

        {/* ── 3. All Orgs ───────────────────────────────────── */}
        <Section title="All orgs" subtitle={loadingOrgs ? 'Loading…' : `${orgs.length} total`}>
          {loadingOrgs ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>Loading…</div>
          ) : orgs.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>No orgs yet.</div>
          ) : (
            <div className="table-wrapper" style={{ overflow: 'visible' }}>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}></th>
                      <th>Org</th>
                      <th>Users</th>
                      <th>Shopify</th>
                      <th>Meta</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map(org => {
                      const isOpen = expanded === org.id
                      const members = membersByOrg[org.id] ?? []
                      return (
                        <Fragment key={org.id}>
                          <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpand(org.id)}>
                            <td>
                              {isOpen ? <ChevronDown size={14} color="var(--muted)" /> : <ChevronRight size={14} color="var(--muted)" />}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{org.name}</div>
                              <div className="td-mono td-muted">{org.slug}</div>
                            </td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Users size={12} color="var(--muted)" />
                                {org.user_count}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${org.shopify_connected ? 'badge-green' : 'badge-gray'}`}>
                                {org.shopify_connected ? 'Connected' : '—'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${org.meta_connected ? 'badge-green' : 'badge-gray'}`}>
                                {org.meta_connected ? 'Connected' : '—'}
                              </span>
                            </td>
                            <td className="td-muted">
                              {new Date(org.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="td-right" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => editCredentials(org.id)}
                                className="btn btn-secondary btn-xs"
                                title="Edit credentials in settings"
                              >
                                <SettingsIcon size={11} /> Edit credentials
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr style={{ background: 'var(--cream)' }}>
                              <td colSpan={7} style={{ padding: '16px 24px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="form-grid-2">
                                  <div>
                                    <div className="label" style={{ marginBottom: 8 }}>Connections</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
                                      <ConnectionRow label="Shopify" connected={org.shopify_connected} />
                                      <ConnectionRow label="Meta Ads" connected={org.meta_connected} />
                                    </div>
                                    <div style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                                      org_id: {org.id}
                                      <button onClick={() => copyToClipboard(org.id)} title="Copy"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, marginLeft: 4, verticalAlign: 'middle' }}>
                                        <Copy size={11} />
                                      </button>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                                      timezone: {org.timezone ?? '—'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="label" style={{ marginBottom: 8 }}>Users ({members.length})</div>
                                    {loadingMembers[org.id] ? (
                                      <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Loading…</div>
                                    ) : members.length === 0 ? (
                                      <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>No users yet.</div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {members.map(m => (
                                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--paper)', borderRadius: 6, border: '1px solid var(--border)' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {m.full_name || m.email}
                                              </div>
                                              {m.full_name && m.email && (
                                                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{m.email}</div>
                                              )}
                                            </div>
                                            <span className={`badge badge-${m.role}`}>{m.role}</span>
                                            <span className={`badge ${m.status === 'joined' ? 'badge-green' : 'badge-yellow'}`}>
                                              {m.status === 'joined' ? 'Joined' : 'Invited'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}

function ConnectionRow({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--paper)', borderRadius: 6, border: '1px solid var(--border)' }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span className={`badge ${connected ? 'badge-green' : 'badge-gray'}`}>
        {connected ? '● Connected' : '○ Not connected'}
      </span>
    </div>
  )
}
