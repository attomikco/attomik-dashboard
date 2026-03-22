import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { org_id } = await request.json()
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const supabase = createServiceClient()

    // Count before
    const { count: before } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .eq('source', 'shopify')
      .like('external_id', 'shopify_#%')

    // Delete CSV-imported duplicates (order name format vs numeric ID format)
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('org_id', org_id)
      .eq('source', 'shopify')
      .like('external_id', 'shopify_#%')

    if (error) throw error

    return NextResponse.json({ deleted: before ?? 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
