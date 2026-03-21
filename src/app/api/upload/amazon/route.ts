import { NextResponse } from 'next/server'
import { getOrgId, parseCSV, createServiceClient } from '../_shared'

export async function POST(request: Request) {
  try {
    const { orgId, error } = await getOrgId(request)
    if (error) return error

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const { rows } = parseCSV(await file.text())

    const clean = (v: string) => parseFloat((v ?? '0').replace(/[$,]/g, '')) || 0
    const cleanInt = (v: string) => parseInt((v ?? '0').replace(/,/g, '')) || 0

    const records = rows.map(row => {
      const rawDate = row['Date']
      const parsedDate = rawDate ? new Date(rawDate) : null
      const date = parsedDate && !isNaN(parsedDate.getTime())
        ? parsedDate.toISOString().split('T')[0]
        : null

      // Combine B2C + B2B for all metrics
      const revenue = clean(row['Ordered Product Sales']) + clean(row['Ordered Product Sales - B2B'])
      const units   = cleanInt(row['Units Ordered']) + cleanInt(row['Units Ordered - B2B'])
      const orders  = cleanInt(row['Total Order Items']) + cleanInt(row['Total Order Items - B2B'])
      const sessions = cleanInt(row['Sessions - Total'])

      return { date, revenue, units, orders, sessions, org_id: orgId! }
    }).filter(r => r.date && (r.revenue > 0 || r.units > 0))

    // Store as one order row per day
    const orderRecords = records.map(r => ({
      org_id: r.org_id,
      external_id: `amazon_daily_${r.date}`,
      source: 'amazon' as const,
      customer_email: null,
      customer_name: 'Amazon (daily aggregate)',
      total_price: r.revenue,
      units: r.units,
      status: 'paid' as const,
      created_at: new Date(r.date!).toISOString(),
    }))

    const serviceClient = createServiceClient()

    // Delete existing Amazon rows for this org + date range to allow re-upload
    const dates = records.map(r => `amazon_daily_${r.date}`)
    await serviceClient.from('orders').delete().eq('org_id', orgId!).in('external_id', dates)

    const { data, error: dbError } = await serviceClient
      .from('orders')
      .insert(orderRecords)
      .select()
    if (dbError) throw dbError

    const totalRevenue = records.reduce((s, r) => s + r.revenue, 0)
    const totalUnits   = records.reduce((s, r) => s + r.units, 0)
    const totalOrders  = records.reduce((s, r) => s + r.orders, 0)

    return NextResponse.json({
      inserted: data?.length ?? orderRecords.length,
      skipped: 0,
      days: records.length,
      total_revenue: `$${totalRevenue.toFixed(2)}`,
      total_units: totalUnits,
      total_orders: totalOrders,
    })
  } catch (err: any) {
    console.error('Amazon upload error:', err)
    return NextResponse.json({ error: err.message ?? 'Upload failed' }, { status: 500 })
  }
}
