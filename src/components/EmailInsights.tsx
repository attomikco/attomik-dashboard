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

  const labelStyle = {
    fontSize: '0.72rem', fontWeight: 600 as const, color: '#999',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    fontFamily: 'Barlow, sans-serif', marginBottom: 6, display: 'block' as const,
  }

  return (
    <>
      {/* Trigger button */}
      <button onClick={openModal}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 16px', background: '#000', color: '#00ff97',
          border: 'none', borderRadius: 6, fontFamily: 'Barlow, sans-serif',
          fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
          transition: '0.15s',
        }}>
        <Mail size={14} /> Email Report
      </button>

      {/* Modal overlay */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'grid', placeItems: 'center', padding: 16,
        }} onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div style={{
            background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560,
            maxHeight: '90vh', overflow: 'auto', position: 'relative',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid #e0e0e0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '14px 14px 0 0',
            }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Barlow, sans-serif', letterSpacing: '-0.02em' }}>
                  Email Report
                </div>
                <div style={{ fontSize: '0.78rem', color: '#999', fontFamily: 'Barlow, sans-serif' }}>
                  {orgName} · {period}
                </div>
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} color="#999" />
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
                    <button onClick={reset} style={{ background: '#f2f2f2', border: 'none', borderRadius: 6, padding: '8px 16px', fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                      Compose another
                    </button>
                    <button onClick={closeModal} style={{ background: '#000', color: '#00ff97', border: 'none', borderRadius: 6, padding: '8px 16px', fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                      Done
                    </button>
                  </div>
                </div>
              ) : !drafted ? (
                <>
                  {/* Recipients */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={labelStyle}>Recipients</label>
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

                  {error && <div style={{ color: '#b91c1c', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif', marginBottom: 12 }}>{error}</div>}

                  <button onClick={draft} disabled={drafting}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '10px 20px', width: '100%',
                      background: drafting ? '#e0e0e0' : '#000', color: drafting ? '#999' : '#00ff97',
                      border: 'none', borderRadius: 6, fontFamily: 'Barlow, sans-serif',
                      fontWeight: 700, fontSize: '0.875rem', cursor: drafting ? 'not-allowed' : 'pointer',
                    }}>
                    {drafting ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</> : <><Mail size={14} /> Draft email</>}
                  </button>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </>
              ) : (
                <>
                  {/* Preview */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Subject</label>
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                      style={{ ...inputStyle, minHeight: 'auto', resize: 'none' }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Email body <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— edit before sending</span></label>
                    <textarea value={body} onChange={e => setBody(e.target.value)}
                      style={{ ...inputStyle, minHeight: 200 }} />
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#999', fontFamily: 'Barlow, sans-serif', marginBottom: 14 }}>
                    Sending to {selected.size} recipient{selected.size !== 1 ? 's' : ''}: {[...selected].join(', ')}
                  </div>

                  {error && <div style={{ color: '#b91c1c', fontSize: '0.8rem', fontFamily: 'Barlow, sans-serif', marginBottom: 12 }}>{error}</div>}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={send} disabled={sending}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '10px 20px', flex: 1,
                        background: sending ? '#e0e0e0' : '#000', color: sending ? '#999' : '#00ff97',
                        border: 'none', borderRadius: 6, fontFamily: 'Barlow, sans-serif',
                        fontWeight: 700, fontSize: '0.875rem', cursor: sending ? 'not-allowed' : 'pointer',
                      }}>
                      {sending ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</> : <><Send size={14} /> Send email</>}
                    </button>
                    <button onClick={() => { setDrafted(false); setError('') }}
                      style={{
                        padding: '10px 16px', background: '#f2f2f2',
                        border: '1px solid #e0e0e0', borderRadius: 6,
                        fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.8rem',
                        color: '#666', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
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
