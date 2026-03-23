import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { question, metrics, orgName, period } = await request.json()
    if (!question) return NextResponse.json({ error: 'Question required' }, { status: 400 })

    const fmtChg = (v: any) => v ? `${Number(v) > 0 ? '+' : ''}${v}%` : ''

    const prompt = `You are a calm, knowledgeable ecommerce analyst for ${orgName}. A team member is asking about their dashboard. Answer conversationally with specific numbers. Be matter-of-fact and positive without being over the top — state what's happening clearly, note improvements naturally, and keep a professional tone. No exclamation marks, no hype words like "fantastic" or "incredible". Keep it to 2-4 sentences.

DASHBOARD DATA (${period}):

OVERALL:
- Total Sales: ${metrics.totalRev} (${fmtChg(metrics.totalRevChg)} vs prior)
- Ad Spend: ${metrics.totalSp} (${fmtChg(metrics.totalSpChg)} vs prior)
- ROAS: ${metrics.roas}x (was ${metrics.roasP}x)
- Orders: ${metrics.orders} (${fmtChg(metrics.ordersChg)} vs prior)
- AOV: ${metrics.aov} (${fmtChg(metrics.aovChg)} vs prior)
- CAC: ${metrics.cac} (${fmtChg(metrics.cacChg)} vs prior — lower is better)

CUSTOMERS:
- New: ${metrics.newCust}, Returning: ${metrics.retCust}, Return Rate: ${metrics.retRate}%

${metrics.shopifyRev ? `SHOPIFY: ${metrics.shopifyRev} (${metrics.shopifyPctOfTotal}% of total, ${fmtChg(metrics.shopifyRevChg)} vs prior)
- Orders: ${metrics.shopifyOrders}, Customers: ${metrics.shopifyCust}, AOV: ${metrics.shopifyAov}
- Discount Rate: ${metrics.discountRate}%, Refund Rate: ${metrics.refundRate}%
${metrics.shopifyRoas ? `- Shopify ROAS: ${metrics.shopifyRoas}x` : ''}` : ''}

${metrics.amazonRev ? `AMAZON: ${metrics.amazonRev} (${metrics.amazonPctOfTotal}% of total, ${fmtChg(metrics.amazonRevChg)} vs prior)
- Units: ${metrics.amazonUnits ?? 'N/A'}${metrics.amazonAov ? `, AOV: ${metrics.amazonAov}` : ''}` : ''}

${metrics.cltv ? `UNIT ECONOMICS:
- CLTV (Shopify): ${metrics.cltv} (${fmtChg(metrics.cltvChg)} vs prior)
- CLTV/CAC: ${metrics.cltvCacRatio ?? 'N/A'}x` : ''}

${metrics.metaSp ? `META ADS:
- Spend: ${metrics.metaSp}${metrics.metaSpChg ? ` (${fmtChg(metrics.metaSpChg)})` : ''}, ROAS: ${metrics.metaRoas ?? 'N/A'}x
- Impressions: ${metrics.metaImpr}, Clicks: ${metrics.metaClicks}, Purchases: ${metrics.metaConv}` : ''}

${metrics.trafficSessions ? `TRAFFIC (GA4):
- Sessions: ${metrics.trafficSessions}${metrics.trafficSessionsP ? ` (prev: ${metrics.trafficSessionsP})` : ''}
- Users: ${metrics.trafficUsers}${metrics.trafficUsersP ? ` (prev: ${metrics.trafficUsersP})` : ''}
- New Users: ${metrics.trafficNewUsers}${metrics.trafficNewUsersP ? ` (prev: ${metrics.trafficNewUsersP})` : ''}
- Conv. Rate (Sessions): ${metrics.convRateSessions ?? 'N/A'}%
- Conv. Rate (Users): ${metrics.convRateUsers ?? 'N/A'}%
- Conv. Rate (New Users): ${metrics.convRateNewUsers ?? 'N/A'}%` : ''}

TONE RULES:
- Be positive but grounded — no hype, no exclamation marks
- Note improvements naturally ("sales are up 12%" not "sales are CRUSHING it!")
- If something went up that's normally "bad" (like CAC), explain the context calmly
- Be direct and specific with numbers
- Sound like a smart colleague, not a cheerleader

QUESTION: ${question}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return NextResponse.json({ error: 'AI error' }, { status: 500 })
    }

    const data = await response.json()
    const answer = data.content?.[0]?.text ?? 'No answer generated.'

    // Log the question and answer
    const serviceClient = createServiceClient()
    await serviceClient.from('chat_logs').insert({
      user_id: user.id,
      org_id: metrics.orgId ?? null,
      question,
      answer,
      org_name: orgName,
    }).then(() => {}).catch(() => {}) // fire and forget

    return NextResponse.json({ answer })
  } catch (err: any) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
