'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader } from 'lucide-react'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface UploadResult {
  inserted: number
  skipped: number
  filename: string
  type: string
}

export default function CsvUpload() {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file')
      setStatus('error')
      return
    }
    setStatus('uploading')
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const activeOrgId = localStorage.getItem('activeOrgId') ?? ''
      const res = await fetch('/api/upload/csv', {
        method: 'POST',
        body: formData,
        headers: { 'x-active-org': activeOrgId },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setResult({ ...data, filename: file.name })
      setStatus('success')
    } catch (err: any) {
      setError(err.message)
      setStatus('error')
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const reset = () => { setStatus('idle'); setResult(null); setError('') }

  return (
    <div>
      {status === 'idle' || status === 'error' ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : status === 'error' ? '#fca5a5' : 'var(--border)'}`,
            borderRadius: 10, padding: '48px 24px', textAlign: 'center',
            cursor: 'pointer', transition: '0.15s',
            background: dragging ? 'var(--accent-light)' : status === 'error' ? '#fff5f5' : 'var(--cream)',
          }}
        >
          <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <Upload size={32} style={{ color: dragging ? 'var(--success)' : 'var(--muted)', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
            {dragging ? 'Drop it!' : 'Drop your CSV here'}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>or click to browse</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Shopify · Amazon · Meta · Custom
          </p>
          {status === 'error' && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#b91c1c', fontSize: '0.8rem' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>
      ) : status === 'uploading' ? (
        <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center', background: 'var(--cream)' }}>
          <Loader size={32} style={{ color: 'var(--accent)', marginBottom: 12, display: 'block', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontWeight: 600 }}>Processing your CSV…</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>Detecting columns and importing rows</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--success)', borderRadius: 10, padding: 24, background: 'var(--accent-light)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <CheckCircle size={20} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, marginBottom: 4 }}>{result?.filename} imported</p>
              <p style={{ fontSize: '0.875rem', color: '#007a48' }}>
                {result?.inserted} rows added · {result?.skipped} skipped (duplicates) · type: {result?.type}
              </p>
            </div>
            <button onClick={reset} style={{
              background: 'var(--ink)', color: 'var(--accent)', border: 'none',
              borderRadius: 6, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'var(--font-barlow)',
            }}>
              Upload another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
