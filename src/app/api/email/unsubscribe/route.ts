import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function page(body: string, status = 200) {
  return new Response(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>Unsubscribed · Attomik</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#333333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:64px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#f8f8f8;border:1px solid #e0e0e0;border-radius:16px;">
        <tr><td style="background:#00ff97;height:6px;font-size:0;line-height:0;border-top-left-radius:16px;border-top-right-radius:16px;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 28px;text-align:center;">
          ${body}
          <div style="margin-top:24px;font-size:11px;color:#999999;">Attomik · <a href="https://attomik.co" style="color:#999999;text-decoration:none;">attomik.co</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const org_id = searchParams.get('org_id')
  const emailParam = searchParams.get('email')

  if (!org_id || !emailParam) {
    return page(`
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#000000;">Invalid unsubscribe link</h1>
      <p style="margin:0;font-size:14px;color:#666666;line-height:1.6;">The unsubscribe link is missing required info.</p>
    `, 400)
  }

  const email = emailParam.trim().toLowerCase()
  const sb = createServiceClient()

  const { data: org } = await sb
    .from('organizations')
    .select('id, name, weekly_email_unsubscribed')
    .eq('id', org_id)
    .single()

  if (!org) {
    return page(`
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#000000;">Organization not found</h1>
      <p style="margin:0;font-size:14px;color:#666666;line-height:1.6;">This link is no longer valid.</p>
    `, 404)
  }

  const current: string[] = (org as any).weekly_email_unsubscribed ?? []
  const alreadyUnsubbed = current.map(e => e.toLowerCase()).includes(email)
  const orgName = (org as any).name as string

  if (!alreadyUnsubbed) {
    const next = [...current, email]
    const { error } = await sb.from('organizations').update({ weekly_email_unsubscribed: next }).eq('id', org_id)
    if (error) {
      return page(`
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#000000;">Something went wrong</h1>
        <p style="margin:0;font-size:14px;color:#666666;line-height:1.6;">Please try again in a moment, or reply to the email directly.</p>
      `, 500)
    }
  }

  return page(`
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#000000;letter-spacing:-0.02em;">You're unsubscribed</h1>
    <p style="margin:0;font-size:14px;color:#333333;line-height:1.6;">
      <strong style="color:#000000;">${escapeHtml(email)}</strong> will no longer receive weekly performance emails for <strong style="color:#000000;">${escapeHtml(orgName)}</strong>.
    </p>
  `)
}
