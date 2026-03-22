import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { domain, token } = await request.json()
    if (!domain || !token) return NextResponse.json({ error: 'domain and token required' }, { status: 400 })

    const res = await fetch(`https://${domain}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': token },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Shopify returned ${res.status}. Check your domain and token.` }, { status: 400 })
    }

    const { shop } = await res.json()
    return NextResponse.json({ ok: true, shop_name: shop.name, shop_email: shop.email })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
