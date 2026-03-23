import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Attomik <no-reply@email.attomik.co>',
      to,
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }
}

function inviteEmailHtml(orgName: string, role: string, link: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#fff">
      <div style="margin-bottom:32px;font-size:1.4rem;font-weight:900;letter-spacing:-0.03em">attomik</div>
      <h2 style="font-size:1.2rem;font-weight:800;margin-bottom:8px;color:#000">
        You've been invited to ${orgName}
      </h2>
      <p style="color:#666;margin-bottom:8px;line-height:1.6">
        You have <strong>${role}</strong> access to ${orgName}'s analytics dashboard.
      </p>
      <p style="color:#666;margin-bottom:24px;line-height:1.6">
        Click the button below to sign in — no password needed.
      </p>
      <a href="${link}" style="display:inline-block;background:#00ff97;color:#000;font-weight:700;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:0.95rem">
        Open dashboard →
      </a>
      <p style="color:#999;font-size:0.8rem;margin-top:32px">
        This link expires in 24 hours.
      </p>
    </div>
  `
}

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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dashboard.attomik.co'

    const { data: orgData } = await serviceClient
      .from('organizations').select('name').eq('id', org_id).single()
    const orgName = orgData?.name ?? 'a project'

    // Check if user already exists in Supabase auth
    const { data: { users } } = await serviceClient.auth.admin.listUsers()
    const existingUser = users?.find(u => u.email === email)

    if (existingUser) {
      // Check if already a member of this org
      const { data: existing } = await serviceClient
        .from('org_memberships')
        .select('id').eq('user_id', existingUser.id).eq('org_id', org_id).single()

      if (existing) {
        return NextResponse.json({ error: 'This user already has access to this project' }, { status: 400 })
      }

      // Add membership with 'invited' status
      await serviceClient.from('org_memberships').insert({
        user_id: existingUser.id,
        org_id,
        role,
        status: 'invited',
        invited_at: new Date().toISOString(),
      })

      if (full_name) {
        await serviceClient.from('profiles').update({ full_name }).eq('id', existingUser.id)
      }

      // Generate magic link and send via Resend
      const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${siteUrl}/dashboard/analytics` },
      })

      if (linkError) throw linkError

      await sendEmail(
        email,
        `You've been added to ${orgName} on Attomik`,
        inviteEmailHtml(orgName, role, linkData.properties.action_link)
      )

      return NextResponse.json({
        message: `${email} added to ${orgName} as ${role} and notified by email.`,
        type: 'linked',
      })
    }

    // New user — create invite record first
    await serviceClient.from('invites').upsert({
      email, org_id, role,
      invited_by: user.id,
      status: 'pending',
    }, { onConflict: 'email,org_id' })

    // Generate invite link
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${siteUrl}/auth/callback?next=/dashboard/analytics` },
    })

    if (linkError) throw linkError

    // Save name to profile if provided (user was just created by generateLink)
    if (full_name) {
      const { data: { users: updated } } = await serviceClient.auth.admin.listUsers()
      const created = updated?.find(u => u.email === email)
      if (created) {
        await serviceClient.from('profiles').upsert(
          { id: created.id, full_name },
          { onConflict: 'id' }
        )
      }
    }

    await sendEmail(
      email,
      `You've been invited to ${orgName} on Attomik`,
      inviteEmailHtml(orgName, role, linkData.properties.action_link)
    )

    return NextResponse.json({
      message: `Invite sent to ${email} — they'll join ${orgName} as ${role}.`,
      type: 'invited',
    })

  } catch (err: any) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: err.message ?? 'Invite failed' }, { status: 500 })
  }
}
