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
    const cleanInt = (v: string) => parseInt((v ?? '').replace(/,/g, '')) || 0

    const summaryRow = rows.find(r => !r['Campaign name']?.trim())
    const adRows = rows.filter(r => r['Campaign name']?.trim() && r['Day']?.trim())

    if (adRows.length === 0) {
      return NextResponse.json({ error: 'No daily data found. Make sure your export includes the "Day" breakdown.' }, { status: 400 })
    }

    const grouped: Record<string, any> = {}

    adRows.forEach(row => {
      const day      = row['Day']?.trim()
      const campaign = row['Campaign name']?.trim() ?? 'Unknown'
      const adset    = row['Ad set name']?.trim() ?? ''
      const ad       = row['Ad name']?.trim() ?? ''
      const key = `${day}||${campaign}||${adset}||${ad}`

      if (!grouped[key]) {
        grouped[key] = { campaign, adset, ad, spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, conversionValue: 0 }
      }
      grouped[key].spend           += clean(row['Amount spent (USD)'])
      grouped[key].impressions     += cleanInt(row['Impressions'])
      grouped[key].reach           += cleanInt(row['Reach'])
      grouped[key].clicks          += cleanInt(row['Link clicks'])
      grouped[key].conversions     += cleanInt(row['Purchases'])
      grouped[key].conversionValue += clean(row['Purchases conversion value'])
    })

    const records = Object.entries(grouped).map(([key, v]) => {
      const [date] = key.split('||')
      const cpc = v.clicks > 0 ? v.spend / v.clicks : 0
      const cpm = v.impressions > 0 ? (v.spend / v.impressions) * 1000 : 0
      const ctr = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0
      return {
        org_id: orgId!,
        platform: 'meta' as const,
        campaign_name: v.campaign,
        adset_name: v.adset || null,
        ad_name: v.ad || null,
        spend: v.spend,
        impressions: v.impressions,
        reach: v.reach,
        clicks: v.clicks,
        conversions: v.conversions,
        conversion_value: v.conversionValue,
        cpc: Math.round(cpc * 10000) / 10000,
        cpm: Math.round(cpm * 10000) / 10000,
        ctr: Math.round(ctr * 10000) / 10000,
        date,
      }
    }).filter(r => r.spend > 0 || r.impressions > 0)

    if (records.length === 0) {
      return NextResponse.json({ error: 'No records with spend or impressions found.' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const dates = [...new Set(records.map(r => r.date))]
    if (dates.length > 0) {
      await serviceClient.from('ad_spend').delete().eq('org_id', orgId!).eq('platform', 'meta').in('date', dates)
    }

    const { data, error: dbError } = await serviceClient.from('ad_spend').insert(records).select()
    if (dbError) throw dbError

    // Track Meta Ads sync timestamp
    const { error: tsError } = await serviceClient
      .from('sync_timestamps')
      .upsert({ org_id: orgId, source: 'meta', last_synced_at: new Date().toISOString() }, { onConflict: 'org_id,source' })
    if (tsError) console.error('Meta sync_timestamps upsert failed:', tsError)

    const totalSpend     = summaryRow ? clean(summaryRow['Amount spent (USD)']) : records.reduce((s, r) => s + r.spend, 0)
    const totalPurchases = summaryRow ? cleanInt(summaryRow['Purchases']) : records.reduce((s, r) => s + r.conversions, 0)
    const totalConvValue = summaryRow ? clean(summaryRow['Purchases conversion value']) : records.reduce((s, r) => s + r.conversion_value, 0)

    return NextResponse.json({
      inserted: data?.length ?? records.length,
      skipped: 0,
      days: dates.length,
      campaigns: [...new Set(records.map(r => r.campaign_name))].length,
      adsets: [...new Set(records.map(r => r.adset_name).filter(Boolean))].length,
      ads: [...new Set(records.map(r => r.ad_name).filter(Boolean))].length,
      total_spend: `$${totalSpend.toFixed(2)}`,
      total_purchases: totalPurchases,
      revenue_attributed: `$${totalConvValue.toFixed(2)}`,
    })
  } catch (err: any) {
    console.error('Meta upload error:', err)
    return NextResponse.json({ error: err.message ?? 'Upload failed' }, { status: 500 })
  }
}
