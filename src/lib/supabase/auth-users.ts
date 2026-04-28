// Lightweight helpers for looking up auth user emails without paging the entire
// auth.users table via `auth.admin.listUsers()`. The service role can read the
// `auth` schema directly, which is O(matches) instead of O(all users).

type ServiceClient = ReturnType<typeof import('@/lib/supabase/server').createServiceClient>

type AuthUserRow = {
  id: string
  email: string | null
  last_sign_in_at: string | null
}

export async function getAuthUserById(sb: ServiceClient, id: string): Promise<AuthUserRow | null> {
  const { data } = await (sb as any)
    .schema('auth')
    .from('users')
    .select('id, email, last_sign_in_at')
    .eq('id', id)
    .maybeSingle()
  return (data as AuthUserRow | null) ?? null
}

export async function getAuthUserByEmail(sb: ServiceClient, email: string): Promise<AuthUserRow | null> {
  const { data } = await (sb as any)
    .schema('auth')
    .from('users')
    .select('id, email, last_sign_in_at')
    .eq('email', email)
    .maybeSingle()
  return (data as AuthUserRow | null) ?? null
}

export async function getAuthEmailsByIds(sb: ServiceClient, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const { data } = await (sb as any)
    .schema('auth')
    .from('users')
    .select('id, email')
    .in('id', ids)
  return new Map((data ?? []).map((u: any) => [u.id as string, u.email as string]))
}
