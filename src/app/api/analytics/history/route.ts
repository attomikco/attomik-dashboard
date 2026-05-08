import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
}

const HISTORY_START_ISO = '2020-01-01T00:00:00.000Z'
const HISTORY_START_DATE = '2020-01-01'
const PAGE_SIZE = 1000
const EMAIL_CHUNK_SIZE = 120

type CustomerRevenue = { email: string; revenue: number }

type OrderLite = {
  created_at: string
  source: string | null
  units?: number | string | null
  total_price?: number | string | null
  customer_email?: string | null
  is_subscription?: boolean | null
}

type SpendLite = {
  date: string
  spend: number | string | null
}

function uniq(values: unknown[]) {
  return Array.from(new Set(
    values
      .map(v => typeof v === 'string' ? v : '')
      .map(v => v.trim())
      .filter(Boolean)
  ))
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function monthKeyInTz(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(iso))
  const byType = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]))
  return `${byType.year}-${byType.month}`
}

function datePartsInTz(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const byType = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]))
  return {
    year: Number(byType.year),
    monthIndex: Number(byType.month) - 1,
    day: Number(byType.day),
  }
}

function monthLabel(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
}

function monthWindows(nowIso: string, timeZone: string) {
  const base = datePartsInTz(nowIso, timeZone)
  const windows: { label: string; startISO: string; endISO: string; year: number; monthIndex: number }[] = []
  for (let m = 5; m >= 0; m--) {
    const dt = new Date(Date.UTC(base.year, base.monthIndex, base.day))
    dt.setUTCMonth(dt.getUTCMonth() - m)
    const year = dt.getUTCFullYear()
    const monthIndex = dt.getUTCMonth()
    const startISO = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01T00:00:00.000Z`
    const endISO = monthIndex === 11
      ? `${year + 1}-01-01T00:00:00.000Z`
      : `${year}-${String(monthIndex + 2).padStart(2, '0')}-01T00:00:00.000Z`
    windows.push({ label: monthLabel(year, monthIndex), startISO, endISO, year, monthIndex })
  }
  return windows
}

function formatCacData(rows: any[]) {
  return rows
    .map(row => {
      const key = String(row.key ?? row.month_key ?? '')
      const [year, month] = key.split('-').map(Number)
      const orders = Number(row.orders) || 0
      const spend = Number(row.spend) || 0
      return {
        period: Number.isFinite(year) && Number.isFinite(month)
          ? new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          : key,
        cac: orders > 0 ? spend / orders : 0,
        orders,
        spend,
      }
    })
    .filter(row => row.spend > 0)
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

async function fetchPaged<T>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  let from = 0
  const rows: T[] = []
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function assertOrgAccess(orgId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Unauthorized' }

  const service = createServiceClient()
  const [profileRes, membershipRes] = await Promise.all([
    service.from('profiles').select('is_superadmin, org_id').eq('id', user.id).maybeSingle(),
    service.from('org_memberships').select('id').eq('user_id', user.id).eq('org_id', orgId).limit(1),
  ])

  const profile = profileRes.data as any
  if (profile?.is_superadmin || profile?.org_id === orgId || (membershipRes.data?.length ?? 0) > 0) {
    return { ok: true as const, service }
  }

  return { ok: false as const, status: 403, error: 'Forbidden' }
}

async function fetchPriorEmailHits(service: any, orgId: string, cutoffISO: string, emails: string[], source?: string) {
  const cleanEmails = uniq(emails)
  const hits = new Set<string>()
  if (cleanEmails.length === 0) return hits

  for (const emailChunk of chunk(cleanEmails, EMAIL_CHUNK_SIZE)) {
    const rows = await fetchPaged<{ customer_email: string | null }>((from, to) => {
      let query = service
        .from('orders')
        .select('customer_email')
        .eq('org_id', orgId)
        .lt('created_at', cutoffISO)
        .in('customer_email', emailChunk)
        .order('created_at', { ascending: true })
      if (source) query = query.eq('source', source)
      return query.range(from, to)
    })
    for (const row of rows) {
      if (row.customer_email) hits.add(row.customer_email)
    }
  }

  return hits
}

async function fetchOrders(service: any, orgId: string, cols: string, gteISO: string, lteISO: string) {
  const startedAt = performance.now()
  const rows = await fetchPaged<OrderLite>((from, to) =>
    service
      .from('orders')
      .select(cols)
      .eq('org_id', orgId)
      .gte('created_at', gteISO)
      .lte('created_at', lteISO)
      .order('created_at', { ascending: true })
      .range(from, to)
  )
  console.log(JSON.stringify({ kind: 'timing', label: 'fetchAllOrders.complete', org_id: orgId, rows: rows.length, pages: Math.ceil(rows.length / PAGE_SIZE), gte: gteISO, lte: lteISO, ms: Math.round(performance.now() - startedAt) }))
  return rows
}

async function fetchSpend(service: any, orgId: string, cols: string, gteDate: string, lteDate: string) {
  const startedAt = performance.now()
  const rows = await fetchPaged<SpendLite>((from, to) =>
    service
      .from('ad_spend')
      .select(cols)
      .eq('org_id', orgId)
      .gte('date', gteDate)
      .lte('date', lteDate)
      .order('date', { ascending: true })
      .range(from, to)
  )
  console.log(JSON.stringify({ kind: 'timing', label: 'fetchAllAdSpend.complete', org_id: orgId, rows: rows.length, pages: Math.ceil(rows.length / PAGE_SIZE), gte: gteDate, lte: lteDate, ms: Math.round(performance.now() - startedAt) }))
  return rows
}

export async function POST(request: Request) {
  try {
    const startedAt = Date.now()
    const body = await request.json()
    const {
      org_id,
      thisStart,
      prevStart,
      rangeEnd,
      nowIso,
      clientTimezone,
      currentCustomerRevenue,
      previousCustomerEmails,
      shopifyCurrentEmails,
      shopifyPreviousEmails,
    } = body as {
      org_id?: string
      thisStart?: string
      prevStart?: string
      rangeEnd?: string
      nowIso?: string
      clientTimezone?: string
      currentCustomerRevenue?: CustomerRevenue[]
      previousCustomerEmails?: string[]
      shopifyCurrentEmails?: string[]
      shopifyPreviousEmails?: string[]
    }

    if (!org_id || !thisStart || !prevStart || !rangeEnd) {
      return NextResponse.json({ error: 'org_id, thisStart, prevStart, and rangeEnd are required' }, { status: 400 })
    }

    const access = await assertOrgAccess(org_id)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const service = access.service

    const currentRevenueRows = (currentCustomerRevenue ?? [])
      .filter(row => row?.email)
      .map(row => ({ email: String(row.email), revenue: Number(row.revenue) || 0 }))
    const currentEmails = uniq(currentRevenueRows.map(row => row.email))
    const previousEmails = uniq(previousCustomerEmails ?? [])
    const shopCurrentEmails = uniq(shopifyCurrentEmails ?? [])
    const shopPreviousEmails = uniq(shopifyPreviousEmails ?? [])
    const now = nowIso || new Date().toISOString()
    const tz = clientTimezone || 'UTC'

    const [
      currentPrior,
      previousPrior,
      shopCurrentPrior,
      shopPreviousPrior,
    ] = await Promise.all([
      fetchPriorEmailHits(service, org_id, thisStart, currentEmails),
      fetchPriorEmailHits(service, org_id, prevStart, previousEmails),
      fetchPriorEmailHits(service, org_id, thisStart, shopCurrentEmails, 'shopify'),
      fetchPriorEmailHits(service, org_id, prevStart, shopPreviousEmails, 'shopify'),
    ])

    const retCustC = currentEmails.filter(email => currentPrior.has(email)).length
    const retCustP = previousEmails.filter(email => previousPrior.has(email)).length
    const newCustC = currentEmails.length - retCustC
    const newCustP = previousEmails.length - retCustP
    const retRevC = sum(currentRevenueRows.filter(row => currentPrior.has(row.email)).map(row => row.revenue))
    const newRevC = sum(currentRevenueRows.filter(row => !currentPrior.has(row.email)).map(row => row.revenue))
    const shRetCustC = shopCurrentEmails.filter(email => shopCurrentPrior.has(email)).length
    const shRetCustP = shopPreviousEmails.filter(email => shopPreviousPrior.has(email)).length

    let cacData: { period: string; cac: number; orders: number; spend: number }[] = []
    let cacDebug = { usedRpc: false, orders: 0, spend: 0 }
    const cacRpc = await service.rpc('analytics_cac_trend_v1', {
      p_org_id: org_id,
      p_range_end: rangeEnd,
      p_tz: tz,
    })

    if (!cacRpc.error && Array.isArray(cacRpc.data)) {
      cacData = formatCacData(cacRpc.data)
      cacDebug = { usedRpc: true, orders: 0, spend: 0 }
    } else {
      if (cacRpc.error) console.warn('[analytics/history] CAC RPC unavailable, using paged fallback:', cacRpc.error.message)
      const rangeEndISO = `${rangeEnd}T23:59:59.999Z`
      const rangeEndMonth = rangeEnd.slice(0, 7)
      const [cacOrders, cacSpend] = await Promise.all([
        fetchOrders(service, org_id, 'created_at,source,units', HISTORY_START_ISO, rangeEndISO),
        fetchSpend(service, org_id, 'date,spend', HISTORY_START_DATE, rangeEnd),
      ])

      const monthMap: Record<string, { spend: number; orders: number }> = {}
      for (const order of cacOrders) {
        const key = monthKeyInTz(order.created_at, tz)
        if (!monthMap[key]) monthMap[key] = { spend: 0, orders: 0 }
        monthMap[key].orders += (order.source === 'amazon' || order.source === 'walmart') ? (Number(order.units) || 1) : 1
      }
      for (const spend of cacSpend) {
        const key = spend.date.slice(0, 7)
        if (monthMap[key]) monthMap[key].spend += Number(spend.spend) || 0
      }
      cacData = formatCacData(Object.keys(monthMap)
        .sort()
        .filter(key => key <= rangeEndMonth)
        .slice(-6)
        .map(key => ({ key, orders: monthMap[key].orders, spend: monthMap[key].spend })))
      cacDebug = { usedRpc: false, orders: cacOrders.length, spend: cacSpend.length }
    }

    const nowMs = new Date(now).getTime()
    const earliestWeekStart = new Date(nowMs - 8 * 7 * 864e5)
    const weeklyOrders = await fetchOrders(
      service,
      org_id,
      'total_price,source,units,customer_email,created_at',
      earliestWeekStart.toISOString(),
      now
    )
    const weeklySpend = await fetchSpend(
      service,
      org_id,
      'date,spend',
      earliestWeekStart.toISOString().split('T')[0],
      now.split('T')[0]
    )

    const weekRevs: number[] = []
    const weekSpend: number[] = []
    const weekOrders: number[] = []
    const weekCac: number[] = []
    const weekAov: number[] = []
    const weekRoas: number[] = []
    const weekNewCusts: number[] = []
    const weekRetCusts: number[] = []
    const weekRetRate: number[] = []

    for (let w = 7; w >= 0; w--) {
      const wStart = new Date(nowMs - (w + 1) * 7 * 864e5)
      const wEnd = new Date(nowMs - w * 7 * 864e5)
      const wStartISO = wStart.toISOString()
      const wEndISO = wEnd.toISOString()
      const wStartDate = wStartISO.split('T')[0]
      const wEndDate = wEndISO.split('T')[0]

      const wOrds = weeklyOrders.filter(o => o.created_at >= wStartISO && o.created_at < wEndISO)
      const wRev = wOrds.reduce((total, order) => total + Number(order.total_price || 0), 0)
      const wOrdCount = wOrds.reduce((total, order) =>
        total + ((order.source === 'amazon' || order.source === 'walmart') ? (Number(order.units) || 1) : 1), 0)
      const wSpendRows = weeklySpend.filter(row => row.date >= wStartDate && row.date < wEndDate)
      const spend = wSpendRows.reduce((total, row) => total + Number(row.spend || 0), 0)
      const wCustomers = uniq(wOrds.map(o => o.customer_email))
      const wPrior = await fetchPriorEmailHits(service, org_id, wStartISO, wCustomers)
      const ret = wCustomers.filter(email => wPrior.has(email)).length
      const fresh = wCustomers.length - ret

      weekRevs.push(wRev)
      weekSpend.push(spend)
      weekOrders.push(wOrdCount)
      weekCac.push(wOrdCount > 0 && spend > 0 ? spend / wOrdCount : 0)
      weekAov.push(wOrdCount > 0 ? wRev / wOrdCount : 0)
      weekRoas.push(spend > 0 ? wRev / spend : 0)
      weekNewCusts.push(fresh)
      weekRetCusts.push(ret)
      weekRetRate.push(wCustomers.length > 0 ? (ret / wCustomers.length) * 100 : 0)
    }

    const months = monthWindows(now, tz)
    const firstMonthStart = months[0]?.startISO ?? now
    const monthlyOrders = await fetchOrders(
      service,
      org_id,
      'total_price,source,customer_email,created_at,is_subscription',
      firstMonthStart,
      now
    )

    const monthlyRetention = []
    const monthlySubscribers = []
    for (const month of months) {
      const monthOrders = monthlyOrders.filter(o => o.created_at >= month.startISO && o.created_at < month.endISO)
      const monthCustomers = uniq(monthOrders.map(o => o.customer_email))
      const monthPrior = await fetchPriorEmailHits(service, org_id, month.startISO, monthCustomers)
      const returning = monthCustomers.filter(email => monthPrior.has(email)).length
      const fresh = monthCustomers.length - returning

      monthlyRetention.push({
        month: month.label,
        total: monthCustomers.length,
        returning,
        new: fresh,
        retRate: monthCustomers.length > 0 ? (returning / monthCustomers.length) * 100 : 0,
      })

      const subOrders = monthOrders.filter(o => o.source === 'shopify' && o.is_subscription)
      const subscribers = uniq(subOrders.map(o => o.customer_email)).length
      const revenue = subOrders.reduce((total, order) => total + Number(order.total_price || 0), 0)
      const allRevenue = monthOrders.reduce((total, order) => total + Number(order.total_price || 0), 0)
      monthlySubscribers.push({
        month: month.label,
        subscribers,
        revenue,
        pctOfRev: allRevenue > 0 ? (revenue / allRevenue) * 100 : 0,
      })
    }

    return NextResponse.json({
      retCustC,
      newCustC,
      totalCustC: currentEmails.length,
      retCustP,
      newCustP,
      retRevC,
      newRevC,
      shRetCustC,
      shRetCustP,
      shRcrC: shopCurrentEmails.length > 0 ? (shRetCustC / shopCurrentEmails.length) * 100 : 0,
      shRcrP: shopPreviousEmails.length > 0 ? (shRetCustP / shopPreviousEmails.length) * 100 : 0,
      cacData,
      weekRevs,
      weekSpend,
      weekOrders,
      weekCac,
      weekAov,
      weekRoas,
      weekNewCusts,
      weekRetCusts,
      weekRetRate,
      monthlyRetention,
      monthlySubscribers,
      debug: {
        durationMs: Date.now() - startedAt,
        rows: {
          cacOrders: cacDebug.orders,
          cacSpend: cacDebug.spend,
          cacUsedRpc: cacDebug.usedRpc,
          weeklyOrders: weeklyOrders.length,
          weeklySpend: weeklySpend.length,
          monthlyOrders: monthlyOrders.length,
        },
      },
    }, { headers: NO_CACHE })
  } catch (err: any) {
    console.error('[analytics/history] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500, headers: NO_CACHE })
  }
}
