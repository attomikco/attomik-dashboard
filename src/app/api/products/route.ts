import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { org_id, startDate, endDate } = await request.json()
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const serviceClient = createServiceClient()

    // Fetch all line items in date range with pagination
    const all: any[] = []
    let from = 0
    while (true) {
      const { data } = await serviceClient.from('order_items')
        .select('product_title, variant_title, sku, quantity, price, created_at')
        .eq('org_id', org_id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .range(from, from + 999)
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < 1000) break
      from += 1000
    }

    // Aggregate by product + variant
    const productMap: Record<string, { product: string; variant: string; sku: string; units: number; revenue: number }> = {}
    for (const item of all) {
      const key = `${item.product_title}|||${item.variant_title ?? ''}`
      if (!productMap[key]) {
        productMap[key] = { product: item.product_title, variant: item.variant_title ?? '', sku: item.sku ?? '', units: 0, revenue: 0 }
      }
      productMap[key].units += item.quantity
      productMap[key].revenue += item.quantity * Number(item.price)
    }

    const products = Object.values(productMap).sort((a, b) => b.revenue - a.revenue)
    const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)

    return NextResponse.json({
      products: products.map(p => ({
        ...p,
        pctOfTotal: totalRevenue > 0 ? (p.revenue / totalRevenue * 100) : 0,
        aov: p.units > 0 ? p.revenue / p.units : 0,
      })),
      totalRevenue,
      totalUnits: products.reduce((s, p) => s + p.units, 0),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
