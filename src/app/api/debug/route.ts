import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const orgId = '5df94b65-44fd-4b00-a7a7-c5800e077a28'
    const supabase = createServiceClient()

    const { data: org } = await supabase.from('organizations')
      .select('name, timezone, channels').eq('id', orgId).single()

    const tz = org?.timezone ?? 'America/New_York'
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
    const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
    const today = `${p.year}-${p.month}-${p.day}`
    const monthStart = `${p.year}-${p.month}-01`

    // Paginated fetch
    const fetchAll = async (gte: string, lte: string) => {
      const all: any[] = []
      let from = 0
      while (true) {
        const { data } = await supabase.from('orders')
          .select('total_price, status, source, created_at')
          .eq('org_id', orgId).gte('created_at', gte).lte('created_at', lte)
          .range(from, from + 999)
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < 1000) break
        from += 1000
      }
      return all
    }

    const orders = await fetchAll(`${monthStart}T00:00:00.000Z`, `${today}T23:59:59.999Z`)

    // Also check: any amazon orders at all for this org?
    const { data: amazonAll, count: amazonCount } = await supabase.from('orders')
      .select('total_price, source, created_at, external_id', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('source', 'amazon')
      .limit(5)

    const sources: Record<string, { count: number; rev: number }> = {}
    for (const o of orders) {
      const src = o.source ?? 'unknown'
      if (!sources[src]) sources[src] = { count: 0, rev: 0 }
      sources[src].count++
      if (o.status !== 'refunded') sources[src].rev += Number(o.total_price || 0)
    }

    const totalRev = orders.filter(o => o.status !== 'refunded').reduce((s, o) => s + Number(o.total_price || 0), 0)

    return NextResponse.json({
      org: org?.name,
      timezone: tz,
      channels: org?.channels,
      range: { monthStart, today },
      totalOrdersPaginated: orders.length,
      totalRevenue: totalRev,
      bySource: sources,
      amazonInDb: {
        totalCount: amazonCount,
        samples: (amazonAll ?? []).map(o => ({ price: o.total_price, date: o.created_at, id: o.external_id })),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
