import OpenAI from "openai";
import type { MonthEndForecast } from "@/lib/forecast";
import type { EnrichedDetectedPatterns } from "@/lib/detection";

interface AIInsightCard {
  headline: string;
  summary: string;
  severity: "info" | "warning" | "critical";
}

export async function generateInsightCard(
  forecast: MonthEndForecast,
  patterns: EnrichedDetectedPatterns,
  companyName?: string
): Promise<AIInsightCard | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;

  const biggestExpenses = patterns.recurringExpenses
    .sort((a, b) => b.typicalAmount - a.typicalAmount)
    .slice(0, 5)
    .map((e) => e.merchant)
    .join(", ");

  const prompt = `You are a cashflow intelligence analyst for a business called "${companyName || "the company"}". Write a short, practical insight for the dashboard.

CURRENT FORECAST DATA:
- Current balance: £${forecast.currentBalance.toFixed(0)}
- Predicted month-end: £${forecast.predictedMonthEnd.toFixed(0)}
- Status: ${forecast.status}
- Remaining income: £${forecast.remainingIncome.toFixed(0)}
- Remaining expenses: £${forecast.remainingExpenses.toFixed(0)}
- Next income date: ${forecast.nextIncomeDate ?? "unknown"}
- Danger window: ${forecast.dangerWindow ? `balance drops to £${forecast.dangerWindow.lowestBalance.toFixed(0)} between ${forecast.dangerWindow.from} and ${forecast.dangerWindow.to}` : "none"}
- Biggest recurring expenses: ${biggestExpenses}
- Confidence: ${Math.round(forecast.confidence * 100)}%

Write ONE insight with two parts:
1. HEADLINE: One sentence about the most important thing the business owner needs to know right now. Be specific with amounts and dates.
2. SUMMARY: 1-2 sentences with the practical implication and what action to take.

Format as JSON: { "headline": "...", "summary": "...", "severity": "info"|"warning"|"critical" }`;

  try {
    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });

    const completion = await deepseek.chat.completions.create({
      model: "deepseek-v4-flash",
      temperature: 0.3,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) return null;

    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    return {
      headline: json.headline ?? forecast.statusReason,
      summary: json.summary ?? "",
      severity: json.severity ?? "info",
    };
  } catch {
    return null;
  }
}
