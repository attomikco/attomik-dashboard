'use client'

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

interface Props {
  metrics: any
  period: string
  preset: string
  orgName: string
  platform?: 'ecommerce' | 'meta'
}

export default function AIInsights({ metrics, period, preset, orgName, platform = 'ecommerce' }: Props) {
  const [insight, setInsight] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, period, preset, orgName, platform }),
      })
      const data = await res.json()
      setInsight(data.insight ?? data.error ?? 'No insights available.')
      setGenerated(true)
    } catch {
      setInsight('Failed to generate insights. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ background: '#000', border: '1px solid #222', borderRadius: 10, padding: isMobile ? 16 : 24, marginBottom: 8 }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: generated || loading ? 16 : 0,
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        {/* Left: icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,255,151,0.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Sparkles size={16} color="#00ff97" />
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', fontFamily: 'Barlow, sans-serif', letterSpacing: '-0.02em' }}>
              AI Insights
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'Barlow, sans-serif' }}>
              Powered by Attomik
            </div>
          </div>
        </div>

        {/* Button */}
        <button
          onClick={generate}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 16px',
            background: loading ? 'rgba(255,255,255,0.05)' : '#00ff97',
            color: loading ? 'rgba(255,255,255,0.4)' : '#000',
            border: 'none', borderRadius: 6,
            fontFamily: 'Barlow, sans-serif', fontWeight: 700,
            fontSize: '0.875rem', cursor: loading ? 'not-allowed' : 'pointer',
            transition: '0.15s',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          {loading ? (
            <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing…</>
          ) : generated ? (
            <><RefreshCw size={14} /> Regenerate</>
          ) : (
            <><Sparkles size={14} /> Generate insights</>
          )}
        </button>
      </div>

      {loading && (
        <div style={{ marginTop: generated ? 0 : 16 }}>
          <div style={{ height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: '90%', marginBottom: 8 }} className="animate-pulse" />
          <div style={{ height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: '75%', marginBottom: 8 }} className="animate-pulse" />
          <div style={{ height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: '85%' }} className="animate-pulse" />
        </div>
      )}

      {!loading && insight && (
        <p style={{ fontSize: isMobile ? '0.875rem' : '0.9375rem', color: '#fff', fontFamily: 'Barlow, sans-serif', lineHeight: 1.7, margin: 0 }}>
          {insight}
        </p>
      )}

      {!loading && !insight && (
        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'Barlow, sans-serif', marginTop: isMobile ? 12 : 0, margin: 0 }}>
          {isMobile ? 'Tap "Generate insights" for an AI-powered analysis.' : 'Click "Generate insights" to get an AI-powered analysis of this period\'s performance.'}
        </p>
      )}
    </div>
  )
}
