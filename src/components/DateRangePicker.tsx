'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'

export type CompareMode = 'previous_period' | 'previous_month' | 'previous_year' | 'custom'

export type DateRange = {
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
  label: string
  compareMode?: CompareMode
  customCompareStart?: string  // YYYY-MM-DD, only used when compareMode === 'custom'
  customCompareEnd?: string    // YYYY-MM-DD
}

const COMPARE_OPTIONS: { value: CompareMode; label: string }[] = [
  { value: 'previous_period', label: 'Previous period' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'previous_year', label: 'Previous year' },
  { value: 'custom', label: 'Custom' },
]

/** Smart default compare mode based on the selected preset */
function defaultCompareMode(label: string): CompareMode {
  switch (label) {
    case 'Month to date':
    case 'Last month':
      return 'previous_month'
    case 'Last 12 months':
    case 'This year':
    case 'Last year':
      return 'previous_year'
    default:
      return 'previous_period'
  }
}

/** Calculate comparison period dates based on mode */
export function getComparisonPeriod(start: string, end: string, mode: CompareMode = 'previous_period', customCompareStart?: string, customCompareEnd?: string): { prevStart: string; prevEnd: string } {
  if (mode === 'custom' && customCompareStart && customCompareEnd) {
    return { prevStart: customCompareStart, prevEnd: customCompareEnd }
  }

  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  if (mode === 'previous_month') {
    const ps = new Date(s)
    ps.setMonth(ps.getMonth() - 1)
    const pe = new Date(e)
    pe.setMonth(pe.getMonth() - 1)
    // Handle month-end overflow (e.g. Mar 31 → Feb 28)
    if (ps.getDate() !== s.getDate()) ps.setDate(0) // last day of prev month
    if (pe.getDate() !== e.getDate()) pe.setDate(0)
    return { prevStart: fmt(ps), prevEnd: fmt(pe) }
  }

  if (mode === 'previous_year') {
    const ps = new Date(s)
    ps.setFullYear(ps.getFullYear() - 1)
    const pe = new Date(e)
    pe.setFullYear(pe.getFullYear() - 1)
    // Handle leap year (Feb 29 → Feb 28)
    if (ps.getDate() !== s.getDate()) ps.setDate(0)
    if (pe.getDate() !== e.getDate()) pe.setDate(0)
    return { prevStart: fmt(ps), prevEnd: fmt(pe) }
  }

  // previous_period: shift back by period length
  const diff = e.getTime() - s.getTime() + 864e5
  return {
    prevStart: new Date(s.getTime() - diff).toISOString().split('T')[0],
    prevEnd: new Date(s.getTime() - 864e5).toISOString().split('T')[0],
  }
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

const STORAGE_KEY = 'attomik_date_range'

function getSavedRange(): DateRange | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as DateRange
    // For preset labels (not custom), recalculate the dates so they stay fresh
    if (saved.label && saved.label !== 'Custom range') {
      const preset = PRESETS.find(p => p.label === saved.label)
      if (preset) {
        const range = preset.getRange()
        return { ...range, label: saved.label, compareMode: saved.compareMode ?? defaultCompareMode(saved.label), customCompareStart: saved.customCompareStart, customCompareEnd: saved.customCompareEnd }
      }
    }
    // For custom ranges, return as-is
    if (saved.start && saved.end && saved.label) return { ...saved, compareMode: saved.compareMode ?? 'previous_period' }
    return null
  } catch { return null }
}

