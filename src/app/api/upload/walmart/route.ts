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

    const clean = (v: string) => parseFloat((v ?? '0').replace(/[$,\s]/g, '')) || 0
    const cleanInt = (v: string) => parseInt((v ?? '0').replace(/[,\s]/g, '')) || 0

    let skipped = 0
    const records = rows.map(row => {
      const rawDate = row['Date']?.trim()
      let date: string | null = null
      if (rawDate) {
        const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (isoMatch) {
          date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
        } else {
          const parsed = new Date(rawDate + ' 12:00:00 UTC')
          if (!isNaN(parsed.getTime())) date = parsed.toISOString().split('T')[0]
        }
      }

      const gmv    = clean(row['GMV'])
      const orders = cleanInt(row['Orders'])
      const units  = cleanInt(row['Units Sold'])

      return { date, gmv, orders, units, org_id: orgId! }
    }).filter(r => {
      if (!r.date) { skipped++; return false }
      if (r.gmv === 0 && r.orders === 0) { skipped++; return false }
      return true
    })

    console.log('[walmart-upload] parse summary', {
      orgId,
      rawRowCount: rows.length,
      validRecordCount: records.length,
      skipped,
      headers: Object.keys(rows[0] ?? {}),
      firstValidRecord: records[0] ?? null,
    })

    if (records.length === 0) {
      return NextResponse.json({ error: 'No valid Walmart rows found. Make sure the CSV has Date, GMV, Orders, and Units Sold columns.' }, { status: 400 })
    }

    // One order row per day
    const orderRecords = records.map(r => ({
      org_id: r.org_id,
      external_id: `walmart_daily_${r.date}`,
      source: 'walmart' as const,
      customer_email: null,
      customer_name: 'Walmart (daily aggregate)',
      total_price: r.gmv,
      units: r.units,
      status: (r.gmv < 0 ? 'refunded' : 'paid') as 'refunded' | 'paid',
      created_at: `${r.date}T12:00:00Z`,
    }))

    const serviceClient = createServiceClient()

    // Delete existing Walmart rows for this org + date range to allow re-upload
    const externalIds = [...new Set(orderRecords.map(r => r.external_id))]
    if (externalIds.length > 0) {
      await serviceClient.from('orders').delete().eq('org_id', orgId!).in('external_id', externalIds)
    }

    const { data, error: dbError } = await serviceClient
      .from('orders')
      .insert(orderRecords)
      .select('id')
    if (dbError) throw dbError

    const tsPayload = { org_id: orgId, source: 'walmart' as const, last_synced_at: new Date().toISOString() }
    const { error: tsError } = await serviceClient
      .from('sync_timestamps')
      .upsert(tsPayload, { onConflict: 'org_id,source' })
      .select()
    if (tsError) {
      console.error('Walmart sync_timestamps upsert failed:', tsError)
      return NextResponse.json({ error: `Import saved but sync timestamp failed: ${tsError.message}` }, { status: 500 })
    }

    const totalRevenue = records.reduce((s, r) => s + r.gmv, 0)
    const totalUnits   = records.reduce((s, r) => s + r.units, 0)
    const totalOrders  = records.reduce((s, r) => s + r.orders, 0)
    const rowsAdded    = data?.length ?? orderRecords.length

    return NextResponse.json({
      days: records.length,
      totalRevenue: `$${totalRevenue.toFixed(2)}`,
      totalOrders,
      totalUnits,
      rowsAdded,
      inserted: rowsAdded,
      skipped,
    })
  } catch (err: any) {
    console.error('Walmart upload error:', err)
    return NextResponse.json({ error: err.message ?? 'Upload failed' }, { status: 500 })
  }
}
