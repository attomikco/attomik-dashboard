import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function detectColumn(headers: string[], ...candidates: string[]): string | null {
  const lower = headers.map(h => h.toLowerCase().trim().replace(/\s+/g, '_'))
  for (const c of candidates) {
    const idx = lower.findIndex(h => h === c || h.includes(c))
    if (idx !== -1) return headers[idx]
  }
  return null
}

function parseOrdersCSV(headers: string[], rows: Record<string, string>[], orgId: string) {
  const idCol = detectColumn(headers, 'id', 'order_id', 'name', 'order_number')
  const dateCol = detectColumn(headers, 'created_at', 'date', 'ordered_at', 'order_date', 'processed_at')
  const emailCol = detectColumn(headers, 'email', 'customer_email', 'billing_email')
  const totalCol = detectColumn(headers, 'total_price', 'total', 'amount', 'grand_total', 'order_total')
  const statusCol = detectColumn(headers, 'financial_status', 'status', 'payment_status')
  const firstNameCol = detectColumn(headers, 'first_name', 'billing_first_name', 'shipping_first_name')
  const lastNameCol = detectColumn(headers, 'last_name', 'billing_last_name', 'shipping_last_name')
  const nameCol = detectColumn(headers, 'customer_name', 'full_name')

  return rows.map(row => {
    const firstName = firstNameCol ? row[firstNameCol] : ''
    const lastName = lastNameCol ? row[lastNameCol] : ''
    const fullName = nameCol ? row[nameCol] : [firstName, lastName].filter(Boolean).join(' ')

    const rawTotal = totalCol ? row[totalCol]?.replace(/[$,]/g, '') : '0'
    const total = parseFloat(rawTotal) || 0

    const rawDate = dateCol ? row[dateCol] : null
    const parsedDate = rawDate ? new Date(rawDate) : new Date()
    const createdAt = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString()

    const status = statusCol ? (row[statusCol]?.toLowerCase() || 'pending') : 'paid'
    const normalizedStatus = ['paid', 'pending', 'refunded', 'cancelled'].includes(status) ? status : 'pending'

    return {
      org_id: orgId,
      external_id: idCol ? row[idCol] : null,
      source: 'csv' as const,
      customer_email: emailCol ? row[emailCol] : null,
      customer_name: fullName || null,
      total_price: total,
      status: normalizedStatus,
      created_at: createdAt,
    }
  }).filter(r => r.total_price > 0)
}

function parseAdSpendCSV(headers: string[], rows: Record<string, string>[], orgId: string) {
  const dateCol = detectColumn(headers, 'date', 'day', 'report_date')
  const campaignCol = detectColumn(headers, 'campaign_name', 'campaign', 'ad_set_name')
  const spendCol = detectColumn(headers, 'spend', 'amount_spent', 'cost', 'total_spend')
  const impressionsCol = detectColumn(headers, 'impressions', 'impr')
  const clicksCol = detectColumn(headers, 'clicks', 'link_clicks', 'outbound_clicks')
  const conversionsCol = detectColumn(headers, 'conversions', 'purchases', 'results')

  const allHeaders = headers.join(',').toLowerCase()
  const platform = allHeaders.includes('facebook') || allHeaders.includes('meta') || allHeaders.includes('ad_set')
    ? 'meta'
    : allHeaders.includes('google') || allHeaders.includes('campaign_id')
      ? 'google'
      : 'meta'

  return rows.map(row => {
    const rawDate = dateCol ? row[dateCol] : null
    const parsedDate = rawDate ? new Date(rawDate) : new Date()
    const date = isNaN(parsedDate.getTime()) ? new Date().toISOString().split('T')[0] : parsedDate.toISOString().split('T')[0]
    const spend = parseFloat((spendCol ? row[spendCol] : '0')?.replace(/[$,]/g, '') || '0') || 0

    return {
      org_id: orgId,
      platform,
      campaign_name: campaignCol ? row[campaignCol] : null,
      spend,
      impressions: parseInt(impressionsCol ? row[impressionsCol] : '0') || 0,
      clicks: parseInt(clicksCol ? row[clicksCol] : '0') || 0,
      conversions: parseInt(conversionsCol ? row[conversionsCol] : '0') || 0,
      date,
    }
  }).filter(r => r.spend > 0 || r.impressions > 0)
}

