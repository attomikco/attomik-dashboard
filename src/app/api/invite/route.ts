import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function sendResendEmail(to: string, subject: string, html: string) {
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

function emailHtml(link: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to Attomik</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="data:image/svg+xml;base64,CiAgICAgICAgPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHdpZHRoPSIzMTYyLjIwODMwOTYxODY2OSIgaGVpZ2h0PSI5MDkuMjE3OTMwMzAzMDMxMiIgdmlld0JveD0iMCAwIDMxNjIuMjA4MzA5NjE4NjY5IDkwOS4yMTc5MzAzMDMwMzEyIj4KCQkJCgkJCTxnIHRyYW5zZm9ybT0ic2NhbGUoOC4xMTA0MTU0ODA5MzM0MSkgdHJhbnNsYXRlKDEwLCAxMCkiPgoJCQkJPGRlZnMgaWQ9IlN2Z2pzRGVmczEwOTQiLz48ZyBpZD0iU3ZnanNHMTA5NSIgZmVhdHVyZUtleT0iNVRNVEtDLTAiIHRyYW5zZm9ybT0ibWF0cml4KDEuMDQ2NjQ4OTAyODYzMDI3NSwwLDAsMS4wNDY2NDg5MDI4NjMwMjc1LC02LjI3OTgxMjA2Njk2MDc0MywtNi4yNzk4OTM0MTcxNzgxNjUpIiBmaWxsPSIjMDAwIj48ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAsLTk1Mi4zNjIxOCkiPjxwYXRoIHN0eWxlPSJ0ZXh0LWluZGVudDogMDsgdGV4dC10cmFuc2Zvcm06IG5vbmU7IGRpcmVjdGlvbjogbHRyOyBibG9jay1wcm9ncmVzc2lvbjogdGI7IGJhc2VsaW5lLXNoaWZ0OiBiYXNlbGluZTsgY29sb3I6IDsgZW5hYmxlLWJhY2tncm91bmQ6IGFjY3VtdWxhdGUiIGQ9Im0gMTMuNTQwNzg5LDEwMTMuMTY4IGMgLTQuMTYxMjYwNCwwIC03LjU0MDg2NjUsMy4zOTIyIC03LjU0MDg2NjUsNy41NjkzIDAsNC4xNzcxIDMuMzc5NjA2MSw3LjYwNSA3LjU0MDg2NjUsNy42MDUgMC44MTM1NDMsMCAxLjYxMzk3NiwtMC4xMzYxIDIuMzgzMjI4LC0wLjM5MjggMTIuMjgxMTAyLDE4Ljg5OTcgMzYuNjQ5ODQyLDIzLjI2MDggNTQuNDkzMjI3LDEzLjAzMiAwLjUyMTIyMSwtMC4yOTkxIDAuNzI0NjA3LC0xLjA0NzUgMC40MjY2MTQsLTEuNTcxIC0wLjI5Nzk5MiwtMC41MjM0IC0xLjA0MzUwMywtMC43Mjc1IC0xLjU2NTA3OCwtMC40Mjg0IC0xNi43NzI5NTMsOS42MTUzIC0zOS42NzEyMiw1LjYyOTIgLTUxLjMyNzI4MiwtMTIuMTAzNyAxLjg5NDI1MSwtMS4zODEyIDMuMTMwMTU3LC0zLjYxOTUgMy4xMzAxNTcsLTYuMTQxMSAwLC00LjE3NzEgLTMuMzc5MjUyLC03LjU2OTMgLTcuNTQwODY2LC03LjU2OTMgeiIgZmlsbC1vcGFjaXR5PSIxIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0ibm9uZSIgbWFya2VyPSJub25lIiB2aXNpYmlsaXR5PSJ2aXNpYmxlIiBkaXNwbGF5PSJpbmxpbmUiIG92ZXJmbG93PSJ2aXNpYmxlIi8+PHBhdGggc3R5bGU9InRleHQtaW5kZW50OiAwOyB0ZXh0LXRyYW5zZm9ybTogbm9uZTsgZGlyZWN0aW9uOiBsdHI7IGJsb2NrLXByb2dyZXNzaW9uOiB0YjsgYmFzZWxpbmUtc2hpZnQ6IGJhc2VsaW5lOyBjb2xvcjogOyBlbmFibGUtYmFja2dyb3VuZDogYWNjdW11bGF0ZSIgZD0ibSA3MC40MTcyNDQsOTcwLjU3Mjk5IGMgLTAuOTUxMDIzLDAuMTIxMzIgLTEuMjM3MzIzLDEuNjkwMjYgLTAuMzkxMTgxLDIuMTQyMjUgMTMuNDI5ODQyLDguMjE4OTkgMjAuOTI4NTQzLDI0LjMwMTgyIDE3LjY0MjQ4LDQwLjU1OTg2IC0wLjM5Mjk1MywtMC4wNjcgLTAuODAxODUsLTAuMTA3IC0xLjIwOTMzMSwtMC4xMDcgLTQuMTYxMjU5LDAgLTcuNTQwODY2LDMuMzkyMiAtNy41NDA4NjYsNy41NjkyIDAsNC4xNzcxIDMuMzc5NjA3LDcuNjA1IDcuNTQwODY2LDcuNjA1IDQuMTYxMjYsMCA3LjU0MDg2NiwtMy40Mjc5IDcuNTQwODY2LC03LjYwNSAwLC0yLjk1MTYgLTEuNjg2OTY4LC01LjUxIC00LjE2MTYxNCwtNi43NDggMy42MDc0NDEsLTE3LjI5MTA3IC00LjMzMTMzOCwtMzQuNDgxODggLTE4LjYzODUwMywtNDMuMjM3NzMgLTAuMTg5OTIxLC0wLjEyMTIyIC0wLjQxNTk4NCwtMC4xODQyMyAtMC42NDA2MywtMC4xNzg1MiAtMC4wNDc4NCwtMC4wMDMgLTAuMDk0MjUsLTAuMDAzIC0wLjE0MjA4NywwIHoiIGZpbGwtb3BhY2l0eT0iMSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9Im5vbmUiIG1hcmtlcj0ibm9uZSIgdmlzaWJpbGl0eT0idmlzaWJsZSIgZGlzcGxheT0iaW5saW5lIiBvdmVyZmxvdz0idmlzaWJsZSIvPjxwYXRoIHN0eWxlPSJ0ZXh0LWluZGVudDogMDsgdGV4dC10cmFuc2Zvcm06IG5vbmU7IGRpcmVjdGlvbjogbHRyOyBibG9jay1wcm9ncmVzc2lvbjogdGI7IGJhc2VsaW5lLXNoaWZ0OiBiYXNlbGluZTsgY29sb3I6IDsgZW5hYmxlLWJhY2tncm91bmQ6IGFjY3VtdWxhdGUiIGQ9Im0gNTAuMDAwMDAxLDk1OC4zNjIxOCBjIC00LjAxMjQ0MSwwIC03LjI3NDQxLDMuMTY5ODcgLTcuNTA1MDc5LDcuMTQwODMgLTE3LjE5NzA4NiwzLjE5MzYyIC0yOS43Mjc2MzcsMTYuODUyNjYgLTMyLjU4MjEyNTQsMzMuMDYyMDEgYSAxLjEzODM1MTUsMS4xNDI2NDYzIDAgMSAwIDIuMjQwNzg3NCwwLjM5Mjc1IGMgMi42ODEyMjEsLTE1LjIyNDg2IDE0LjM4ODMwNywtMjguMDcwODQgMzAuNTE4ODU4LC0zMS4xNjk3IDAuODI2NjUzLDMuMjg1MzkgMy44MDI2NzcsNS43MTI2NiA3LjMyNzU1OSw1LjcxMjY2IDQuMTYxMjU5LDAgNy41NDA4NjYsLTMuMzkyMTkgNy41NDA4NjYsLTcuNTY5MjggMCwtNC4xNzcwOCAtMy4zNzk2MDcsLTcuNTY5MjcgLTcuNTQwODY2LC03LjU2OTI3IHoiIGZpbGwtb3BhY2l0eT0iMSIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9Im5vbmUiIG1hcmtlcj0ibm9uZSIgdmlzaWJpbGl0eT0idmlzaWJsZSIgZGlzcGxheT0iaW5saW5lIiBvdmVyZmxvdz0idmlzaWJsZSIvPjwvZz48L2c+PGcgaWQ9IlN2Z2pzRzEwOTYiIGZlYXR1cmVLZXk9IjdVQnA5aS0wIiB0cmFuc2Zvcm09Im1hdHJpeCgyLjc4MTQzNTYzNjYwNjIxNSwwLDAsMi43ODE0MzU2MzY2MDYyMTUsMTExLjgzMzExNDM1MjUzMTYyLDExLjMxNDAxMzk0OTk4MzMwNSkiIGZpbGw9IiMwMDAiPjxwYXRoIGQ9Ik0xMi43NiAyMCBsLTEuNiAtMy43MiBsLTcuOTQgMCBsLTEuNiAzLjcyIGwtMS41NiAwIGw2LjI4IC0xNC41OCBsMS43NCAwIGw2LjMgMTQuNTggbC0xLjYyIDAgeiBNMTAuNTggMTQuODggbC0zLjQgLTcuODggbC0zLjM4IDcuODggbDYuNzggMCB6IE0yMS4yNCA2Ljg2IGwwIDEzLjE0IGwtMS41MiAwIGwwIC0xMy4xNCBsLTQuODggMCBsMCAtMS40NCBsMTEuMjggMCBsMCAxLjQ0IGwtNC44OCAwIHogTTMzLjMyIDYuODYgbDAgMTMuMTQgbC0xLjUyIDAgbDAgLTEzLjE0IGwtNC44OCAwIGwwIC0xLjQ0IGwxMS4yOCAwIGwwIDEuNDQgbC00Ljg4IDAgeiBNNTQuMjYgMTIuNjggYzAgMS4zOCAtMC4zMiAyLjY0IC0wLjk0IDMuNzggYy0wLjY0IDEuMTQgLTEuNTIgMi4wNCAtMi42NCAyLjcgYy0xLjE0IDAuNjYgLTIuMzggMSAtMy43OCAxIGMtMS4wMiAwIC0xLjk4IC0wLjIgLTIuOSAtMC41OCBjLTAuOSAtMC4zOCAtMS42OCAtMC45IC0yLjMyIC0xLjU4IGMtMC42NCAtMC42NCAtMS4xNCAtMS40MiAtMS41MiAtMi4zNCBjLTAuMzYgLTAuOTIgLTAuNTYgLTEuODggLTAuNTYgLTIuOSBjMCAtMS4zOCAwLjMyIC0yLjY0IDAuOTYgLTMuNzggYzAuNjIgLTEuMTQgMS41IC0yLjA2IDIuNjQgLTIuNzIgYzEuMTIgLTAuNjYgMi4zOCAtMC45OCAzLjc2IC0wLjk4IGMxLjAyIDAgMS45OCAwLjE4IDIuOSAwLjU2IGMwLjkgMC40IDEuNjggMC45MiAyLjMyIDEuNTYgYzAuNjQgMC42OCAxLjE2IDEuNDYgMS41MiAyLjM2IGMwLjM4IDAuOTIgMC41NiAxLjg4IDAuNTYgMi45MiB6IE01Mi42OCAxMi43NiBjMCAtMS42NCAtMC42IC0zLjE2IC0xLjYgLTQuMjYgcy0yLjUgLTEuOCAtNC4xOCAtMS44IGMtMS4wOCAwIC0yLjA2IDAuMjggLTIuOTQgMC44IGMtMC44OCAwLjU2IC0xLjU2IDEuMjggLTIuMDQgMi4xOCBjLTAuNDggMC45MiAtMC43MiAxLjkyIC0wLjcyIDMgYzAgMS42MiAwLjYgMy4xNiAxLjYgNC4yNCBjMSAxLjEgMi41IDEuOCA0LjE2IDEuOCBjMS4wOCAwIDIuMDYgLTAuMjggMi45NCAtMC44MiBjMC45IC0wLjUyIDEuNTggLTEuMjYgMi4wNiAtMi4xNiBzMC43MiAtMS45IDAuNzIgLTIuOTggeiBNNzAuMyA1LjQyIGwyLjIgMCBsMCAxNC41OCBsLTEuNTIgMCBsMCAtMTIuNSBsMCAwIGwtNS40MiAxMi41IGwtMS4zOCAwIGwtNS4zOCAtMTIuNCBsMCAwIGwwIDEyLjQgbC0xLjUyIDAgbDAgLTE0LjU4IGwyLjE4IDAgbDUuNDQgMTIuNSB6IE03Ni41NiAyMCBsMCAtMTQuNTggbDEuNTQgMCBsMCAxNC41OCBsLTEuNTQgMCB6IE04My42OCAyMCBsLTEuNTQgMCBsMCAtMTQuNTggbDEuNTQgMCBsMCA2LjQ0IGwwLjEgMCBsNi41NCAtNi40NCBsMi4xMiAwIGwtNy4xNCA2Ljk4IGw3LjQ4IDcuNiBsLTIuMTYgMCBsLTYuODQgLTcuMDIgbC0wLjEgMCBsMCA3LjAyIHoiLz48L2c+CgkJCTwvZz4KCQk8L3N2Zz4KCQ==" alt="Attomik" width="140" style="display:block;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e0e0e0;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#00ff97;height:5px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:40px 40px 40px;">
                    <p style="margin:0 0 8px;font-size:1.5rem;font-weight:800;letter-spacing:-0.03em;color:#000000;line-height:1.25;text-align:center;">
                      You've been invited<br>to Attomik Brand Dashboard
                    </p>
                    <p style="margin:0 0 32px;font-size:0.875rem;color:#666666;line-height:1.6;text-align:center;">
                      You've been given access to the Attomik dashboard.<br>Click below to accept your invitation and set up your account.
                    </p>
                    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        <td align="center" style="background:#000000;border-radius:8px;">
                          <a href="${link}" style="display:inline-block;padding:15px 32px;font-size:0.95rem;font-weight:700;color:#00ff97;text-decoration:none;letter-spacing:-0.01em;white-space:nowrap;">
                            Accept invitation &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:0.75rem;color:#999999;line-height:1.7;text-align:center;">
                If you weren't expecting this invitation, you can safely ignore this email.<br>
                &copy; Attomik &middot; <a href="https://attomik.co" style="color:#999999;text-decoration:none;">attomik.co</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function PUT(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_superadmin').eq('id', user.id).single()
    if (!profile?.is_superadmin) {
      return NextResponse.json({ error: 'Only superadmins can resend invites' }, { status: 403 })
    }

    const { email, org_id } = await request.json()
    if (!email || !org_id) {
      return NextResponse.json({ error: 'email and org_id are required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dashboard.attomik.co'

    const { data: orgData } = await serviceClient
      .from('organizations').select('name').eq('id', org_id).single()
    const orgName = orgData?.name ?? 'a project'

    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${siteUrl}/auth/callback` },
    })
    if (linkError) throw linkError

    await sendResendEmail(
      email,
      `Reminder: You've been invited to ${orgName} on Attomik`,
      emailHtml(linkData.properties.action_link)
    )

    return NextResponse.json({ message: `Invite resent to ${email}` })
  } catch (err: any) {
    console.error('Resend invite error:', err)
    return NextResponse.json({ error: err.message ?? 'Resend failed' }, { status: 500 })
  }
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

      // Only mark as joined immediately if they signed in very recently (last 7 days)
      // Someone who was removed and re-invited should start as 'invited' again
      const lastSignIn = existingUser.last_sign_in_at ? new Date(existingUser.last_sign_in_at) : null
      const recentlyActive = lastSignIn ? (Date.now() - lastSignIn.getTime()) < 7 * 24 * 60 * 60 * 1000 : false
      const now = new Date().toISOString()
      await serviceClient.from('org_memberships').insert({
        user_id: existingUser.id,
        org_id,
        role,
        status: recentlyActive ? 'joined' : 'invited',
        invited_at: now,
        joined_at: recentlyActive ? now : null,
        last_seen_at: recentlyActive ? existingUser.last_sign_in_at : null,
      })

      if (full_name) {
        await serviceClient.from('profiles').update({ full_name }).eq('id', existingUser.id)
      }

      // Generate magic link and send via Resend (inviteUserByEmail is no-op for existing users)
      const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${siteUrl}/auth/callback` },
      })
      if (linkError) throw linkError

      await sendResendEmail(
        email,
        `You've been added to ${orgName} on Attomik`,
        emailHtml(linkData.properties.action_link)
      )

      return NextResponse.json({
        message: `${email} added to ${orgName} as ${role} and notified by email.`,
        type: 'linked',
      })
    }

    // New user — create via inviteUserByEmail but generate link manually to send branded email
    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${siteUrl}/auth/callback`, data: { org_id, role, full_name } },
    })
    if (inviteError) throw inviteError

    await sendResendEmail(
      email,
      `You've been invited to ${orgName} on Attomik`,
      emailHtml(inviteData.properties.action_link)
    )

    // Store pending invite to link membership on first sign-in
    await serviceClient.from('invites').upsert({
      email, org_id, role,
      invited_by: user.id,
      status: 'pending',
    }, { onConflict: 'email,org_id' })

    // Also create org_membership so the user appears in member lists immediately
    const newUserId = inviteData.user?.id
    if (newUserId) {
      await serviceClient.from('org_memberships').upsert({
        user_id: newUserId,
        org_id,
        role,
        status: 'invited',
        invited_at: new Date().toISOString(),
      }, { onConflict: 'user_id,org_id' })
    }

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

    return NextResponse.json({
      message: `Invite sent to ${email} — they'll join ${orgName} as ${role}.`,
      type: 'invited',
    })

  } catch (err: any) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: err.message ?? 'Invite failed' }, { status: 500 })
  }
}
