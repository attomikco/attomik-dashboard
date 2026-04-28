import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)
    const viewAsUserId = searchParams.get('viewAs')

    // Run profile + membership lookups in parallel. Members-route always wins
    // for non-superadmin / viewAs paths; profile decides the branch.
    const targetUserId = viewAsUserId ?? user.id
    const [profRes, membershipRes] = await Promise.all([
      supabase.from('profiles').select('is_superadmin').eq('id', user.id).single(),
      serviceClient
        .from('org_memberships')
        .select('org_id, organizations(id, name, slug, timezone, channels, shopify_synced_at, ga_property_id)')
        .eq('user_id', targetUserId),
    ])
    const prof = profRes.data

    let orgs: any[] = []
    if (prof?.is_superadmin && !viewAsUserId) {
      const { data } = await serviceClient
        .from('organizations').select('id, name, slug, timezone, channels, shopify_synced_at, ga_property_id').order('name')
      orgs = data ?? []
    } else {
      orgs = (membershipRes.data ?? []).map((m: any) => m.organizations).filter(Boolean)
    }

    const res = NextResponse.json({ orgs })
    // Short private cache so rapid sidebar mounts / back-forward nav don't
    // re-hit the DB. Per-user data so must stay `private`.
    res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

type OrderRow = { total_price: number | string; subtotal: number | string | null; status: string | null; source: string | null; units: number | null }
type SpendRow = { spend: number | string }

type Aggregates = {
  revenue: number
  netRev: number
  orders: number
  shopifyRev: number
  amazonRev: number
  walmartRev: number
  shopifyOrders: number
}

