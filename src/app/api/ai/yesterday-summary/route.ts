import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface OrgData {
  org_id: string
  name: string
  revenue: number
  orders: number
  adSpend: number
  roas: number
  prevWeekRevenue: number
  prevWeekOrders: number
  prevWeekAdSpend: number
  prevWeekRoas: number
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { org_ids } = await request.json()
    if (!Array.isArray(org_ids) || org_ids.length === 0) {
      return NextResponse.json({ error: 'org_ids required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Fetch org names + timezones
    const { data: orgsRaw } = await serviceClient
      .from('organizations')
      .select('id, name, timezone')
      .in('id', org_ids) as { data: { id: string; name: string; timezone: string | null }[] | null }
    const orgsMap = new Map((orgsRaw ?? []).map(o => [o.id, o]))

    const allOrgData: OrgData[] = []

    for (const orgId of org_ids) {
      const org = orgsMap.get(orgId)
      if (!org) continue
      const tz = org.timezone ?? 'America/New_York'

      // Calculate yesterday and same day last week in org's timezone
      const nowInTz = new Date().toLocaleDateString('en-CA', { timeZone: tz })
      const todayDate = new Date(nowInTz + 'T12:00:00')
      const yesterday = new Date(todayDate)
      yesterday.setDate(yesterday.getDate() - 1)
      const prevWeekDay = new Date(todayDate)
      prevWeekDay.setDate(prevWeekDay.getDate() - 8) // same day last week

      const yStr = yesterday.toLocaleDateString('en-CA')
      const pwStr = prevWeekDay.toLocaleDateString('en-CA')

      // Convert a local date to UTC boundaries for timestamp queries
      const toUTCRange = (dateStr: string) => {
        const startUTC = new Date(`${dateStr}T00:00:00`)
        const endUTC = new Date(`${dateStr}T23:59:59`)
        // Approximate offset: compute the difference between UTC midnight and local midnight
        const utcMidnight = new Date(`${dateStr}T00:00:00Z`)
        const fmt = new Intl.DateTimeFormat('en-US', {
          timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        })
        const parts = fmt.formatToParts(utcMidnight)
        const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
        const localAtUTCMidnight = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`)
        const targetLocalStart = new Date(`${dateStr}T00:00:00`)
        const targetLocalEnd = new Date(`${dateStr}T23:59:59`)
        const diffMs = targetLocalStart.getTime() - localAtUTCMidnight.getTime()
        return {
          start: new Date(utcMidnight.getTime() + diffMs).toISOString(),
          end: new Date(new Date(`${dateStr}T23:59:59Z`).getTime() + diffMs).toISOString(),
        }
      }

      const yRange = toUTCRange(yStr)
      const pwRange = toUTCRange(pwStr)

      // Fetch orders + ad spend for yesterday and prev week day in parallel
      const [yOrders, pwOrders, ySpend, pwSpend] = await Promise.all([
        serviceClient.from('orders')
          .select('total_price, source, status, units')
          .eq('org_id', orgId)
          .gte('created_at', yRange.start)
          .lte('created_at', yRange.end)
          .neq('status', 'refunded'),
        serviceClient.from('orders')
          .select('total_price, source, status, units')
          .eq('org_id', orgId)
          .gte('created_at', pwRange.start)
          .lte('created_at', pwRange.end)
          .neq('status', 'refunded'),
        serviceClient.from('ad_spend')
          .select('spend')
          .eq('org_id', orgId)
          .eq('date', yStr),
        serviceClient.from('ad_spend')
          .select('spend')
          .eq('org_id', orgId)
          .eq('date', pwStr),
      ])

      const sumRev = (orders: any[]) => orders.reduce((s, o) => s + Number(o.total_price || 0), 0)
      const countOrd = (orders: any[]) => orders.reduce((s: number, o: any) => s + (o.source === 'amazon' ? (Number(o.units) || 1) : 1), 0)
      const sumSpend = (rows: any[]) => rows.reduce((s, r) => s + Number(r.spend || 0), 0)

      const revenue = sumRev(yOrders.data ?? [])
      const orders = countOrd(yOrders.data ?? [])
      const adSpend = sumSpend(ySpend.data ?? [])
      const roas = adSpend > 0 ? revenue / adSpend : 0

      const prevWeekRevenue = sumRev(pwOrders.data ?? [])
      const prevWeekOrders = countOrd(pwOrders.data ?? [])
      const prevWeekAdSpend = sumSpend(pwSpend.data ?? [])
      const prevWeekRoas = prevWeekAdSpend > 0 ? prevWeekRevenue / prevWeekAdSpend : 0

      allOrgData.push({
        org_id: orgId,
        name: org.name,
        revenue,
        orders,
        adSpend,
        roas,
        prevWeekRevenue,
        prevWeekOrders,
        prevWeekAdSpend,
        prevWeekRoas,
      })
    }

    // Build the prompt for Claude
    const pctChange = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? '+100%' : '0%'
      const change = ((cur - prev) / prev) * 100
      return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
    }

    const dataBlock = allOrgData.map(d => {
      return [
        `Brand: ${d.name}`,
        `  Revenue: $${d.revenue.toFixed(2)} (${pctChange(d.revenue, d.prevWeekRevenue)} vs same day last week)`,
        `  Orders: ${d.orders} (${pctChange(d.orders, d.prevWeekOrders)} vs same day last week)`,
        `  Ad Spend: $${d.adSpend.toFixed(2)} (${pctChange(d.adSpend, d.prevWeekAdSpend)} vs same day last week)`,
        `  ROAS: ${d.roas > 0 ? d.roas.toFixed(2) + 'x' : 'N/A'} (${d.prevWeekRoas > 0 ? pctChange(d.roas, d.prevWeekRoas) + ' vs same day last week' : 'no comparison'})`,
      ].join('\n')
    }).join('\n\n')

    const yesterdayLabel = new Date(allOrgData.length > 0
      ? (() => {
          const tz = (orgsMap.get(allOrgData[0].org_id) as any)?.timezone ?? 'America/New_York'
          const nowInTz = new Date().toLocaleDateString('en-CA', { timeZone: tz })
          const d = new Date(nowInTz + 'T12:00:00')
          d.setDate(d.getDate() - 1)
          return d.toLocaleDateString('en-CA')
        })()
      : new Date().toLocaleDateString('en-CA')
    ).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    const anthropic = new Anthropic()

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are an e-commerce performance analyst writing a morning briefing for a DTC brand founder. Yesterday was ${yesterdayLabel}.

Here is yesterday's data for each brand, with % change vs the same day last week:

${dataBlock}

For each brand, write a 2-3 sentence summary. Be founder-friendly — conversational but data-driven. Focus on what matters: revenue direction, ROAS efficiency, notable spend changes. Highlight wins and flag concerns. Use exact dollar amounts and percentages.

Format your response as JSON: { "summaries": { "<org_id>": "<summary text>" } }

Use these org_ids: ${allOrgData.map(d => d.org_id).join(', ')}

Return ONLY the JSON, no markdown fences.`,
      }],
    })

    // Parse the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    let summaries: Record<string, string> = {}
    try {
      const parsed = JSON.parse(responseText)
      summaries = parsed.summaries ?? parsed
    } catch {
      // If JSON parsing fails, return the raw text as a single summary
      summaries = Object.fromEntries(allOrgData.map(d => [d.org_id, responseText]))
    }

    // Attach metrics to each summary for display
    const result: Record<string, {
      summary: string
      revenue: number
      orders: number
      adSpend: number
      roas: number
      revenueDelta: number
      ordersDelta: number
      adSpendDelta: number
      roasDelta: number
    }> = {}

    for (const d of allOrgData) {
      const revDelta = d.prevWeekRevenue > 0 ? ((d.revenue - d.prevWeekRevenue) / d.prevWeekRevenue) * 100 : (d.revenue > 0 ? 100 : 0)
      const ordDelta = d.prevWeekOrders > 0 ? ((d.orders - d.prevWeekOrders) / d.prevWeekOrders) * 100 : (d.orders > 0 ? 100 : 0)
      const spendDelta = d.prevWeekAdSpend > 0 ? ((d.adSpend - d.prevWeekAdSpend) / d.prevWeekAdSpend) * 100 : (d.adSpend > 0 ? 100 : 0)
      const roasDelta = d.prevWeekRoas > 0 ? ((d.roas - d.prevWeekRoas) / d.prevWeekRoas) * 100 : (d.roas > 0 ? 100 : 0)

      result[d.org_id] = {
        summary: summaries[d.org_id] ?? 'No summary available.',
        revenue: d.revenue,
        orders: d.orders,
        adSpend: d.adSpend,
        roas: d.roas,
        revenueDelta: revDelta,
        ordersDelta: ordDelta,
        adSpendDelta: spendDelta,
        roasDelta: roasDelta,
      }
    }

    return NextResponse.json({ summaries: result })
  } catch (err: any) {
    console.error('[yesterday-summary] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
