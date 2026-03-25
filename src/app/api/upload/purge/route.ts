import { getOrgId, createServiceClient } from '../_shared'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { orgId, error } = await getOrgId(request)
  if (error) return error

  const { platform, mode = 'last' } = await request.json()
  if (!platform || typeof platform !== 'string') {
    return NextResponse.json({ error: 'Missing platform' }, { status: 400 })
  }

  const service = createServiceClient()
  const adPlatforms = ['meta', 'google', 'tiktok']
  const orderPlatforms = ['shopify', 'amazon', 'walmart']
  let deleted = 0

  if (adPlatforms.includes(platform)) {
    let query = service.from('ad_spend').delete({ count: 'exact' }).eq('org_id', orgId!).eq('platform', platform)

    if (mode === 'last') {
      // Find the most recent synced_at for this platform, then delete that batch (within 5 min window)
      const { data: latest } = await service
        .from('ad_spend').select('synced_at').eq('org_id', orgId!).eq('platform', platform)
        .order('synced_at', { ascending: false }).limit(1).single()
      if (!latest) return NextResponse.json({ deleted: 0, platform })
      const cutoff = new Date(new Date(latest.synced_at).getTime() - 5 * 60 * 1000).toISOString()
      query = query.gte('synced_at', cutoff)
    }

    const { count } = await query
    deleted = count ?? 0
  } else if (orderPlatforms.includes(platform)) {
    let orderQuery = service.from('orders').select('id, external_id').eq('org_id', orgId!).like('external_id', `${platform}_%`)

    if (mode === 'last') {
      const { data: latest } = await service
        .from('orders').select('synced_at').eq('org_id', orgId!).like('external_id', `${platform}_%`)
        .order('synced_at', { ascending: false }).limit(1).single()
      if (!latest) return NextResponse.json({ deleted: 0, platform })
      const cutoff = new Date(new Date(latest.synced_at).getTime() - 5 * 60 * 1000).toISOString()
      orderQuery = orderQuery.gte('synced_at', cutoff)
    }

    const { data: orders } = await orderQuery
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id)
      const externalIds = orders.map(o => o.external_id).filter(Boolean)
      // Delete order_items by order_external_id (not order_id — that column doesn't exist)
      for (let i = 0; i < externalIds.length; i += 500) {
        const batch = externalIds.slice(i, i + 500)
        await service.from('order_items').delete().eq('org_id', orgId!).in('order_external_id', batch)
      }
      for (let i = 0; i < orderIds.length; i += 500) {
        const batch = orderIds.slice(i, i + 500)
        await service.from('orders').delete().in('id', batch)
      }
      deleted = orders.length
    }
  } else {
    return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 })
  }

  return NextResponse.json({ deleted, platform, org_id: orgId })
}
