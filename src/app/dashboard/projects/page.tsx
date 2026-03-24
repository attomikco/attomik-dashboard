'use client'

import { useState, useEffect, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Building2, BarChart2, ChevronDown, ChevronRight, UserPlus, Trash2, CheckCircle, AlertCircle, X, Eye, Users, MessageCircle, Send } from 'lucide-react'

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
  role: string; status: string; invited_at: string | null; last_seen_at: string | null; is_superadmin?: boolean
}
interface TeamMember extends Member {
  orgs: { id: string; name: string; role: string }[]
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
  const [settingsState, setSettingsState] = useState<Record<string, { name: string; timezone: string; logo_url: string; header_url: string; ga_property_id: string }>>({})
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
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(true)
  const [showTeam, setShowTeam] = useState(true)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [assigningProject, setAssigningProject] = useState<string | null>(null)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [teamInviteEmail, setTeamInviteEmail] = useState('')
  const [teamInviteName, setTeamInviteName] = useState('')
  const [teamInviteRole, setTeamInviteRole] = useState('viewer')
  const [teamInviteOrg, setTeamInviteOrg] = useState('')
  const [teamInviting, setTeamInviting] = useState(false)
  const [teamInviteMsg, setTeamInviteMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [chatLogs, setChatLogs] = useState<any[]>([])
  const [chatLogsLoading, setChatLogsLoading] = useState(false)
  const [showChatLogs, setShowChatLogs] = useState(false)
  const [pageTab, setPageTab] = useState<'projects' | 'team' | 'logs'>('projects')
  const [logsPage, setLogsPage] = useState(0)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const LOGS_PER_PAGE = 25
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { fetchOrgs() }, [])

