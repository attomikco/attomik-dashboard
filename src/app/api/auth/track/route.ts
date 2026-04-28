import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date().toISOString()
    const sb = createServiceClient()

    // Two disjoint updates run in parallel: promote any 'invited' rows to
    // 'joined' (and stamp last_seen_at) AND bump last_seen_at on the rest.
    // Previously these ran sequentially and double-wrote last_seen_at on
    // invited rows.
    await Promise.all([
      sb.from('org_memberships')
        .update({ status: 'joined', joined_at: now, last_seen_at: now })
        .eq('user_id', user.id).eq('status', 'invited'),
      sb.from('org_memberships')
        .update({ last_seen_at: now })
        .eq('user_id', user.id).neq('status', 'invited'),
    ])

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
