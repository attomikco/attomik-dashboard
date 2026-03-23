import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard/analytics'

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const serviceClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  async function handleUser(user: any) {
    const now = new Date().toISOString()

    // Find ALL pending invites for this email
    const { data: invites } = await serviceClient
      .from('invites')
      .select('org_id, role')
      .eq('email', user.email!)
      .eq('status', 'pending')

    if (invites && invites.length > 0) {
      for (const invite of invites) {
        // Upsert membership
        await serviceClient.from('org_memberships').upsert({
          user_id: user.id,
          org_id: invite.org_id,
          role: invite.role,
          status: 'joined',
          joined_at: now,
          last_seen_at: now,
        }, { onConflict: 'user_id,org_id' })
      }

      // Mark invites accepted
      await serviceClient.from('invites')
        .update({ status: 'accepted' })
        .eq('email', user.email!)
        .eq('status', 'pending')
    } else {
      // Existing user signing in — update last_seen_at and mark joined on all their memberships
      await serviceClient.from('org_memberships')
        .update({ last_seen_at: now, status: 'joined', joined_at: now })
        .eq('user_id', user.id)
        .is('joined_at', null)

      await serviceClient.from('org_memberships')
        .update({ last_seen_at: now })
        .eq('user_id', user.id)
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) return handleUser(data.user)
  }

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type: type as any, token_hash })
    if (!error && data.user) return handleUser(data.user)
  }

  return NextResponse.redirect(new URL('/auth/login?error=auth_failed', requestUrl.origin))
}
