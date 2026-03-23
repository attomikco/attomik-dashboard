import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date().toISOString()
    const serviceClient = createServiceClient()

    // Mark any 'invited' memberships as joined
    await serviceClient.from('org_memberships')
      .update({ status: 'joined', joined_at: now, last_seen_at: now })
      .eq('user_id', user.id)
      .eq('status', 'invited')

    // Always update last_seen_at
    await serviceClient.from('org_memberships')
      .update({ last_seen_at: now })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
