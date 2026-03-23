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
}

export default function AskAttomik({ metrics, orgName, period, userName }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const firstName = userName?.split(' ')[0] || 'there'

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
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer ?? 'Sorry, I couldn\'t generate an answer.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Try again.' }])
    }
    setLoading(false)
  }

  return (
    <div style={{ background: '#000', border: '1px solid #222', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', fontFamily: 'Barlow, sans-serif', letterSpacing: '-0.02em' }}>
          Hey {firstName}, what do you want to explore?
        </div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Barlow, sans-serif', marginTop: 2 }}>
          Ask anything about your {orgName} metrics
        </div>
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div style={{ padding: '0 20px', maxHeight: 320, overflowY: 'auto' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                background: msg.role === 'user' ? '#333' : 'rgba(0,255,151,0.15)',
                display: 'grid', placeItems: 'center',
                fontSize: '0.6rem', fontWeight: 700,
                color: msg.role === 'user' ? '#999' : '#00ff97',
              }}>
                {msg.role === 'user' ? firstName[0]?.toUpperCase() : 'A'}
              </div>
              <div style={{
                fontSize: '0.875rem', color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#fff',
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
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,255,151,0.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <RefreshCw size={10} color="#00ff97" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Barlow, sans-serif' }}>Thinking...</div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <form onSubmit={ask} style={{ display: 'flex', gap: 8, padding: '12px 20px 16px', borderTop: messages.length > 0 ? '1px solid #222' : 'none' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. Why did CAC increase this month?"
          disabled={loading}
          style={{
            flex: 1, padding: '10px 14px', background: '#111', border: '1px solid #333',
            borderRadius: 8, color: '#fff', fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem',
            outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = '#00ff97')}
          onBlur={e => (e.target.style.borderColor = '#333')}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 16px', background: loading || !input.trim() ? '#222' : '#00ff97',
            color: loading || !input.trim() ? '#555' : '#000',
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
