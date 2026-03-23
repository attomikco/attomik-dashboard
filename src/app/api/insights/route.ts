import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { metrics, period, orgName, preset, platform } = await request.json()

    // Auth + rate limit (non-blocking — don't break insights if auth fails)
    let user: any = null
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      user = data?.user

      if (user) {
        const serviceClient = createServiceClient()
        const todayStart = new Date(); todayStart.setHours(0,0,0,0)
        const { count } = await serviceClient.from('chat_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('type', 'insights')
          .gte('created_at', todayStart.toISOString())
        if ((count ?? 0) >= 5) {
          return NextResponse.json({ error: 'Daily limit reached (5 summaries/day). Try again tomorrow.' }, { status: 429 })
        }
      }
    } catch {} // auth/rate limit is best-effort

    const currentLabels = ['Month to date', 'Week to date', 'Today', 'Quarter to date']
    const isCurrent = currentLabels.some(l => preset?.toLowerCase().includes(l.toLowerCase().split(' ')[0]))
    const tense = isCurrent ? 'present' : 'past'
    const labelMap: Record<string, string> = {
      'Month to date': 'this month', 'Week to date': 'this week', 'Today': 'today',
      'Last 7 days': 'in the last 7 days', 'Last 30 days': 'in the last 30 days',
      'Last month': 'last month', 'Last quarter': 'last quarter', 'Quarter to date': 'this quarter',
    }
    const periodLabel = labelMap[preset] ?? `from ${period}`
    const tenseNote = tense === 'present'
      ? 'present tense — the period is ongoing (e.g. "is showing", "has grown", "is tracking")'
      : 'past tense — the period has ended (e.g. "showed", "grew", "dropped")'

    const prompt = platform === 'meta'
      ? `You are an expert paid social media analyst. Analyze this Meta Ads data for ${orgName} and write a balanced, honest, directionally accurate summary.

Period: ${periodLabel} (${period})
Write in ${tenseNote}. Always mention the period label naturally.

CURRENT PERIOD:
- Spend: ${metrics.metaSp}
- ROAS: ${metrics.roas}
- Purchases: ${metrics.metaConv}
- Conv. Value: ${metrics.totalRev}
- CTR: ${metrics.ctr}
- CPC: ${metrics.cpc}
- Active Campaigns: ${metrics.activeCampaigns} of ${metrics.totalCampaigns}
- Top Campaign: ${metrics.topCampaign} (${metrics.topCampaignSpend}, ROAS ${metrics.topCampaignRoas})

VS PRIOR PERIOD:
- Prior Spend: ${metrics.prevSpend}
- Prior ROAS: ${metrics.prevRoas}
- Prior Purchases: ${metrics.prevConversions}
- Prior CPC: ${metrics.prevCpc}
- Prior CTR: ${metrics.prevCtr}
${metrics.roasTrend ? `- ROAS Change: ${Number(metrics.roasTrend) > 0 ? '+' : ''}${metrics.roasTrend}% vs prior period` : ''}
${metrics.spendTrend ? `- Spend Change: ${Number(metrics.spendTrend) > 0 ? '+' : ''}${metrics.spendTrend}% vs prior period` : ''}
${metrics.convTrend ? `- Purchases Change: ${Number(metrics.convTrend) > 0 ? '+' : ''}${metrics.convTrend}% vs prior period` : ''}

IMPORTANT FRAMING RULES:
- If ROAS is low but IMPROVING vs prior period, frame it as positive momentum — acknowledge the absolute level but highlight the trajectory
- If a metric is low in absolute terms but trending in the right direction, say so explicitly ("ROAS is still below breakeven at X but improving from Y, a Z% gain")
- Do NOT catastrophize metrics that are improving — the trend matters more than the snapshot
- Be honest about real concerns, but only flag something as a problem if it's both low AND not improving
- If the account is early-stage or scaling, factor that context in

Write a 4-sentence summary: (1) brand + period + biggest headline (wins OR trend), (2) what's working or improving with specific numbers, (3) one honest concern if metrics are both poor AND not improving, (4) one specific actionable recommendation. Flowing prose, under 120 words.`

      : `You are an expert ecommerce analyst. Analyze this data for ${orgName} and write a balanced, honest, directionally accurate summary.

Period: ${periodLabel} (${period})
Write in ${tenseNote}. Always mention the period label naturally.

OVERALL PERFORMANCE vs PRIOR PERIOD:
- Total Sales: ${metrics.totalRev} (${Number(metrics.totalRevChg) > 0 ? '+' : ''}${metrics.totalRevChg}% vs prior)
- Total Ad Spend: ${metrics.totalSp} (${Number(metrics.totalSpChg) > 0 ? '+' : ''}${metrics.totalSpChg}% vs prior)
- Blended ROAS: ${metrics.roas}x (was ${metrics.roasP}x prior)
- Orders: ${metrics.orders} (${Number(metrics.ordersChg) > 0 ? '+' : ''}${metrics.ordersChg}% vs prior)
- AOV: ${metrics.aov} (${Number(metrics.aovChg) > 0 ? '+' : ''}${metrics.aovChg}% vs prior)
- CAC: ${metrics.cac} (${Number(metrics.cacChg) > 0 ? '+' : ''}${metrics.cacChg}% change — lower is better)

SALES BY CHANNEL:
${metrics.shopifyRev ? `- Shopify: ${metrics.shopifyRev} (${metrics.shopifyPctOfTotal}% of total${metrics.shopifyRevChg ? `, ${Number(metrics.shopifyRevChg) > 0 ? '+' : ''}${metrics.shopifyRevChg}% vs prior` : ''})
  - Orders: ${metrics.shopifyOrders}, Customers: ${metrics.shopifyCust}, AOV: ${metrics.shopifyAov}
  - Gross: ${metrics.shopifyGross}, Net: ${metrics.shopifyNet}, Discount Rate: ${metrics.discountRate}%, Refund Rate: ${metrics.refundRate}%${metrics.shopifyRoas ? `\n  - Shopify ROAS: ${metrics.shopifyRoas}x` : ''}` : '- Shopify: No data'}
${metrics.amazonRev ? `- Amazon: ${metrics.amazonRev} (${metrics.amazonPctOfTotal}% of total${metrics.amazonRevChg ? `, ${Number(metrics.amazonRevChg) > 0 ? '+' : ''}${metrics.amazonRevChg}% vs prior` : ''})
  - Units: ${metrics.amazonUnits}${metrics.amazonAov ? `, AOV: ${metrics.amazonAov}` : ''}` : ''}

CUSTOMERS:
- New Customers: ${metrics.newCust}
- Returning Customers: ${metrics.retCust}
- Returning Customer Rate: ${metrics.retRate}%

${metrics.cltv ? `UNIT ECONOMICS:
- CLTV (Shopify): ${metrics.cltv}${metrics.cltvChg ? ` (${Number(metrics.cltvChg) > 0 ? '+' : ''}${metrics.cltvChg}% vs prior)` : ''}
- CLTV/CAC Ratio: ${metrics.cltvCacRatio ? `${metrics.cltvCacRatio}x` : 'N/A'}` : ''}

${metrics.metaSp ? `META ADS:
- Meta Spend: ${metrics.metaSp}${metrics.metaSpChg ? ` (${Number(metrics.metaSpChg) > 0 ? '+' : ''}${metrics.metaSpChg}% vs prior)` : ''}
- Meta ROAS: ${metrics.metaRoas ? `${metrics.metaRoas}x` : 'N/A'}
- Impressions: ${metrics.metaImpr}, Clicks: ${metrics.metaClicks}, Purchases: ${metrics.metaConv}` : ''}

IMPORTANT FRAMING RULES:
- Focus on GROWTH and TRAJECTORY — what's improving, what's trending up
- Always lead with wins and positive momentum
- If a metric is low in absolute terms but improving vs prior, that IS the story — frame it positively
- Do NOT judge metrics against industry benchmarks or thresholds (e.g. never say "below 3x" for CLTV/CAC). Only compare vs the brand's own prior period
- Do NOT give recommendations, action items, or "should" statements — this is a summary, not a strategy doc
- Only mention a concern if a metric is declining AND it's significant — keep it brief
- Mention channel mix insights if multiple channels have data
- Be concise and celebratory where growth exists

Write a 3-sentence summary: (1) brand + period + biggest growth headline with numbers, (2) 2-3 additional wins or improving trends with specific numbers, (3) brief note on any notable metric shifts. Flowing prose, growth-focused tone, under 120 words.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return NextResponse.json({ error: `API error: ${response.status}` }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? 'No insights generated.'

    // Log the generation
    if (user) {
      const serviceClient = createServiceClient()
      await serviceClient.from('chat_logs').insert({
        user_id: user.id,
        question: `Generate ${platform ?? 'ecommerce'} insights`,
        answer: text,
        org_name: orgName,
        type: 'insights',
      }).catch(() => {})
    }

    return NextResponse.json({ insight: text })

  } catch (err: any) {
    console.error('Insights error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
