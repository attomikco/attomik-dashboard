'use client'

import { useState } from 'react'
import { MessageCircle, Send, RefreshCw } from 'lucide-react'

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
}

function getGreeting(tz: string): string {
  const hour = new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false })
  const h = parseInt(hour, 10)
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Hey'
}

function getContextLine(metrics: any): { headline: string; sub: string } | null {
  if (!metrics) return null
  const revChg = parseFloat(metrics.totalRevChg)
  const ordChg = parseFloat(metrics.ordersChg)
  const roas = parseFloat(metrics.roas)

  if (!isNaN(revChg) && revChg > 5)
    return { headline: `revenue is up ${revChg}% — let's keep it going`, sub: `Want to dig into what's driving the growth?` }
  if (!isNaN(roas) && roas >= 3)
    return { headline: `your ROAS is sitting at ${roas}x`, sub: `Curious which channels are pulling the most weight?` }
  if (!isNaN(ordChg) && ordChg > 5)
    return { headline: `orders are up ${ordChg}% this period`, sub: `Want to see where the momentum is coming from?` }
  if (!isNaN(revChg) && revChg > 0)
    return { headline: `revenue is trending up — solid`, sub: `Ready to explore what's working?` }
  return null
}

export default function AskAttomik({ metrics, orgName, period, userName, timezone = 'America/New_York' }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const firstName = userName?.split(' ')[0] || 'there'
  const greeting = getGreeting(timezone)
  const contextLine = getContextLine(metrics)

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

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 14px' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#000', fontFamily: 'Barlow, sans-serif', letterSpacing: '-0.03em' }}>
          {greeting} {firstName}{contextLine ? ` — ${contextLine.headline}` : ', what do you want to explore?'}
          {contextLine && <><br />{contextLine.sub}</>}
        </div>
        {messages.length === 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {[
              'How are we trending this month?',
              'Why did CAC change?',
              'How is Amazon vs Shopify?',
              'What\'s our best performing channel?',
              'Break down our conversion rates',
            ].map(q => (
              <button key={q} onClick={() => { setInput(q); }} style={{
                padding: '5px 12px', background: '#f2f2f2', border: '1px solid #e0e0e0', borderRadius: 20,
                fontSize: '0.72rem', fontWeight: 500, color: '#666', fontFamily: 'Barlow, sans-serif',
                cursor: 'pointer', transition: '0.15s', whiteSpace: 'nowrap',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#000'; e.currentTarget.style.color = '#00ff97'; e.currentTarget.style.borderColor = '#000' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f2f2f2'; e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#e0e0e0' }}
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
                background: msg.role === 'user' ? '#f2f2f2' : '#000',
                display: 'grid', placeItems: 'center',
                fontSize: '0.6rem', fontWeight: 700,
                color: msg.role === 'user' ? '#666' : '#00ff97',
              }}>
                {msg.role === 'user' ? firstName[0]?.toUpperCase() : 'A'}
              </div>
              <div style={{
                fontSize: '0.875rem', color: msg.role === 'user' ? '#999' : '#000',
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
              <div style={{ fontSize: '0.8rem', color: '#999', fontFamily: 'Barlow, sans-serif' }}>Thinking...</div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <form onSubmit={ask} style={{ display: 'flex', gap: 8, padding: '12px 20px 16px', borderTop: messages.length > 0 ? '1px solid #f0f0f0' : 'none' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your metrics..."
          disabled={loading}
          style={{
            flex: 1, padding: '10px 14px', background: '#f8f8f8', border: '1px solid #e0e0e0',
            borderRadius: 8, color: '#000', fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem',
            outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = '#00ff97')}
          onBlur={e => (e.target.style.borderColor = '#e0e0e0')}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 16px', background: loading || !input.trim() ? '#f0f0f0' : '#000',
            color: loading || !input.trim() ? '#ccc' : '#00ff97',
            border: 'none', borderRadius: 8, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.875rem',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
