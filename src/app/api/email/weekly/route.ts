import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Order = { total_price: number | string; source: string | null; created_at: string }
type Spend = { spend: number | string; date: string }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtRange = (start: Date, end: Date) => {
  const s = `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`
  const e = `${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}, ${end.getUTCFullYear()}`
  return `${s} – ${e}`
}

function computeLastWeekBounds(now = new Date()) {
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = base.getUTCDay()
  const daysSinceMonday = (dow + 6) % 7
  const thisMon = new Date(base)
  thisMon.setUTCDate(base.getUTCDate() - daysSinceMonday)
  const lastMon = new Date(thisMon)
  lastMon.setUTCDate(thisMon.getUTCDate() - 7)
  const lastSun = new Date(thisMon)
  lastSun.setUTCDate(thisMon.getUTCDate() - 1)
  const prevMon = new Date(lastMon)
  prevMon.setUTCDate(lastMon.getUTCDate() - 7)
  const prevSun = new Date(lastMon)
  prevSun.setUTCDate(lastMon.getUTCDate() - 1)
  return { lastMon, lastSun, thisMon, prevMon, prevSun }
}

async function fetchAllOrders(sb: any, orgId: string, gteISO: string, ltISO: string) {
  const size = 1000
  let from = 0
  const all: Order[] = []
  while (true) {
    const { data } = await sb.from('orders')
      .select('total_price, source, created_at')
      .eq('org_id', orgId)
      .gte('created_at', gteISO)
      .lt('created_at', ltISO)
      .order('created_at', { ascending: true })
      .range(from, from + size - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < size) break
    from += size
  }
  return all
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

const toDateOnly = (d: Date) => d.toISOString().slice(0, 10)

function aggregate(orders: Order[]) {
  let revenue = 0
  let shopify = 0
  let amazon = 0
  for (const o of orders) {
    const v = Number(o.total_price) || 0
    revenue += v
    if (o.source === 'amazon') amazon += v
    else shopify += v
  }
  return { revenue, orders: orders.length, shopify, amazon }
}

function bestDay(orders: Order[], weekStart: Date) {
  const buckets: number[] = Array(7).fill(0)
  const startMs = weekStart.getTime()
  for (const o of orders) {
    const t = new Date(o.created_at).getTime()
    const idx = Math.floor((t - startMs) / 86400000)
    if (idx >= 0 && idx < 7) buckets[idx] += Number(o.total_price) || 0
  }
  let maxIdx = 0
  for (let i = 1; i < 7; i++) if (buckets[i] > buckets[maxIdx]) maxIdx = i
  const dayDate = new Date(weekStart)
  dayDate.setUTCDate(weekStart.getUTCDate() + maxIdx)
  return { name: DAYS_LONG[dayDate.getUTCDay()], revenue: buckets[maxIdx] }
}

function wowPct(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? 0 : null
  return ((cur - prev) / prev) * 100
}

function changeBadge(pct: number | null) {
  if (pct === null) return `<span style="font-size:11px;font-weight:600;color:#666666;">—</span>`
  const up = pct >= 0
  const bg = up ? '#00ff97' : '#fee2e2'
  const color = up ? '#003d1f' : '#dc2626'
  const arrow = up ? '▲' : '▼'
  const val = Math.abs(pct).toFixed(1)
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${bg};color:${color};font-size:11px;font-weight:700;letter-spacing:0.02em;">${arrow} ${val}%</span>`
}

function kpiCell(label: string, value: string, pct: number | null | undefined, width: '50%' | '33.33%' = '50%') {
  const badge = pct === undefined
    ? `<span style="display:inline-block;font-size:11px;font-weight:600;color:#999999;">&nbsp;</span>`
    : changeBadge(pct)
  const valueSize = width === '33.33%' ? '20px' : '26px'
  return `
    <td width="${width}" valign="top" style="padding:6px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:12px;">
        <tr><td style="padding:16px 16px 14px;">
          <div style="font-size:11px;font-weight:700;color:#666666;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">${label}</div>
          <div style="font-size:${valueSize};font-weight:800;color:#000000;letter-spacing:-0.02em;line-height:1.1;margin-bottom:8px;">${value}</div>
          ${badge}
        </td></tr>
      </table>
    </td>`
}

type Kpi = { value: string; pct: number | null }
type KpiNoWow = { value: string }

async function generateAISummary(ctx: {
  orgName: string
  revenue: number; orders: number; adSpend: number; roas: number; aov: number; cac: number | null
  revenueWow: number | null; ordersWow: number | null; adSpendWow: number | null; roasWow: number | null
  bestDay: { name: string; revenue: number }
  shopifyPct: number; amazonPct: number
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return ''
  const pct = (n: number | null) => n === null ? 'N/A' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
  const cacStr = ctx.cac === null ? 'N/A' : `$${ctx.cac.toFixed(0)}`
  const prompt = `Write a 2-3 sentence weekly performance summary for ${ctx.orgName}. Be specific with numbers, founder-friendly tone, no fluff, no advice. Just what happened.

Data:
- Revenue: $${ctx.revenue.toFixed(0)} (${pct(ctx.revenueWow)} vs last week)
- Orders: ${ctx.orders} (${pct(ctx.ordersWow)} vs last week)
- Ad Spend: $${ctx.adSpend.toFixed(0)} (${pct(ctx.adSpendWow)} vs last week)
- ROAS: ${ctx.roas.toFixed(2)}x (${pct(ctx.roasWow)} vs last week)
- AOV: $${ctx.aov.toFixed(0)}
- CAC: ${cacStr}
- Best day: ${ctx.bestDay.name} at $${ctx.bestDay.revenue.toFixed(0)}
- Shopify: ${ctx.shopifyPct.toFixed(0)}% of revenue, Amazon: ${ctx.amazonPct.toFixed(0)}%`

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
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return (data.content?.[0]?.text ?? '').trim()
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
  kpis: {
    revenue: Kpi; orders: Kpi; adSpend: Kpi; roas: Kpi
    aov: Kpi; cac: Kpi; cltvCac: KpiNoWow
  }
  bestDay: { name: string; revenue: string }
  channel: { shopify: string; shopifyPct: number; amazon: string; amazonPct: number }
}) {
  const { orgName, rangeLabel, aiSummary, kpis, bestDay, channel } = opts
  const summaryBlock = aiSummary
    ? `<tr><td style="padding:16px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;border:1px solid #e0e0e0;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-size:10px;font-weight:700;color:#00ff97;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;">✦ Attomik AI</div>
              <div style="font-size:14px;color:#333333;line-height:1.6;">${escapeHtml(aiSummary)}</div>
            </td></tr>
          </table>
        </td></tr>`
    : ''
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${orgName} — Weekly Performance</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#333333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e0e0e0;">
        <tr><td style="background:#00ff97;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td align="center" style="padding:32px 32px 0;">
          <img src="https://static.wixstatic.com/media/87635f_7c6f600cb41c4dd4a4446bed800e0657~mv2.png/v1/fill/w_980,h_282,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Color%20logo%20-%20no%20background.png"
               alt="Attomik" width="120" style="display:block;width:120px;height:auto;border:0;outline:none;text-decoration:none;" />
          <div style="font-size:10px;font-weight:700;color:#00ff97;letter-spacing:0.22em;text-transform:uppercase;margin-top:10px;">Attomik AI</div>
        </td></tr>
        <tr><td align="center" style="padding:18px 32px 8px;">
          <div style="font-size:11px;font-weight:700;color:#666666;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;">Weekly Performance</div>
          <div style="font-size:24px;font-weight:800;color:#000000;letter-spacing:-0.02em;line-height:1.2;">${orgName}</div>
          <div style="font-size:13px;color:#666666;margin-top:4px;">${rangeLabel}</div>
        </td></tr>

        <tr><td style="padding:20px 26px 4px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${kpiCell('Revenue', kpis.revenue.value, kpis.revenue.pct)}
              ${kpiCell('Orders', kpis.orders.value, kpis.orders.pct)}
            </tr>
            <tr>
              ${kpiCell('Ad Spend', kpis.adSpend.value, kpis.adSpend.pct)}
              ${kpiCell('ROAS', kpis.roas.value, kpis.roas.pct)}
            </tr>
            <tr>
              ${kpiCell('AOV', kpis.aov.value, kpis.aov.pct, '33.33%')}
              ${kpiCell('CAC', kpis.cac.value, kpis.cac.pct, '33.33%')}
              ${kpiCell('CLTV/CAC', kpis.cltvCac.value, undefined, '33.33%')}
            </tr>
          </table>
        </td></tr>

        ${summaryBlock}

        <tr><td style="padding:16px 32px 0;">
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

        <tr><td style="padding:12px 32px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-size:11px;font-weight:700;color:#666666;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">Channel Split</div>
              <div style="font-size:14px;color:#333333;line-height:1.6;">
                <strong style="color:#000000;">Shopify</strong> ${channel.shopify} <span style="color:#666666;">(${channel.shopifyPct.toFixed(0)}%)</span>
                <span style="color:#cccccc;margin:0 8px;">·</span>
                <strong style="color:#000000;">Amazon</strong> ${channel.amazon} <span style="color:#666666;">(${channel.amazonPct.toFixed(0)}%)</span>
              </div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:28px 32px 32px;">
          <a href="https://dashboard.attomik.co" style="display:inline-block;background:#000000;color:#00ff97;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:999px;letter-spacing:0.02em;">View Dashboard →</a>
        </td></tr>

        <tr><td style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #e0e0e0;">
          <div style="font-size:11px;color:#666666;text-align:center;line-height:1.6;">
            Generated by <a href="https://attomik.co" style="color:#666666;text-decoration:none;font-weight:600;">Attomik AI</a>
            <span style="color:#cccccc;margin:0 6px;">·</span>
            <a href="https://dashboard.attomik.co/dashboard/settings" style="color:#666666;text-decoration:none;">Unsubscribe</a>
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
  const { data: { users } } = await sb.auth.admin.listUsers()
  const byId = new Map((users ?? []).map((u: any) => [u.id, u.email]))
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

    const { data: org } = await sb.from('organizations').select('id, name, weekly_email_enabled').eq('id', org_id).single()
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

    const override = process.env.WEEKLY_EMAIL_OVERRIDE?.trim()
    const recipients = override ? [override] : await getRecipients(sb, org_id)
    if (recipients.length === 0) return NextResponse.json({ error: 'No recipients' }, { status: 400 })

    const { lastMon, lastSun, thisMon, prevMon, prevSun } = computeLastWeekBounds()
    const lastMonISO = lastMon.toISOString()
    const thisMonISO = thisMon.toISOString()
    const prevMonISO = prevMon.toISOString()
    const prevSunNextISO = new Date(prevSun.getTime() + 86400000).toISOString() // exclusive upper

    const [curOrders, prevOrders, curSpend, prevSpend] = await Promise.all([
      fetchAllOrders(sb, org_id, lastMonISO, thisMonISO),
      fetchAllOrders(sb, org_id, prevMonISO, prevSunNextISO),
      fetchAllSpend(sb, org_id, toDateOnly(lastMon), toDateOnly(lastSun)),
      fetchAllSpend(sb, org_id, toDateOnly(prevMon), toDateOnly(prevSun)),
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
    const curCltvCac = curCac && curCac > 0 ? (curAov * 2) / curCac : null

    const best = bestDay(curOrders, lastMon)
    const chanTotal = cur.shopify + cur.amazon
    const shopifyPct = chanTotal > 0 ? (cur.shopify / chanTotal) * 100 : 0
    const amazonPct = chanTotal > 0 ? (cur.amazon / chanTotal) * 100 : 0

    const aiSummary = await generateAISummary({
      orgName: org.name,
      revenue: cur.revenue, orders: cur.orders, adSpend: curAdSpend, roas: curRoas, aov: curAov, cac: curCac,
      revenueWow: wowPct(cur.revenue, prev.revenue),
      ordersWow: wowPct(cur.orders, prev.orders),
      adSpendWow: wowPct(curAdSpend, prevAdSpend),
      roasWow: wowPct(curRoas, prevRoas),
      bestDay: { name: best.name, revenue: best.revenue },
      shopifyPct, amazonPct,
    })

    const html = buildHtml({
      orgName: org.name,
      rangeLabel: `Weekly Performance · ${fmtRange(lastMon, lastSun)}`,
      aiSummary,
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
        cltvCac: { value: curCltvCac === null ? '—' : `${curCltvCac.toFixed(2)}x` },
      },
      bestDay: { name: best.name, revenue: fmtMoney(best.revenue) },
      channel: { shopify: fmtMoney(cur.shopify), shopifyPct, amazon: fmtMoney(cur.amazon), amazonPct },
    })

    const subject = `${org.name} — Weekly Performance · ${fmtRange(lastMon, lastSun)}`
    const sentTo: string[] = []
    const errors: string[] = []

    for (const to of recipients) {
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
          html,
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
      range: { start: toDateOnly(lastMon), end: toDateOnly(lastSun) },
    })
  } catch (err: any) {
    console.error('Weekly email error:', err)
    return NextResponse.json({ error: err.message ?? 'Send failed' }, { status: 500 })
  }
}
