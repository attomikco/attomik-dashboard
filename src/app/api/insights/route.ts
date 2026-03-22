import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { metrics, period, orgName, preset, platform } = await request.json()

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

METRICS vs PRIOR PERIOD:
- Total Sales: ${metrics.totalRev} (${Number(metrics.totalRevChg) > 0 ? '+' : ''}${metrics.totalRevChg}% vs prior)
- Ad Spend: ${metrics.totalSp} (${Number(metrics.totalSpChg) > 0 ? '+' : ''}${metrics.totalSpChg}% vs prior)
- ROAS: ${metrics.roas}x (was ${metrics.roasP}x prior)
- Orders: ${metrics.orders} (${Number(metrics.ordersChg) > 0 ? '+' : ''}${metrics.ordersChg}% vs prior)
- AOV: ${metrics.aov} (${Number(metrics.aovChg) > 0 ? '+' : ''}${metrics.aovChg}% vs prior)
- CAC: ${metrics.cac} (was ${metrics.cacChg}% change — lower is better)
- New Customers: ${metrics.newCust}
- Returning Customers: ${metrics.retCust}
- Return Rate: ${metrics.retRate}%
${metrics.shopifyGross ? `- Gross Sales: ${metrics.shopifyGross}\n- Net Sales: ${metrics.shopifyNet}\n- Discount Rate: ${metrics.discountRate}%` : ''}
${metrics.metaSp ? `- Meta Spend: ${metrics.metaSp}, Purchases: ${metrics.metaConv}` : ''}

IMPORTANT FRAMING RULES:
- If a metric is low in absolute terms but improving vs prior, frame it as positive momentum
- Always reference the direction of change, not just the current level
- Only flag something as a concern if it's BOTH poor AND not improving vs prior
- If ROAS is improving, say so — even if still below breakeven

Write a 4-sentence summary: (1) brand + period + biggest headline, (2) 2-3 wins or improving trends with numbers, (3) one honest concern if applicable, (4) one specific action. Flowing prose, under 120 words.`

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
    return NextResponse.json({ insight: text })

  } catch (err: any) {
    console.error('Insights error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
