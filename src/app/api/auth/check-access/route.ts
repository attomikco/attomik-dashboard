import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUserByEmail } from '@/lib/supabase/auth-users'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const serviceClient = createServiceClient()

    // Check if user exists in auth
    const user = await getAuthUserByEmail(serviceClient, email)

    if (!user) {
      // Brand new email — no access
      return NextResponse.json({ access: false })
    }

    // Check if superadmin
    const { data: profile } = await serviceClient
      .from('profiles').select('is_superadmin').eq('id', user.id).single()

    if (profile?.is_superadmin) {
      return NextResponse.json({ access: true })
    }

    // Check if they have any org memberships
    const { data: memberships } = await serviceClient
      .from('org_memberships').select('id').eq('user_id', user.id).limit(1)

    // Also check pending invites
    const { data: invites } = await serviceClient
      .from('invites').select('id').eq('email', email).eq('status', 'pending').limit(1)

    const hasAccess = (memberships && memberships.length > 0) || (invites && invites.length > 0)

    return NextResponse.json({ access: hasAccess })
  } catch (err: any) {
    // On error, allow through — don't block legitimate users due to a server error
    return NextResponse.json({ access: true })
  }
}
