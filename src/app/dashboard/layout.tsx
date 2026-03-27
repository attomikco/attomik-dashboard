'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Wait for auth session to be fully ready before rendering pages
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/auth/login')
      } else {
        setReady(true)
        // Update joined status + last_seen on every dashboard load
        // This handles users who get added to new projects while already logged in
        fetch('/api/auth/track', { method: 'POST' }).catch(() => {})
      }
    })

    // Also listen for auth changes (handles magic link landing)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setReady(true)
      } else if (event === 'SIGNED_OUT') {
        router.push('/auth/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main">
        {ready ? children : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }} className="text-muted">
            Loading…
          </div>
        )}
      </main>
    </div>
  )
}
