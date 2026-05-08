import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { timed, timeBlock } from '@/lib/timing'

export async function GET(request: Request) {
  return timed('api.overview.GET', async () => {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)
    const viewAsUserId = searchParams.get('viewAs')

    const targetUserId = viewAsUserId ?? user.id
    const [profRes, membershipRes] = await Promise.all([
      supabase.from('profiles').select('is_superadmin').eq('id', user.id).single(),
      serviceClient
        .from('org_memberships')
        .select('org_id, organizations(id, name, slug, timezone, channels, shopify_synced_at, ga_property_id, archived_at)')
        .eq('user_id', targetUserId),
    ])
    const isSuperadmin = !!(profRes.data as any)?.is_superadmin

    if (viewAsUserId && !isSuperadmin) {
      return NextResponse.json({ error: 'Superadmin required for viewAs' }, { status: 403 })
    }

    let orgs: any[] = []
    if (isSuperadmin && !viewAsUserId) {
      const { data } = await serviceClient
        .from('organizations').select('id, name, slug, timezone, channels, shopify_synced_at, ga_property_id, archived_at')
        .is('archived_at', null).order('name')
      orgs = (data ?? []).map(({ archived_at: _a, ...rest }: any) => rest)
    } else {
      orgs = (membershipRes.data ?? [])
        .map((m: any) => m.organizations)
        .filter((o: any) => o && o.archived_at == null)
        .map(({ archived_at: _a, ...rest }: any) => rest)
    }

    const res = NextResponse.json({ orgs })
    // Short private cache so rapid sidebar mounts / back-forward nav don't
    // re-hit the DB. Per-user data so must stay `private`.
    res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
  })
}

type OverviewKpiRequest = {
  org_id?: string
  start?: string
  end?: string
  prevStart?: string
  prevEnd?: string
  adSpendStart?: string
  adSpendEnd?: string
  adSpendPrevStart?: string
  adSpendPrevEnd?: string
}

function toRpcRange(item: OverviewKpiRequest) {
  const spendStart = item.adSpendStart ?? item.start?.split('T')[0]
  const spendEnd = item.adSpendEnd ?? item.end?.split('T')[0]
  const spendPrevStart = item.adSpendPrevStart ?? item.prevStart?.split('T')[0]
  const spendPrevEnd = item.adSpendPrevEnd ?? item.prevEnd?.split('T')[0]

  return {
    org_id: item.org_id,
    start_ts: item.start,
    end_ts: item.end,
    prev_start_ts: item.prevStart,
    prev_end_ts: item.prevEnd,
    ad_spend_start: spendStart,
    ad_spend_end: spendEnd,
    ad_spend_prev_start: spendPrevStart,
    ad_spend_prev_end: spendPrevEnd,
    amazon_start_ts: `${spendStart}T00:00:00.000Z`,
    amazon_end_ts: `${spendEnd}T23:59:59.999Z`,
    amazon_prev_start_ts: `${spendPrevStart}T00:00:00.000Z`,
    amazon_prev_end_ts: `${spendPrevEnd}T23:59:59.999Z`,
  }
}

function normalizeKpiRow(row: any) {
  return {
    org_id: row.org_id,
    revenue: Number(row.revenue) || 0,
    prevRevenue: Number(row.prev_revenue) || 0,
    netRev: Number(row.net_rev) || 0,
    prevNetRev: Number(row.prev_net_rev) || 0,
    orders: Number(row.orders) || 0,
    prevOrders: Number(row.prev_orders) || 0,
    adSpend: Number(row.ad_spend) || 0,
    prevAdSpend: Number(row.prev_ad_spend) || 0,
    shopifyRev: Number(row.shopify_rev) || 0,
    amazonRev: Number(row.amazon_rev) || 0,
    walmartRev: Number(row.walmart_rev) || 0,
    shopifyOrders: Number(row.shopify_orders) || 0,
    prevShopifyOrders: Number(row.prev_shopify_orders) || 0,
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const isBatch = Array.isArray(body.items)
    const items = (isBatch ? body.items : [body]) as OverviewKpiRequest[]
    if (items.length === 0) return NextResponse.json({ error: 'No overview requests supplied' }, { status: 400 })

    const missing = items.find(item => !item.org_id || !item.start || !item.end || !item.prevStart || !item.prevEnd)
    if (missing) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const orgIds = Array.from(new Set(items.map(item => item.org_id!).filter(Boolean)))

    return await timed('api.overview.POST', async () => {
      const serviceClient = createServiceClient()
      const t1 = timeBlock('api.overview.POST.fetchOrders', { org_id: orgIds.join(',') })
      const { data: prof } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('id', user.id)
        .single()
      const isSuperadmin = !!(prof as any)?.is_superadmin

      if (!isSuperadmin) {
        const { data: memberships } = await serviceClient
          .from('org_memberships')
          .select('org_id')
          .eq('user_id', user.id)
          .in('org_id', orgIds)
        const allowed = new Set((memberships ?? []).map((m: any) => m.org_id))
        if (orgIds.some(id => !allowed.has(id))) {
          t1.end({ rows: 0 })
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
      t1.end()

      const t2 = timeBlock('api.overview.POST.fetchAdSpend', { org_id: orgIds.join(',') })
      const ranges = items.map(toRpcRange)
      const { data, error } = await (serviceClient as any).rpc('overview_kpis_batch', { _ranges: ranges })
      t2.end({ rows: (data ?? []).length })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const t3 = timeBlock('api.overview.POST.aggregation', { org_id: orgIds.join(',') })
      const rows = (data ?? []).map(normalizeKpiRow)
      t3.end({ rows: rows.length })
      if (isBatch) return NextResponse.json({ orgs: rows })
      const row = rows[0]
      if (!row) return NextResponse.json({ error: 'No overview data returned' }, { status: 404 })
      return NextResponse.json(row)
    }, { org_id: orgIds.join(','), batch: isBatch, items: items.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
