'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

const TRACK_DEBOUNCE_MS = 60_000

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Auth is already enforced by middleware before we ever render here, so we
    // don't gate paint on a session round-trip. We only:
    //  1. Fire a debounced last-seen ping (cheap, fire-and-forget).
    //  2. Listen for SIGNED_OUT to bounce the user to /auth/login.
    try {
      const last = Number(window.localStorage.getItem('attomik:last-track') || 0)
      if (Date.now() - last > TRACK_DEBOUNCE_MS) {
        window.localStorage.setItem('attomik:last-track', String(Date.now()))
        fetch('/api/auth/track', { method: 'POST' }).catch(() => {})
      }
    } catch {}

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/auth/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  )
}
