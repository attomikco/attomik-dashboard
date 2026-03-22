import { NextResponse } from 'next/server'

const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!
const SCOPES = 'read_orders,read_customers,read_products'
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL}/api/shopify/callback`

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const shop = searchParams.get('shop')
  const orgId = searchParams.get('org_id')

  if (!shop || !orgId) {
    return NextResponse.json({ error: 'shop and org_id are required' }, { status: 400 })
  }

  // Clean shop domain
  const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '')

  // Generate a random nonce for security
  const nonce = crypto.randomUUID()

  // Store nonce + orgId in a cookie so we can verify on callback
  const state = Buffer.from(JSON.stringify({ nonce, orgId, shop: cleanShop })).toString('base64')

  const authUrl = `https://${cleanShop}/admin/oauth/authorize?` + new URLSearchParams({
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
  })

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
  })

  return response
}