  const fetchOrgs = async () => {
    setLoading(true)
    const { data } = await supabase.from('organizations')
      .select('id, name, slug, created_at, shopify_domain, channels, timezone, logo_url, header_url, ga_property_id').order('name')
    setOrgs(data ?? [])
    const chMap: Record<string, Record<string, boolean>> = {}
    const sMap: Record<string, { name: string; timezone: string }> = {}
    ;(data ?? []).forEach((o: Org) => {
      chMap[o.id] = o.channels ?? {}
      sMap[o.id] = { name: o.name, timezone: o.timezone ?? 'America/New_York', logo_url: (o as any).logo_url ?? '', header_url: (o as any).header_url ?? '', ga_property_id: (o as any).ga_property_id ?? '' }
    })
    setChannels(chMap)
    setSettingsState(sMap)
    setLoading(false)

    // Fetch all members across all orgs for the team table
    setTeamLoading(true)
    const allMembers: Map<string, TeamMember> = new Map()
    await Promise.all((data ?? []).map(async (org: Org) => {
      const res = await fetch(`/api/members?org_id=${org.id}`)
      const json = await res.json()
      for (const m of (json.members ?? []) as Member[]) {
        const existing = allMembers.get(m.id)
        if (existing) {
          existing.orgs.push({ id: org.id, name: org.name, role: m.role })
          // If invited in any org, show invited (worst status wins)
          if (m.status === 'invited') existing.status = 'invited'
        } else {
          allMembers.set(m.id, { ...m, orgs: [{ id: org.id, name: org.name, role: m.role }] })
        }
      }
    }))
    setTeamMembers(Array.from(allMembers.values()).sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? '')))
    setTeamLoading(false)
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
    await supabase.from('organizations').update({ name: s.name, timezone: s.timezone, ga_property_id: s.ga_property_id || null }).eq('id', orgId)
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

  const loadChatLogs = async () => {
    setChatLogsLoading(true)
    const res = await fetch('/api/chat-logs')
    const data = await res.json()
    setChatLogs(data.logs ?? [])
    setChatLogsLoading(false)
  }

  const switchToTab = (tab: 'projects' | 'team' | 'logs') => {
    setPageTab(tab)
    if (tab === 'logs' && chatLogs.length === 0) loadChatLogs()
  }

  const assignProject = async (userId: string, orgId: string, role: string) => {
    setAssigningProject(`${userId}-${orgId}`)
    await fetch('/api/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, org_id: orgId, role }),
    })
    // Update local state
    setTeamMembers(prev => prev.map(m => {
      if (m.id !== userId) return m
      const hasOrg = m.orgs.some(o => o.id === orgId)
      if (hasOrg) return m
      const orgName = orgs.find(o => o.id === orgId)?.name ?? ''
      return { ...m, orgs: [...m.orgs, { id: orgId, name: orgName, role }] }
    }))
    setAssigningProject(null)
  }

  const removeFromProject = async (userId: string, orgId: string) => {
    await fetch('/api/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, org_id: orgId }),
    })
    setTeamMembers(prev => prev.map(m => {
      if (m.id !== userId) return m
      return { ...m, orgs: m.orgs.filter(o => o.id !== orgId) }
    }))
  }

  const removeTeamMember = async (member: TeamMember) => {
    if (!confirm(`Remove ${member.full_name || member.email} from all projects and delete their account?`)) return
    for (let i = 0; i < member.orgs.length; i++) {
      await fetch('/api/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: member.id, org_id: member.orgs[i].id, delete_user: i === member.orgs.length - 1 }),
      })
    }
    setTeamMembers(prev => prev.filter(m => m.id !== member.id))
  }

  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendResult, setResendResult] = useState<Record<string, { ok: boolean; text: string }>>({})
  const resendTeamInvite = async (member: TeamMember) => {
    if (!member.email || member.orgs.length === 0) return
    if (!confirm(`Resend invite to ${member.email}?`)) return
    setResendingId(member.id)
    setResendResult(prev => { const next = { ...prev }; delete next[member.id]; return next })
    try {
      const res = await fetch('/api/invite', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: member.email, org_id: member.orgs[0].id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Resend failed')
      setResendResult(prev => ({ ...prev, [member.id]: { ok: true, text: 'Invite sent!' } }))
    } catch (err: any) {
      setResendResult(prev => ({ ...prev, [member.id]: { ok: false, text: err.message } }))
    }
    setResendingId(null)
  }

  const handleTeamInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamInviteOrg) return
    setTeamInviting(true)
    setTeamInviteMsg(null)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: teamInviteEmail, org_id: teamInviteOrg, role: teamInviteRole, full_name: teamInviteName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTeamInviteMsg({ text: data.message, ok: true })
      setTeamInviteEmail(''); setTeamInviteName('')
      // Refresh team data
      fetchOrgs()
    } catch (err: any) {
      setTeamInviteMsg({ text: err.message, ok: false })
    }
    setTeamInviting(false)
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
    padding: '8px 24px 8px 10px', border: `1px solid ${C.border}`, borderRadius: 6,
    fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', outline: 'none',
    background: C.paper, color: C.ink,
  }

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>

      {/* Topbar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.paper, zIndex: 50 }}>
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: 'Barlow, sans-serif' }}>Admin</h1>
          </div>
        </div>
        <div style={{ display: 'flex', padding: '0 24px', gap: 0 }}>
          {(['projects', 'team', 'logs'] as const).map(tab => (
            <button key={tab} onClick={() => switchToTab(tab)} style={{
              padding: '10px 20px', border: 'none', background: 'transparent',
              fontFamily: 'Barlow, sans-serif', fontSize: '0.85rem', fontWeight: 600,
              color: pageTab === tab ? C.ink : C.muted, cursor: 'pointer',
              borderBottom: `2px solid ${pageTab === tab ? C.accent : 'transparent'}`,
              marginBottom: -1, transition: '0.15s', textTransform: 'capitalize',
            }}>
              {tab === 'logs' ? 'AI Chat Logs' : tab === 'team' ? `Team (${teamMembers.length})` : `Projects (${orgs.length})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px clamp(16px,4vw,40px) 80px' }}>

        {/* ── PROJECTS TAB ── */}
        {pageTab === 'projects' && <>

        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setShowNewForm(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: showNewForm ? C.cream : C.ink, color: showNewForm ? C.ink : C.accent, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.8rem', border: 'none', borderRadius: 6, cursor: 'pointer', marginBottom: showNewForm ? 10 : 0 }}>
            <Building2 size={13} /> {showNewForm ? 'Cancel' : '+ New Project'}
          </button>
        </div>

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

        </>}

        {/* ── TEAM TAB ── */}
        {pageTab === 'team' && <>
        <div style={{ marginBottom: 24 }}>
          {teamLoading ? (
              <div style={{ color: C.muted, fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif', padding: '12px 0' }}>Loading team...</div>
            ) : (<>
              {/* Invite new user form */}
              <div style={{ marginBottom: 12 }}>
                <button onClick={() => setShowInviteForm(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: showInviteForm ? C.cream : C.ink, color: showInviteForm ? C.ink : C.accent, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.8rem', border: 'none', borderRadius: 6, cursor: 'pointer', marginBottom: showInviteForm ? 10 : 0 }}>
                  <UserPlus size={13} /> {showInviteForm ? 'Cancel' : 'Invite new user'}
                </button>
                {showInviteForm && (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, background: C.paper }}>
                    {teamInviteMsg && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 6, marginBottom: 10, background: teamInviteMsg.ok ? '#e6fff5' : '#fee2e2', border: `1px solid ${teamInviteMsg.ok ? '#00cc78' : '#fca5a5'}` }}>
                        {teamInviteMsg.ok ? <CheckCircle size={13} color="#007a48" /> : <AlertCircle size={13} color="#b91c1c" />}
                        <span style={{ fontSize: '0.78rem', color: teamInviteMsg.ok ? '#007a48' : '#b91c1c', fontFamily: 'Barlow, sans-serif' }}>{teamInviteMsg.text}</span>
                      </div>
                    )}
                    <form onSubmit={handleTeamInvite} style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: 3, fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</label>
                        <input value={teamInviteName} onChange={e => setTeamInviteName(e.target.value)} placeholder="Full name" style={{ ...inp, width: '100%' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: 3, fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
                        <input type="email" value={teamInviteEmail} onChange={e => setTeamInviteEmail(e.target.value)} placeholder="email@company.com" required style={{ ...inp, width: '100%' }} />
                      </div>
                      <div style={{ minWidth: 100 }}>
                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: 3, fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project</label>
                        <select value={teamInviteOrg} onChange={e => setTeamInviteOrg(e.target.value)} required style={{ ...inp, width: '100%', cursor: 'pointer' }}>
                          <option value="">Select…</option>
                          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </div>
                      <div style={{ minWidth: 80 }}>
                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: C.muted, display: 'block', marginBottom: 3, fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Role</label>
                        <select value={teamInviteRole} onChange={e => setTeamInviteRole(e.target.value)} style={{ ...inp, width: '100%', cursor: 'pointer' }}>
                          <option value="viewer">Viewer</option>
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <button type="submit" disabled={teamInviting} style={{ padding: '8px 16px', background: teamInviting ? '#ccc' : C.ink, color: teamInviting ? C.muted : C.accent, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.8rem', border: 'none', borderRadius: 6, cursor: teamInviting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                        {teamInviting ? 'Sending…' : 'Send invite'}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead>
                    <tr style={{ background: C.cream }}>
                      {['Member', 'Projects', 'Status', 'Last seen', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, fontFamily: 'Barlow, sans-serif', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((m, i) => (<Fragment key={m.id}>
                      <tr key={m.id} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none', cursor: !m.is_superadmin ? 'pointer' : 'default' }}
                        onClick={() => !m.is_superadmin && setExpandedMember(expandedMember === m.id ? null : m.id)}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                        onMouseLeave={e => (e.currentTarget.style.background = expandedMember === m.id ? '#fafafa' : 'transparent')}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.cream, display: 'grid', placeItems: 'center', fontSize: '0.68rem', fontWeight: 700, color: C.muted, flexShrink: 0 }}>
                              {(m.full_name || m.email || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>{m.full_name || m.email || 'Unnamed'}</span>
                                {m.is_superadmin && <span style={{ fontSize: '0.6rem', fontWeight: 700, background: C.ink, color: C.accent, padding: '1px 5px', borderRadius: 4, letterSpacing: '0.05em', fontFamily: 'Barlow, sans-serif' }}>ATTOMIK</span>}
                              </div>
                              {m.full_name && m.email && <div style={{ fontSize: '0.7rem', color: '#aaa', fontFamily: 'DM Mono, monospace', marginTop: 1 }}>{m.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {m.orgs.map(o => (
                              <span key={o.id} style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: C.cream, color: C.ink, fontFamily: 'Barlow, sans-serif', whiteSpace: 'nowrap', border: `1px solid ${C.border}` }}>
                                {o.name} <span style={{ color: C.muted, fontWeight: 400 }}>· {o.role}</span>
                              </span>
                            ))}
                            {!m.is_superadmin && m.orgs.length === 0 && <span style={{ fontSize: '0.68rem', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>No projects</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, fontFamily: 'Barlow, sans-serif',
                              background: m.status === 'joined' ? '#e6fff5' : '#fff8e1',
                              color: m.status === 'joined' ? '#007a48' : '#b45309',
                            }}>
                              {m.status === 'joined' ? 'Joined' : 'Invited'}
                            </span>
                            {resendResult[m.id] && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 600, fontFamily: 'Barlow, sans-serif', color: resendResult[m.id].ok ? '#007a48' : '#b91c1c' }}>
                                {resendResult[m.id].text}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#999', fontFamily: 'Barlow, sans-serif', whiteSpace: 'nowrap' }}>
                          {m.last_seen_at
                            ? new Date(m.last_seen_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                            : m.invited_at
                              ? `Invited ${new Date(m.invited_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                              : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {!m.is_superadmin && m.status === 'joined' && m.orgs.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                localStorage.setItem('viewAsUserId', m.id)
                                localStorage.setItem('viewAsUserName', m.full_name || m.email || 'User')
                                localStorage.setItem('activeOrgId', m.orgs[0].id)
                                window.location.href = '/dashboard/analytics'
                              }}
                              title={`View as ${m.full_name || m.email}`}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, transition: '0.15s', marginRight: 4 }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#000')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
                            >
                              <Eye size={15} />
                            </button>
                          )}
                          {!m.is_superadmin && m.status !== 'joined' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); resendTeamInvite(m) }}
                              disabled={resendingId === m.id}
                              title={`Resend invite to ${m.email}`}
                              style={{ background: 'none', border: 'none', cursor: resendingId === m.id ? 'not-allowed' : 'pointer', color: '#ccc', padding: 4, transition: '0.15s', marginRight: 4 }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#007a48')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
                            >
                              <Send size={14} />
                            </button>
                          )}
                          {!m.is_superadmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeTeamMember(m) }}
                              title={`Remove ${m.full_name || m.email}`}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, transition: '0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#b91c1c')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Expanded project assignment row */}
                      {expandedMember === m.id && !m.is_superadmin && (
                        <tr key={`${m.id}-assign`} style={{ background: '#fafafa' }}>
                          <td colSpan={5} style={{ padding: '12px 16px 16px 56px', borderTop: 'none' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif', marginBottom: 8 }}>Assign projects</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {orgs.map(org => {
                                const memberOrg = m.orgs.find(o => o.id === org.id)
                                const isAssigned = !!memberOrg
                                const isLoading = assigningProject === `${m.id}-${org.id}`
                                return (
                                  <div key={org.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C.paper, borderRadius: 6, border: `1px solid ${isAssigned ? C.accent : C.border}` }}>
                                    <input
                                      type="checkbox"
                                      checked={isAssigned}
                                      disabled={isLoading}
                                      onChange={() => isAssigned ? removeFromProject(m.id, org.id) : assignProject(m.id, org.id, 'viewer')}
                                      style={{ accentColor: C.accent, width: 15, height: 15, cursor: 'pointer' }}
                                    />
                                    <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: isAssigned ? 600 : 400, fontFamily: 'Barlow, sans-serif', color: isAssigned ? C.ink : C.muted }}>{org.name}</span>
                                    {isAssigned && (
                                      <select
                                        value={memberOrg.role}
                                        onChange={e => { e.stopPropagation(); assignProject(m.id, org.id, e.target.value) }}
                                        onClick={e => e.stopPropagation()}
                                        style={{ ...inp, padding: '3px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                                      >
                                        <option value="viewer">Viewer</option>
                                        <option value="member">Member</option>
                                        <option value="admin">Admin</option>
                                      </select>
                                    )}
                                    {isLoading && <span style={{ fontSize: '0.7rem', color: C.muted }}>…</span>}
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>))}
                  </tbody>
                </table>
              </div>
            </>)}
        </div>

        </>}

        {/* ── LOGS TAB ── */}
        {pageTab === 'logs' && <>
        <div style={{ marginBottom: 24 }}>
          {chatLogsLoading ? (
              <div style={{ color: C.muted, fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif', padding: '12px 0' }}>Loading logs...</div>
            ) : chatLogs.length === 0 ? (
              <div style={{ color: '#ccc', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif' }}>No chat activity yet.</div>
            ) : (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr style={{ background: C.cream }}>
                      {['User', 'Project', 'Type', 'Question', 'Time'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, fontFamily: 'Barlow, sans-serif', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chatLogs.slice(logsPage * LOGS_PER_PAGE, (logsPage + 1) * LOGS_PER_PAGE).map((log: any, i: number) => (<Fragment key={log.id}>
                      <tr style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                        onMouseLeave={e => (e.currentTarget.style.background = expandedLog === log.id ? '#fafafa' : 'transparent')}>
                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Barlow, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>{log.email}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.75rem', fontFamily: 'Barlow, sans-serif', color: C.muted, whiteSpace: 'nowrap' }}>{log.org_name ?? '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20, fontFamily: 'Barlow, sans-serif', textTransform: 'uppercase',
                            background: log.type === 'insights' ? '#e6fff5' : '#f0f0ff',
                            color: log.type === 'insights' ? '#007a48' : '#4f46e5',
                          }}>{log.type}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontFamily: 'Barlow, sans-serif', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.question}</td>
                        <td style={{ padding: '10px 12px', fontSize: '0.72rem', fontFamily: 'Barlow, sans-serif', color: '#999', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </td>
                      </tr>
                      {expandedLog === log.id && (
                        <tr style={{ background: '#fafafa' }}>
                          <td colSpan={5} style={{ padding: '16px 20px' }}>
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif', marginBottom: 6 }}>Question</div>
                              <div style={{ fontSize: '0.82rem', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>{log.question}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif', marginBottom: 6 }}>Answer</div>
                              <div style={{ fontSize: '0.82rem', fontFamily: 'Barlow, sans-serif', color: C.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{log.answer}</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>))}
                  </tbody>
                </table>
              </div>
            )}
          {chatLogs.length > LOGS_PER_PAGE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '16px 0' }}>
              <button onClick={() => setLogsPage(p => Math.max(0, p - 1))} disabled={logsPage === 0}
                style={{ padding: '6px 14px', background: logsPage === 0 ? C.cream : C.ink, color: logsPage === 0 ? C.muted : C.accent, border: 'none', borderRadius: 6, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.78rem', cursor: logsPage === 0 ? 'not-allowed' : 'pointer' }}>
                Previous
              </button>
              <span style={{ fontSize: '0.78rem', color: C.muted, fontFamily: 'Barlow, sans-serif' }}>
                Page {logsPage + 1} of {Math.ceil(chatLogs.length / LOGS_PER_PAGE)}
              </span>
              <button onClick={() => setLogsPage(p => p + 1)} disabled={(logsPage + 1) * LOGS_PER_PAGE >= chatLogs.length}
                style={{ padding: '6px 14px', background: (logsPage + 1) * LOGS_PER_PAGE >= chatLogs.length ? C.cream : C.ink, color: (logsPage + 1) * LOGS_PER_PAGE >= chatLogs.length ? C.muted : C.accent, border: 'none', borderRadius: 6, fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.78rem', cursor: (logsPage + 1) * LOGS_PER_PAGE >= chatLogs.length ? 'not-allowed' : 'pointer' }}>
                Next
              </button>
            </div>
          )}
        </div>
        </>}

        {/* ── PROJECTS LIST (inside projects tab) ── */}
        {pageTab === 'projects' && (<>
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
                                    {m.status === 'joined' && (
                                      <button
                                        onClick={() => {
                                          localStorage.setItem('viewAsUserId', m.id)
                                          localStorage.setItem('viewAsUserName', m.full_name || m.email || 'User')
                                          localStorage.setItem('activeOrgId', org.id)
                                          window.location.href = '/dashboard/analytics'
                                        }}
                                        title={`View as ${m.full_name || m.email}`}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', padding: 2, flexShrink: 0, transition: '0.15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#000')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#ddd')}
                                      >
                                        <Eye size={12} />
                                      </button>
                                    )}
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
                            <div>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Barlow, sans-serif', display: 'block', marginBottom: 6 }}>GA4 Property ID</label>
                              <p style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 8, fontFamily: 'Barlow, sans-serif' }}>
                                Enter your Google Analytics 4 Property ID to display website traffic data on the analytics page.
                              </p>
                              <input value={settingsState[org.id]?.ga_property_id ?? ''}
                                onChange={e => setSettingsState(p => ({ ...p, [org.id]: { ...p[org.id], ga_property_id: e.target.value } }))}
                                placeholder="e.g. 123456789"
                                style={{ ...inp, width: '100%', fontFamily: 'DM Mono, monospace', fontSize: '0.8rem' }}
                                onFocus={e => (e.target.style.borderColor = C.accent)}
                                onBlur={e => (e.target.style.borderColor = C.border)} />
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
        </>)}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .proj-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
