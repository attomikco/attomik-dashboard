'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'

export type DateRange = {
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
  label: string
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function monthStart(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toLocaleDateString('en-CA')
}
function monthEnd(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset + 1, 0).toLocaleDateString('en-CA')
}
function yearStart(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear() + offset, 0, 1).toLocaleDateString('en-CA')
}
function yearEnd(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear() + offset, 11, 31).toLocaleDateString('en-CA')
}

const PRESETS: { label: string; getRange: () => { start: string; end: string } }[] = [
  { label: 'Today',          getRange: () => ({ start: today(), end: today() }) },
  { label: 'Yesterday',      getRange: () => ({ start: daysAgo(1), end: daysAgo(1) }) },
  { label: 'Last 7 days',    getRange: () => ({ start: daysAgo(7), end: today() }) },
  { label: 'Last 30 days',   getRange: () => ({ start: daysAgo(30), end: today() }) },
  { label: 'Month to date',  getRange: () => ({ start: monthStart(0), end: today() }) },
  { label: 'Last month',     getRange: () => ({ start: monthStart(-1), end: monthEnd(-1) }) },
  { label: 'Last 90 days',   getRange: () => ({ start: daysAgo(90), end: today() }) },
  { label: 'Last 12 months', getRange: () => ({ start: daysAgo(365), end: today() }) },
  { label: 'This year',      getRange: () => ({ start: yearStart(0), end: today() }) },
  { label: 'Last year',      getRange: () => ({ start: yearStart(-1), end: yearEnd(-1) }) },
  { label: 'Custom range',   getRange: () => ({ start: daysAgo(30), end: today() }) },
]

interface Props {
  value: DateRange
  onChange: (range: DateRange) => void
}

export default function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [customStart, setCustomStart] = useState(value.start)
  const [customEnd, setCustomEnd] = useState(value.end)
  const [activePreset, setActivePreset] = useState(value.label)
  const [isMobile, setIsMobile] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobile, open])

  const selectPreset = (preset: typeof PRESETS[0]) => {
    const range = preset.getRange()
    setCustomStart(range.start)
    setCustomEnd(range.end)
    setActivePreset(preset.label)
    if (preset.label !== 'Custom range') {
      onChange({ ...range, label: preset.label })
      setOpen(false)
    }
  }

  const applyCustom = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      onChange({ start: customStart, end: customEnd, label: 'Custom range' })
      setOpen(false)
    }
  }

  const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const fmtShort = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const isCustom = activePreset === 'Custom range'

  const buttonLabel = value.label === 'Custom range'
    ? isMobile
      ? `${fmtShort(value.start)} – ${fmtShort(value.end)}`
      : `${fmt(value.start)} – ${fmt(value.end)}`
    : value.label

  return (
    <>
      <div ref={ref} style={{ position: 'relative', zIndex: 100 }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: isMobile ? '7px 10px' : '8px 14px',
            border: '1px solid #e0e0e0',
            borderRadius: 6, background: '#fff', cursor: 'pointer',
            fontFamily: 'Barlow, sans-serif',
            fontSize: isMobile ? '0.8rem' : '0.875rem',
            fontWeight: 600, color: '#000', transition: '0.15s',
            whiteSpace: 'nowrap', maxWidth: isMobile ? 190 : 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#00ff97')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0e0e0')}
        >
          <Calendar size={isMobile ? 13 : 15} color="#666" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{buttonLabel}</span>
          <ChevronDown size={12} color="#666" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.15s', flexShrink: 0 }} />
        </button>

        {/* Desktop dropdown */}
        {open && !isMobile && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            display: 'flex', minWidth: 520, zIndex: 200,
          }}>
            <div style={{ width: 180, borderRight: '1px solid #e0e0e0', padding: '8px 0' }}>
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => selectPreset(p)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '9px 16px', border: 'none', cursor: 'pointer',
                    fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem',
                    fontWeight: activePreset === p.label ? 700 : 400,
                    background: activePreset === p.label ? '#f2f2f2' : 'transparent',
                    color: activePreset === p.label ? '#000' : '#444',
                    transition: '0.1s',
                  }}
                  onMouseEnter={e => { if (activePreset !== p.label) (e.currentTarget.style.background = '#fafafa') }}
                  onMouseLeave={e => { if (activePreset !== p.label) (e.currentTarget.style.background = 'transparent') }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, padding: 20 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16, fontFamily: 'Barlow, sans-serif' }}>
                {isCustom ? 'Custom date range' : 'Selected range'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>Start date</label>
                  <input
                    type="date" value={customStart}
                    onChange={e => { setCustomStart(e.target.value); setActivePreset('Custom range') }}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: 6, fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}
                    onFocus={e => (e.target.style.borderColor = '#00ff97')}
                    onBlur={e => (e.target.style.borderColor = '#e0e0e0')}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>End date</label>
                  <input
                    type="date" value={customEnd}
                    onChange={e => { setCustomEnd(e.target.value); setActivePreset('Custom range') }}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: 6, fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}
                    onFocus={e => (e.target.style.borderColor = '#00ff97')}
                    onBlur={e => (e.target.style.borderColor = '#e0e0e0')}
                  />
                </div>
              </div>

              <div style={{ background: '#f2f2f2', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: '0.8rem', color: '#666', fontFamily: 'Barlow, sans-serif' }}>
                  {fmt(customStart)} – {fmt(customEnd)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2, fontFamily: 'Barlow, sans-serif' }}>
                  {Math.round((new Date(customEnd).getTime() - new Date(customStart).getTime()) / 864e5) + 1} days selected
                </div>
              </div>

              <button
                onClick={applyCustom}
                disabled={!customStart || !customEnd || customStart > customEnd}
                style={{ width: '100%', padding: '10px', background: '#00ff97', color: '#000', fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 6, cursor: 'pointer', transition: '0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#00e085')}
                onMouseLeave={e => (e.currentTarget.style.background = '#00ff97')}
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {open && isMobile && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: '#fff', borderRadius: '16px 16px 0 0',
              maxHeight: '85vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle + header */}
            <div style={{ padding: '12px 20px 0', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ width: 40, height: 4, background: '#e0e0e0', borderRadius: 2, margin: '0 auto 14px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'Barlow, sans-serif', letterSpacing: '-0.02em' }}>
                  Select period
                </div>
                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <X size={18} color="#666" />
                </button>
              </div>
            </div>

            {/* Presets grid */}
            <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PRESETS.filter(p => p.label !== 'Custom range').map(p => (
                <button
                  key={p.label}
                  onClick={() => selectPreset(p)}
                  style={{
                    padding: '12px 14px',
                    border: `1.5px solid ${activePreset === p.label ? '#000' : '#e0e0e0'}`,
                    borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem',
                    fontWeight: activePreset === p.label ? 700 : 500,
                    background: activePreset === p.label ? '#000' : '#fff',
                    color: activePreset === p.label ? '#00ff97' : '#333',
                    transition: '0.15s',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom range */}
            <div style={{ padding: '0 16px 32px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: 'Barlow, sans-serif' }}>
                Custom range
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>Start</label>
                  <input
                    type="date" value={customStart}
                    onChange={e => { setCustomStart(e.target.value); setActivePreset('Custom range') }}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: 8, fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>End</label>
                  <input
                    type="date" value={customEnd}
                    onChange={e => { setCustomEnd(e.target.value); setActivePreset('Custom range') }}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: 8, fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <button
                onClick={applyCustom}
                disabled={!customStart || !customEnd || customStart > customEnd}
                style={{ width: '100%', padding: '14px', background: '#00ff97', color: '#000', fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.9375rem', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                Apply custom range
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
