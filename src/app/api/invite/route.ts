import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_superadmin').eq('id', user.id).single()
    if (!profile?.is_superadmin) {
      return NextResponse.json({ error: 'Only superadmins can invite members' }, { status: 403 })
    }

    const { email, org_id, role, full_name } = await request.json()
    if (!email || !org_id || !role) {
      return NextResponse.json({ error: 'email, org_id and role are required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    const { data: orgData } = await serviceClient
      .from('organizations').select('name').eq('id', org_id).single()
    const orgName = orgData?.name ?? 'a project'

    // Check if user already exists in auth
    const { data: { users } } = await serviceClient.auth.admin.listUsers()
    const existingUser = users?.find(u => u.email === email)

    if (existingUser) {
      // Check if already a member
      const { data: existing } = await serviceClient
        .from('org_memberships')
        .select('id').eq('user_id', existingUser.id).eq('org_id', org_id).single()

      if (existing) {
        return NextResponse.json({ error: 'This user already has access to this project' }, { status: 400 })
      }

      // Add membership
      await serviceClient.from('org_memberships').insert({
        user_id: existingUser.id,
        org_id,
        role,
      })

      // Update name if provided
      if (full_name) {
        await serviceClient.from('profiles').update({ full_name }).eq('id', existingUser.id)
      }

      // Send magic link via Supabase (uses configured SMTP — Resend)
      await serviceClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dashboard.attomik.co'}/dashboard/analytics`,
        data: { org_id, role },
      })

      return NextResponse.json({
        message: `${email} has been added to ${orgName} as ${role} and notified by email.`,
        type: 'linked',
      })
    }

    // New user — invite via Supabase (sends email automatically)
    const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dashboard.attomik.co'}/dashboard/analytics`,
      data: { org_id, role, full_name },
    })

    if (inviteError) throw inviteError

    // Store pending invite to link membership on first sign-in
    await serviceClient.from('invites').upsert({
      email,
      org_id,
      role,
      invited_by: user.id,
      status: 'pending',
    }, { onConflict: 'email,org_id', ignoreDuplicates: false }).catch(() => {
      // invites table may not have unique constraint on email+org_id, ignore
    })

    // Pre-save name to profile if provided
    if (full_name) {
      const { data: { users: newUsers } } = await serviceClient.auth.admin.listUsers()
      const created = newUsers?.find(u => u.email === email)
      if (created) {
        await serviceClient.from('profiles').upsert({ id: created.id, full_name }, { onConflict: 'id' })
      }
    }

    return NextResponse.json({
      message: `Invite sent to ${email}. They'll receive an email to join ${orgName} as ${role}.`,
      type: 'invited',
    })

  } catch (err: any) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: err.message ?? 'Invite failed' }, { status: 500 })
  }
}
