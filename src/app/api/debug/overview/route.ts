import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const orgId = '5df94b65-44fd-4b00-a7a7-c5800e077a28'
  const supabase = createServiceClient()

  // Get org info
  const { data: org } = await supabase.from('organizations')
    .select('name, timezone, channels').eq('id', orgId).single()

  const tz = org?.timezone ?? 'America/New_York'

  // Get current month start/end in org timezone
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
  const today = `${p.year}-${p.month}-${p.day}`
  const monthStart = `${p.year}-${p.month}-01`

  // What the overview sends
  const toUTC = (dateStr: string, endOfDay = false) => {
    const time = endOfDay ? '23:59:59' : '00:00:00'
    const utcMidnight = new Date(`${dateStr}T${time}Z`)
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
    const fmtParts = fmt.formatToParts(utcMidnight)
    const fp = Object.fromEntries(fmtParts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
    const localAtUTCMidnight = new Date(`${fp.year}-${fp.month}-${fp.day}T${fp.hour}:${fp.minute}:${fp.second}`)
    const targetLocal = new Date(`${dateStr}T${time}`)
    const diffMs = targetLocal.getTime() - localAtUTCMidnight.getTime()
    return new Date(utcMidnight.getTime() + diffMs).toISOString()
  }

  const start = toUTC(monthStart, false)
  const end = toUTC(today, true)
  const orderStart = `${monthStart}T00:00:00.000Z` < start ? `${monthStart}T00:00:00.000Z` : start
  const orderEnd = `${today}T23:59:59.999Z` > end ? `${today}T23:59:59.999Z` : end

  // Count orders by source - total in DB for this month
  const { data: allOrders } = await supabase.from('orders')
    .select('total_price, status, source, created_at')
    .eq('org_id', orgId)
    .gte('created_at', `${monthStart}T00:00:00.000Z`)
    .lte('created_at', `${today}T23:59:59.999Z`)

  const { data: narrowOrders } = await supabase.from('orders')
    .select('total_price, status, source, created_at')
    .eq('org_id', orgId)
    .gte('created_at', orderStart)
    .lte('created_at', orderEnd)

  // Paginated (what overview actually does)
  const fetchAll = async (gte: string, lte: string) => {
    const size = 1000
    let from = 0
    const all: any[] = []
    while (true) {
      const { data } = await supabase.from('orders')
        .select('total_price, status, source')
        .eq('org_id', orgId).gte('created_at', gte).lte('created_at', lte)
        .range(from, from + size - 1)
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < size) break
      from += size
    }
    return all
  }

  const paginatedOrders = await fetchAll(orderStart, orderEnd)

  const sourceCounts = (orders: any[]) => {
    const counts: Record<string, { count: number; revenue: number }> = {}
    for (const o of orders) {
      const src = o.source ?? 'unknown'
      if (!counts[src]) counts[src] = { count: 0, revenue: 0 }
      counts[src].count++
      if (o.status !== 'refunded') counts[src].revenue += Number(o.total_price || 0)
    }
    return counts
  }

  const ch = org?.channels ?? {}
  const isConfigured = Object.keys(ch).length > 0

  return NextResponse.json({
    org: { name: org?.name, timezone: tz, channels: ch, isConfigured },
    dateRange: { monthStart, today, start, end, orderStart, orderEnd },
    channelFlags: {
      showShopify: !isConfigured || ch.shopify !== false,
      showAmazon: !isConfigured || ch.amazon !== false,
    },
    broadQuery: {
      totalOrders: allOrders?.length ?? 0,
      bySouce: sourceCounts(allOrders ?? []),
      totalRevenue: (allOrders ?? []).filter(o => o.status !== 'refunded').reduce((s, o) => s + Number(o.total_price || 0), 0),
    },
    narrowQuery: {
      totalOrders: narrowOrders?.length ?? 0,
      bySource: sourceCounts(narrowOrders ?? []),
      totalRevenue: (narrowOrders ?? []).filter(o => o.status !== 'refunded').reduce((s, o) => s + Number(o.total_price || 0), 0),
    },
    paginatedQuery: {
      totalOrders: paginatedOrders.length,
      bySource: sourceCounts(paginatedOrders),
      totalRevenue: paginatedOrders.filter(o => o.status !== 'refunded').reduce((s, o) => s + Number(o.total_price || 0), 0),
    },
  })
}
