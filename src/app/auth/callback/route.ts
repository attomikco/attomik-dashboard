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
    const { data: invite } = await serviceClient
      .from('invites')
      .select('org_id, role')
      .eq('email', user.email!)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (invite) {
      await serviceClient.from('profiles')
        .update({ org_id: invite.org_id, role: invite.role })
        .eq('id', user.id)

      await serviceClient.from('invites')
        .update({ status: 'accepted' })
        .eq('email', user.email!)
        .eq('status', 'pending')
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin))
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      return handleUser(data.user)
    }
  }

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type: type as any, token_hash })
    if (!error && data.user) {
      return handleUser(data.user)
    }
  }

  return NextResponse.redirect(new URL('/auth/login?error=auth_failed', requestUrl.origin))
}
