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

    const clean = (v: string) => parseFloat((v ?? '').replace(/[$,]/g, '')) || 0

    // Shopify exports one row per line item — deduplicate by order Name
    const orderMap: Record<string, any> = {}
    rows.forEach(row => {
      const name = row['Name']?.trim()
      if (!name) return
      // Only take the first row per order (header data is the same across line items)
      if (!orderMap[name]) orderMap[name] = row
    })

    const records = Object.values(orderMap).map((row: any) => {
      const rawDate = row['Created at'] || row['Paid at']
      const parsedDate = rawDate ? new Date(rawDate) : new Date()
      const createdAt = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString()

      const subtotal        = clean(row['Subtotal'])
      const discountAmount  = clean(row['Discount Amount'])
      const shippingAmount  = clean(row['Shipping'])
      const taxAmount       = clean(row['Taxes'])
      const totalPrice      = clean(row['Total'])
      const refundedAmount  = clean(row['Refunded Amount'])

      // Gross = subtotal + discounts (what they would have paid without discount)
      const grossSales = subtotal + discountAmount

      const rawStatus = row['Financial Status']?.toLowerCase() || 'paid'
      const status = ['paid', 'pending', 'refunded', 'cancelled'].includes(rawStatus) ? rawStatus : 'paid'

      const firstName = row['Billing Name']?.split(' ')[0] || ''
      const lastName  = row['Billing Name']?.split(' ').slice(1).join(' ') || ''
      const fullName  = row['Billing Name'] || [firstName, lastName].filter(Boolean).join(' ') || null

      return {
        org_id: orgId!,
        external_id: row['Id'] ? `shopify_${row['Id']}` : `shopify_${row['Name']}`, // prefer numeric ID to match API sync
        source: 'shopify' as const,
        customer_email: row['Email'] || null,
        customer_name: fullName,
        // total_price = Total (includes shipping + taxes)
        total_price: totalPrice,
        // finance breakdown
        subtotal,
        discount_amount: discountAmount,
        shipping_amount: shippingAmount,
        tax_amount: taxAmount,
        refunded_amount: refundedAmount,
        status,
        created_at: createdAt,
      }
    }).filter(r => r.total_price > 0 || r.subtotal > 0)

    if (records.length === 0) {
      return NextResponse.json({ error: 'No valid orders found in this file.' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    const { data, error: dbError } = await serviceClient
      .from('orders')
      .upsert(records, { onConflict: 'external_id', ignoreDuplicates: false })
      .select('id')
    if (dbError) throw dbError

    const totalRevenue  = records.reduce((s, r) => s + r.total_price, 0)
    const totalDiscount = records.reduce((s, r) => s + r.discount_amount, 0)
    const totalRefunded = records.reduce((s, r) => s + r.refunded_amount, 0)

    return NextResponse.json({
      inserted: data?.length ?? records.length,
      skipped: records.length - (data?.length ?? records.length),
      orders: records.length,
      total_revenue: `$${totalRevenue.toFixed(2)}`,
      total_discounts: `$${totalDiscount.toFixed(2)}`,
      total_refunded: `$${totalRefunded.toFixed(2)}`,
    })
  } catch (err: any) {
    console.error('Shopify upload error:', err)
    return NextResponse.json({ error: err.message ?? 'Upload failed' }, { status: 500 })
  }
}