function parseAmazonSalesCSV(headers: string[], rows: Record<string, string>[], orgId: string) {
  return rows.map(row => {
    const date = row['Date'] ? new Date(row['Date']).toISOString().split('T')[0] : null
    const revenue = parseFloat((row['Ordered Product Sales'] ?? '0').replace(/[$,]/g, '')) || 0
    const units = parseInt(row['Units Ordered'] ?? '0') || 0
    const sessions = parseInt(row['Sessions - Total'] ?? '0') || 0

    return {
      org_id: orgId,
      platform: 'amazon' as const,
      campaign_name: 'Amazon Store',
      spend: 0,
      impressions: sessions,
      clicks: sessions,
      conversions: units,
      date,
    }
  }).filter(r => r.date && r.conversions > 0)
}

function detectFileType(headers: string[]): 'orders' | 'ad_spend' | 'amazon_sales' | 'unknown' {
  const lower = headers.map(h => h.toLowerCase())
  const hasAmazon = lower.some(h => h.includes('ordered product sales') || h.includes('units ordered'))
  const hasSpend = lower.some(h => ['spend', 'amount_spent', 'cost'].includes(h))
  const hasOrder = lower.some(h => ['total_price', 'total', 'financial_status', 'order_id'].includes(h))
  if (hasAmazon) return 'amazon_sales'
  if (hasSpend) return 'ad_spend'
  if (hasOrder) return 'orders'
  const hasCustomer = lower.some(h => h.includes('email') || h.includes('customer'))
  return hasCustomer ? 'orders' : 'unknown'
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('org_id, is_superadmin').eq('id', user.id).single()

    // Superadmin: use active org from header, otherwise use profile org
    let orgId = profile?.org_id
    if (profile?.is_superadmin) {
      const activeOrgId = request.headers.get('x-active-org')
      if (activeOrgId) orgId = activeOrgId
    }

    if (!orgId) return NextResponse.json({ error: 'No organization linked. Select a client first.' }, { status: 400 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const text = await file.text()
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) return NextResponse.json({ error: 'CSV must have at least a header row and one data row' }, { status: 400 })

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes }
        else if (char === ',' && !inQuotes) { result.push(current.trim()); current = '' }
        else { current += char }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseCSVLine(lines[0])
    const rows = lines.slice(1).map(line => {
      const values = parseCSVLine(line)
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
    })

    const fileType = detectFileType(headers)
    const serviceClient = createServiceClient()
    let inserted = 0
    let skipped = 0

    if (fileType === 'orders') {
      const records = parseOrdersCSV(headers, rows, orgId)
      const { data, error } = await serviceClient
        .from('orders')
        .upsert(records, { onConflict: 'external_id', ignoreDuplicates: true })
        .select()
      if (error) throw error
      inserted = data?.length ?? records.length
      skipped = records.length - inserted

    } else if (fileType === 'ad_spend') {
      const records = parseAdSpendCSV(headers, rows, orgId)
      const { data, error } = await serviceClient
        .from('ad_spend')
        .insert(records)
        .select()
      if (error) throw error
      inserted = data?.length ?? records.length
      skipped = records.length - inserted

    } else {
      return NextResponse.json({ error: 'Could not detect file type. Make sure your CSV has order or ad spend columns.' }, { status: 400 })
    }

    return NextResponse.json({ inserted, skipped, type: fileType })

  } catch (err: any) {
    console.error('CSV upload error:', err)
    return NextResponse.json({ error: err.message ?? 'Upload failed' }, { status: 500 })
  }
}
