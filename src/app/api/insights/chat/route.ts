import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { question, metrics, orgName, period } = await request.json()
    if (!question) return NextResponse.json({ error: 'Question required' }, { status: 400 })

    const prompt = `You are an expert ecommerce analyst for ${orgName}. A team member is asking you a question about their dashboard metrics. Answer conversationally, referencing specific numbers from the data below. Be concise (2-4 sentences), insightful, and growth-focused.

CURRENT DASHBOARD DATA (${period}):

OVERALL:
- Total Sales: ${metrics.totalRev} (${metrics.totalRevChg > 0 ? '+' : ''}${metrics.totalRevChg}% vs prior)
- Ad Spend: ${metrics.totalSp} (${metrics.totalSpChg > 0 ? '+' : ''}${metrics.totalSpChg}% vs prior)
- ROAS: ${metrics.roas}x (was ${metrics.roasP}x)
- Orders: ${metrics.orders} (${metrics.ordersChg > 0 ? '+' : ''}${metrics.ordersChg}% vs prior)
- AOV: ${metrics.aov} (${metrics.aovChg > 0 ? '+' : ''}${metrics.aovChg}% vs prior)
- CAC: ${metrics.cac} (${metrics.cacChg > 0 ? '+' : ''}${metrics.cacChg}% vs prior)

CUSTOMERS:
- New: ${metrics.newCust}, Returning: ${metrics.retCust}, Return Rate: ${metrics.retRate}%

${metrics.shopifyRev ? `SHOPIFY: ${metrics.shopifyRev} (${metrics.shopifyPctOfTotal}% of total${metrics.shopifyRevChg ? `, ${metrics.shopifyRevChg > 0 ? '+' : ''}${metrics.shopifyRevChg}%` : ''})
- Orders: ${metrics.shopifyOrders}, Customers: ${metrics.shopifyCust}, AOV: ${metrics.shopifyAov}
- Discount Rate: ${metrics.discountRate}%, Refund Rate: ${metrics.refundRate}%` : ''}

${metrics.amazonRev ? `AMAZON: ${metrics.amazonRev} (${metrics.amazonPctOfTotal}% of total${metrics.amazonRevChg ? `, ${metrics.amazonRevChg > 0 ? '+' : ''}${metrics.amazonRevChg}%` : ''})` : ''}

${metrics.cltv ? `UNIT ECONOMICS: CLTV ${metrics.cltv}${metrics.cltvChg ? ` (${metrics.cltvChg > 0 ? '+' : ''}${metrics.cltvChg}%)` : ''}, CLTV/CAC: ${metrics.cltvCacRatio ?? 'N/A'}x` : ''}

${metrics.metaSp ? `META ADS: Spend ${metrics.metaSp}, ROAS ${metrics.metaRoas ?? 'N/A'}x, Impressions ${metrics.metaImpr}, Clicks ${metrics.metaClicks}, Purchases ${metrics.metaConv}` : ''}

${metrics.trafficSessions ? `TRAFFIC (GA4): Sessions ${metrics.trafficSessions}, Users ${metrics.trafficUsers}, New Users ${metrics.trafficNewUsers}` : ''}

QUESTION: ${question}

Answer directly and reference the specific numbers. Don't repeat the question. Be helpful and conversational.`

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
