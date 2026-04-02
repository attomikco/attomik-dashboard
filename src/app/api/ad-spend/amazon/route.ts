import { NextResponse } from 'next/server'
import { getOrgId, createServiceClient } from '../../upload/_shared'

/** GET — fetch total Amazon ad spend for a given month */
export async function GET(request: Request) {
  const { orgId, error } = await getOrgId(request)
  if (error) return error

  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month) return NextResponse.json({ error: 'year and month required' }, { status: 400 })

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const serviceClient = createServiceClient()
  const { data, error: dbErr } = await serviceClient
    .from('ad_spend')
    .select('spend')
    .eq('org_id', orgId!)
    .eq('platform', 'amazon')
    .gte('date', startDate)
    .lt('date', endDate)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const total = (data ?? []).reduce((s, r) => s + Number(r.spend), 0)
  return NextResponse.json({ total: Math.round(total * 100) / 100 })
}

/** POST — save Amazon ad spend for a month (spreads evenly across days) */
export async function POST(request: Request) {
  const { orgId, error } = await getOrgId(request)
  if (error) return error

  const body = await request.json()
  const { year, month, total_spend } = body
  if (!year || !month || total_spend == null) {
    return NextResponse.json({ error: 'year, month, and total_spend required' }, { status: 400 })
  }

  const spend = parseFloat(total_spend)
  if (isNaN(spend) || spend < 0) {
    return NextResponse.json({ error: 'Invalid spend amount' }, { status: 400 })
  }

  // Calculate days in month
  const daysInMonth = new Date(year, month, 0).getDate()
  const dailySpend = Math.round((spend / daysInMonth) * 100) / 100

  // Adjust last day to absorb rounding difference
  const remainder = Math.round((spend - dailySpend * daysInMonth) * 100) / 100

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const serviceClient = createServiceClient()

  // Delete existing Amazon spend for this month
  await serviceClient
    .from('ad_spend')
    .delete()
    .eq('org_id', orgId!)
    .eq('platform', 'amazon')
    .gte('date', startDate)
    .lt('date', endDate)

  if (spend === 0) {
    return NextResponse.json({ success: true, days: 0, daily_spend: 0, total: 0 })
  }

  // Create one row per day
  const records = Array.from({ length: daysInMonth }, (_, i) => ({
    org_id: orgId!,
    platform: 'amazon' as const,
    campaign_name: 'Amazon Ads',
    spend: i === daysInMonth - 1 ? dailySpend + remainder : dailySpend,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    date: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
  }))

  const { error: dbErr } = await serviceClient.from('ad_spend').insert(records)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    days: daysInMonth,
    daily_spend: dailySpend,
    total: spend,
  })
}
