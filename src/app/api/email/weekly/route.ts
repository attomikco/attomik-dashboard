import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthEmailsByIds } from '@/lib/supabase/auth-users'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Order = { total_price: number | string; source: string | null; status: string | null; created_at: string }
type Spend = { spend: number | string; date: string }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

// Format "Apr 6 – Apr 12, 2026" from two YYYY-MM-DD keys
function fmtRangeKeys(startKey: string, endKey: string): string {
  const [, sm, sd] = startKey.split('-').map(Number)
  const [ey, em, ed] = endKey.split('-').map(Number)
  return `${MONTHS[sm - 1]} ${sd} – ${MONTHS[em - 1]} ${ed}, ${ey}`
}

// YYYY-MM-DD of a Date in a specific timezone — matches analytics' utcToOrgDate
function utcToOrgDate(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: tz })
}

// Convert a YYYY-MM-DD (interpreted in tz) to the UTC instant of that tz-local
// midnight (or end-of-day). Mirrors the helper used in analytics/page.tsx.
function tzDateToUTC(dateStr: string, tz: string, endOfDay = false): Date {
  const time = endOfDay ? '23:59:59' : '00:00:00'
  const utcAnchor = new Date(`${dateStr}T${time}Z`)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const parts = fmt.formatToParts(utcAnchor)
  const p: Record<string, string> = {}
  for (const part of parts) if (part.type !== 'literal') p[part.type] = part.value
  const localAtAnchor = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`)
  const targetLocal = new Date(`${dateStr}T${time}`)
  const diffMs = targetLocal.getTime() - localAtAnchor.getTime()
  return new Date(utcAnchor.getTime() + diffMs)
}

function nextDayKey(ymd: string): string {
  return shiftDayKey(ymd, 1)
}

function shiftDayKey(ymd: string, offsetDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10)
}

// Compute last complete Mon–Sun week, anchored in the org timezone. All returned
// values are YYYY-MM-DD *calendar* dates in that tz.
function computeLastWeekBoundsTz(tz: string, now = new Date()) {
  const todayKey = now.toLocaleDateString('en-CA', { timeZone: tz })
  const [y, m, d] = todayKey.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const daysSinceMonday = (base.getUTCDay() + 6) % 7
  const shift = (offset: number) => {
    const x = new Date(base)
    x.setUTCDate(base.getUTCDate() + offset)
    return x.toISOString().slice(0, 10)
  }
  return {
    lastMonKey: shift(-daysSinceMonday - 7),
    lastSunKey: shift(-daysSinceMonday - 1),
    prevMonKey: shift(-daysSinceMonday - 14),
    prevSunKey: shift(-daysSinceMonday - 8),
  }
}

function weekDayKeys(mondayKey: string): string[] {
  const [y, m, d] = mondayKey.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const keys: string[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(base)
    day.setUTCDate(base.getUTCDate() + i)
    keys.push(day.toISOString().slice(0, 10))
  }
  return keys
}

async function fetchOrdersBounded(
  sb: any, orgId: string, gteISO: string, ltOrLteISO: string,
  opts: { source?: 'amazon' | 'non-amazon'; exclusiveUpper?: boolean } = {}
): Promise<Order[]> {
  const size = 1000
  let from = 0
  const all: Order[] = []
  while (true) {
    let q = sb.from('orders')
      .select('total_price, source, status, created_at')
      .eq('org_id', orgId)
      .gte('created_at', gteISO)
    q = opts.exclusiveUpper ? q.lt('created_at', ltOrLteISO) : q.lte('created_at', ltOrLteISO)
    if (opts.source === 'amazon') q = q.eq('source', 'amazon')
    else if (opts.source === 'non-amazon') q = q.neq('source', 'amazon')
    q = q.order('created_at', { ascending: true }).range(from, from + size - 1)
    const { data } = await q
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < size) break
    from += size
  }
  return all
}

// Fetch orders across an inclusive [startKey, endKey] date range in the org
// timezone: tz-aware UTC bounds for Shopify/other sources + plain UTC bounds
// for Amazon (which is stored at midnight UTC), matching analytics.
async function fetchOrdersForRange(
  sb: any, orgId: string, startKey: string, endKey: string, tz: string
): Promise<Order[]> {
  const shopStart = tzDateToUTC(startKey, tz, false).toISOString()
  const shopEnd = tzDateToUTC(nextDayKey(endKey), tz, false).toISOString()
  const amzStart = `${startKey}T00:00:00.000Z`
  const amzEnd = `${endKey}T23:59:59.999Z`
  const [nonAmazon, amazon] = await Promise.all([
    fetchOrdersBounded(sb, orgId, shopStart, shopEnd, { source: 'non-amazon', exclusiveUpper: true }),
    fetchOrdersBounded(sb, orgId, amzStart, amzEnd, { source: 'amazon' }),
  ])
  return [...nonAmazon, ...amazon]
}

async function fetchAllSpend(sb: any, orgId: string, gteDate: string, lteDate: string) {
  const size = 1000
  let from = 0
  const all: Spend[] = []
  while (true) {
    const { data } = await sb.from('ad_spend').select('spend, date')
      .eq('org_id', orgId)
      .gte('date', gteDate)
      .lte('date', lteDate)
      .range(from, from + size - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < size) break
    from += size
  }
  return all
}

function aggregate(orders: Order[]) {
  let revenue = 0
  let shopify = 0
  let amazon = 0
  let walmart = 0
  for (const o of orders) {
    const v = Number(o.total_price) || 0
    revenue += v
    if (o.source === 'amazon') amazon += v
    else if (o.source === 'walmart') walmart += v
    else shopify += v
  }
  return { revenue, orders: orders.length, shopify, amazon, walmart }
}

function bestDay(orders: Order[], weekKeys: string[], tz: string) {
  // Bucket by the order's calendar date in the org's timezone, matching the
  // analytics page. Exclude fully refunded orders (analytics does the same for
  // day-level revenue buckets).
  const buckets = new Map<string, number>()
  for (const k of weekKeys) buckets.set(k, 0)
  for (const o of orders) {
    if (o.status === 'refunded') continue
    const key = utcToOrgDate(o.created_at, tz)
    if (!buckets.has(key)) continue
    buckets.set(key, (buckets.get(key) ?? 0) + (Number(o.total_price) || 0))
  }
  let maxKey = weekKeys[0]
  for (const k of weekKeys) {
    if ((buckets.get(k) ?? 0) > (buckets.get(maxKey) ?? 0)) maxKey = k
  }
  const [y, m, d] = maxKey.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return { name: DAYS_LONG[dow], revenue: buckets.get(maxKey) ?? 0 }
}

function wowPct(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? 0 : null
  return ((cur - prev) / prev) * 100
}

function changeBadge(pct: number | null, lowerIsBetter = false) {
  if (pct === null) return `<span style="font-size:11px;font-weight:600;color:#666666 !important;">—</span>`
  const up = pct >= 0
  const isGood = lowerIsBetter ? !up : up
  const bg = isGood ? '#dcfce7' : '#fee2e2'
  const color = isGood ? '#16a34a' : '#dc2626'
  const arrow = up ? '▲' : '▼'
  const val = Math.abs(pct).toFixed(1)
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background-color:${bg} !important;color:${color} !important;font-size:11px;font-weight:700;letter-spacing:0.02em;">${arrow} ${val}%</span>`
}

