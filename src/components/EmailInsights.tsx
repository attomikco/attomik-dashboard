'use client'

import { useState, useEffect } from 'react'
import { Mail, RefreshCw, Send, ChevronDown, ChevronUp, Check } from 'lucide-react'

interface Props {
  metrics: any
  period: string
  preset: string
  orgName: string
  orgId: string
}

export default function EmailInsights({ metrics, period, preset, orgName, orgId }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [members, setMembers] = useState<{ id: string; full_name: string | null; email: string | null }[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Context fields
  const [performance, setPerformance] = useState('')
  const [challenges, setChallenges] = useState('')
  const [focusTasks, setFocusTasks] = useState('')

  // Draft state
  const [drafting, setDrafting] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [drafted, setDrafted] = useState(false)

  // Send state
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const fetchMembers = async () => {
    if (members.length > 0) return
    setLoadingMembers(true)
    try {
      const res = await fetch(`/api/members?org_id=${orgId}`)
      const data = await res.json()
      const m = (data.members ?? []).filter((m: any) => m.email)
      setMembers(m)
      setSelected(new Set(m.map((m: any) => m.email)))
    } catch {}
    setLoadingMembers(false)
  }

  const toggleExpand = () => {
    if (!expanded) fetchMembers()
    setExpanded(!expanded)
  }

  const toggleMember = (email: string) => {
    const next = new Set(selected)
    next.has(email) ? next.delete(email) : next.add(email)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === members.length) setSelected(new Set())
    else setSelected(new Set(members.map(m => m.email!)))
  }

  const draft = async () => {
    setDrafting(true); setError('')
    try {
      const res = await fetch('/api/insights/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, period, preset, orgName, performance, challenges, focusTasks }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Draft failed')
      setSubject(data.subject ?? `${orgName} — Performance Update`)
      setBody(data.body ?? '')
      setDrafted(true)
    } catch (err: any) { setError(err.message) }
    setDrafting(false)
  }

  const send = async () => {
    if (selected.size === 0) { setError('Select at least one recipient.'); return }
    setSending(true); setError('')
    try {
      const res = await fetch('/api/insights/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: [...selected], subject, body, orgName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setSent(true)
    } catch (err: any) { setError(err.message) }
    setSending(false)
  }

  const reset = () => {
    setDrafted(false); setSent(false); setSubject(''); setBody('')
    setPerformance(''); setChallenges(''); setFocusTasks('')
    setError('')
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff',
    fontFamily: 'Barlow, sans-serif', fontSize: '0.85rem', resize: 'vertical' as const,
    outline: 'none', lineHeight: 1.5, minHeight: 60,
  }

  const labelStyle = {
    fontSize: '0.75rem', fontWeight: 600 as const, color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    fontFamily: 'Barlow, sans-serif', marginBottom: 6, display: 'block' as const,
  }

  return (
    <div style={{ background: '#000', border: '1px solid #222', borderRadius: 10, padding: isMobile ? 16 : 24, marginBottom: 8 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between', gap: 12,
        flexDirection: isMobile ? 'column' : 'row',
        cursor: 'pointer',
      }} onClick={toggleExpand}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,255,151,0.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Mail size={16} color="#00ff97" />
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', fontFamily: 'Barlow, sans-serif', letterSpacing: '-0.02em' }}>
              Email Update to Team
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'Barlow, sans-serif' }}>
              AI-crafted performance email with your context
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} color="#666" /> : <ChevronDown size={18} color="#666" />}
      </div>

      {expanded && (
        <div style={{ marginTop: 20 }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,255,151,0.15)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
                <Check size={24} color="#00ff97" />
              </div>
              <p style={{ color: '#fff', fontWeight: 700, fontFamily: 'Barlow, sans-serif', marginBottom: 4 }}>Email sent!</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontFamily: 'Barlow, sans-serif', marginBottom: 16 }}>
                Sent to {selected.size} team member{selected.size !== 1 ? 's' : ''}
              </p>
              <button onClick={reset} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '8px 16px', color: '#fff', fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                Compose another
              </button>
            </div>
          ) : !drafted ? (
            <>
              {/* Recipients */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Recipients</label>
                {loadingMembers ? (
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif' }}>Loading team members…</div>
                ) : members.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif' }}>No team members found for this project.</div>
                ) : (
                  <>
                    <button onClick={toggleAll} style={{ background: 'none', border: 'none', color: '#00ff97', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Barlow, sans-serif', cursor: 'pointer', padding: 0, marginBottom: 8 }}>
                      {selected.size === members.length ? 'Deselect all' : 'Select all'}
                    </button>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {members.map(m => (
                        <button key={m.email} onClick={() => toggleMember(m.email!)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '5px 10px', borderRadius: 6, fontSize: '0.78rem',
                            fontFamily: 'Barlow, sans-serif', cursor: 'pointer',
                            border: selected.has(m.email!) ? '1px solid #00ff97' : '1px solid rgba(255,255,255,0.15)',
                            background: selected.has(m.email!) ? 'rgba(0,255,151,0.1)' : 'rgba(255,255,255,0.04)',
                            color: selected.has(m.email!) ? '#00ff97' : 'rgba(255,255,255,0.6)',
                          }}>
                          {m.full_name || m.email}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Context fields */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Performance notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— wins, highlights</span></label>
                <textarea style={inputStyle} value={performance} onChange={e => setPerformance(e.target.value)} placeholder="e.g. Strong Meta ROAS this week, new creative performing well…" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Challenges <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— blockers, issues</span></label>
                <textarea style={inputStyle} value={challenges} onChange={e => setChallenges(e.target.value)} placeholder="e.g. Amazon conversion dipped, shipping delays affecting CSAT…" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Focus tasks <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— priorities for next period</span></label>
                <textarea style={inputStyle} value={focusTasks} onChange={e => setFocusTasks(e.target.value)} placeholder="e.g. Scale Meta budget 20%, launch new Google campaign, A/B test landing page…" />
              </div>

              {error && <div style={{ color: '#fca5a5', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif', marginBottom: 12 }}>{error}</div>}

              <button onClick={draft} disabled={drafting}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 20px', width: isMobile ? '100%' : 'auto',
                  background: drafting ? 'rgba(255,255,255,0.05)' : '#00ff97',
                  color: drafting ? 'rgba(255,255,255,0.4)' : '#000',
                  border: 'none', borderRadius: 6, fontFamily: 'Barlow, sans-serif',
                  fontWeight: 700, fontSize: '0.875rem', cursor: drafting ? 'not-allowed' : 'pointer',
                }}>
                {drafting ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</> : <><Mail size={14} /> Draft email</>}
              </button>
            </>
          ) : (
            <>
              {/* Preview */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  style={{ ...inputStyle, minHeight: 'auto', resize: 'none' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Email body <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— edit before sending</span></label>
                <textarea value={body} onChange={e => setBody(e.target.value)}
                  style={{ ...inputStyle, minHeight: 200 }} />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Barlow, sans-serif', marginBottom: 14 }}>
                Sending to {selected.size} recipient{selected.size !== 1 ? 's' : ''}: {[...selected].join(', ')}
              </div>

              {error && <div style={{ color: '#fca5a5', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif', marginBottom: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={send} disabled={sending}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px 20px',
                    background: sending ? 'rgba(255,255,255,0.05)' : '#00ff97',
                    color: sending ? 'rgba(255,255,255,0.4)' : '#000',
                    border: 'none', borderRadius: 6, fontFamily: 'Barlow, sans-serif',
                    fontWeight: 700, fontSize: '0.875rem', cursor: sending ? 'not-allowed' : 'pointer',
                  }}>
                  {sending ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</> : <><Send size={14} /> Send email</>}
                </button>
                <button onClick={() => { setDrafted(false); setError('') }}
                  style={{
                    padding: '10px 20px', background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
                    fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.875rem',
                    color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                  }}>
                  Edit context & redraft
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