// Mirrors the client-side filterEnabled in overview/page.tsx exactly:
// - drop refunded
// - keep order if its source is enabled in org.channels (default-on if channels not set)
// - unknown sources are bucketed with shopify
function aggregate(rows: OrderRow[], ch: { showShopify: boolean; showAmazon: boolean; showWalmart: boolean }): Aggregates {
  let revenue = 0, netRev = 0, orders = 0
  let shopifyRev = 0, amazonRev = 0, walmartRev = 0, shopifyOrders = 0
  for (const o of rows) {
    if (o.status === 'refunded') continue
    const src = o.source
    const isShopify = src === 'shopify'
    const isAmazon  = src === 'amazon'
    const isWalmart = src === 'walmart'
    const isUnknown = !isShopify && !isAmazon && !isWalmart
    const include =
      (ch.showShopify && isShopify) ||
      (ch.showAmazon  && isAmazon)  ||
      (ch.showWalmart && isWalmart) ||
      (ch.showShopify && isUnknown)
    if (!include) continue
    const price = Number(o.total_price) || 0
    const sub = o.subtotal == null ? price : Number(o.subtotal) || price
    const unitMult = (isAmazon || isWalmart) ? (Number(o.units) || 1) : 1
    revenue += price
    netRev += sub
    orders += unitMult
    if (isAmazon) amazonRev += price
    else if (isWalmart) walmartRev += price
    else shopifyRev += price
    if (isShopify) shopifyOrders += 1
  }
  return { revenue, netRev, orders, shopifyRev, amazonRev, walmartRev, shopifyOrders }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { org_id, start, end, prevStart, prevEnd, adSpendStart, adSpendEnd, adSpendPrevStart, adSpendPrevEnd } = await request.json()
    if (!org_id || !start || !end) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Use plain dates for ad_spend (date column, not timestamp)
    const spendStart = adSpendStart ?? start.split('T')[0]
    const spendEnd = adSpendEnd ?? end.split('T')[0]
    const spendPrevStart = adSpendPrevStart ?? (prevStart ? prevStart.split('T')[0] : null)
    const spendPrevEnd = adSpendPrevEnd ?? (prevEnd ? prevEnd.split('T')[0] : null)

    // Paginated fetch to get ALL orders (Supabase caps at 1000 per query)
    const fetchAllOrders = async (gte: string, lte: string, source?: string): Promise<OrderRow[]> => {
      const size = 1000
      let from = 0
      const all: OrderRow[] = []
      while (true) {
        let query = serviceClient.from('orders')
          .select('total_price, subtotal, status, source, units')
          .eq('org_id', org_id).gte('created_at', gte).lte('created_at', lte)
          .order('created_at', { ascending: true })
        if (source) query = query.eq('source', source)
        const { data } = await query.range(from, from + size - 1)
        if (!data || data.length === 0) break
        all.push(...(data as any))
        if (data.length < size) break
        from += size
      }
      return all
    }

    // Amazon orders are stored at midnight UTC, so they need a different range than
    // shopify/walmart which are full timestamps timezone-shifted by the caller.
    const amazonStart = `${spendStart}T00:00:00.000Z`
    const amazonEnd = `${spendEnd}T23:59:59.999Z`
    const amazonPrevStart = spendPrevStart ? `${spendPrevStart}T00:00:00.000Z` : null
    const amazonPrevEnd = spendPrevEnd ? `${spendPrevEnd}T23:59:59.999Z` : null

    const fetchAllAdSpend = async (gte: string, lte: string): Promise<SpendRow[]> => {
      const size = 1000
      let from = 0
      const all: SpendRow[] = []
      while (true) {
        const { data } = await serviceClient.from('ad_spend').select('spend')
          .eq('org_id', org_id).gte('date', gte).lte('date', lte)
          .order('date', { ascending: true }).range(from, from + size - 1)
        if (!data || data.length === 0) break
        all.push(...(data as any))
        if (data.length < size) break
        from += size
      }
      return all
    }

    const [orgRow, curNonAmazon, curAmazon, prevNonAmazon, prevAmazon, curSpend, prevSpend] = await Promise.all([
      serviceClient.from('organizations').select('channels').eq('id', org_id).maybeSingle(),
      fetchAllOrders(start, end, undefined).then(rows => rows.filter(o => o.source !== 'amazon')),
      fetchAllOrders(amazonStart, amazonEnd, 'amazon'),
      prevStart ? fetchAllOrders(prevStart, prevEnd, undefined).then(rows => rows.filter(o => o.source !== 'amazon')) : Promise.resolve([] as OrderRow[]),
      amazonPrevStart ? fetchAllOrders(amazonPrevStart, amazonPrevEnd!, 'amazon') : Promise.resolve([] as OrderRow[]),
      fetchAllAdSpend(spendStart, spendEnd),
      spendPrevStart ? fetchAllAdSpend(spendPrevStart, spendPrevEnd!) : Promise.resolve([] as SpendRow[]),
    ])

    const channels = ((orgRow.data as any)?.channels ?? {}) as Record<string, boolean>
    const isConfigured = Object.keys(channels).length > 0
    const ch = {
      showShopify: !isConfigured || channels.shopify !== false,
      showAmazon:  !isConfigured || channels.amazon  !== false,
      showWalmart: !isConfigured || channels.walmart !== false,
    }

    const cur  = aggregate([...curNonAmazon, ...curAmazon], ch)
    const prev = aggregate([...prevNonAmazon, ...prevAmazon], ch)
    const adSpend     = curSpend.reduce((s, r)  => s + (Number(r.spend) || 0), 0)
    const prevAdSpend = prevSpend.reduce((s, r) => s + (Number(r.spend) || 0), 0)

    return NextResponse.json({
      revenue: cur.revenue, prevRevenue: prev.revenue,
      netRev: cur.netRev,   prevNetRev:  prev.netRev,
      orders: cur.orders,   prevOrders:  prev.orders,
      adSpend, prevAdSpend,
      shopifyRev: cur.shopifyRev, amazonRev: cur.amazonRev, walmartRev: cur.walmartRev,
      shopifyOrders: cur.shopifyOrders, prevShopifyOrders: prev.shopifyOrders,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
