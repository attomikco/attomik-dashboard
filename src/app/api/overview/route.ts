import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
    // Fall back to splitting ISO string if plain dates not provided
    const spendStart = adSpendStart ?? start.split('T')[0]
    const spendEnd = adSpendEnd ?? end.split('T')[0]

    const [curOrders, prevOrders, curSpend, prevSpend] = await Promise.all([
      serviceClient.from('orders').select('total_price, subtotal, status, source')
        .eq('org_id', org_id).gte('created_at', start).lte('created_at', end).limit(5000),
      serviceClient.from('orders').select('total_price, subtotal, status, source')
        .eq('org_id', org_id).gte('created_at', prevStart).lte('created_at', prevEnd).limit(5000),
      serviceClient.from('ad_spend').select('spend')
        .eq('org_id', org_id).gte('date', spendStart).lte('date', spendEnd),
      serviceClient.from('ad_spend').select('spend')
        .eq('org_id', org_id).gte('date', prevStart).lte('date', prevEnd),
    ])

    return NextResponse.json({
      curOrders: curOrders.data ?? [],
      prevOrders: prevOrders.data ?? [],
      curSpend: curSpend.data ?? [],
      prevSpend: prevSpend.data ?? [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
