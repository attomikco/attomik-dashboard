import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 300

const GRAPH_API = 'https://graph.facebook.com/v19.0'
const FIELDS = 'spend,impressions,clicks,reach,actions,action_values,campaign_name,adset_name,ad_name,cpc,cpm,ctr'

export async function POST(request: Request) {
  try {
    const { org_id } = await request.json()
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const supabase = createServiceClient()

    // Fetch org credentials
    const { data: org } = await supabase
      .from('organizations')
      .select('meta_ad_account_id, meta_access_token')
      .eq('id', org_id)
      .single()

    console.log('[meta-sync] org credentials:', {
      org_id,
      meta_ad_account_id: org?.meta_ad_account_id ?? null,
      has_access_token: !!org?.meta_access_token,
      token_length: org?.meta_access_token?.length ?? 0,
    })

    if (!org?.meta_ad_account_id || !org?.meta_access_token) {
      return NextResponse.json({ error: 'Meta Ads not configured for this org' }, { status: 400 })
    }

    const { meta_ad_account_id: adAccountId, meta_access_token: accessToken } = org

    // Determine date preset: this_year if no existing data, last_30d otherwise
    const { count } = await supabase
      .from('ad_spend')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .eq('platform', 'meta')

    const datePreset = (count ?? 0) === 0 ? 'this_year' : 'last_30d'
    console.log('[meta-sync] existing row count:', count, '→ date_preset:', datePreset)

    // Paginate through Meta Insights API
    const allRows: any[] = []
    let nextUrl: string | null = `${GRAPH_API}/act_${adAccountId}/insights?` + new URLSearchParams({
      access_token: accessToken,
      fields: FIELDS,
      time_increment: '1',
      level: 'ad',
      date_preset: datePreset,
      limit: '500',
    }).toString()

    while (nextUrl) {
      const apiRes = await fetch(nextUrl)
      if (!apiRes.ok) {
        const body = await apiRes.text()
        throw new Error(`Meta API error ${apiRes.status}: ${body}`)
      }
      const apiJson: any = await apiRes.json()
      console.log('[meta-sync] API page response:', {
        data_count: apiJson.data?.length ?? 0,
        has_paging: !!apiJson.paging?.next,
        sample_row: apiJson.data?.[0] ?? null,
        error: apiJson.error ?? null,
      })
      allRows.push(...(apiJson.data ?? []))
      nextUrl = apiJson.paging?.next ?? null
    }

    console.log('[meta-sync] total rows from API:', allRows.length)

    if (allRows.length === 0) {
      // Still update sync timestamp
      await supabase.from('sync_timestamps').upsert(
        { org_id, source: 'meta', last_synced_at: new Date().toISOString() },
        { onConflict: 'org_id,source' }
      )
      return NextResponse.json({ inserted: 0, days: 0, campaigns: 0, message: 'No data returned from Meta' })
    }

    // Map API response to the same row shape the CSV import produces
    const records = allRows.map(row => {
      const spend = parseFloat(row.spend ?? '0')
      const impressions = parseInt(row.impressions ?? '0') || 0
      const clicks = parseInt(row.clicks ?? '0') || 0
      const reach = parseInt(row.reach ?? '0') || 0
      const cpc = parseFloat(row.cpc ?? '0') || 0
      const cpm = parseFloat(row.cpm ?? '0') || 0
      const ctr = parseFloat(row.ctr ?? '0') || 0

      const purchaseAction = (row.actions ?? []).find((a: any) => a.action_type === 'purchase')
      const conversions = parseInt(purchaseAction?.value ?? '0') || 0

      const purchaseValue = (row.action_values ?? []).find((a: any) => a.action_type === 'purchase')
      const conversionValue = parseFloat(purchaseValue?.value ?? '0') || 0

      return {
        org_id,
        platform: 'meta' as const,
        campaign_name: row.campaign_name ?? 'Unknown',
        adset_name: row.adset_name ?? null,
        ad_name: row.ad_name ?? null,
        spend,
        impressions,
        reach,
        clicks,
        conversions,
        conversion_value: conversionValue,
        cpc: Math.round(cpc * 10000) / 10000,
        cpm: Math.round(cpm * 10000) / 10000,
        ctr: Math.round(ctr * 10000) / 10000,
        date: row.date_start,
      }
    }).filter(r => r.spend > 0 || r.impressions > 0)

    console.log('[meta-sync] mapped records:', records.length, 'sample:', records[0] ?? null)

    if (records.length === 0) {
      await supabase.from('sync_timestamps').upsert(
        { org_id, source: 'meta', last_synced_at: new Date().toISOString() },
        { onConflict: 'org_id,source' }
      )
      return NextResponse.json({ inserted: 0, days: 0, campaigns: 0, message: 'No records with spend or impressions' })
    }

    // Upsert: delete existing rows for these dates, then insert (matches CSV import logic)
    const dates = Array.from(new Set(records.map(r => r.date)))
    console.log('[meta-sync] unique dates:', dates.length, 'range:', dates[0], '→', dates[dates.length - 1])

    if (dates.length > 0) {
      const { error: delError, count: delCount } = await supabase.from('ad_spend').delete({ count: 'exact' }).eq('org_id', org_id).eq('platform', 'meta').in('date', dates)
      console.log('[meta-sync] deleted existing rows:', delCount, 'error:', delError)
    }

    // Insert in batches of 500
    let insertedCount = 0
    for (let i = 0; i < records.length; i += 500) {
      const batch = records.slice(i, i + 500)
      const { data, error: dbError } = await supabase.from('ad_spend').insert(batch).select()
      console.log(`[meta-sync] insert batch ${i / 500 + 1}:`, {
        attempted: batch.length,
        inserted: data?.length ?? 0,
        error: dbError ?? null,
      })
      if (dbError) throw dbError
      insertedCount += data?.length ?? 0
    }

    console.log('[meta-sync] total inserted:', insertedCount)

    // Log per-day breakdown from records being inserted
    const spendByDate: Record<string, { rows: number; spend: number }> = {}
    records.forEach(r => {
      if (!spendByDate[r.date]) spendByDate[r.date] = { rows: 0, spend: 0 }
      spendByDate[r.date].rows++
      spendByDate[r.date].spend += r.spend
    })
    console.log('[meta-sync] records by date:', JSON.stringify(spendByDate))

    // Verify what's in the DB — check last 3 dates
    const sortedDates = Object.keys(spendByDate).sort()
    const recentDates = sortedDates.slice(-3)
    for (const d of recentDates) {
      const { data: dbRows, count: dbCount } = await supabase.from('ad_spend')
        .select('spend', { count: 'exact' })
        .eq('org_id', org_id).eq('platform', 'meta').eq('date', d)
      const dbTotal = (dbRows ?? []).reduce((s: number, r: any) => s + Number(r.spend), 0)
      console.log(`[meta-sync] DB check date=${d}: ${dbCount} rows, $${dbTotal.toFixed(2)} (expected ${spendByDate[d].rows} rows, $${spendByDate[d].spend.toFixed(2)})`)
    }

    // Also log sample date_start values from raw API to check format
    const sampleDateStarts = allRows.slice(0, 5).map((r: any) => ({ date_start: r.date_start, date_stop: r.date_stop }))
    console.log('[meta-sync] sample raw API date fields:', sampleDateStarts)

    // Update sync timestamp
    const { error: tsError } = await supabase.from('sync_timestamps').upsert(
      { org_id, source: 'meta', last_synced_at: new Date().toISOString() },
      { onConflict: 'org_id,source' }
    )
    console.log('[meta-sync] sync_timestamps upsert:', { org_id, error: tsError })

    const totalSpend = records.reduce((s, r) => s + r.spend, 0)
    const latestDate = sortedDates[sortedDates.length - 1] ?? ''
    const latestDaySpend = spendByDate[latestDate]?.spend ?? 0

    return NextResponse.json({
      inserted: insertedCount,
      days: dates.length,
      campaigns: Array.from(new Set(records.map(r => r.campaign_name))).length,
      adsets: Array.from(new Set(records.map(r => r.adset_name).filter(Boolean))).length,
      ads: Array.from(new Set(records.map(r => r.ad_name).filter(Boolean))).length,
      total_spend: `$${totalSpend.toFixed(2)}`,
      latest_date: latestDate,
      latest_day_spend: `$${latestDaySpend.toFixed(2)}`,
      latest_day_rows: spendByDate[latestDate]?.rows ?? 0,
      date_preset: datePreset,
      message: datePreset === 'this_year'
        ? `Initial sync — ${insertedCount} records across ${dates.length} days · $${totalSpend.toFixed(2)} total · $${latestDaySpend.toFixed(2)} on ${latestDate}`
        : `Synced ${dates.length} days — ${insertedCount} records · $${totalSpend.toFixed(2)} total · $${latestDaySpend.toFixed(2)} on ${latestDate}`,
    })

  } catch (err: any) {
    console.error('Meta sync error:', err)
    return NextResponse.json({ error: err.message ?? 'Sync failed' }, { status: 500 })
  }
}
