import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { timed } from '@/lib/timing'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('org_id')
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  if (!orgId || !year || !month) return NextResponse.json({ error: 'org_id, year, month required' }, { status: 400 })

  return await timed('api.targets.GET', async () => {
    const supabase = createServiceClient()
    console.log('[targets API] GET', { orgId, year, month })
    const { data, error } = await supabase
      .from('monthly_targets')
      .select('*')
      .eq('org_id', orgId)
      .eq('year', Number(year))
      .eq('month', Number(month))
      .maybeSingle()

    console.log('[targets API] result', { data, error })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }, { org_id: orgId, year, month })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { org_id, year, month, sales_target, aov_target, cac_target, roas_target, ad_spend_budget } = body
  if (!org_id || !year || !month) return NextResponse.json({ error: 'org_id, year, month required' }, { status: 400 })

  return await timed('api.targets.POST', async () => {
    const supabase = createServiceClient()
    const { error } = await supabase.from('monthly_targets').upsert({
      org_id,
      year,
      month,
      sales_target: sales_target ?? null,
      aov_target: aov_target ?? null,
      cac_target: cac_target ?? null,
      roas_target: roas_target ?? null,
      ad_spend_budget: ad_spend_budget ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,year,month' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }, { org_id, year, month })
}
