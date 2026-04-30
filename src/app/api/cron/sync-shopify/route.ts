import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 300

// Reuse the token fetching logic from the main sync route
async function getShopifyToken(domain: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }).toString(),
  })
  if (!res.ok) throw new Error(`Token error: ${res.status}`)
  const data = await res.json()
  if (!data.access_token) throw new Error('No access token')
  return data.access_token
}

async function syncOrg(orgId: string, org: any, supabase: any): Promise<{ orgId: string; name: string; synced: number; error?: string }> {
  try {
    const { shopify_domain: domain, shopify_synced_at: lastSynced } = org

    let token: string
    if (org.shopify_client_id && org.shopify_client_secret) {
      token = await getShopifyToken(domain, org.shopify_client_id, org.shopify_client_secret)
    } else if (org.shopify_token) {
      token = org.shopify_token
    } else {
      return { orgId, name: org.name, synced: 0, error: 'No credentials' }
    }

    const headers = { 'X-Shopify-Access-Token': token }
    const apiBase = `https://${domain}/admin/api/2024-01`
    const updatedAtMin = lastSynced ? new Date(lastSynced).toISOString() : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const allOrders: any[] = []
    let url: string | null = `${apiBase}/orders.json?limit=250&status=any&order=created_at+asc&updated_at_min=${updatedAtMin}&fields=id,name,email,financial_status,created_at,updated_at,total_price,subtotal_price,total_discounts,total_tax,total_shipping_price_set,customer,line_items,refunds,source_name,tags,discount_codes`

    while (url) {
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error(`Shopify API ${res.status}`)
      const { orders } = await res.json()
      allOrders.push(...orders)
      const linkHeader = res.headers.get('Link') ?? ''
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
      url = nextMatch ? nextMatch[1] : null
    }

    if (allOrders.length === 0) {
      await supabase.from('organizations').update({ shopify_synced_at: new Date().toISOString() }).eq('id', orgId)
      await supabase.from('sync_timestamps').delete().eq('org_id', orgId).eq('source', 'shopify')
      await supabase.from('sync_timestamps').insert({ org_id: orgId, source: 'shopify', last_synced_at: new Date().toISOString() })
      return { orgId, name: org.name, synced: 0 }
    }

    const rows = allOrders.map((o: any) => {
      const units = (o.line_items ?? []).reduce((sum: number, li: any) => sum + (li.quantity ?? 0), 0)
      const refundedAmount = (o.refunds ?? []).reduce((sum: number, r: any) =>
        sum + (r.transactions ?? []).reduce((s: number, t: any) =>
          s + (t.kind === 'refund' ? parseFloat(t.amount ?? '0') : 0), 0), 0)
      const shippingAmount = parseFloat(o.total_shipping_price_set?.shop_money?.amount ?? '0')

      const hasSellingPlan = (o.line_items ?? []).some((li: any) => li.selling_plan_allocation)
      const sourceName = (o.source_name ?? '').toLowerCase()
      const isSubSource = sourceName.includes('paywhirl') || sourceName.includes('subscription')
      const isSubTag = (o.tags ?? '').toLowerCase().includes('subscription')
      const isSubDiscount = (o.discount_codes ?? []).some((dc: any) => (dc.code ?? '').toLowerCase().includes('subscri'))

      return {
        org_id: orgId,
        external_id: `shopify_${o.name || o.id}`,
        source: 'shopify',
        customer_email: o.email || o.customer?.email || null,
        customer_name: o.customer ? `${o.customer.first_name ?? ''} ${o.customer.last_name ?? ''}`.trim() : null,
        total_price: parseFloat(o.total_price) || 0,
        subtotal: parseFloat(o.subtotal_price) || 0,
        discount_amount: parseFloat(o.total_discounts) || 0,
        tax_amount: parseFloat(o.total_tax) || 0,
        shipping_amount: shippingAmount,
        refunded_amount: refundedAmount,
        units,
        is_subscription: hasSellingPlan || isSubSource || isSubTag || isSubDiscount,
        status: o.financial_status === 'paid' ? 'paid'
              : o.financial_status === 'refunded' ? 'refunded'
              : o.financial_status === 'pending' ? 'pending'
              : 'cancelled',
        created_at: o.created_at,
        synced_at: new Date().toISOString(),
      }
    })

    const { error } = await supabase
      .from('orders')
      .upsert(rows, { onConflict: 'org_id,external_id', ignoreDuplicates: false })
      .select('id')
    if (error) throw error

    // Store line items
    const lineItems = allOrders.flatMap((o: any) =>
      (o.line_items ?? []).map((li: any) => ({
        org_id: orgId,
        order_external_id: `shopify_${o.name || o.id}`,
        product_title: li.title ?? 'Unknown',
        variant_title: li.variant_title ?? null,
        sku: li.sku ?? null,
        quantity: li.quantity ?? 1,
        price: parseFloat(li.price) || 0,
        created_at: o.created_at,
      }))
    )
    if (lineItems.length > 0) {
      const externalIds = [...new Set(lineItems.map(li => li.order_external_id))]
      for (let i = 0; i < externalIds.length; i += 500) {
        await supabase.from('order_items').delete().eq('org_id', orgId).in('order_external_id', externalIds.slice(i, i + 500))
      }
      for (let i = 0; i < lineItems.length; i += 500) {
        await supabase.from('order_items').insert(lineItems.slice(i, i + 500))
      }
    }

    await supabase.from('organizations').update({ shopify_synced_at: new Date().toISOString() }).eq('id', orgId)
    await supabase.from('sync_timestamps').delete().eq('org_id', orgId).eq('source', 'shopify')
    await supabase.from('sync_timestamps').insert({ org_id: orgId, source: 'shopify', last_synced_at: new Date().toISOString() })

    return { orgId, name: org.name, synced: rows.length }
  } catch (err: any) {
    console.error(`[cron] Sync failed for ${org.name}:`, err.message)
    return { orgId, name: org.name, synced: 0, error: err.message }
  }
}

export async function GET(request: Request) {
  // Allow access via cron secret OR authenticated superadmin
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const hasCronSecret = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!hasCronSecret) {
    // Check if request is from an authenticated superadmin
    const userClient = createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await userClient.from('profiles').select('is_superadmin').eq('id', user.id).single()
    if (!profile?.is_superadmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Find all orgs with Shopify connected
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, shopify_domain, shopify_token, shopify_client_id, shopify_client_secret, shopify_synced_at')
    .not('shopify_domain', 'is', null)
    .is('archived_at', null)

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ message: 'No orgs with Shopify connected', results: [] })
  }

  // Sync each org sequentially to avoid rate limits across stores
  const results = []
  for (const org of orgs) {
    const result = await syncOrg(org.id, org, supabase)
    results.push(result)
    console.log(`[cron] ${org.name}: ${result.synced} orders${result.error ? ` (error: ${result.error})` : ''}`)
  }

  const totalSynced = results.reduce((s, r) => s + r.synced, 0)
  const errors = results.filter(r => r.error)

  return NextResponse.json({
    message: `Synced ${totalSynced} orders across ${orgs.length} store${orgs.length !== 1 ? 's' : ''}`,
    results,
    errors: errors.length,
  })
}
