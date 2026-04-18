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
      const rawDate = row['Date']?.trim()
      // Parse date robustly — use noon UTC to avoid timezone day-shift
      let date: string | null = null
      if (rawDate) {
        // Try ISO format first (YYYY-MM-DD), then fall back to Date parsing with noon anchor
        const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (isoMatch) {
          date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
        } else {
          const parsed = new Date(rawDate + ' 12:00:00 UTC')
          if (!isNaN(parsed.getTime())) date = parsed.toISOString().split('T')[0]
        }
      }

      // Combine B2C + B2B for all metrics
      const revenue = clean(row['Ordered Product Sales']) + clean(row['Ordered Product Sales - B2B'])
      const units   = cleanInt(row['Units Ordered']) + cleanInt(row['Units Ordered - B2B'])
      const orders  = cleanInt(row['Total Order Items']) + cleanInt(row['Total Order Items - B2B'])
      const sessions = cleanInt(row['Sessions - Total'])

      return { date, revenue, units, orders, sessions, org_id: orgId! }
    }).filter(r => r.date && (r.revenue > 0 || r.units > 0))

    console.log('[amazon-upload] parse summary', {
      orgId,
      rawRowCount: rows.length,
      validRecordCount: records.length,
      headers: Object.keys(rows[0] ?? {}),
      firstValidRecord: records[0] ?? null,
    })

    if (records.length === 0) {
      return NextResponse.json({ error: 'No valid Amazon rows found. Make sure the CSV has Date and Ordered Product Sales columns.' }, { status: 400 })
    }

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
      created_at: `${r.date}T12:00:00Z`,
    }))

    const serviceClient = createServiceClient()

    // Delete existing Amazon rows for this org + date range to allow re-upload
    const externalIds = [...new Set(orderRecords.map(r => r.external_id))]
    if (externalIds.length > 0) {
      await serviceClient.from('orders').delete().eq('org_id', orgId!).in('external_id', externalIds)
    }

    const { data, error: dbError } = await serviceClient
      .from('orders')
      .insert(orderRecords)
      .select('id')
    if (dbError) throw dbError

    // Track Amazon sync timestamp — mirrors Shopify/Meta upsert pattern
    const tsPayload = { org_id: orgId, source: 'amazon' as const, last_synced_at: new Date().toISOString() }
    console.log('[amazon-upload] about to upsert sync_timestamps', {
      orgId,
      payload: tsPayload,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
    const { data: tsData, error: tsError } = await serviceClient
      .from('sync_timestamps')
      .upsert(tsPayload, { onConflict: 'org_id,source' })
      .select()
    console.log('[amazon-upload] upsert result', { tsData, tsError })
    if (tsError) {
      console.error('Amazon sync_timestamps upsert failed:', tsError)
      return NextResponse.json({ error: `Import saved but sync timestamp failed: ${tsError.message}` }, { status: 500 })
    }

    // Verify the row actually landed — reads the authoritative value back from the DB
    const { data: verifyRow, error: verifyError } = await serviceClient
      .from('sync_timestamps')
      .select('source, last_synced_at')
      .eq('org_id', orgId!)
      .eq('source', 'amazon')
      .maybeSingle()
    console.log('[amazon-upload] verify read', { verifyRow, verifyError })

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
