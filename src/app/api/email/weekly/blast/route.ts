import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Superadmin-only test helper: send a weekly email for every org to a single
// recipient. Useful for previewing what each client's email looks like without
// having to trigger them one by one from the settings page.
//
// Hit this from a logged-in browser tab as a superadmin:
//   /api/email/weekly/blast?to=pablo@attomik.co
async function blast(request: Request) {
  const user_sb = createClient()
  const { data: { user } } = await user_sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: prof } = await user_sb.from('profiles').select('is_superadmin').eq('id', user.id).single()
  if (!(prof as any)?.is_superadmin) {
    return NextResponse.json({ error: 'Superadmin required' }, { status: 403 })
  }

  const url = new URL(request.url)
  const to = url.searchParams.get('to')?.trim()
  if (!to) return NextResponse.json({ error: '`to` query param required' }, { status: 400 })

  const sb = createServiceClient()
  const { data: orgs } = await sb.from('organizations').select('id, name').order('name')
  const orgList = (orgs ?? []) as Array<{ id: string; name: string }>

  const cookieHeader = request.headers.get('cookie') ?? ''
  const baseUrl = url.origin

  // Fire all sends in parallel — each is its own serverless invocation, so the
  // wrapper only waits for them to all return.
  const settled = await Promise.allSettled(orgList.map(async (org) => {
    const res = await fetch(`${baseUrl}/api/email/weekly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify({ org_id: org.id, recipientOverride: to }),
    })
    const body = await res.json().catch(() => ({}))
    return { org: org.name, status: res.status, ok: res.ok, ...body }
  }))

  const results = settled.map((r, i) => r.status === 'fulfilled'
    ? r.value
    : { org: orgList[i]?.name, ok: false, error: (r.reason as Error)?.message ?? 'unknown' })
  const sent = results.filter(r => r.ok).length

  return NextResponse.json({
    to,
    total: orgList.length,
    sent,
    failed: orgList.length - sent,
    results,
  })
}

export async function GET(request: Request) {
  return blast(request)
}

export async function POST(request: Request) {
  return blast(request)
}
