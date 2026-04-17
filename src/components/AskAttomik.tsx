'use client'

import { useState } from 'react'
import { Send, RefreshCw } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

interface Props {
  metrics: any
  orgName: string
  period: string
  userName: string
  timezone?: string
  dark?: boolean
  suggestions?: string[]
  connectedAbove?: boolean
}

function getGreeting(tz: string): string {
  const hour = new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false })
  const h = parseInt(hour, 10)
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Hey'
}

function getContextLine(metrics: any, orgName: string): string {
  if (!metrics) return 'what do you want to explore?'
  const revChg = parseFloat(metrics.totalRevChg)
  const ordChg = parseFloat(metrics.ordersChg)
  const roas = parseFloat(metrics.roas)

  if (!isNaN(revChg) && revChg > 5) return `${orgName} revenue is up ${revChg}% — want to dig into what's driving the growth?`
  if (!isNaN(roas) && roas >= 3) return `${orgName} ROAS is sitting at ${roas}x. Curious which channels are pulling the most weight?`
  if (!isNaN(ordChg) && ordChg > 5) return `${orgName} orders are up ${ordChg}% this period. Want to see where the momentum is coming from?`
  if (!isNaN(revChg) && revChg > 0) return `${orgName} revenue is trending up. Ready to explore what's working?`

  if (metrics.totalRev) return `${orgName} has done ${metrics.totalRev} in revenue this period. Want to find opportunities to grow?`
  return 'what do you want to explore?'
}

const DEFAULT_SUGGESTIONS = [
  'How are we trending this month?',
  'Why did CAC change?',
  'How is Amazon vs Shopify?',
  'What\'s our best performing channel?',
  'Break down our conversion rates',
]

export default function AskAttomik({
  metrics, orgName, period, userName, timezone = 'America/New_York',
  dark = false, suggestions, connectedAbove = false,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const firstName = userName?.split(' ')[0] || 'there'
  const greeting = getGreeting(timezone)
  const contextLine = getContextLine(metrics, orgName)
  const questionPills = suggestions && suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS

  const ask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setLoading(true)

    try {
      const res = await fetch('/api/insights/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, metrics, orgName, period }),
      })
      const data = await res.json()
      if (res.status === 429) {
        setMessages(prev => [...prev, { role: 'assistant', text: data.error ?? 'Daily limit reached. Try again tomorrow.' }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: data.answer ?? 'Sorry, I couldn\'t generate an answer.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Try again.' }])
    }
    setLoading(false)
  }

  // ── THEME TOKENS ──
  const T = dark
    ? {
        bg: '#0a0a0a',
        border: 'rgba(0,255,151,0.2)',
        borderSoft: 'rgba(255,255,255,0.08)',
        headingColor: '#ffffff',
        bodyColor: '#d8d8d8',
        muted: '#888',
        pillBg: 'rgba(255,255,255,0.05)',
        pillBorder: 'rgba(255,255,255,0.1)',
        pillColor: '#d8d8d8',
        pillHoverBg: '#00ff97',
        pillHoverColor: '#000',
        inputBg: 'rgba(255,255,255,0.04)',
        inputBorder: 'rgba(255,255,255,0.1)',
        inputColor: '#fff',
        userMsgColor: '#888',
        assistantMsgColor: '#e8e8e8',
        dividerColor: 'rgba(255,255,255,0.08)',
      }
    : {
        bg: '#ffffff',
        border: '#e0e0e0',
        borderSoft: '#f0f0f0',
        headingColor: '#000',
        bodyColor: '#000',
        muted: '#666',
        pillBg: '#f2f2f2',
        pillBorder: '#e0e0e0',
        pillColor: '#666',
        pillHoverBg: '#000',
        pillHoverColor: '#00ff97',
        inputBg: '#f8f8f8',
        inputBorder: '#e0e0e0',
        inputColor: '#000',
        userMsgColor: '#999',
        assistantMsgColor: '#000',
        dividerColor: '#f0f0f0',
      }

  const containerClass = dark ? 'ask-attomik-dark' : 'card'
  const containerStyle: React.CSSProperties = dark
    ? {
        overflow: 'hidden',
        marginBottom: 8,
        padding: 0,
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderTop: connectedAbove ? 'none' : `1px solid ${T.border}`,
        borderRadius: connectedAbove ? '0 0 12px 12px' : 12,
      }
    : { overflow: 'hidden', marginBottom: 8, padding: 0 }

  return (
    <div className={containerClass} style={containerStyle}>
      {/* Header */}
      <div style={{ padding: '18px 20px 12px' }}>
        <div style={{ fontSize: dark ? '1rem' : '1.3rem', fontWeight: dark ? 700 : 800, color: T.headingColor, fontFamily: 'Barlow, sans-serif', letterSpacing: dark ? '-0.01em' : '-0.03em', lineHeight: 1.4 }}>
          {greeting} {firstName} — {contextLine}
        </div>
        {messages.length === 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {questionPills.map(q => (
              <button key={q} onClick={() => { setInput(q); }} style={{
                padding: '5px 12px', background: T.pillBg, border: `1px solid ${T.pillBorder}`, borderRadius: 20,
                fontSize: '0.72rem', fontWeight: 500, color: T.pillColor, fontFamily: 'Barlow, sans-serif',
                cursor: 'pointer', transition: '0.15s', whiteSpace: 'nowrap',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = T.pillHoverBg; e.currentTarget.style.color = T.pillHoverColor; e.currentTarget.style.borderColor = T.pillHoverBg }}
                onMouseLeave={e => { e.currentTarget.style.background = T.pillBg; e.currentTarget.style.color = T.pillColor; e.currentTarget.style.borderColor = T.pillBorder }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div style={{ padding: '0 20px', maxHeight: 320, overflowY: 'auto' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                background: msg.role === 'user' ? (dark ? 'rgba(255,255,255,0.08)' : '#f2f2f2') : '#000',
                display: 'grid', placeItems: 'center',
                fontSize: '0.6rem', fontWeight: 700,
                color: msg.role === 'user' ? (dark ? '#aaa' : '#666') : '#00ff97',
              }}>
                {msg.role === 'user' ? firstName[0]?.toUpperCase() : 'A'}
              </div>
              <div style={{
                fontSize: '0.875rem', color: msg.role === 'user' ? T.userMsgColor : T.assistantMsgColor,
                fontFamily: 'Barlow, sans-serif', lineHeight: 1.6,
                fontWeight: msg.role === 'assistant' ? 400 : 500,
                fontStyle: msg.role === 'user' ? 'italic' : 'normal',
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#000', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <RefreshCw size={10} color="#00ff97" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: T.muted, fontFamily: 'Barlow, sans-serif' }}>Thinking...</div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <form onSubmit={ask} style={{ display: 'flex', gap: 8, padding: '12px 20px 16px', borderTop: messages.length > 0 ? `1px solid ${T.dividerColor}` : 'none' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your metrics..."
          disabled={loading}
          style={{
            flex: 1, padding: '10px 14px', background: T.inputBg, border: `1px solid ${T.inputBorder}`,
            borderRadius: 8, color: T.inputColor, fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem',
            outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = '#00ff97')}
          onBlur={e => (e.target.style.borderColor = T.inputBorder)}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 16px', borderRadius: 8, border: 'none', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            background: loading || !input.trim() ? (dark ? 'rgba(255,255,255,0.08)' : '#f2f2f2') : '#00ff97',
            color: loading || !input.trim() ? (dark ? '#555' : '#999') : '#000',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: '0.15s',
          }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
