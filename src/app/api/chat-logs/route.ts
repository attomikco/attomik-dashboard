import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthEmailsByIds } from '@/lib/supabase/auth-users'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('is_superadmin').eq('id', user.id).single()
    if (!profile?.is_superadmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const serviceClient = createServiceClient()

    const { data: logs } = await serviceClient
      .from('chat_logs')
      .select('id, user_id, org_name, question, answer, type, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    const userIds = Array.from(new Set((logs ?? []).map((l: any) => l.user_id).filter(Boolean)))
    const userMap = await getAuthEmailsByIds(serviceClient, userIds)

    const enriched = (logs ?? []).map((l: any) => ({
      ...l,
      email: userMap.get(l.user_id) ?? 'Unknown',
    }))

    return NextResponse.json({ logs: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
