import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  const supabase = createServiceClient()

  // Debug: test if we can write to sync_timestamps at all
  const debug = searchParams.get('debug') === '1'
  let debugInfo: any = undefined
  if (debug) {
    const testTime = new Date().toISOString()
    const { error: delErr } = await supabase
      .from('sync_timestamps').delete().eq('org_id', orgId).eq('source', 'shopify')
    const { data: insertResult, error: insertErr } = await supabase
      .from('sync_timestamps')
      .insert({ org_id: orgId, source: 'shopify', last_synced_at: testTime })
      .select()
    const { data: readBack, error: readErr } = await supabase
      .from('sync_timestamps')
      .select('*')
      .eq('org_id', orgId)
    debugInfo = { testTime, delErr, insertResult, insertErr, readBack, readErr }
  }

  const { data, error } = await supabase
    .from('sync_timestamps')
    .select('source, last_synced_at')
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(debug ? { rows: data ?? [], debug: debugInfo } : data ?? [], { headers: NO_CACHE })
}
