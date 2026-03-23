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

    // For orders: use the EARLIER of midnight UTC or the timezone-adjusted start
    // This ensures Amazon daily records (stored at midnight UTC) are always captured
    const orderStart = `${spendStart}T00:00:00.000Z` < start ? `${spendStart}T00:00:00.000Z` : start
    const orderEnd = `${spendEnd}T23:59:59.999Z` > end ? `${spendEnd}T23:59:59.999Z` : end

    // Paginated fetch to get ALL orders (Supabase caps at 1000 per query)
    const fetchAllOrders = async (gte: string, lte: string) => {
      const size = 1000
      let from = 0
      const all: any[] = []
      while (true) {
        const { data } = await serviceClient.from('orders')
          .select('total_price, subtotal, status, source')
          .eq('org_id', org_id).gte('created_at', gte).lte('created_at', lte)
          .order('created_at', { ascending: true })
          .range(from, from + size - 1)
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < size) break
        from += size
      }
      return all
    }

    const [curOrders, prevOrders, curSpend, prevSpend] = await Promise.all([
      fetchAllOrders(orderStart, orderEnd),
      fetchAllOrders(prevStart, prevEnd),
      serviceClient.from('ad_spend').select('spend')
        .eq('org_id', org_id).gte('date', spendStart).lte('date', spendEnd),
      serviceClient.from('ad_spend').select('spend')
        .eq('org_id', org_id).gte('date', prevStart).lte('date', prevEnd),
    ])

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
