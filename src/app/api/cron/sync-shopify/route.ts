import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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
    let url: string | null = `${apiBase}/orders.json?limit=250&status=any&order=created_at+asc&updated_at_min=${updatedAtMin}&fields=id,name,email,financial_status,created_at,updated_at,total_price,subtotal_price,total_discounts,total_tax,total_shipping_price_set,customer,line_items,refunds,source_name,tags`

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
      return { orgId, name: org.name, synced: 0 }
    }

    const rows = allOrders.map((o: any) => {
      const units = (o.line_items ?? []).reduce((sum: number, li: any) => sum + (li.quantity ?? 0), 0)
      const refundedAmount = (o.refunds ?? []).reduce((sum: number, r: any) =>
        sum + (r.transactions ?? []).reduce((s: number, t: any) =>
          s + (t.kind === 'refund' ? parseFloat(t.amount ?? '0') : 0), 0), 0)
      const shippingAmount = parseFloat(o.total_shipping_price_set?.shop_money?.amount ?? '0')

      const hasSellingPlan = (o.line_items ?? []).some((li: any) => li.selling_plan_allocation)
      const isSubSource = (o.source_name ?? '').toLowerCase().includes('paywhirl')
      const isSubTag = (o.tags ?? '').toLowerCase().includes('subscription')

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
        is_subscription: hasSellingPlan || isSubSource || isSubTag,
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

    await supabase.from('organizations').update({ shopify_synced_at: new Date().toISOString() }).eq('id', orgId)

    return { orgId, name: org.name, synced: rows.length }
  } catch (err: any) {
    console.error(`[cron] Sync failed for ${org.name}:`, err.message)
    return { orgId, name: org.name, synced: 0, error: err.message }
  }
}

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Find all orgs with Shopify connected
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, shopify_domain, shopify_token, shopify_client_id, shopify_client_secret, shopify_synced_at')
    .not('shopify_domain', 'is', null)

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
