import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only superadmins can invite
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

    // Check if user already exists in auth
    const { data: existingUsers } = await serviceClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      // User exists — check if already in this org
      const { data: existingProfile } = await serviceClient
        .from('profiles').select('org_id, role').eq('id', existingUser.id).single()

      if (existingProfile?.org_id === org_id) {
        return NextResponse.json({ error: 'This user already has access to this project' }, { status: 400 })
      }

      // Link existing user to this org
      await serviceClient.from('profiles')
        .update({ org_id, role, ...(full_name ? { full_name } : {}) })
        .eq('id', existingUser.id)

      return NextResponse.json({
        message: `${email} has been added to this project as ${role}.`,
        type: 'linked',
      })
    }

    // User doesn't exist yet — create a pending invite record
    // They'll be linked when they first sign in
    const { error: inviteError } = await serviceClient.from('invites').insert({
      email,
      org_id,
      role,
      invited_by: user.id,
      status: 'pending',
    })

    // Pre-create profile with name so it shows immediately
    if (full_name) {
      const { data: newUser } = await serviceClient.auth.admin.createUser({ email, email_confirm: false })
      if (newUser?.user) {
        await serviceClient.from('profiles').upsert({ id: newUser.user.id, full_name, org_id, role })
      }
    }

    if (inviteError) throw inviteError

    // Send magic link so they can sign in
    await serviceClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/dashboard/analytics`,
      data: { org_id, role },
    })

    return NextResponse.json({
      message: `Invite sent to ${email}. They'll get an email to join as ${role}.`,
      type: 'invited',
    })

  } catch (err: any) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: err.message ?? 'Invite failed' }, { status: 500 })
  }
}