export default function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [customStart, setCustomStart] = useState(value.start)
  const [customEnd, setCustomEnd] = useState(value.end)
  const [activePreset, setActivePreset] = useState(value.label)
  const [compareMode, setCompareMode] = useState<CompareMode>(value.compareMode ?? defaultCompareMode(value.label))
  const [customCompareStart, setCustomCompareStart] = useState(value.customCompareStart ?? '')
  const [customCompareEnd, setCustomCompareEnd] = useState(value.customCompareEnd ?? '')
  const [isMobile, setIsMobile] = useState(false)
  const [restored, setRestored] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Restore saved range on mount
  useEffect(() => {
    if (restored) return
    const saved = getSavedRange()
    if (saved && (saved.label !== value.label || saved.start !== value.start || saved.end !== value.end || saved.compareMode !== value.compareMode)) {
      setCustomStart(saved.start)
      setCustomEnd(saved.end)
      setActivePreset(saved.label)
      setCompareMode(saved.compareMode ?? defaultCompareMode(saved.label))
      if (saved.customCompareStart) setCustomCompareStart(saved.customCompareStart)
      if (saved.customCompareEnd) setCustomCompareEnd(saved.customCompareEnd)
      onChange(saved)
    }
    setRestored(true)
  }, [restored])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const mobileSheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          (!mobileSheetRef.current || !mobileSheetRef.current.contains(e.target as Node))) {
        setOpen(false)
      }
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
    const newMode = defaultCompareMode(preset.label)
    setCompareMode(newMode)
    if (preset.label !== 'Custom range') {
      const newRange: DateRange = { ...range, label: preset.label, compareMode: newMode }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRange))
      onChange(newRange)
      setOpen(false)
    }
  }

  const applyCustom = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      const newRange: DateRange = { start: customStart, end: customEnd, label: 'Custom range', compareMode }
      if (compareMode === 'custom' && customCompareStart && customCompareEnd) {
        newRange.customCompareStart = customCompareStart
        newRange.customCompareEnd = customCompareEnd
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRange))
      onChange(newRange)
      setOpen(false)
    }
  }

  const handleCompareModeChange = (mode: CompareMode) => {
    setCompareMode(mode)
    // For non-custom modes, apply immediately
    if (mode !== 'custom') {
      const newRange: DateRange = { ...value, compareMode: mode }
      // Clear custom compare dates when switching away
      delete newRange.customCompareStart
      delete newRange.customCompareEnd
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRange))
      onChange(newRange)
    } else {
      // For custom mode, pre-fill with previous_period dates if empty
      if (!customCompareStart || !customCompareEnd) {
        const { prevStart, prevEnd } = getComparisonPeriod(value.start, value.end, 'previous_period')
        setCustomCompareStart(prevStart)
        setCustomCompareEnd(prevEnd)
      }
    }
  }

  const applyCustomCompare = () => {
    if (customCompareStart && customCompareEnd && customCompareStart <= customCompareEnd) {
      const newRange: DateRange = { ...value, compareMode: 'custom' as CompareMode, customCompareStart, customCompareEnd }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRange))
      onChange(newRange)
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

  const compareInputStyle = {
    width: '100%', padding: '6px 8px', border: '1px solid #e0e0e0', borderRadius: 6,
    fontFamily: 'Barlow, sans-serif', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' as const,
  }

  const CompareSection = ({ mobile }: { mobile?: boolean }) => (
    <>
      <div style={{ display: 'flex', gap: mobile ? 8 : 6, flexWrap: 'wrap' }}>
        {COMPARE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleCompareModeChange(opt.value)}
            style={{
              flex: opt.value === 'custom' ? 'none' : 1,
              padding: mobile ? '10px 8px' : '7px 6px',
              border: `1.5px solid ${compareMode === opt.value ? '#000' : '#e0e0e0'}`,
              borderRadius: mobile ? 8 : 6, cursor: 'pointer', textAlign: 'center',
              fontFamily: 'Barlow, sans-serif', fontSize: mobile ? '0.8rem' : '0.75rem',
              fontWeight: compareMode === opt.value ? 700 : 500,
              background: compareMode === opt.value ? '#000' : '#fff',
              color: compareMode === opt.value ? '#00ff97' : '#444',
              transition: '0.15s', whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {compareMode === 'custom' && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 3, fontSize: '0.7rem' }}>Compare start</label>
              <input
                type="date" value={customCompareStart}
                onChange={e => setCustomCompareStart(e.target.value)}
                style={compareInputStyle}
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: 3, fontSize: '0.7rem' }}>Compare end</label>
              <input
                type="date" value={customCompareEnd}
                onChange={e => setCustomCompareEnd(e.target.value)}
                style={compareInputStyle}
              />
            </div>
          </div>
          <button
            onClick={applyCustomCompare}
            disabled={!customCompareStart || !customCompareEnd || customCompareStart > customCompareEnd}
            style={{
              width: '100%', padding: '6px 10px', border: '1.5px solid #000', borderRadius: 6,
              cursor: 'pointer', fontFamily: 'Barlow, sans-serif', fontSize: '0.75rem', fontWeight: 700,
              background: '#000', color: '#00ff97', transition: '0.15s',
              opacity: (!customCompareStart || !customCompareEnd || customCompareStart > customCompareEnd) ? 0.4 : 1,
            }}
          >
            Apply comparison
          </button>
        </div>
      )}
    </>
  )

  return (
    <>
      <div ref={ref} style={{ position: 'relative', zIndex: 100 }}>
        <button
          onClick={() => setOpen(!open)}
          className="btn btn-secondary"
          style={{
            padding: isMobile ? '7px 10px' : '8px 14px',
            fontSize: isMobile ? '0.8rem' : '0.875rem',
            whiteSpace: 'nowrap', maxWidth: isMobile ? 190 : 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
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
              <div className="form-label" style={{ marginBottom: 16 }}>
                {isCustom ? 'Custom date range' : 'Selected range'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Start date</label>
                  <input
                    type="date" value={customStart}
                    onChange={e => { setCustomStart(e.target.value); setActivePreset('Custom range') }}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e0e0', borderRadius: 6, fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}
                    onFocus={e => (e.target.style.borderColor = '#00ff97')}
                    onBlur={e => (e.target.style.borderColor = '#e0e0e0')}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>End date</label>
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

              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Compare to</label>
                <CompareSection />
              </div>

              <button
                onClick={applyCustom}
                disabled={!customStart || !customEnd || customStart > customEnd}
                className="btn btn-primary w-full"
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
            ref={mobileSheetRef}
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

            {/* Compare to */}
            <div style={{ padding: '0 16px 16px' }}>
              <div className="form-label" style={{ marginBottom: 8 }}>Compare to</div>
              <CompareSection mobile />
            </div>

            {/* Custom range */}
            <div style={{ padding: '0 16px 32px' }}>
              <div className="form-label" style={{ marginBottom: 10 }}>
                Custom range
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Start</label>
                  <input
                    type="date" value={customStart}
                    onChange={e => { setCustomStart(e.target.value); setActivePreset('Custom range') }}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: 8, fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>End</label>
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
                className="btn btn-primary btn-lg w-full"
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
