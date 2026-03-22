import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function getOrgId(request: Request): Promise<{ orgId: string | null; error?: NextResponse }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { orgId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles').select('is_superadmin').eq('id', user.id).single()

  let orgId: string | null = null

  if (profile?.is_superadmin) {
    // Superadmin: use active org from header
    orgId = request.headers.get('x-active-org')
  } else {
    // Regular user: get their first membership (caller should pass x-active-org if multi-org)
    const activeOrgId = request.headers.get('x-active-org')
    if (activeOrgId) {
      // Verify they actually have membership in this org
      const { data: membership } = await supabase
        .from('org_memberships').select('org_id').eq('user_id', user.id).eq('org_id', activeOrgId).single()
      orgId = membership?.org_id ?? null
    }
    if (!orgId) {
      // Fall back to first membership
      const { data: membership } = await supabase
        .from('org_memberships').select('org_id').eq('user_id', user.id).limit(1).single()
      orgId = membership?.org_id ?? null
    }
  }

  if (!orgId) return { orgId: null, error: NextResponse.json({ error: 'No organization selected. Pick a client first.' }, { status: 400 }) }
  return { orgId }
}

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').filter(Boolean)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes }
      else if (char === ',' && !inQuotes) { result.push(current.trim()); current = '' }
      else { current += char }
    }
    result.push(current.trim())
    return result
  }
  const firstLine = lines[0].replace(/^\uFEFF/, '')
  const headers = parseCSVLine(firstLine)
  const rows = lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
  return { headers, rows }
}

export { createServiceClient }
