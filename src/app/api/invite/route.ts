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

    // Get org name for the email
    const { data: orgData } = await serviceClient
      .from('organizations').select('name').eq('id', org_id).single()
    const orgName = orgData?.name ?? 'a project'

    // Check if user already exists in auth
    const { data: existingUsers } = await serviceClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      // Check if already a member of this org
      const { data: existingMembership } = await serviceClient
        .from('org_memberships')
        .select('id').eq('user_id', existingUser.id).eq('org_id', org_id).single()

      if (existingMembership) {
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

      // Send notification email with magic link
      try {
        const { data: linkData } = await serviceClient.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/dashboard/analytics`,
          },
        })
        if (linkData?.properties?.action_link) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: 'Attomik <no-reply@email.attomik.co>',
              to: email,
              subject: `You've been added to ${orgName} on Attomik`,
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fff">
                  <div style="margin-bottom:32px">
                    <span style="font-size:1.4rem;font-weight:900;letter-spacing:-0.03em">attomik</span>
                  </div>
                  <h2 style="font-size:1.3rem;font-weight:800;margin-bottom:8px;color:#000">You've been added to ${orgName}</h2>
                  <p style="color:#666;margin-bottom:24px;line-height:1.6">You now have <strong>${role}</strong> access to ${orgName}'s dashboard. Click below to sign in.</p>
                  <a href="${linkData.properties.action_link}" style="display:inline-block;background:#00ff97;color:#000;font-weight:700;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:0.95rem">Open dashboard →</a>
                  <p style="color:#999;font-size:0.8rem;margin-top:32px">This sign-in link expires in 24 hours. After that, visit <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#666">dashboard.attomik.co</a> to request a new one.</p>
                </div>
              `,
            }),
          })
        }
      } catch { /* non-fatal */ }

      return NextResponse.json({
        message: `${email} has been added to ${orgName} as ${role} and notified by email.`,
        type: 'linked',
      })
    }

    // New user — send invite email via Supabase
    const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/dashboard/analytics`,
      data: { org_id, role, full_name },
    })

    if (inviteError) throw inviteError

    // Store pending invite so we can link them on first sign-in
    await serviceClient.from('invites').upsert({
      email,
      org_id,
      role,
      invited_by: user.id,
      status: 'pending',
    }, { onConflict: 'email,org_id', ignoreDuplicates: false })

    // Pre-create profile with name if provided
    if (full_name) {
      const { data: newUser } = await serviceClient.auth.admin.listUsers()
      const created = newUser?.users?.find(u => u.email === email)
      if (created) {
        await serviceClient.from('profiles').upsert(
          { id: created.id, full_name },
          { onConflict: 'id' }
        )
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
