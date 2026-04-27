import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

function pct(cur: number, prev: number): number | null {
  if (prev <= 0) return null
  return ((cur - prev) / prev) * 100
}

const computeOrgYesterday = unstable_cache(
  async (orgId: string, tz: string) => {
    const service = createServiceClient()
    const nowInTz = new Date().toLocaleDateString('en-CA', { timeZone: tz })
    const today = new Date(nowInTz + 'T12:00:00')
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const dayBefore = new Date(today); dayBefore.setDate(dayBefore.getDate() - 2)
    const yStr = yesterday.toLocaleDateString('en-CA')
    const dStr = dayBefore.toLocaleDateString('en-CA')

    const yRange = toUTCRange(yStr, tz)
    const dRange = toUTCRange(dStr, tz)

    const [yOrders, dOrders, ySpend, dSpend] = await Promise.all([
      service.from('orders').select('total_price, source, status, units')
        .eq('org_id', orgId).gte('created_at', yRange.start).lte('created_at', yRange.end).neq('status', 'refunded'),
      service.from('orders').select('total_price, source, status, units')
        .eq('org_id', orgId).gte('created_at', dRange.start).lte('created_at', dRange.end).neq('status', 'refunded'),
      service.from('ad_spend').select('spend').eq('org_id', orgId).eq('date', yStr),
      service.from('ad_spend').select('spend').eq('org_id', orgId).eq('date', dStr),
    ])

    const sumRev = (rows: any[]) => rows.reduce((s, o) => s + Number(o.total_price || 0), 0)
    const countOrd = (rows: any[]) => rows.reduce((s: number, o: any) => s + (o.source === 'amazon' ? (Number(o.units) || 1) : 1), 0)
    const sumSpend = (rows: any[]) => rows.reduce((s, r) => s + Number(r.spend || 0), 0)

    const revenue = sumRev(yOrders.data ?? [])
    const orders = countOrd(yOrders.data ?? [])
    const ad_spend = sumSpend(ySpend.data ?? [])
    const roas = ad_spend > 0 ? revenue / ad_spend : 0

    const pRevenue = sumRev(dOrders.data ?? [])
    const pOrders = countOrd(dOrders.data ?? [])

    return {
      revenue,
      orders,
      ad_spend,
      roas,
      revenue_dod: pct(revenue, pRevenue),
      orders_dod: pct(orders, pOrders),
    }
  },
  ['insights-yesterday-org'],
  { revalidate: 60 }
)

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const viewAsUserId = searchParams.get('viewAs')

    const { data: prof } = await supabase
      .from('profiles').select('is_superadmin').eq('id', user.id).single() as { data: { is_superadmin: boolean | null } | null }

    const service = createServiceClient()

    // Resolve accessible orgs (same pattern as /api/overview).
    let orgs: { id: string; name: string; timezone: string | null }[] = []
    if (prof?.is_superadmin && !viewAsUserId) {
      const { data } = await service
        .from('organizations').select('id, name, timezone').order('name') as {
          data: { id: string; name: string; timezone: string | null }[] | null
        }
      orgs = data ?? []
    } else {
      const targetUserId = viewAsUserId ?? user.id
      const { data: memberships } = await service
        .from('org_memberships')
        .select('org_id, organizations(id, name, timezone)')
        .eq('user_id', targetUserId) as { data: { org_id: string; organizations: { id: string; name: string; timezone: string | null } | null }[] | null }
      orgs = (memberships ?? []).map(m => m.organizations).filter((o): o is { id: string; name: string; timezone: string | null } => !!o)
    }

    if (orgs.length === 0) return NextResponse.json({ data: [], date: null }, { headers: NO_CACHE })

    // Use the first org's timezone to label "yesterday" for the header.
    const headerTz = orgs[0].timezone ?? 'America/New_York'
    const headerNow = new Date().toLocaleDateString('en-CA', { timeZone: headerTz })
    const headerYesterday = new Date(headerNow + 'T12:00:00')
    headerYesterday.setDate(headerYesterday.getDate() - 1)
    const headerDate = headerYesterday.toLocaleDateString('en-CA')

    const rows = await Promise.all(orgs.map(async (org) => {
      const m = await computeOrgYesterday(org.id, org.timezone ?? 'America/New_York')
      return { org_id: org.id, org_name: org.name, ...m }
    }))

    return NextResponse.json({ data: rows, date: headerDate }, { headers: NO_CACHE })
  } catch (err: any) {
    console.error('[insights/yesterday-all] error:', err)
    return NextResponse.json({ error: err.message ?? 'Failed to load yesterday summary' }, { status: 500 })
  }
}
