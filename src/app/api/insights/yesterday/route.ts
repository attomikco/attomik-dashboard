import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
}

// UTC timestamp range for a local-timezone calendar date.
function toUTCRange(dateStr: string, tz: string) {
  const utcMidnight = new Date(`${dateStr}T00:00:00Z`)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const parts = fmt.formatToParts(utcMidnight)
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
  const localAtUTCMidnight = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`)
  const targetLocalStart = new Date(`${dateStr}T00:00:00`)
  const diffMs = targetLocalStart.getTime() - localAtUTCMidnight.getTime()
  return {
    start: new Date(utcMidnight.getTime() + diffMs).toISOString(),
    end: new Date(new Date(`${dateStr}T23:59:59Z`).getTime() + diffMs).toISOString(),
  }
}

function pct(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return ((cur - prev) / prev) * 100
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('timezone')
    .eq('id', orgId)
    .single() as { data: { timezone: string | null } | null }

  const tz = org?.timezone ?? 'America/New_York'
  const nowInTz = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const todayDate = new Date(nowInTz + 'T12:00:00')
  // Yesterday = today-1, Day-before-yesterday = today-2 (for day-over-day comparison)
  const yesterday = new Date(todayDate); yesterday.setDate(yesterday.getDate() - 1)
  const prevDay = new Date(todayDate); prevDay.setDate(prevDay.getDate() - 2)
  const yStr = yesterday.toLocaleDateString('en-CA')
  const pdStr = prevDay.toLocaleDateString('en-CA')

  const yRange = toUTCRange(yStr, tz)
  const pdRange = toUTCRange(pdStr, tz)

  const [yOrders, pdOrders, ySpend, pdSpend] = await Promise.all([
    supabase.from('orders').select('total_price, source, status, units')
      .eq('org_id', orgId).gte('created_at', yRange.start).lte('created_at', yRange.end).neq('status', 'refunded'),
    supabase.from('orders').select('total_price, source, status, units')
      .eq('org_id', orgId).gte('created_at', pdRange.start).lte('created_at', pdRange.end).neq('status', 'refunded'),
    supabase.from('ad_spend').select('spend').eq('org_id', orgId).eq('date', yStr),
    supabase.from('ad_spend').select('spend').eq('org_id', orgId).eq('date', pdStr),
  ])

  const sumRev = (rows: any[]) => rows.reduce((s, o) => s + Number(o.total_price || 0), 0)
  const countOrd = (rows: any[]) => rows.reduce((s: number, o: any) => s + (o.source === 'amazon' ? (Number(o.units) || 1) : 1), 0)
  const sumSpend = (rows: any[]) => rows.reduce((s, r) => s + Number(r.spend || 0), 0)

  const revenue = sumRev(yOrders.data ?? [])
  const orders = countOrd(yOrders.data ?? [])
  const adSpend = sumSpend(ySpend.data ?? [])
  const roas = adSpend > 0 ? revenue / adSpend : 0

  const pRevenue = sumRev(pdOrders.data ?? [])
  const pOrders = countOrd(pdOrders.data ?? [])
  const pAdSpend = sumSpend(pdSpend.data ?? [])
  const pRoas = pAdSpend > 0 ? pRevenue / pAdSpend : 0

  const metrics = {
    revenue, orders, ad_spend: adSpend, roas,
    revenue_dod: pRevenue > 0 ? pct(revenue, pRevenue) : null,
    orders_dod: pOrders > 0 ? pct(orders, pOrders) : null,
    ad_spend_dod: pAdSpend > 0 ? pct(adSpend, pAdSpend) : null,
    roas_dod: pRoas > 0 ? pct(roas, pRoas) : null,
  }

  return NextResponse.json({ data: { date: yStr, metrics } }, { headers: NO_CACHE })
}
