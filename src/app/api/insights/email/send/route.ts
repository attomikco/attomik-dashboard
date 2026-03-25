import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function emailHtml(body: string, orgName: string) {
  const bodyHtml = body.split('\n').filter(Boolean).map(p => `<p style="margin:0 0 14px;font-size:0.95rem;color:#333;line-height:1.7;">${p}</p>`).join('')
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${orgName} — Performance Update</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e0e0e0;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#00ff97;height:5px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:36px 40px 40px;">
                    <p style="margin:0 0 24px;font-size:1.25rem;font-weight:800;letter-spacing:-0.03em;color:#000;line-height:1.3;">
                      ${orgName} — Performance Update
                    </p>
                    ${bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:0.72rem;color:#999;line-height:1.7;text-align:center;">
                Sent via <a href="https://dashboard.attomik.co" style="color:#999;text-decoration:none;">Attomik Dashboard</a>
                &middot; <a href="https://attomik.co" style="color:#999;text-decoration:none;">attomik.co</a>
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

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { recipients, subject, body, orgName } = await request.json()
    if (!recipients?.length) return NextResponse.json({ error: 'No recipients' }, { status: 400 })
    if (!subject || !body) return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 })

    const html = emailHtml(body, orgName)
    const errors: string[] = []

    for (const to of recipients) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `Attomik <hello@email.attomik.co>`,
          to,
          subject,
          html,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        errors.push(`${to}: ${err}`)
      }
    }

    if (errors.length > 0 && errors.length === recipients.length) {
      return NextResponse.json({ error: `All sends failed: ${errors[0]}` }, { status: 500 })
    }

    return NextResponse.json({
      sent: recipients.length - errors.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('Email send error:', err)
    return NextResponse.json({ error: err.message ?? 'Send failed' }, { status: 500 })
  }
}
