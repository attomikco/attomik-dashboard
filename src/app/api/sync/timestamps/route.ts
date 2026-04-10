import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sync_timestamps')
    .select('source, last_synced_at')
    .eq('org_id', orgId)

  console.log('[sync-timestamps API] org_id:', orgId, 'data:', data, 'error:', error)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Temporary: log what the DB returns so we can debug in the browser
  const debugRows = (data ?? []).map((r: any) => ({ ...r, _fetched_at: new Date().toISOString() }))
  console.log('[sync-timestamps API] returning', debugRows.length, 'rows, fetched_at:', new Date().toISOString())

  return NextResponse.json(data ?? [], {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
