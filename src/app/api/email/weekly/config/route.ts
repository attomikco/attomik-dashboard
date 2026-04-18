import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function requireMember(org_id: string) {
  const user_sb = createClient()
  const { data: { user } } = await user_sb.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const sb = createServiceClient()
  const { data: profile } = await sb.from('profiles').select('is_superadmin').eq('id', user.id).single()
  if ((profile as any)?.is_superadmin) return { sb }

  const { data: membership } = await sb.from('org_memberships')
    .select('user_id').eq('user_id', user.id).eq('org_id', org_id).maybeSingle()
  if (!membership) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { sb }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const org_id = searchParams.get('org_id')
  if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  const { error: authError, sb } = await requireMember(org_id)
  if (authError) return authError

  const { data, error } = await sb!.from('organizations')
    .select('weekly_email_enabled').eq('id', org_id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  return NextResponse.json({ weekly_email_enabled: !!(data as any).weekly_email_enabled })
}

export async function PUT(request: Request) {
  const { org_id, weekly_email_enabled } = await request.json()
  if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })
  if (typeof weekly_email_enabled !== 'boolean') {
    return NextResponse.json({ error: 'weekly_email_enabled must be a boolean' }, { status: 400 })
  }

  const { error: authError, sb } = await requireMember(org_id)
  if (authError) return authError

  const { error } = await sb!.from('organizations')
    .update({ weekly_email_enabled }).eq('id', org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, weekly_email_enabled })
}
