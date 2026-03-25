'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authenticating, setAuthenticating] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Show error from callback redirect
  useEffect(() => {
    if (searchParams.get('error') === 'auth_failed') {
      setError('Authentication failed. The link may have expired — please try again.')
    }
  }, [searchParams])

  // Handle implicit flow — token arrives as URL fragment (#access_token=...)
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token')) return
    setAuthenticating(true)
    const params = new URLSearchParams(hash.replace('#', ''))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(async ({ data, error }) => {
        if (!error && data.user) {
          // Update membership status to joined
          await fetch('/api/auth/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: data.user.id }),
          })
          router.replace('/dashboard/analytics')
        } else {
          setAuthenticating(false)
        }
      })
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Check if this email has access before sending magic link
    const check = await fetch('/api/auth/check-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const { access } = await check.json()

    if (!access) {
      setError('This email is not part of any project. Contact your admin to get access.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 48,
      width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
    }}>
      {/* Logo */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3162 909" style={{ height: 28, marginBottom: 32 }}>
        <g transform="scale(8.11041548093341) translate(10, 10)">
          <g transform="matrix(1.0466,0,0,1.0466,-6.28,-6.28)" fill="#000000">
            <g transform="translate(0,-952.36218)">
              <path d="m 13.540789,1013.168 c -4.1612604,0 -7.5408665,3.3922 -7.5408665,7.5693 0,4.1771 3.3796061,7.605 7.5408665,7.605 0.813543,0 1.613976,-0.1361 2.383228,-0.3928 12.281102,18.8997 36.649842,23.2608 54.493227,13.032 0.521221,-0.2991 0.724607,-1.0475 0.426614,-1.571 -0.297992,-0.5234 -1.043503,-0.7275 -1.565078,-0.4284 -16.772953,9.6153 -39.67122,5.6292 -51.327282,-12.1037 1.894251,-1.3812 3.130157,-3.6195 3.130157,-6.1411 0,-4.1771 -3.379252,-7.5693 -7.540866,-7.5693 z"/>
              <path d="m 70.417244,970.57299 c -0.951023,0.12132 -1.237323,1.69026 -0.391181,2.14225 13.429842,8.21899 20.928543,24.30182 17.64248,40.55986 -0.392953,-0.067 -0.80185,-0.107 -1.209331,-0.107 -4.161259,0 -7.540866,3.3922 -7.540866,7.5692 0,4.1771 3.379607,7.605 7.540866,7.605 4.16126,0 7.540866,-3.4279 7.540866,-7.605 0,-2.9516 -1.686968,-5.51 -4.161614,-6.748 3.607441,-17.29107 -4.331338,-34.48188 -18.638503,-43.23773 -0.189921,-0.12122 -0.415984,-0.18423 -0.64063,-0.17852 -0.04784,-0.003 -0.09425,-0.003 -0.142087,0 z"/>
              <path d="m 50.000001,958.36218 c -4.012441,0 -7.27441,3.16987 -7.505079,7.14083 -17.197086,3.19362 -29.727637,16.85266 -32.5821254,33.06201 a 1.1383515,1.1426463 0 1 0 2.2407874,0.39275 c 2.681221,-15.22486 14.388307,-28.07084 30.518858,-31.1697 0.826653,3.28539 3.802677,5.71266 7.327559,5.71266 4.161259,0 7.540866,-3.39219 7.540866,-7.56928 0,-4.17708 -3.379607,-7.56927 -7.540866,-7.56927 z"/>
            </g>
          </g>
          <g transform="matrix(2.7814,0,0,2.7814,111.833,11.314)" fill="#000000">
            <path d="M12.76 20 l-1.6 -3.72 l-7.94 0 l-1.6 3.72 l-1.56 0 l6.28 -14.58 l1.74 0 l6.3 14.58 l-1.62 0 z M10.58 14.88 l-3.4 -7.88 l-3.38 7.88 l6.78 0 z M21.24 6.86 l0 13.14 l-1.52 0 l0 -13.14 l-4.88 0 l0 -1.44 l11.28 0 l0 1.44 l-4.88 0 z M33.32 6.86 l0 13.14 l-1.52 0 l0 -13.14 l-4.88 0 l0 -1.44 l11.28 0 l0 1.44 l-4.88 0 z M54.26 12.68 c0 1.38 -0.32 2.64 -0.94 3.78 c-0.64 1.14 -1.52 2.04 -2.64 2.7 c-1.14 0.66 -2.38 1 -3.78 1 c-1.02 0 -1.98 -0.2 -2.9 -0.58 c-0.9 -0.38 -1.68 -0.9 -2.32 -1.58 c-0.64 -0.64 -1.14 -1.42 -1.52 -2.34 c-0.36 -0.92 -0.56 -1.88 -0.56 -2.9 c0 -1.38 0.32 -2.64 0.96 -3.78 c0.62 -1.14 1.5 -2.06 2.64 -2.72 c1.12 -0.66 2.38 -0.98 3.76 -0.98 c1.02 0 1.98 0.18 2.9 0.56 c0.9 0.4 1.68 0.92 2.32 1.56 c0.64 0.68 1.16 1.46 1.52 2.36 c0.38 0.92 0.56 1.88 0.56 2.92 z M52.68 12.76 c0 -1.64 -0.6 -3.16 -1.6 -4.26 s-2.5 -1.8 -4.18 -1.8 c-1.08 0 -2.06 0.28 -2.94 0.8 c-0.88 0.56 -1.56 1.28 -2.04 2.18 c-0.48 0.92 -0.72 1.92 -0.72 3 c0 1.62 0.6 3.16 1.6 4.24 c1 1.1 2.5 1.8 4.16 1.8 c1.08 0 2.06 -0.28 2.94 -0.82 c0.9 -0.52 1.58 -1.26 2.06 -2.16 s0.72 -1.9 0.72 -2.98 z M70.3 5.42 l2.2 0 l0 14.58 l-1.52 0 l0 -12.5 l0 0 l-5.42 12.5 l-1.38 0 l-5.38 -12.4 l0 0 l0 12.4 l-1.52 0 l0 -14.58 l2.18 0 l5.44 12.5 z M76.56 20 l0 -14.58 l1.54 0 l0 14.58 l-1.54 0 z M83.68 20 l-1.54 0 l0 -14.58 l1.54 0 l0 6.44 l0.1 0 l6.54 -6.44 l2.12 0 l-7.14 6.98 l7.48 7.6 l-2.16 0 l-6.84 -7.02 l-0.1 0 l0 7.02 z"/>
          </g>
        </g>
      </svg>

      {authenticating ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e0e0e0', borderTopColor: '#00ff97', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: '1rem', color: '#000', marginBottom: 4 }}>Signing you in…</p>
          <p style={{ fontSize: '0.8rem', color: '#999' }}>Setting up your account</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : <>

      <h1 style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.03em', marginBottom: 6 }}>
        Sign in
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: 28 }}>
        We'll send a magic link to your email — no password needed.
      </p>

      {sent ? (
        <div style={{ background: 'var(--accent-light)', border: '1px solid var(--success)', borderRadius: 8, padding: '16px 20px' }}>
          <p style={{ color: '#007a48', fontWeight: 600, fontSize: '0.875rem' }}>
            ✓ Check your email for the login link.
          </p>
        </div>
      ) : (
        <form onSubmit={handleLogin}>
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
              <p style={{ color: '#b91c1c', fontSize: '0.8rem' }}>{error}</p>
            </div>
          )}
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'var(--font-barlow)', fontSize: '0.875rem',
              marginBottom: 12, outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', background: loading ? '#ccc' : 'var(--accent)',
              color: '#000', fontFamily: 'var(--font-barlow)', fontWeight: 700,
              fontSize: '0.875rem', padding: '11px 20px',
              border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      )}
      </>}
    </div>
  )
}
