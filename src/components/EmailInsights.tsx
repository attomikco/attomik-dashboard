'use client'

import { useState, useEffect } from 'react'
import { Mail, RefreshCw, Send, X, Check } from 'lucide-react'

interface Props {
  metrics: any
  period: string
  preset: string
  orgName: string
  orgId: string
}

export default function EmailInsights({ metrics, period, preset, orgName, orgId }: Props) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<{ id: string; full_name: string | null; email: string | null; role: string }[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadingMembers, setLoadingMembers] = useState(false)

  const [performance, setPerformance] = useState('')
  const [challenges, setChallenges] = useState('')
  const [focusTasks, setFocusTasks] = useState('')

  const [drafting, setDrafting] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [drafted, setDrafted] = useState(false)

  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const fetchMembers = async () => {
    if (members.length > 0) return
    setLoadingMembers(true)
    try {
      const res = await fetch(`/api/members?org_id=${orgId}`)
      const data = await res.json()
      const m = (data.members ?? []).filter((m: any) => m.email)
      setMembers(m)
      // Preselect only viewers (clients) — admins/superadmins can be toggled manually
      setSelected(new Set(m.filter((m: any) => m.role === 'viewer').map((m: any) => m.email)))
    } catch {}
    setLoadingMembers(false)
  }

  const openModal = () => {
    fetchMembers()
    setOpen(true)
  }

  const closeModal = () => {
    if (drafting || sending) return
    setOpen(false)
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

  // Lock body scroll when modal open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: '#f8f8f8',
    border: '1px solid #e0e0e0', borderRadius: 6, color: '#000',
    fontFamily: 'Barlow, sans-serif', fontSize: '0.85rem', resize: 'vertical' as const,
    outline: 'none', lineHeight: 1.5, minHeight: 60,
  }

  const labelClass = 'form-label'

  return (
    <>
      {/* Trigger button — icon-only on mobile */}
      <button onClick={openModal} className="btn btn-dark email-report-btn"
        style={{ flexShrink: 0 }}>
        <Mail size={14} /> <span className="email-report-label">Email Report</span>
      </button>
      <style>{`
        @media (max-width: 640px) {
          .email-report-btn { padding: 8px !important; border-radius: 8px !important; }
          .email-report-label { display: none !important; }
        }
      `}</style>

      {/* Modal overlay */}
      {open && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            {/* Header */}
            <div className="modal-header">
              <div>
                <div className="modal-title">Email Report</div>
                <div className="caption">{orgName} · {period}</div>
              </div>
              <button onClick={closeModal} className="modal-close">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px 24px' }}>
              {sent ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e6fff5', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
                    <Check size={24} color="#007a48" />
                  </div>
                  <p style={{ fontWeight: 700, fontFamily: 'Barlow, sans-serif', marginBottom: 4 }}>Email sent!</p>
                  <p style={{ color: '#999', fontSize: '0.85rem', fontFamily: 'Barlow, sans-serif', marginBottom: 20 }}>
                    Sent to {selected.size} team member{selected.size !== 1 ? 's' : ''}
                  </p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button onClick={reset} className="btn btn-secondary btn-sm">
                      Compose another
                    </button>
                    <button onClick={closeModal} className="btn btn-dark btn-sm">
                      Done
                    </button>
                  </div>
                </div>
              ) : !drafted ? (
                <>
                  {/* Recipients */}
                  <div style={{ marginBottom: 18 }}>
                    <label className={labelClass} style={{ display: 'block', marginBottom: 6 }}>Recipients</label>
                    {loadingMembers ? (
                      <div style={{ color: '#999', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif' }}>Loading team members…</div>
                    ) : members.length === 0 ? (
                      <div style={{ color: '#999', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif' }}>No team members found.</div>
                    ) : (
                      <>
                        <button onClick={toggleAll} style={{ background: 'none', border: 'none', color: '#00cc78', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'Barlow, sans-serif', cursor: 'pointer', padding: 0, marginBottom: 8 }}>
                          {selected.size === members.length ? 'Deselect all' : 'Select all'}
                        </button>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {members.map(m => (
                            <button key={m.email} onClick={() => toggleMember(m.email!)}
                              style={{
                                padding: '5px 10px', borderRadius: 6, fontSize: '0.78rem',
                                fontFamily: 'Barlow, sans-serif', cursor: 'pointer',
                                border: selected.has(m.email!) ? '1px solid #00cc78' : '1px solid #e0e0e0',
                                background: selected.has(m.email!) ? '#e6fff5' : '#f8f8f8',
                                color: selected.has(m.email!) ? '#007a48' : '#666',
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
                    <label className={labelClass} style={{ display: 'block', marginBottom: 6 }}>Performance notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— wins, highlights</span></label>
                    <textarea style={inputStyle} value={performance} onChange={e => setPerformance(e.target.value)} placeholder="e.g. Strong Meta ROAS this week, new creative performing well…" />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label className={labelClass} style={{ display: 'block', marginBottom: 6 }}>Challenges <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— blockers, issues</span></label>
                    <textarea style={inputStyle} value={challenges} onChange={e => setChallenges(e.target.value)} placeholder="e.g. Amazon conversion dipped, shipping delays affecting CSAT…" />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label className={labelClass} style={{ display: 'block', marginBottom: 6 }}>Focus tasks <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— priorities for next period</span></label>
                    <textarea style={inputStyle} value={focusTasks} onChange={e => setFocusTasks(e.target.value)} placeholder="e.g. Scale Meta budget 20%, launch new Google campaign, A/B test landing page…" />
                  </div>

                  {error && <div style={{ color: '#b91c1c', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif', marginBottom: 12 }}>{error}</div>}

                  <button onClick={draft} disabled={drafting}
                    className="btn btn-dark w-full">
                    {drafting ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</> : <><Mail size={14} /> Draft email</>}
                  </button>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </>
              ) : (
                <>
                  {/* Preview */}
                  <div style={{ marginBottom: 14 }}>
                    <label className={labelClass} style={{ display: 'block', marginBottom: 6 }}>Subject</label>
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                      style={{ ...inputStyle, minHeight: 'auto', resize: 'none' }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label className={labelClass} style={{ display: 'block', marginBottom: 6 }}>Email body <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— edit before sending</span></label>
                    <textarea value={body} onChange={e => setBody(e.target.value)}
                      style={{ ...inputStyle, minHeight: 200 }} />
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#999', fontFamily: 'Barlow, sans-serif', marginBottom: 14 }}>
                    Sending to {selected.size} recipient{selected.size !== 1 ? 's' : ''}: {[...selected].join(', ')}
                  </div>

                  {error && <div style={{ color: '#b91c1c', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif', marginBottom: 12 }}>{error}</div>}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={send} disabled={sending}
                      className="btn btn-dark flex-1">
                      {sending ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</> : <><Send size={14} /> Send email</>}
                    </button>
                    <button onClick={() => { setDrafted(false); setError('') }}
                      className="btn btn-secondary">
                      Redraft
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
