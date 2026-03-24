import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const org_id = searchParams.get('org_id')
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const serviceClient = createServiceClient()

    const { data: memberships } = await serviceClient
      .from('org_memberships')
      .select('user_id, role, status, invited_at, joined_at, last_seen_at')
      .eq('org_id', org_id)
      .order('invited_at', { ascending: false })

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ members: [] })
    }

    const userIds = memberships.map(m => m.user_id)
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, full_name, is_superadmin')
      .in('id', userIds)

    // Also get emails from auth.users via admin API
    const { data: { users: authUsers } } = await serviceClient.auth.admin.listUsers()

    const members = memberships.map(m => {
      const profile = profiles?.find(p => p.id === m.user_id)
      const authUser = authUsers?.find(u => u.id === m.user_id)
      return {
        id: m.user_id,
        full_name: profile?.full_name ?? null,
        email: authUser?.email ?? null,
        is_superadmin: profile?.is_superadmin ?? false,
        role: m.role,
        status: m.status ?? 'joined',
        invited_at: m.invited_at,
        joined_at: m.joined_at,
        last_seen_at: m.last_seen_at,
      }
    })

    return NextResponse.json({ members })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('is_superadmin').eq('id', user.id).single()
    if (!profile?.is_superadmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { user_id, org_id, role } = await request.json()
    if (!user_id || !org_id || !role) return NextResponse.json({ error: 'user_id, org_id and role required' }, { status: 400 })

    const serviceClient = createServiceClient()
    const now = new Date().toISOString()

    // Check if user has actually signed in before
    const { data: { users } } = await serviceClient.auth.admin.listUsers()
    const targetUser = users?.find(u => u.id === user_id)
    const hasSignedIn = !!targetUser?.last_sign_in_at

    await serviceClient.from('org_memberships').upsert({
      user_id,
      org_id,
      role,
      status: hasSignedIn ? 'joined' : 'invited',
      invited_at: now,
      joined_at: hasSignedIn ? now : null,
    }, { onConflict: 'user_id,org_id' })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('is_superadmin').eq('id', user.id).single()
    if (!profile?.is_superadmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { user_id, org_id, delete_user } = await request.json()
    const serviceClient = createServiceClient()
    await serviceClient.from('org_memberships').delete().eq('user_id', user_id).eq('org_id', org_id)

    // If delete_user flag is set, fully remove from Supabase after last membership
    if (delete_user) {
      const { data: remaining } = await serviceClient.from('org_memberships').select('id').eq('user_id', user_id).limit(1)
      if (!remaining || remaining.length === 0) {
        // No memberships left — clean up profile, invites, and auth user
        const { data: { users } } = await serviceClient.auth.admin.listUsers()
        const authUser = users?.find(u => u.id === user_id)
        if (authUser?.email) {
          await serviceClient.from('invites').delete().eq('email', authUser.email)
        }
        await serviceClient.from('profiles').delete().eq('id', user_id)
        await serviceClient.auth.admin.deleteUser(user_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
