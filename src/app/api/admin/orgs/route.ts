import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireSuperadmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const { data: profile } = await supabase
    .from('profiles').select('is_superadmin').eq('id', user.id).single()
  if (!(profile as any)?.is_superadmin) return { error: 'Forbidden', status: 403 as const }
  return { user }
}

export async function GET() {
  const check = await requireSuperadmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const serviceClient = createServiceClient()

  const { data: orgs, error } = await serviceClient
    .from('organizations')
    .select('id, name, slug, timezone, created_at, shopify_domain, shopify_token, shopify_client_id, meta_ad_account_id, meta_access_token')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: memberships } = await serviceClient
    .from('org_memberships')
    .select('org_id')

  const counts: Record<string, number> = {}
  for (const m of memberships ?? []) {
    counts[(m as any).org_id] = (counts[(m as any).org_id] ?? 0) + 1
  }

  const rows = (orgs ?? []).map((o: any) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    timezone: o.timezone,
    created_at: o.created_at,
    user_count: counts[o.id] ?? 0,
    shopify_connected: !!(o.shopify_domain && (o.shopify_token || o.shopify_client_id)),
    meta_connected: !!(o.meta_ad_account_id && o.meta_access_token),
  }))

  return NextResponse.json({ orgs: rows })
}

export async function POST(request: Request) {
  const check = await requireSuperadmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { name, slug, timezone } = await request.json()
  if (!name || !slug) return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })

  const cleanSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '')
  if (!cleanSlug) return NextResponse.json({ error: 'slug must contain letters or numbers' }, { status: 400 })

  const serviceClient = createServiceClient()

  const { data: existing } = await serviceClient
    .from('organizations').select('id').eq('slug', cleanSlug).maybeSingle()
  if (existing) return NextResponse.json({ error: `Slug "${cleanSlug}" is already in use` }, { status: 400 })

  const { data: org, error } = await serviceClient
    .from('organizations')
    .insert({ name: String(name).trim(), slug: cleanSlug, timezone: timezone || 'America/New_York' })
    .select('id, name, slug, timezone, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ org })
}
