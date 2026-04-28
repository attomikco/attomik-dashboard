import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

const computeYesterday = unstable_cache(
  async (orgId: string) => {
    const supabase = createServiceClient()

    const { data: org } = await supabase
      .from('organizations')
      .select('timezone')
      .eq('id', orgId)
      .single() as { data: { timezone: string | null } | null }

    const tz = org?.timezone ?? 'America/New_York'
    const nowInTz = new Date().toLocaleDateString('en-CA', { timeZone: tz })
    const todayDate = new Date(nowInTz + 'T12:00:00')
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
    const countOrd = (rows: any[]) => rows.reduce((s: number, o: any) => s + ((o.source === 'amazon' || o.source === 'walmart') ? (Number(o.units) || 1) : 1), 0)
    const sumSpend = (rows: any[]) => rows.reduce((s, r) => s + Number(r.spend || 0), 0)

    const revenue = sumRev(yOrders.data ?? [])
    const orders = countOrd(yOrders.data ?? [])
    const adSpend = sumSpend(ySpend.data ?? [])
    const roas = adSpend > 0 ? revenue / adSpend : 0
    const aov = orders > 0 ? revenue / orders : 0
    const cac = orders > 0 && adSpend > 0 ? adSpend / orders : 0

    const pRevenue = sumRev(pdOrders.data ?? [])
    const pOrders = countOrd(pdOrders.data ?? [])
    const pAdSpend = sumSpend(pdSpend.data ?? [])
    const pRoas = pAdSpend > 0 ? pRevenue / pAdSpend : 0
    const pAov = pOrders > 0 ? pRevenue / pOrders : 0
    const pCac = pOrders > 0 && pAdSpend > 0 ? pAdSpend / pOrders : 0

    const metrics = {
      revenue, orders, ad_spend: adSpend, roas, aov, cac,
      revenue_dod: pRevenue > 0 ? pct(revenue, pRevenue) : null,
      orders_dod: pOrders > 0 ? pct(orders, pOrders) : null,
      ad_spend_dod: pAdSpend > 0 ? pct(adSpend, pAdSpend) : null,
      roas_dod: pRoas > 0 ? pct(roas, pRoas) : null,
      aov_dod: pAov > 0 ? pct(aov, pAov) : null,
      cac_dod: pCac > 0 && cac > 0 ? pct(cac, pCac) : null,
    }

    return { date: yStr, metrics }
  },
  ['insights-yesterday'],
  { revalidate: 60 }
)

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  const service = createServiceClient()
  const { data: prof } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()
  const isSuperadmin = !!(prof as any)?.is_superadmin

  if (!isSuperadmin) {
    const { data: membership } = await service
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await computeYesterday(orgId)
  return NextResponse.json({ data }, { headers: NO_CACHE })
}
