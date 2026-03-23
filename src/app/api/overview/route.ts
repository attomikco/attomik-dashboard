import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: prof } = await supabase
      .from('profiles').select('is_superadmin').eq('id', user.id).single()

    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)
    const viewAsUserId = searchParams.get('viewAs')

    let orgs: any[] = []
    if (prof?.is_superadmin && !viewAsUserId) {
      const { data } = await serviceClient
        .from('organizations').select('id, name, slug, timezone, channels').order('name')
      orgs = data ?? []
    } else {
      const targetUserId = viewAsUserId ?? user.id
      const { data: memberships } = await serviceClient
        .from('org_memberships')
        .select('org_id, organizations(id, name, slug, timezone, channels)')
        .eq('user_id', targetUserId)
      orgs = (memberships ?? []).map((m: any) => m.organizations).filter(Boolean)
    }

    return NextResponse.json({ orgs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { org_id, start, end, prevStart, prevEnd, adSpendStart, adSpendEnd } = await request.json()
    if (!org_id || !start || !end) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Use plain dates for ad_spend (date column, not timestamp)
    const spendStart = adSpendStart ?? start.split('T')[0]
    const spendEnd = adSpendEnd ?? end.split('T')[0]

    // Paginated fetch to get ALL orders (Supabase caps at 1000 per query)
    const fetchAllOrders = async (gte: string, lte: string, source?: string) => {
      const size = 1000
      let from = 0
      const all: any[] = []
      while (true) {
        let query = serviceClient.from('orders')
          .select('total_price, subtotal, status, source, units')
          .eq('org_id', org_id).gte('created_at', gte).lte('created_at', lte)
          .order('created_at', { ascending: true })
        if (source) query = query.eq('source', source)
        const { data } = await query.range(from, from + size - 1)
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < size) break
        from += size
      }
      return all
    }

    // Fetch non-Amazon orders with exact timezone-adjusted range
    // Fetch Amazon orders separately using midnight UTC boundaries (they're stored at 00:00 UTC)
    const amazonStart = `${spendStart}T00:00:00.000Z`
    const amazonEnd = `${spendEnd}T23:59:59.999Z`

    const [curNonAmazon, curAmazon, prevOrders, curSpend, prevSpend] = await Promise.all([
      fetchAllOrders(start, end, undefined).then(orders => orders.filter(o => o.source !== 'amazon')),
      fetchAllOrders(amazonStart, amazonEnd, 'amazon'),
      fetchAllOrders(prevStart, prevEnd),
      serviceClient.from('ad_spend').select('spend')
        .eq('org_id', org_id).gte('date', spendStart).lte('date', spendEnd),
      serviceClient.from('ad_spend').select('spend')
        .eq('org_id', org_id).gte('date', prevStart).lte('date', prevEnd),
    ])
    const curOrders = [...curNonAmazon, ...curAmazon]

    return NextResponse.json({
      curOrders,
      prevOrders,
      curSpend: curSpend.data ?? [],
      prevSpend: prevSpend.data ?? [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
