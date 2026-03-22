import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const shop = searchParams.get('shop')
  const hmac = searchParams.get('hmac')

  if (!code || !state || !shop) {
    return NextResponse.redirect(`${SITE_URL}/dashboard/settings?shopify_error=missing_params`)
  }

  // Verify state matches cookie
  const cookieHeader = request.headers.get('cookie') ?? ''
  const cookieState = cookieHeader.match(/shopify_oauth_state=([^;]+)/)?.[1]

  if (!cookieState || decodeURIComponent(cookieState) !== state) {
    return NextResponse.redirect(`${SITE_URL}/dashboard/settings?shopify_error=invalid_state`)
  }

  // Decode state to get orgId
  let orgId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
    orgId = decoded.orgId
  } catch {
    return NextResponse.redirect(`${SITE_URL}/dashboard/settings?shopify_error=invalid_state`)
  }

  // Exchange code for access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${SITE_URL}/dashboard/settings?shopify_error=token_exchange_failed`)
  }

  const { access_token } = await tokenRes.json()

  // Get shop name
  const shopRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
    headers: { 'X-Shopify-Access-Token': access_token },
  })
  const { shop: shopData } = await shopRes.json()

  // Save to organizations table
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('organizations')
    .update({
      shopify_domain: shop,
      shopify_token: access_token,
    })
    .eq('id', orgId)

  if (error) {
    return NextResponse.redirect(`${SITE_URL}/dashboard/settings?shopify_error=save_failed`)
  }

  // Clear the state cookie and redirect to settings with success
  const response = NextResponse.redirect(
    `${SITE_URL}/dashboard/settings?shopify_success=${encodeURIComponent(shopData?.name ?? shop)}`
  )
  response.cookies.delete('shopify_oauth_state')
  return response
}
