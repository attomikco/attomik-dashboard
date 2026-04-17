import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Compute a UTC timestamp range for a local-timezone calendar date.
// Mirrors the approach used in /api/ai/yesterday-summary so queries match the same buckets.
function toUTCRange(dateStr: string, tz: string) {
  const utcMidnight = new Date(`${dateStr}T00:00:00Z`)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const parts = fmt.formatToParts(utcMidnight)
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]))
  const localAtUTCMidnight = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`)
  const targetLocalStart = new Date(`${dateStr}T00:00:00`)
  const diffMs = targetLocalStart.getTime() - localAtUTCMidnight.getTime()
  return {
    start: new Date(utcMidnight.getTime() + diffMs).toISOString(),
    end: new Date(new Date(`${dateStr}T23:59:59Z`).getTime() + diffMs).toISOString(),
  }
}

function pct(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return ((cur - prev) / prev) * 100
}

export async function POST(request: Request) {
  try {
    const { org_id } = await request.json()
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const supabase = createServiceClient()

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, timezone')
      .eq('id', org_id)
      .single() as { data: { id: string; name: string; timezone: string | null } | null }
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

    const tz = org.timezone ?? 'America/New_York'
    const nowInTz = new Date().toLocaleDateString('en-CA', { timeZone: tz })
    const todayDate = new Date(nowInTz + 'T12:00:00')
    const yesterday = new Date(todayDate); yesterday.setDate(yesterday.getDate() - 1)
    const prevWeekDay = new Date(todayDate); prevWeekDay.setDate(prevWeekDay.getDate() - 8)
    const yStr = yesterday.toLocaleDateString('en-CA')
    const pwStr = prevWeekDay.toLocaleDateString('en-CA')

    const yRange = toUTCRange(yStr, tz)
    const pwRange = toUTCRange(pwStr, tz)

    const [yOrders, pwOrders, ySpend, pwSpend] = await Promise.all([
      supabase.from('orders').select('total_price, source, status, units')
        .eq('org_id', org_id).gte('created_at', yRange.start).lte('created_at', yRange.end).neq('status', 'refunded'),
      supabase.from('orders').select('total_price, source, status, units')
        .eq('org_id', org_id).gte('created_at', pwRange.start).lte('created_at', pwRange.end).neq('status', 'refunded'),
      supabase.from('ad_spend').select('spend').eq('org_id', org_id).eq('date', yStr),
      supabase.from('ad_spend').select('spend').eq('org_id', org_id).eq('date', pwStr),
    ])

    const sumRev = (rows: any[]) => rows.reduce((s, o) => s + Number(o.total_price || 0), 0)
    const countOrd = (rows: any[]) => rows.reduce((s: number, o: any) => s + (o.source === 'amazon' ? (Number(o.units) || 1) : 1), 0)
    const sumSpend = (rows: any[]) => rows.reduce((s, r) => s + Number(r.spend || 0), 0)

    const revenue = sumRev(yOrders.data ?? [])
    const orders = countOrd(yOrders.data ?? [])
    const adSpend = sumSpend(ySpend.data ?? [])
    const roas = adSpend > 0 ? revenue / adSpend : 0

    const pRevenue = sumRev(pwOrders.data ?? [])
    const pOrders = countOrd(pwOrders.data ?? [])
    const pAdSpend = sumSpend(pwSpend.data ?? [])
    const pRoas = pAdSpend > 0 ? pRevenue / pAdSpend : 0

    const metrics = {
      revenue, orders, ad_spend: adSpend, roas,
      revenue_wow: pRevenue > 0 ? pct(revenue, pRevenue) : null,
      orders_wow: pOrders > 0 ? pct(orders, pOrders) : null,
      ad_spend_wow: pAdSpend > 0 ? pct(adSpend, pAdSpend) : null,
      roas_wow: pRoas > 0 ? pct(roas, pRoas) : null,
    }

    const fmtDelta = (v: number | null) => v === null ? 'no comparison' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}% vs same day last week`

    const dataBlock = [
      `Revenue: $${revenue.toFixed(2)} (${fmtDelta(metrics.revenue_wow)})`,
      `Orders: ${orders} (${fmtDelta(metrics.orders_wow)})`,
      `Ad Spend: $${adSpend.toFixed(2)} (${fmtDelta(metrics.ad_spend_wow)})`,
      `ROAS: ${roas > 0 ? roas.toFixed(2) + 'x' : 'N/A'} (${fmtDelta(metrics.roas_wow)})`,
    ].join('\n')

    const anthropic = new Anthropic()
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are a performance analyst for a CPG ecommerce brand. Write a 2-3 sentence morning briefing about yesterday's performance. Be specific with numbers. Note what's up or down vs last week. Founder-friendly tone, no fluff, no generic advice.

Brand: ${org.name}

Data:
${dataBlock}

Return only the briefing text, no preamble or markdown.`,
      }],
    })

    const summary = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    const { data: upserted, error: upsertErr } = await supabase
      .from('daily_insights')
      .upsert({ org_id, date: yStr, summary, metrics }, { onConflict: 'org_id,date' })
      .select('id, org_id, date, summary, metrics, created_at')
      .single()

    if (upsertErr) {
      console.error('[insights/generate] upsert failed:', upsertErr)
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ data: upserted })
  } catch (err: any) {
    console.error('[insights/generate] error:', err)
    return NextResponse.json({ error: err.message ?? 'Failed to generate insights' }, { status: 500 })
  }
}
