import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: 5 email drafts per day
    const svc = createServiceClient()
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { count } = await svc.from('chat_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('type', 'email_draft')
      .gte('created_at', todayStart.toISOString())
    if ((count ?? 0) >= 5) {
      return NextResponse.json({ error: 'Daily limit reached (5 email drafts/day).' }, { status: 429 })
    }

    const { metrics, period, preset, orgName, performance, challenges, focusTasks } = await request.json()

    const prompt = `You are an expert ecommerce strategist writing a performance update email for a team. Write a professional, concise email that combines dashboard metrics with the sender's personal context.

BRAND: ${orgName}
PERIOD: ${period} (${preset})

DASHBOARD METRICS:
- Total Sales: ${metrics.totalRev} (${Number(metrics.totalRevChg) > 0 ? '+' : ''}${metrics.totalRevChg}% vs prior)
- Ad Spend: ${metrics.totalSp} (${Number(metrics.totalSpChg) > 0 ? '+' : ''}${metrics.totalSpChg}% vs prior)
- ROAS: ${metrics.roas}x (was ${metrics.roasP}x)
- Orders: ${metrics.orders} (${Number(metrics.ordersChg) > 0 ? '+' : ''}${metrics.ordersChg}%)
- AOV: ${metrics.aov} (${Number(metrics.aovChg) > 0 ? '+' : ''}${metrics.aovChg}%)
- CAC: ${metrics.cac} (${Number(metrics.cacChg) > 0 ? '+' : ''}${metrics.cacChg}%)
- New Customers: ${metrics.newCust}, Returning: ${metrics.retCust}
${metrics.convRate ? `- Conv. Rate (Users): ${metrics.convRate}%${metrics.convRateP ? ` (was ${metrics.convRateP}%)` : ''}` : ''}
${metrics.shopifyRev ? `- Shopify: ${metrics.shopifyRev} (${metrics.shopifyPctOfTotal}% of total)` : ''}
${metrics.amazonRev ? `- Amazon: ${metrics.amazonRev} (${metrics.amazonPctOfTotal}% of total)` : ''}
${metrics.metaSp ? `- Meta Ads: ${metrics.metaSp} spend, ROAS ${metrics.metaRoas ?? 'N/A'}x` : ''}
${metrics.cltv ? `- CLTV: ${metrics.cltv}` : ''}

SENDER'S CONTEXT:
${performance ? `Performance notes: ${performance}` : '(No performance notes provided)'}
${challenges ? `Challenges: ${challenges}` : '(No challenges noted)'}
${focusTasks ? `Focus tasks for next period: ${focusTasks}` : '(No focus tasks provided)'}

INSTRUCTIONS:
- Write a subject line (short, informative, includes brand name and period)
- Write the email body with these sections:
  1. Brief greeting and overview (1-2 sentences with the key headline number)
  2. Performance Summary — weave together the metrics and the sender's notes naturally. Use specific numbers. Don't just list metrics, tell a story.
  3. Challenges (only if the sender provided them) — be honest but constructive
  4. Next Steps / Focus Areas (only if the sender provided them) — frame as priorities
  5. Brief sign-off
- Tone: professional but warm, data-driven, forward-looking
- Keep it under 250 words
- Do NOT use markdown formatting, bullet points, or headers — write in flowing paragraphs with line breaks between sections
- Do NOT include "Subject:" prefix in the subject line

Respond in this exact JSON format:
{"subject": "...", "body": "..."}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: `AI error: ${response.status}` }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''

    // Parse JSON from response
    let subject = `${orgName} — Performance Update (${period})`
    let body = text
    try {
      const parsed = JSON.parse(text)
      subject = parsed.subject || subject
      body = parsed.body || body
    } catch {
      // If not valid JSON, try to extract from text
      const subjectMatch = text.match(/"subject"\s*:\s*"([^"]+)"/)
      const bodyMatch = text.match(/"body"\s*:\s*"([\s\S]+?)"\s*\}/)
      if (subjectMatch) subject = subjectMatch[1]
      if (bodyMatch) body = bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
    }

    // Log
    try {
      await svc.from('chat_logs').insert({
        user_id: user.id, question: `Email draft for ${orgName}`,
        answer: body, org_name: orgName, type: 'email_draft',
      })
    } catch {}

    return NextResponse.json({ subject, body })
  } catch (err: any) {
    console.error('Email draft error:', err)
    return NextResponse.json({ error: err.message ?? 'Draft failed' }, { status: 500 })
  }
}