function kpiCell(label: string, value: string, pct: number | null | undefined, lowerIsBetter = false) {
  const badge = pct === undefined
    ? `<span style="display:inline-block;font-size:11px;font-weight:600;color:#999999;">&nbsp;</span>`
    : changeBadge(pct, lowerIsBetter)
  return `
    <td width="50%" valign="top" style="padding:6px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:12px;">
        <tr><td style="padding:16px 16px 14px;">
          <div style="font-size:11px;font-weight:700;color:#666666;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">${label}</div>
          <div style="font-size:26px;font-weight:800;color:#000000;letter-spacing:-0.02em;line-height:1.1;margin-bottom:8px;">${value}</div>
          ${badge}
        </td></tr>
      </table>
    </td>`
}

function markdownToHtml(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/[*#]/g, '')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>')
}

function toPlainText(s: string) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/[*#_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

type Kpi = { value: string; pct: number | null }
type KpiNoWow = { value: string }

async function generateAISummary(ctx: {
  orgName: string
  revenue: number; orders: number; adSpend: number; roas: number; aov: number; cac: number | null
  revenueWow: number | null; ordersWow: number | null; adSpendWow: number | null; roasWow: number | null
  bestDay: { name: string; revenue: number }
  shopifyPct: number; amazonPct: number; walmartPct: number
  avg: {
    revPerWeek: number; ordersPerWeek: number
    aov: number; roas: number; cac: number | null
  }
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return ''
  const pct = (n: number | null) => n === null ? 'N/A' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
  const cacStr = ctx.cac === null ? 'N/A' : `$${ctx.cac.toFixed(0)}`
  const avgCacStr = ctx.avg.cac === null ? 'N/A' : `$${ctx.avg.cac.toFixed(0)}`
  const prompt = `You are writing on behalf of the Attomik team to ${ctx.orgName} (a client). Write a weekly performance summary in 2-3 complete sentences, between 60 and 110 words. Always finish your final sentence — never stop mid-thought.

Voice & framing rules (important):
- Use first-person plural ("we", "our team") to signal that Attomik is monitoring and working alongside the client. This is an automated weekly email, so DO NOT make personal-sounding promises like "we'll keep you posted," "we'll be in touch," "stay tuned," "let us know," or anything that implies a follow-up message — those read as fake when the email is clearly automated.
- Stick to the facts and the numbers provided. Do NOT speculate on causes, suggest tactics, or assign blame.
- You have no visibility into intentional strategy — a low ROAS week, a spend spike, or a soft-revenue stretch may be a deliberate test, launch ramp, or planned pullback. Never imply something is "wrong" or "concerning."
- Lead with the strongest positive signal that's actually true. Where things are flat or down, state it plainly and neutrally without dramatizing — one week is one week, not a trend on its own.
- For declines, prefer neutral language ("revenue came in at X, below last week's Y") over alarm words like "drop," "plunge," "weak," "concerning," "trouble." Don't manufacture a silver lining either — if there isn't one, just stop after the facts.
- Be specific with numbers. Note what's up or down vs last week and, where relevant, vs the 4-week average so the reader can tell a blip from a trend. Founder-friendly tone, no fluff, no generic advice.

This week:
- Revenue: $${ctx.revenue.toFixed(0)} (${pct(ctx.revenueWow)} vs last week)
- Orders: ${ctx.orders} (${pct(ctx.ordersWow)} vs last week)
- Ad Spend: $${ctx.adSpend.toFixed(0)} (${pct(ctx.adSpendWow)} vs last week)
- ROAS: ${ctx.roas.toFixed(2)}x (${pct(ctx.roasWow)} vs last week)
- AOV: $${ctx.aov.toFixed(0)}
- CAC: ${cacStr}
- Best day: ${ctx.bestDay.name} at $${ctx.bestDay.revenue.toFixed(0)}
- Channel mix: ${[
  ctx.shopifyPct > 0 ? `Shopify ${ctx.shopifyPct.toFixed(0)}%` : '',
  ctx.amazonPct  > 0 ? `Amazon ${ctx.amazonPct.toFixed(0)}%`   : '',
  ctx.walmartPct > 0 ? `Walmart ${ctx.walmartPct.toFixed(0)}%` : '',
].filter(Boolean).join(', ')}

4-week averages (the 4 weeks before last week):
- Revenue/wk: $${ctx.avg.revPerWeek.toFixed(0)}
- Orders/wk: ${Math.round(ctx.avg.ordersPerWeek)}
- AOV: $${ctx.avg.aov.toFixed(0)}
- ROAS: ${ctx.avg.roas.toFixed(2)}x
- CAC: ${avgCacStr}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    const text = (data.content?.[0]?.text ?? '').trim()
    if (data.stop_reason === 'max_tokens') {
      const lastEnd = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'))
      if (lastEnd > 0) return text.slice(0, lastEnd + 1)
    }
    return text
  } catch {
    return ''
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function buildHtml(opts: {
  orgName: string
  rangeLabel: string
  aiSummary: string
  dashboardUrl: string
  kpis: {
    revenue: Kpi; orders: Kpi; adSpend: Kpi; roas: Kpi
    aov: Kpi; cac: Kpi; cltv: Kpi; cltvCac: Kpi
  }
  averages: { revPerWeek: string; ordersPerWeek: string; aov: string; roas: string; cac: string }
  bestDay: { name: string; revenue: string }
  channel: { shopify: string; shopifyPct: number; amazon: string; amazonPct: number; walmart: string; walmartPct: number }
}) {
  const { orgName, rangeLabel, aiSummary, dashboardUrl, kpis, averages, bestDay, channel } = opts
  const avgStat = (label: string, value: string) => `
    <td width="20%" valign="top" style="text-align:center;padding:0 4px;">
      <div style="font-size:9px;font-weight:700;color:#888888;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">${label}</div>
      <div style="font-size:13px;font-weight:700;color:#000000;font-family:'DM Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:-0.01em;">${value}</div>
    </td>`
  const preheaderText = escapeHtml(toPlainText(aiSummary || `${orgName} weekly performance — ${rangeLabel}`))
  const summaryBlock = aiSummary
    ? `<tr><td style="padding:16px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;border:1px solid #e0e0e0;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-size:10px;font-weight:700;color:#000000;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;"><span style="color:#00ff97">✦</span> ATTOMIK AI</div>
              <div style="font-size:14px;color:#333333;line-height:1.6;">${markdownToHtml(escapeHtml(aiSummary))}</div>
            </td></tr>
          </table>
        </td></tr>`
    : ''
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${orgName} — Weekly Performance</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#333333;">
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">${preheaderText}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 12px;color-scheme:light only;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e0e0e0;">
        <tr><td style="background:#00ff97;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td align="center" style="padding:32px 32px 0;">
          <div style="text-align:center;margin-bottom:8px;">
            <div style="background-color:#f5f5f5;border-radius:8px;padding:12px 20px;display:inline-block;">
            <svg xmlns="http://www.w3.org/2000/svg" width="160" height="46" viewBox="0 0 3162.208309618669 909.2179303030312">
              <g transform="scale(8.11041548093341) translate(10, 10)">
                <g transform="matrix(1.0466489028630275,0,0,1.0466489028630275,-6.279812066960743,-6.279893417178165)" fill="#000">
                  <g transform="translate(0,-952.36218)">
                    <path d="m 13.540789,1013.168 c -4.1612604,0 -7.5408665,3.3922 -7.5408665,7.5693 0,4.1771 3.3796061,7.605 7.5408665,7.605 0.813543,0 1.613976,-0.1361 2.383228,-0.3928 12.281102,18.8997 36.649842,23.2608 54.493227,13.032 0.521221,-0.2991 0.724607,-1.0475 0.426614,-1.571 -0.297992,-0.5234 -1.043503,-0.7275 -1.565078,-0.4284 -16.772953,9.6153 -39.67122,5.6292 -51.327282,-12.1037 1.894251,-1.3812 3.130157,-3.6195 3.130157,-6.1411 0,-4.1771 -3.379252,-7.5693 -7.540866,-7.5693 z" fill-rule="evenodd"/>
                    <path d="m 70.417244,970.57299 c -0.951023,0.12132 -1.237323,1.69026 -0.391181,2.14225 13.429842,8.21899 20.928543,24.30182 17.64248,40.55986 -0.392953,-0.067 -0.80185,-0.107 -1.209331,-0.107 -4.161259,0 -7.540866,3.3922 -7.540866,7.5692 0,4.1771 3.379607,7.605 7.540866,7.605 4.16126,0 7.540866,-3.4279 7.540866,-7.605 0,-2.9516 -1.686968,-5.51 -4.161614,-6.748 3.607441,-17.29107 -4.331338,-34.48188 -18.638503,-43.23773 -0.189921,-0.12122 -0.415984,-0.18423 -0.64063,-0.17852 -0.04784,-0.003 -0.09425,-0.003 -0.142087,0 z" fill-rule="evenodd"/>
                    <path d="m 50.000001,958.36218 c -4.012441,0 -7.27441,3.16987 -7.505079,7.14083 -17.197086,3.19362 -29.727637,16.85266 -32.5821254,33.06201 a 1.1383515,1.1426463 0 1 0 2.2407874,0.39275 c 2.681221,-15.22486 14.388307,-28.07084 30.518858,-31.1697 0.826653,3.28539 3.802677,5.71266 7.327559,5.71266 4.161259,0 7.540866,-3.39219 7.540866,-7.56928 0,-4.17708 -3.379607,-7.56927 -7.540866,-7.56927 z" fill-rule="evenodd"/>
                  </g>
                </g>
                <g transform="matrix(2.781435636606215,0,0,2.781435636606215,111.83311435253162,11.314013949983305)" fill="#000">
                  <path d="M12.76 20 l-1.6 -3.72 l-7.94 0 l-1.6 3.72 l-1.56 0 l6.28 -14.58 l1.74 0 l6.3 14.58 l-1.62 0 z M10.58 14.88 l-3.4 -7.88 l-3.38 7.88 l6.78 0 z M21.24 6.86 l0 13.14 l-1.52 0 l0 -13.14 l-4.88 0 l0 -1.44 l11.28 0 l0 1.44 l-4.88 0 z M33.32 6.86 l0 13.14 l-1.52 0 l0 -13.14 l-4.88 0 l0 -1.44 l11.28 0 l0 1.44 l-4.88 0 z M54.26 12.68 c0 1.38 -0.32 2.64 -0.94 3.78 c-0.64 1.14 -1.52 2.04 -2.64 2.7 c-1.14 0.66 -2.38 1 -3.78 1 c-1.02 0 -1.98 -0.2 -2.9 -0.58 c-0.9 -0.38 -1.68 -0.9 -2.32 -1.58 c-0.64 -0.64 -1.14 -1.42 -1.52 -2.34 c-0.36 -0.92 -0.56 -1.88 -0.56 -2.9 c0 -1.38 0.32 -2.64 0.96 -3.78 c0.62 -1.14 1.5 -2.06 2.64 -2.72 c1.12 -0.66 2.38 -0.98 3.76 -0.98 c1.02 0 1.98 0.18 2.9 0.56 c0.9 0.4 1.68 0.92 2.32 1.56 c0.64 0.68 1.16 1.46 1.52 2.36 c0.38 0.92 0.56 1.88 0.56 2.92 z M52.68 12.76 c0 -1.64 -0.6 -3.16 -1.6 -4.26 s-2.5 -1.8 -4.18 -1.8 c-1.08 0 -2.06 0.28 -2.94 0.8 c-0.88 0.56 -1.56 1.28 -2.04 2.18 c-0.48 0.92 -0.72 1.92 -0.72 3 c0 1.62 0.6 3.16 1.6 4.24 c1 1.1 2.5 1.8 4.16 1.8 c1.08 0 2.06 -0.28 2.94 -0.82 c0.9 -0.52 1.58 -1.26 2.06 -2.16 s0.72 -1.9 0.72 -2.98 z M70.3 5.42 l2.2 0 l0 14.58 l-1.52 0 l0 -12.5 l0 0 l-5.42 12.5 l-1.38 0 l-5.38 -12.4 l0 0 l0 12.4 l-1.52 0 l0 -14.58 l2.18 0 l5.44 12.5 z M76.56 20 l0 -14.58 l1.54 0 l0 14.58 l-1.54 0 z M83.68 20 l-1.54 0 l0 -14.58 l1.54 0 l0 6.44 l0.1 0 l6.54 -6.44 l2.12 0 l-7.14 6.98 l7.48 7.6 l-2.16 0 l-6.84 -7.02 l-0.1 0 l0 7.02 z"/>
                </g>
              </g>
            </svg>
            </div>
          </div>
          <div style="font-size:10px;font-weight:700;color:#000000;letter-spacing:0.22em;text-transform:uppercase;margin-top:4px;"><span style="color:#00ff97">✦</span> ATTOMIK AI</div>
        </td></tr>
        <tr><td align="center" style="padding:18px 32px 8px;">
          <div style="font-size:11px;font-weight:700;color:#666666;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;">Weekly Performance</div>
          <div style="font-size:24px;font-weight:800;color:#000000;letter-spacing:-0.02em;line-height:1.2;">${orgName}</div>
          <div style="font-size:13px;color:#666666;margin-top:4px;">${rangeLabel}</div>
        </td></tr>

        <tr><td style="padding:20px 26px 4px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${kpiCell('Total Sales', kpis.revenue.value, kpis.revenue.pct)}
              ${kpiCell('Ad Spend', kpis.adSpend.value, kpis.adSpend.pct, true)}
            </tr>
            <tr>
              ${kpiCell('ROAS', kpis.roas.value, kpis.roas.pct)}
              ${kpiCell('CAC', kpis.cac.value, kpis.cac.pct, true)}
            </tr>
            <tr>
              ${kpiCell('AOV', kpis.aov.value, kpis.aov.pct)}
              ${kpiCell('Orders', kpis.orders.value, kpis.orders.pct)}
            </tr>
            <tr>
              ${kpiCell('CLTV', kpis.cltv.value, kpis.cltv.pct)}
              ${kpiCell('CLTV/CAC', kpis.cltvCac.value, kpis.cltvCac.pct)}
            </tr>
          </table>
        </td></tr>

        ${summaryBlock}

        <tr><td style="padding:16px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:12px;">
            <tr><td style="padding:14px 18px;">
              <div style="font-size:10px;font-weight:700;color:#666666;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;">Your 4-Week Averages</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${avgStat('Rev/wk', averages.revPerWeek)}
                  ${avgStat('Orders/wk', averages.ordersPerWeek)}
                  ${avgStat('AOV', averages.aov)}
                  ${avgStat('ROAS', averages.roas)}
                  ${avgStat('CAC', averages.cac)}
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:12px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:12px;">
            <tr>
              <td style="padding:16px 18px;">
                <div style="font-size:11px;font-weight:700;color:#666666;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Best Day</div>
                <div style="font-size:16px;font-weight:700;color:#000000;">${bestDay.name}</div>
              </td>
              <td align="right" style="padding:16px 18px;">
                <div style="font-size:20px;font-weight:800;color:#000000;letter-spacing:-0.02em;">${bestDay.revenue}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        ${(() => {
          const parts: string[] = []
          if (channel.shopifyPct > 0) parts.push(`<strong style="color:#000000;">Shopify</strong> ${channel.shopify} <span style="color:#666666;">(${channel.shopifyPct.toFixed(0)}%)</span>`)
          if (channel.amazonPct  > 0) parts.push(`<strong style="color:#000000;">Amazon</strong> ${channel.amazon} <span style="color:#666666;">(${channel.amazonPct.toFixed(0)}%)</span>`)
          if (channel.walmartPct > 0) parts.push(`<strong style="color:#000000;">Walmart</strong> ${channel.walmart} <span style="color:#666666;">(${channel.walmartPct.toFixed(0)}%)</span>`)
          if (parts.length < 2) return ''
          const sep = `<span style="color:#cccccc;margin:0 8px;">·</span>`
          return `
        <tr><td style="padding:12px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-size:11px;font-weight:700;color:#666666;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">Channel Split</div>
              <div style="font-size:14px;color:#333333;line-height:1.6;">
                ${parts.join(sep)}
              </div>
            </td></tr>
          </table>
        </td></tr>`
        })()}

        <tr><td align="center" style="padding:28px 32px 32px;">
          <a href="${dashboardUrl}" style="display:inline-block;background:#000000;color:#00ff97;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:999px;letter-spacing:0.02em;">View Dashboard →</a>
        </td></tr>

        <tr><td style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #e0e0e0;">
          <div style="font-size:11px;color:#666666;text-align:center;line-height:1.6;">
            Generated by <a href="https://attomik.co" style="color:#666666;text-decoration:none;font-weight:600;">Attomik AI</a>
            <span style="color:#cccccc;margin:0 6px;">·</span>
            <a href="{{UNSUB_URL}}" style="color:#666666;text-decoration:none;">Unsubscribe</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function getRecipients(sb: any, orgId: string): Promise<string[]> {
  const { data: memberships } = await sb.from('org_memberships').select('user_id').eq('org_id', orgId)
  const userIds: string[] = (memberships ?? []).map((m: any) => m.user_id)
  if (userIds.length === 0) return []
  const byId = await getAuthEmailsByIds(sb, userIds)
  return userIds.map(id => byId.get(id)).filter((e: any): e is string => !!e)
}

export async function POST(request: Request) {
  try {
    const user_sb = createClient()
    const { data: { user } } = await user_sb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { org_id } = await request.json()
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const sb = createServiceClient()

    const { data: org, error: orgError } = await sb.from('organizations')
      .select('id, name, slug, timezone').eq('id', org_id).maybeSingle()
    if (orgError) return NextResponse.json({ error: `Org lookup failed: ${orgError.message}` }, { status: 500 })
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })
    const tz = (((org as any).timezone as string | null) ?? 'America/New_York')

    // Pull the unsubscribe list separately so a missing column (migration
    // not yet applied) degrades gracefully instead of failing the whole fetch.
    let unsubList: string[] = []
    const { data: unsubRow } = await sb.from('organizations')
      .select('weekly_email_unsubscribed').eq('id', org_id).maybeSingle()
    if (unsubRow && Array.isArray((unsubRow as any).weekly_email_unsubscribed)) {
      unsubList = (unsubRow as any).weekly_email_unsubscribed
    }
    const unsubscribed = new Set(unsubList.map(e => e.toLowerCase()))
    const override = process.env.WEEKLY_EMAIL_OVERRIDE?.trim()
    const memberRecipients = override ? [override] : await getRecipients(sb, org_id)
    const recipients = memberRecipients.filter(e => !unsubscribed.has(e.toLowerCase()))
    if (recipients.length === 0) return NextResponse.json({ error: 'No recipients' }, { status: 400 })

    const { lastMonKey, lastSunKey, prevMonKey, prevSunKey } = computeLastWeekBoundsTz(tz)
    const weekKeys = weekDayKeys(lastMonKey)
    // 4 weeks ending the Sunday before last week (28 days immediately prior to lastMonKey)
    const avgStartKey = shiftDayKey(lastMonKey, -28)
    const avgEndKey = shiftDayKey(lastMonKey, -1)

    const [curOrders, prevOrders, avgOrders, curSpend, prevSpend, avgSpend] = await Promise.all([
      fetchOrdersForRange(sb, org_id, lastMonKey, lastSunKey, tz),
      fetchOrdersForRange(sb, org_id, prevMonKey, prevSunKey, tz),
      fetchOrdersForRange(sb, org_id, avgStartKey, avgEndKey, tz),
      fetchAllSpend(sb, org_id, lastMonKey, lastSunKey),
      fetchAllSpend(sb, org_id, prevMonKey, prevSunKey),
      fetchAllSpend(sb, org_id, avgStartKey, avgEndKey),
    ])

    const cur = aggregate(curOrders)
    const prev = aggregate(prevOrders)
    const curAdSpend = curSpend.reduce((s, r) => s + (Number(r.spend) || 0), 0)
    const prevAdSpend = prevSpend.reduce((s, r) => s + (Number(r.spend) || 0), 0)
    const curRoas = curAdSpend > 0 ? cur.revenue / curAdSpend : 0
    const prevRoas = prevAdSpend > 0 ? prev.revenue / prevAdSpend : 0

    const curAov = cur.orders > 0 ? cur.revenue / cur.orders : 0
    const prevAov = prev.orders > 0 ? prev.revenue / prev.orders : 0
    const curCac = cur.orders > 0 ? curAdSpend / cur.orders : null
    const prevCac = prev.orders > 0 ? prevAdSpend / prev.orders : null
    const curCltv = cur.orders > 0 ? curAov * 2 : null
    const prevCltv = prev.orders > 0 ? prevAov * 2 : null
    const curCltvCac = curCac && curCac > 0 && curCltv !== null ? curCltv / curCac : null
    const prevCltvCac = prevCac && prevCac > 0 && prevCltv !== null ? prevCltv / prevCac : null
    const cltvPct = curCltv !== null && prevCltv !== null && prevCltv > 0 ? wowPct(curCltv, prevCltv) : null
    const cltvCacPct = curCltvCac !== null && prevCltvCac !== null && prevCltvCac > 0 ? wowPct(curCltvCac, prevCltvCac) : null

    const best = bestDay(curOrders, weekKeys, tz)
    const chanTotal = cur.shopify + cur.amazon + cur.walmart
    const shopifyPct = chanTotal > 0 ? (cur.shopify / chanTotal) * 100 : 0
    const amazonPct = chanTotal > 0 ? (cur.amazon / chanTotal) * 100 : 0
    const walmartPct = chanTotal > 0 ? (cur.walmart / chanTotal) * 100 : 0

    // 4-week averages for context (prior 4 complete weeks, Mon–Sun each)
    const avgAgg = aggregate(avgOrders)
    const avgAdSpendTotal = avgSpend.reduce((s, r) => s + (Number(r.spend) || 0), 0)
    const WEEKS = 4
    const avgRevPerWeek = avgAgg.revenue / WEEKS
    const avgOrdersPerWeek = avgAgg.orders / WEEKS
    const avgAov = avgAgg.orders > 0 ? avgAgg.revenue / avgAgg.orders : 0
    const avgRoas = avgAdSpendTotal > 0 ? avgAgg.revenue / avgAdSpendTotal : 0
    const avgCac = avgAgg.orders > 0 ? avgAdSpendTotal / avgAgg.orders : null

    const aiSummary = await generateAISummary({
      orgName: org.name,
      revenue: cur.revenue, orders: cur.orders, adSpend: curAdSpend, roas: curRoas, aov: curAov, cac: curCac,
      revenueWow: wowPct(cur.revenue, prev.revenue),
      ordersWow: wowPct(cur.orders, prev.orders),
      adSpendWow: wowPct(curAdSpend, prevAdSpend),
      roasWow: wowPct(curRoas, prevRoas),
      bestDay: { name: best.name, revenue: best.revenue },
      shopifyPct, amazonPct, walmartPct,
      avg: {
        revPerWeek: avgRevPerWeek,
        ordersPerWeek: avgOrdersPerWeek,
        aov: avgAov,
        roas: avgRoas,
        cac: avgCac,
      },
    })

    const orgSlug = ((org as any).slug ?? null) as string | null
    const dashboardUrl = orgSlug
      ? `https://dashboard.attomik.co/dashboard/analytics?org=${encodeURIComponent(orgSlug)}`
      : `https://dashboard.attomik.co/dashboard/analytics`

    const html = buildHtml({
      orgName: org.name,
      rangeLabel: fmtRangeKeys(lastMonKey, lastSunKey),
      aiSummary,
      dashboardUrl,
      kpis: {
        revenue: { value: fmtMoney(cur.revenue), pct: wowPct(cur.revenue, prev.revenue) },
        orders: { value: cur.orders.toLocaleString('en-US'), pct: wowPct(cur.orders, prev.orders) },
        adSpend: { value: fmtMoney(curAdSpend), pct: wowPct(curAdSpend, prevAdSpend) },
        roas: { value: `${curRoas.toFixed(2)}x`, pct: wowPct(curRoas, prevRoas) },
        aov: { value: fmtMoney(curAov), pct: wowPct(curAov, prevAov) },
        cac: {
          value: curCac === null ? '—' : fmtMoney(curCac),
          pct: curCac !== null && prevCac !== null ? wowPct(curCac, prevCac) : null,
        },
        cltv: { value: curCltv === null ? '—' : fmtMoney(curCltv), pct: cltvPct },
        cltvCac: { value: curCltvCac === null ? '—' : `${curCltvCac.toFixed(2)}x`, pct: cltvCacPct },
      },
      averages: {
        revPerWeek: fmtMoney(avgRevPerWeek),
        ordersPerWeek: Math.round(avgOrdersPerWeek).toLocaleString('en-US'),
        aov: fmtMoney(avgAov),
        roas: `${avgRoas.toFixed(2)}x`,
        cac: avgCac === null ? '—' : fmtMoney(avgCac),
      },
      bestDay: { name: best.name, revenue: fmtMoney(best.revenue) },
      channel: { shopify: fmtMoney(cur.shopify), shopifyPct, amazon: fmtMoney(cur.amazon), amazonPct, walmart: fmtMoney(cur.walmart), walmartPct },
    })

    const subject = `${org.name} — Weekly Performance · ${fmtRangeKeys(lastMonKey, lastSunKey)}`
    const sentTo: string[] = []
    const errors: string[] = []

    for (const to of recipients) {
      const unsubUrl = `https://dashboard.attomik.co/api/email/unsubscribe?org_id=${encodeURIComponent(org_id)}&email=${encodeURIComponent(to)}`
      const personalHtml = html.replaceAll('{{UNSUB_URL}}', unsubUrl)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Attomik <hello@email.attomik.co>',
          to,
          subject,
          html: personalHtml,
        }),
      })
      if (res.ok) sentTo.push(to)
      else errors.push(`${to}: ${await res.text()}`)
    }

    if (sentTo.length === 0) {
      return NextResponse.json({ error: `All sends failed: ${errors[0] ?? 'unknown'}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sentTo,
      failed: errors.length ? errors : undefined,
      range: { start: lastMonKey, end: lastSunKey },
    })
  } catch (err: any) {
    console.error('Weekly email error:', err)
    return NextResponse.json({ error: err.message ?? 'Send failed' }, { status: 500 })
  }
}
