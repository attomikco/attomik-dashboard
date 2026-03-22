import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { domain, token, client_id, client_secret } = await request.json()
    if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    let accessToken = token

    // If client credentials provided, exchange for token first
    if (client_id && client_secret) {
      const tokenRes = await fetch(`https://${cleanDomain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          client_id,
          client_secret,
          grant_type: 'client_credentials',
        }).toString(),
      })

      if (!tokenRes.ok) {
        return NextResponse.json({ error: 'Could not authenticate with Shopify. Check your Client ID and Secret.' }, { status: 400 })
      }

      const tokenData = await tokenRes.json()
      accessToken = tokenData.access_token
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'token or client_id+client_secret required' }, { status: 400 })
    }

    // Test the token by fetching shop info
    const res = await fetch(`https://${cleanDomain}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Shopify returned ${res.status}. Check your credentials.` }, { status: 400 })
    }

    const { shop } = await res.json()
    return NextResponse.json({ ok: true, shop_name: shop.name, shop_email: shop.email })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
