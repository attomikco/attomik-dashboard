import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BLAST_CONCURRENCY = 5

// Superadmin-only test helper: send a weekly email for every org to a single
// recipient. Useful for previewing what each client's email looks like without
// having to trigger them one by one from the settings page.
//
// POST as a logged-in superadmin with:
//   { "to": "pablo@attomik.co", "confirm": "send" }
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

async function blast(request: Request) {
  const user_sb = createClient()
  const { data: { user } } = await user_sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: prof } = await user_sb.from('profiles').select('is_superadmin').eq('id', user.id).single()
  if (!(prof as any)?.is_superadmin) {
    return NextResponse.json({ error: 'Superadmin required' }, { status: 403 })
  }

  const url = new URL(request.url)
  const body = await request.json().catch(() => ({})) as { to?: string; confirm?: boolean | string }
  const to = (body.to ?? url.searchParams.get('to') ?? '').trim()
  if (!to) return NextResponse.json({ error: '`to` required' }, { status: 400 })

  const confirm = body.confirm ?? url.searchParams.get('confirm')
  const confirmed = confirm === true || String(confirm).toLowerCase() === 'send'
  if (!confirmed) {
    return NextResponse.json({ error: 'Send confirmation required: confirm must be "send"' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { data: orgs } = await sb.from('organizations').select('id, name')
    .is('archived_at', null).order('name')
  const orgList = (orgs ?? []) as Array<{ id: string; name: string }>

  const cookieHeader = request.headers.get('cookie') ?? ''
  const baseUrl = url.origin

  const results = await mapWithConcurrency(orgList, BLAST_CONCURRENCY, async (org) => {
    try {
      const res = await fetch(`${baseUrl}/api/email/weekly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({ org_id: org.id, recipientOverride: to }),
      })
      const body = await res.json().catch(() => ({}))
      return { org: org.name, status: res.status, ok: res.ok, ...body }
    } catch (err: any) {
      return { org: org.name, ok: false, error: err?.message ?? 'unknown' }
    }
  })
  const sent = results.filter(r => r.ok).length

  return NextResponse.json({
    to,
    total: orgList.length,
    sent,
    failed: orgList.length - sent,
    results,
  })
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with { to, confirm: "send" }.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}

export async function POST(request: Request) {
  return blast(request)
}
