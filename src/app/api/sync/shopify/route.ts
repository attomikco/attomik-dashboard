import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

async function getShopifyToken(domain: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to get Shopify token: ${res.status} ${text}`)
  }

  const data = await res.json()
  if (!data.access_token) throw new Error('No access token in response')
  return data.access_token
}

export async function POST(request: Request) {
  try {
    const { org_id, full_sync } = await request.json()
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: org } = await supabase
      .from('organizations')
      .select('shopify_domain, shopify_token, shopify_client_id, shopify_client_secret, shopify_synced_at')
      .eq('id', org_id)
      .single()

    if (!org?.shopify_domain) {
      return NextResponse.json({ error: 'Shopify not configured for this org' }, { status: 400 })
    }

    const { shopify_domain: domain, shopify_synced_at: lastSynced } = org

    // Get token — use client credentials if available, fall back to stored token
    let token: string
    if (org.shopify_client_id && org.shopify_client_secret) {
      token = await getShopifyToken(domain, org.shopify_client_id, org.shopify_client_secret)
    } else if (org.shopify_token) {
      token = org.shopify_token
    } else {
      return NextResponse.json({ error: 'No Shopify credentials configured' }, { status: 400 })
    }

    const headers = { 'X-Shopify-Access-Token': token }
    const apiBase = `https://${domain}/admin/api/2024-01`

    const isFirstSync = !lastSynced || full_sync
    const updatedAtMin = isFirstSync ? null : new Date(lastSynced).toISOString()

    // Paginate through all orders
    const allOrders: any[] = []
    let url: string | null = `${apiBase}/orders.json?limit=250&status=any&fields=id,email,financial_status,created_at,updated_at,total_price,subtotal_price,total_discounts,total_tax,total_shipping_price_set,customer,line_items,refunds${updatedAtMin ? `&updated_at_min=${updatedAtMin}` : ''}`

    while (url) {
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error(`Shopify API error: ${res.status}`)
      const { orders } = await res.json()
      allOrders.push(...orders)

      const linkHeader = res.headers.get('Link') ?? ''
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
      url = nextMatch ? nextMatch[1] : null
    }

    if (allOrders.length === 0) {
      await supabase.from('organizations')
        .update({ shopify_synced_at: new Date().toISOString() })
        .eq('id', org_id)
      return NextResponse.json({ synced: 0, inserted: 0, message: 'Already up to date' })
    }

    const rows = allOrders.map((o: any) => {
      const units = (o.line_items ?? []).reduce((sum: number, li: any) => sum + (li.quantity ?? 0), 0)
      const refundedAmount = (o.refunds ?? []).reduce((sum: number, r: any) =>
        sum + (r.transactions ?? []).reduce((s: number, t: any) =>
          s + (t.kind === 'refund' ? parseFloat(t.amount ?? '0') : 0), 0), 0)
      const shippingAmount = parseFloat(o.total_shipping_price_set?.shop_money?.amount ?? '0')

      return {
        org_id,
        external_id:     `shopify_${o.id}`,
        source:          'shopify',
        customer_email:  o.email || o.customer?.email || null,
        customer_name:   o.customer ? `${o.customer.first_name ?? ''} ${o.customer.last_name ?? ''}`.trim() : null,
        total_price:     parseFloat(o.total_price) || 0,
        subtotal:        parseFloat(o.subtotal_price) || 0,
        discount_amount: parseFloat(o.total_discounts) || 0,
        tax_amount:      parseFloat(o.total_tax) || 0,
        shipping_amount: shippingAmount,
        refunded_amount: refundedAmount,
        units,
        status: o.financial_status === 'paid' ? 'paid'
              : o.financial_status === 'refunded' ? 'refunded'
              : o.financial_status === 'pending' ? 'pending'
              : 'cancelled',
        created_at: o.created_at,
        synced_at:  new Date().toISOString(),
      }
    })

    const { data, error } = await supabase
      .from('orders')
      .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: false })
      .select()

    if (error) throw error

    await supabase.from('organizations')
      .update({ shopify_synced_at: new Date().toISOString() })
      .eq('id', org_id)

    return NextResponse.json({
      synced: rows.length,
      inserted: data?.length ?? 0,
      full_sync: isFirstSync,
      message: isFirstSync
        ? `Full sync complete — ${rows.length} orders imported`
        : `Incremental sync — ${rows.length} new/updated orders`,
    })

  } catch (err: any) {
    console.error('Shopify sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
