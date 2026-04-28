// Lightweight helpers for looking up auth user emails via supported Supabase
// Admin APIs. Avoid direct PostgREST reads from auth.users; that schema is not
// exposed in a standard Supabase project.

type ServiceClient = ReturnType<typeof import('@/lib/supabase/server').createServiceClient>

type AuthUserRow = {
  id: string
  email: string | null
  last_sign_in_at: string | null
}

const LIST_PAGE_SIZE = 1000
const ID_LOOKUP_BATCH_SIZE = 10

function toAuthUserRow(user: any): AuthUserRow {
  return {
    id: user.id,
    email: user.email ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
  }
}

function isMissingUserError(error: any) {
  const msg = String(error?.message ?? '').toLowerCase()
  return error?.status === 404 || msg.includes('not found') || msg.includes('does not exist')
}

function authErrorMessage(action: string, error: any) {
  return `${action}: ${error?.message ?? 'unknown auth admin error'}`
}

export async function getAuthUserById(sb: ServiceClient, id: string): Promise<AuthUserRow | null> {
  const { data, error } = await (sb as any).auth.admin.getUserById(id)
  if (error) {
    if (isMissingUserError(error)) return null
    throw new Error(authErrorMessage('Auth user lookup failed', error))
  }
  return data?.user ? toAuthUserRow(data.user) : null
}

export async function getAuthUserByEmail(sb: ServiceClient, email: string): Promise<AuthUserRow | null> {
  const target = email.trim().toLowerCase()
  if (!target) return null

  for (let page = 1; ; page++) {
    const { data, error } = await (sb as any).auth.admin.listUsers({
      page,
      perPage: LIST_PAGE_SIZE,
    })
    if (error) throw new Error(authErrorMessage('Auth user email lookup failed', error))

    const users = data?.users ?? []
    const found = users.find((u: any) => String(u.email ?? '').toLowerCase() === target)
    if (found) return toAuthUserRow(found)
    if (users.length < LIST_PAGE_SIZE) return null
  }
}

export async function getAuthEmailsByIds(sb: ServiceClient, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()

  const out = new Map<string, string>()
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))

  for (let i = 0; i < uniqueIds.length; i += ID_LOOKUP_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + ID_LOOKUP_BATCH_SIZE)
    const settled = await Promise.all(batch.map(async (id) => {
      const { data, error } = await (sb as any).auth.admin.getUserById(id)
      if (error) {
        if (isMissingUserError(error)) return null
        throw new Error(authErrorMessage(`Auth email lookup failed for ${id}`, error))
      }
      return data?.user ?? null
    }))

    for (const user of settled) {
      if (user?.id && user?.email) out.set(user.id, user.email)
    }
  }

  return out
}
