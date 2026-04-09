import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { org_id, cols, gte_date, lte_date, platform } = await request.json()
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const supabase = createServiceClient()
    const size = 1000
    let from = 0
    const all: any[] = []

    while (true) {
      let query = supabase.from('ad_spend').select(cols || '*')
        .eq('org_id', org_id)
        .order('date', { ascending: true })
        .range(from, from + size - 1)

      if (platform) query = query.eq('platform', platform)
      if (gte_date) query = query.gte('date', gte_date)
      if (lte_date) query = query.lte('date', lte_date)

      const { data, error } = await query
      if (error) {
        console.error('[ad-spend/query] error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < size) break
      from += size
    }

    return NextResponse.json({ data: all })
  } catch (err: any) {
    console.error('[ad-spend/query] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
