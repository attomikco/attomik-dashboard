'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

export type DateRange = {
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
  label: string
}

const today = () => new Date().toISOString().split('T')[0]
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().split('T')[0]

function monthStart(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toISOString().split('T')[0]
}
function monthEnd(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset + 1, 0).toISOString().split('T')[0]
}
function yearStart(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear() + offset, 0, 1).toISOString().split('T')[0]
}
function yearEnd(offset = 0) {
  const d = new Date()
  return new Date(d.getFullYear() + offset, 11, 31).toISOString().split('T')[0]
}

const PRESETS: { label: string; getRange: () => { start: string; end: string } }[] = [
  { label: 'Today',         getRange: () => ({ start: today(), end: today() }) },
  { label: 'Last 7 days',   getRange: () => ({ start: daysAgo(7), end: today() }) },
  { label: 'Last 30 days',  getRange: () => ({ start: daysAgo(30), end: today() }) },
  { label: 'Month to date', getRange: () => ({ start: monthStart(0), end: today() }) },
  { label: 'Last month',    getRange: () => ({ start: monthStart(-1), end: monthEnd(-1) }) },
  { label: 'Last 90 days',  getRange: () => ({ start: daysAgo(90), end: today() }) },
  { label: 'Last 12 months',getRange: () => ({ start: daysAgo(365), end: today() }) },
  { label: 'This year',     getRange: () => ({ start: yearStart(0), end: today() }) },
  { label: 'Last year',     getRange: () => ({ start: yearStart(-1), end: yearEnd(-1) }) },
  { label: 'Custom range',  getRange: () => ({ start: daysAgo(30), end: today() }) },
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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  const isCustom = activePreset === 'Custom range'

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: 100 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', border: '1px solid #e0e0e0',
          borderRadius: 6, background: '#fff', cursor: 'pointer',
          fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', fontWeight: 600,
          color: '#000', transition: '0.15s', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#00ff97')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0e0e0')}
      >
        <Calendar size={15} color="#666" />
        <span>{value.label === 'Custom range' ? `${fmt(value.start)} – ${fmt(value.end)}` : value.label}</span>
        <ChevronDown size={13} color="#666" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          display: 'flex', minWidth: 520,
        }}>
          {/* Presets */}
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

          {/* Custom range or preview */}
          <div style={{ flex: 1, padding: 20 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16, fontFamily: 'Barlow, sans-serif' }}>
              {isCustom ? 'Custom date range' : 'Selected range'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>Start date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => { setCustomStart(e.target.value); setActivePreset('Custom range') }}
                  style={{
                    width: '100%', padding: '8px 10px',
                    border: '1px solid #e0e0e0', borderRadius: 6,
                    fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem',
                    outline: 'none', cursor: 'pointer',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#00ff97')}
                  onBlur={e => (e.target.style.borderColor = '#e0e0e0')}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>End date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => { setCustomEnd(e.target.value); setActivePreset('Custom range') }}
                  style={{
                    width: '100%', padding: '8px 10px',
                    border: '1px solid #e0e0e0', borderRadius: 6,
                    fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem',
                    outline: 'none', cursor: 'pointer',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#00ff97')}
                  onBlur={e => (e.target.style.borderColor = '#e0e0e0')}
                />
              </div>
            </div>

            {/* Summary */}
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
              style={{
                width: '100%', padding: '10px', background: '#00ff97', color: '#000',
                fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.875rem',
                border: 'none', borderRadius: 6, cursor: 'pointer', transition: '0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#00e085')}
              onMouseLeave={e => (e.currentTarget.style.background = '#00ff97')}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
