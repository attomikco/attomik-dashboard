import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { org_id } = await request.json()
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: org } = await supabase
      .from('organizations')
      .select('shopify_domain, shopify_token')
      .eq('id', org_id)
      .single()

    if (!org?.shopify_domain || !org?.shopify_token) {
      return NextResponse.json({ error: 'Shopify not configured for this org' }, { status: 400 })
    }

    // Fetch last 250 orders
    const res = await fetch(
      `https://${org.shopify_domain}/admin/api/2024-01/orders.json?limit=250&status=any`,
      { headers: { 'X-Shopify-Access-Token': org.shopify_token } }
    )

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Shopify API error: ${res.status} ${text}`)
    }

    const { orders } = await res.json()

    const rows = orders.map((o: any) => ({
      org_id,
      external_id: `shopify_${o.id}`,
      source: 'shopify',
      customer_email: o.email || null,
      customer_name: o.customer
        ? `${o.customer.first_name ?? ''} ${o.customer.last_name ?? ''}`.trim()
        : null,
      total_price: parseFloat(o.total_price) || 0,
      status: o.financial_status ?? 'pending',
      created_at: o.created_at,
    }))

    const { data, error } = await supabase
      .from('orders')
      .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
      .select()

    if (error) throw error

    return NextResponse.json({ synced: rows.length, inserted: data?.length ?? 0 })

  } catch (err: any) {
    console.error('Shopify sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
