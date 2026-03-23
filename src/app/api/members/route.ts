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

    await serviceClient.from('org_memberships').upsert({
      user_id,
      org_id,
      role,
      status: 'joined',
      invited_at: now,
      joined_at: now,
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

    const { user_id, org_id } = await request.json()
    const serviceClient = createServiceClient()
    await serviceClient.from('org_memberships').delete().eq('user_id', user_id).eq('org_id', org_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
