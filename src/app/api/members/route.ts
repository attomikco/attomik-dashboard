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

    // Fetch memberships
    const { data: memberships } = await serviceClient
      .from('org_memberships')
      .select('user_id, role, created_at')
      .eq('org_id', org_id)

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ members: [] })
    }

    // Fetch profiles for all members
    const userIds = memberships.map(m => m.user_id)
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, full_name, is_superadmin')
      .in('id', userIds)

    const members = memberships.map(m => {
      const profile = profiles?.find(p => p.id === m.user_id)
      return {
        id: m.user_id,
        full_name: profile?.full_name ?? null,
        is_superadmin: profile?.is_superadmin ?? false,
        role: m.role,
        created_at: m.created_at,
      }
    })

    return NextResponse.json({ members })
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
