import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { question, metrics, orgName, period } = await request.json()
    if (!question) return NextResponse.json({ error: 'Question required' }, { status: 400 })

    const fmtChg = (v: any) => v ? `${Number(v) > 0 ? '+' : ''}${v}%` : ''

    const prompt = `You are a supportive, growth-focused ecommerce analyst for ${orgName}. A team member is asking about their dashboard. Answer conversationally with specific numbers. Be encouraging — always lead with what's going well, acknowledge growth, and frame challenges as opportunities. Keep it to 2-4 sentences.

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
- Lead with positives and growth — always acknowledge what's improving
- Frame metric increases as momentum, not just numbers
- If something went up that's normally "bad" (like CAC), explain WHY it makes sense in context (e.g. scaling spend)
- Never be alarmist — frame challenges as areas to optimize
- Be specific with numbers, conversational in tone

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
    return NextResponse.json({ answer: data.content?.[0]?.text ?? 'No answer generated.' })
  } catch (err: any) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
