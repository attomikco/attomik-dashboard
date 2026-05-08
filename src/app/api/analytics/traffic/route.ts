import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { timed } from '@/lib/timing'
import * as crypto from 'crypto'

// Create a JWT signed with RS256 using Node.js crypto
function createJWT(payload: Record<string, any>, privateKey: string): string {
  const header = { alg: 'RS256', typ: 'JWT' }
  const encodeBase64Url = (data: string) =>
    Buffer.from(data).toString('base64url')

  const headerB64 = encodeBase64Url(JSON.stringify(header))
  const payloadB64 = encodeBase64Url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(privateKey, 'base64url')

  return `${signingInput}.${signature}`
}

// Get an access token from Google using service account JWT
async function getGoogleAccessToken(): Promise<string> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured')

  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)

  const jwt = createJWT({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }, sa.private_key)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google token exchange failed: ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

export async function POST(request: Request) {
  try {
    // Auth check
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { org_id, startDate, endDate } = await request.json()
    if (!org_id || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing org_id, startDate, or endDate' }, { status: 400 })
    }

    return await timed('api.analytics.traffic.POST', async () => {

    // Look up ga_property_id
    const serviceClient = createServiceClient()
    const { data: org } = await serviceClient
      .from('organizations').select('ga_property_id').eq('id', org_id).single()

    if (!org?.ga_property_id) {
      return NextResponse.json({ error: 'No GA4 Property ID configured for this organization' }, { status: 404 })
    }

    const propertyId = org.ga_property_id
    const accessToken = await getGoogleAccessToken()

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
    const apiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`

    // Two requests: one for period-level totals (no date dimension = true unique users),
    // one for daily breakdown (for charts). Summing daily users double-counts multi-day visitors.
    const [totalsRes, dailyRes] = await Promise.all([
      fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'totalUsers' },
            { name: 'sessions' },
            { name: 'newUsers' },
          ],
        }),
      }),
      fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'totalUsers' },
            { name: 'sessions' },
            { name: 'newUsers' },
          ],
          dimensions: [{ name: 'date' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        }),
      }),
    ])

    if (!totalsRes.ok || !dailyRes.ok) {
      const errText = await (totalsRes.ok ? dailyRes : totalsRes).text()
      console.error('GA4 API error:', errText)
      return NextResponse.json({ error: 'GA4 API request failed', details: errText }, { status: 502 })
    }

    const [totalsData, dailyData] = await Promise.all([totalsRes.json(), dailyRes.json()])

    // Period-level totals (deduplicated unique users across the full date range)
    const totalsRow = totalsData.rows?.[0]
    const totalUsers = parseInt(totalsRow?.metricValues?.[0]?.value ?? '0', 10)
    const totalSessions = parseInt(totalsRow?.metricValues?.[1]?.value ?? '0', 10)
    const totalNewUsers = parseInt(totalsRow?.metricValues?.[2]?.value ?? '0', 10)

    // Daily breakdown (for charts)
    const daily: { date: string; users: number; sessions: number }[] = []
    for (const row of (dailyData.rows ?? [])) {
      const dateRaw = row.dimensionValues?.[0]?.value ?? ''
      const users = parseInt(row.metricValues?.[0]?.value ?? '0', 10)
      const sessions = parseInt(row.metricValues?.[1]?.value ?? '0', 10)

      const formattedDate = dateRaw.length === 8
        ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
        : dateRaw

      daily.push({ date: formattedDate, users, sessions })
    }

    return NextResponse.json({
      users: totalUsers,
      sessions: totalSessions,
      newUsers: totalNewUsers,
      daily,
    })
    }, { org_id, startDate, endDate })
  } catch (err: any) {
    console.error('Traffic API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
