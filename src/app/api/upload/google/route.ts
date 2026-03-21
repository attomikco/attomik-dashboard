import { NextResponse } from 'next/server'
import { getOrgId, parseCSV, createServiceClient } from '../_shared'

export async function POST(request: Request) {
  try {
    const { orgId, error } = await getOrgId(request)
    if (error) return error

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const { headers, rows } = parseCSV(await file.text())

    // Skip summary/total rows (Google Ads exports often have "Total" rows)
    const dataRows = rows.filter(row => {
      const day = row['Day'] || row['Date'] || row['Week'] || row['Month'] || ''
      return day && day.toLowerCase() !== 'total' && day !== '--'
    })

    if (dataRows.length === 0) {
      return NextResponse.json({ error: 'No data rows found. Make sure your export has a Day/Date column.' }, { status: 400 })
    }

    const col = (...names: string[]) => {
      const lower = headers.map(h => h.toLowerCase().trim())
      for (const n of names) {
        const i = lower.findIndex(h => h === n || h.includes(n))
        if (i !== -1) return headers[i]
      }
      return null
    }

    const dateCol        = col('day', 'date', 'week', 'month')
    const campaignCol    = col('campaign', 'campaign name')
    const adgroupCol     = col('ad group', 'adgroup', 'ad group name')
    const costCol        = col('cost', 'spend', 'cost / conv')
    const impressionsCol = col('impressions')
    const clicksCol      = col('clicks')
    const conversionsCol = col('conversions', 'all conversions')
    const convValueCol   = col('conversion value', 'all conversion value', 'total conv. value')

    const clean    = (v: string) => parseFloat((v ?? '').replace(/[$,]/g, '')) || 0
    const cleanInt = (v: string) => parseInt((v ?? '').replace(/[,]/g, '')) || 0

    // Group by date + campaign
    const grouped: Record<string, any> = {}
    dataRows.forEach(row => {
      const rawDate = dateCol ? row[dateCol] : null
      const parsedDate = rawDate ? new Date(rawDate) : null
      const date = parsedDate && !isNaN(parsedDate.getTime())
        ? parsedDate.toISOString().split('T')[0]
        : null
      if (!date) return

      const campaign = campaignCol ? row[campaignCol]?.trim() ?? 'Unknown' : 'Unknown'
      const adgroup  = adgroupCol  ? row[adgroupCol]?.trim()  ?? null : null
      const key = `${date}||${campaign}||${adgroup ?? ''}`

      if (!grouped[key]) grouped[key] = { date, campaign, adgroup, spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 }

      let cost = costCol ? clean(row[costCol]) : 0
      // Handle micros (Google sometimes exports cost in micros)
      if (cost > 100000) cost = cost / 1_000_000

      grouped[key].spend           += cost
      grouped[key].impressions     += impressionsCol ? cleanInt(row[impressionsCol]) : 0
      grouped[key].clicks          += clicksCol ? cleanInt(row[clicksCol]) : 0
      grouped[key].conversions     += conversionsCol ? clean(row[conversionsCol]) : 0
      grouped[key].conversionValue += convValueCol ? clean(row[convValueCol]) : 0
    })

    const records = Object.values(grouped).map((v: any) => {
      const cpc = v.clicks > 0 ? v.spend / v.clicks : 0
      const cpm = v.impressions > 0 ? (v.spend / v.impressions) * 1000 : 0
      const ctr = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0
      return {
        org_id: orgId!,
        platform: 'google' as const,
        campaign_name: v.campaign,
        adset_name: v.adgroup,
        spend: v.spend,
        impressions: v.impressions,
        clicks: v.clicks,
        conversions: v.conversions,
        conversion_value: v.conversionValue,
        cpc: Math.round(cpc * 10000) / 10000,
        cpm: Math.round(cpm * 10000) / 10000,
        ctr: Math.round(ctr * 10000) / 10000,
        date: v.date,
      }
    }).filter(r => r.spend > 0 || r.impressions > 0)

    if (records.length === 0) {
      return NextResponse.json({ error: 'No records with spend or impressions found.' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const dates = [...new Set(records.map(r => r.date))]
    if (dates.length > 0) {
      await serviceClient.from('ad_spend').delete().eq('org_id', orgId!).eq('platform', 'google').in('date', dates)
    }

    const { data, error: dbError } = await serviceClient.from('ad_spend').insert(records).select()
    if (dbError) throw dbError

    const totalSpend     = records.reduce((s, r) => s + r.spend, 0)
    const totalClicks    = records.reduce((s, r) => s + r.clicks, 0)
    const totalConv      = records.reduce((s, r) => s + r.conversions, 0)
    const totalConvValue = records.reduce((s, r) => s + r.conversion_value, 0)

    return NextResponse.json({
      inserted: data?.length ?? records.length,
      skipped: 0,
      days: dates.length,
      campaigns: [...new Set(records.map(r => r.campaign_name))].length,
      total_spend: `$${totalSpend.toFixed(2)}`,
      total_clicks: totalClicks.toLocaleString(),
      total_conversions: totalConv,
      revenue_attributed: `$${totalConvValue.toFixed(2)}`,
    })
  } catch (err: any) {
    console.error('Google Ads upload error:', err)
    return NextResponse.json({ error: err.message ?? 'Upload failed' }, { status: 500 })
  }
}
