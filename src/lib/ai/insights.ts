import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import type { StatementData, AIInsights, SpendReviewResult, AnalysisMode, Insight, CandidateFinding, EnrichedTransaction } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { runDetection } from "@/lib/detection/engine";
import { buildBusinessPrompt, buildPersonalPrompt } from "@/lib/ai/prompt";

// ── API Callers ──

async function tryDeepSeek(prompt: string, maxTokens = 4096, jsonMode = false): Promise<string | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;

  const deepseek = new OpenAI({
    baseURL: "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY,
  });

  const params: Record<string, unknown> = {
    model: "deepseek-v4-flash",
    temperature: 0.3,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };

  if (jsonMode) {
    params.response_format = { type: "json_object" };
  }

  const completion = await deepseek.chat.completions.create(params as never);
  return completion.choices[0]?.message?.content ?? null;
}

async function tryAnthropic(prompt: string, maxTokens = 4096): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

async function getAIResponse(prompt: string, maxTokens = 4096, jsonMode = false): Promise<string> {
  const deepseekText = await tryDeepSeek(prompt, maxTokens, jsonMode);
  if (deepseekText) return deepseekText;

  const anthropicText = await tryAnthropic(prompt, maxTokens);
  if (anthropicText) return anthropicText;

  throw new Error("No AI provider configured");
}

// ── JSON Parsing ──

function extractJson(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found in AI response");
  return jsonMatch[0];
}

function parsePersonalResponse(text: string): AIInsights {
  return JSON.parse(extractJson(text)) as AIInsights;
}

function parseSpendReviewResponse(text: string): SpendReviewResult {
  return JSON.parse(extractJson(text)) as SpendReviewResult;
}

// ── Personal Finance (unchanged) ──

export async function generatePersonalInsights(data: StatementData): Promise<AIInsights> {
  const prompt = buildPersonalPrompt(data);
  const text = await getAIResponse(prompt);
  return parsePersonalResponse(text);
}

// ── Business Spend Review ──

export async function generateSpendReview(data: StatementData): Promise<SpendReviewResult> {
  // Pass 1: Run detection engine
  const candidates = runDetection(data);

  if (candidates.length === 0) {
    // No candidates — return a minimal result
    return buildEmptySpendReview(data);
  }

  // Build the AI prompt with candidates + relevant transactions
  const prompt = buildBusinessPrompt(candidates, data.transactions, data);

  // Pass 2: AI enrichment with JSON mode + high token limit
  try {
    const text = await getAIResponse(prompt, 12000, true);
    const result = parseSpendReviewResponse(text);

    // Validate: ensure insights have transaction_ids
    result.insights = result.insights.filter(
      (i) => i.transaction_ids && i.transaction_ids.length > 0,
    );

    return result;
  } catch (aiError) {
    // Retry once with a repair prompt
    try {
      const repairPrompt = `${prompt}\n\nIMPORTANT: Your previous response was not valid JSON or contained errors. Return ONLY a valid JSON object following the schema exactly. Do not include markdown formatting, code fences, or any text outside the JSON object.`;
      const text = await getAIResponse(repairPrompt, 12000, true);
      const result = parseSpendReviewResponse(text);
      result.insights = result.insights.filter(
        (i) => i.transaction_ids && i.transaction_ids.length > 0,
      );
      return result;
    } catch {
      // Fallback: format candidates as insights directly
      console.error("AI enrichment failed, falling back to deterministic candidates:", aiError);
      return formatCandidatesAsInsights(candidates, data);
    }
  }
}

// ── Fallback: Format Candidates as Insights ──

function formatCandidatesAsInsights(
  candidates: CandidateFinding[],
  data: StatementData,
): SpendReviewResult {
  const insights: Insight[] = candidates.map((c, idx) => {
    const id = `insight_detected_${String(idx + 1).padStart(3, "0")}`;
    return {
      id,
      short_title: c.title,
      one_line_summary: c.evidence_summary,
      category: c.category,
      severity: c.severity,
      confidence: c.confidence,
      detection_case_ids: [c.detection_case_id],
      amount_at_risk: c.amount_at_risk,
      estimated_monthly_impact: c.amount_at_risk,
      estimated_annual_impact: c.amount_at_risk * 12,
      why_flagged: c.evidence_summary,
      why_it_matters: `This pattern was detected automatically and may indicate waste, duplication, or control gaps. Total at risk: ${formatCurrency(c.amount_at_risk)}.`,
      possible_legitimate_explanation: "These transactions may have a valid business purpose. Review to confirm.",
      recommended_action: `Review the ${c.transaction_ids.length} transaction(s) and confirm they are necessary, correctly priced, and assigned to the right cost centre.`,
      owner_question: `Can we confirm the business purpose of these ${c.merchant_names.join(", ")} payments?`,
      transaction_ids: c.transaction_ids,
      evidence: {
        merchant_names: c.merchant_names,
        date_pattern: c.date_pattern,
        frequency: c.frequency,
        amount_pattern: `Total: ${formatCurrency(c.amount_at_risk)}`,
        total_value: c.amount_at_risk,
        sample_transactions: c.grouped_transactions.flatMap((g) => g.transactions).slice(0, 5),
      },
      grouped_transactions: c.grouped_transactions,
      drilldown_sections: [
        { title: "What triggered this?", content: c.evidence_summary },
        { title: "Why this matters", content: "This pattern may indicate waste, duplication, or a control gap that should be reviewed." },
        { title: "What to check", content: `Review these ${c.transaction_ids.length} transaction(s) and confirm their business purpose.` },
        { title: "Transactions involved", content: `${c.transaction_ids.length} transaction(s), total ${formatCurrency(c.amount_at_risk)}.` },
      ],
      ui_badges: c.amount_at_risk > 1000 ? ["High value", "Needs review"] : ["Needs review"],
      suggested_filters: {
        merchant: c.merchant_names[0] || "",
        category: c.category,
        cardholder: "",
        date_from: "",
        date_to: "",
      },
    };
  });

  const topInsights = insights.slice(0, 12);
  const dateRange = {
    from: data.transactions[0]?.date || "",
    to: data.transactions[data.transactions.length - 1]?.date || "",
  };

  return {
    analysis_type: "business_spend_review",
    executive_summary: {
      headline: `${topInsights.length} findings detected from ${data.summary.transactionCount} transactions`,
      plain_english_summary: `The detection engine found ${topInsights.length} patterns worth reviewing across ${data.summary.transactionCount} transactions. Total amount at risk: ${formatCurrency(topInsights.reduce((s, i) => s + i.amount_at_risk, 0))}.`,
      total_transactions_reviewed: data.summary.transactionCount,
      date_range: dateRange,
      total_income: data.summary.totalCredits,
      total_expenses: data.summary.totalDebits,
      net_cash_flow: data.summary.netFlow,
      items_to_review: topInsights.length,
      estimated_monthly_savings: {
        amount: topInsights.reduce((s, i) => s + i.estimated_monthly_impact, 0) * 0.3,
        confidence: "Low",
        explanation: "Estimated as 30% of flagged amounts. Actual savings depend on review outcomes.",
      },
      top_3_findings: topInsights.slice(0, 3).map((i) => ({
        insight_id: i.id,
        title: i.short_title,
        why_it_matters: i.why_it_matters,
        amount_at_risk: i.amount_at_risk,
      })),
    },
    insights: topInsights,
    quick_actions: [
      {
        label: "Review all flagged transactions",
        description: "Go through each finding and confirm or dismiss.",
        related_insight_ids: topInsights.map((i) => i.id),
      },
      {
        label: "Export review pack",
        description: "Download a PDF summary of all findings for your records.",
        related_insight_ids: topInsights.map((i) => i.id),
      },
    ],
    owner_review_pack: topInsights.slice(0, 10).map((i, idx) => ({
      priority: idx + 1,
      item: i.short_title,
      amount: i.amount_at_risk,
      reason: i.one_line_summary,
      suggested_question: i.owner_question,
      related_insight_id: i.id,
    })),
    missing_data: [
      { field: "Cardholder/stakeholder names", why_it_would_help: "Would enable per-person spending analysis and accountability." },
      { field: "Known business vendor list", why_it_would_help: "Would improve personal vs business expense detection." },
      { field: "Previous months' statements", why_it_would_help: "Would enable trend comparison and anomaly detection over time." },
    ],
  };
}

function buildEmptySpendReview(data: StatementData): SpendReviewResult {
  const dateRange = {
    from: data.transactions[0]?.date || "",
    to: data.transactions[data.transactions.length - 1]?.date || "",
  };

  return {
    analysis_type: "business_spend_review",
    executive_summary: {
      headline: "No significant patterns detected",
      plain_english_summary: `The detection engine reviewed ${data.summary.transactionCount} transactions and found no material patterns requiring review. This is a good sign — your business spending appears well-controlled.`,
      total_transactions_reviewed: data.summary.transactionCount,
      date_range: dateRange,
      total_income: data.summary.totalCredits,
      total_expenses: data.summary.totalDebits,
      net_cash_flow: data.summary.netFlow,
      items_to_review: 0,
      estimated_monthly_savings: {
        amount: 0,
        confidence: "Low",
        explanation: "No savings opportunities detected in this statement.",
      },
      top_3_findings: [],
    },
    insights: [],
    quick_actions: [
      { label: "Upload another statement", description: "Compare multiple periods for better pattern detection.", related_insight_ids: [] },
    ],
    owner_review_pack: [],
    missing_data: [
      { field: "Previous statements", why_it_would_help: "Enables month-over-month comparison and trend detection." },
      { field: "Cardholder names", why_it_would_help: "Enables per-person spending analysis." },
    ],
  };
}

// ── Public API: Mode Dispatcher ──

export async function generateInsights(
  data: StatementData,
  mode: AnalysisMode,
): Promise<AIInsights | SpendReviewResult> {
  if (mode === "business") {
    return generateSpendReview(data);
  }
  return generatePersonalInsights(data);
}

// ── Fallbacks (for when no AI key is configured) ──

export function generatePersonalFallback(data: StatementData): AIInsights {
  const { summary, monthlyBreakdown, categoryBreakdown } = data;

  const topCategory = categoryBreakdown[0];
  const monthsPositive = monthlyBreakdown.filter((m) => m.netFlow > 0).length;
  const healthRatio = monthsPositive / Math.max(monthlyBreakdown.length, 1);

  const spendingPatterns: string[] = [];
  const savingsOpportunities: string[] = [];

  if (topCategory && topCategory.percentage > 40) {
    spendingPatterns.push(`Your largest spending category is ${topCategory.category} at ${topCategory.percentage.toFixed(0)}% of total outgoings.`);
    savingsOpportunities.push(`Review your ${topCategory.category.toLowerCase()} spending — it represents ${topCategory.percentage.toFixed(0)}% of your total outgoings.`);
  }

  if (summary.averageDebit > summary.averageCredit * 0.8) {
    spendingPatterns.push("Your average spending per transaction is close to your average income per transaction, leaving little margin.");
  }

  const lastThree = monthlyBreakdown.slice(-3);
  const trendIncreasing = lastThree.length >= 2 && lastThree[lastThree.length - 1].debits > lastThree[0].debits;

  if (trendIncreasing) {
    spendingPatterns.push("Your spending has been trending upward over the last 3 months.");
    savingsOpportunities.push("Look for subscription services or recurring payments that have crept up — small increases compound.");
  }

  if (monthlyBreakdown.length >= 2) {
    savingsOpportunities.push("Set up automatic transfers to savings on payday to make saving effortless.");
  }

  savingsOpportunities.push("Review your top 5 recurring payments — you might find services you no longer use.");
  savingsOpportunities.push("Consider using cashback or rewards programs for your biggest spending categories.");

  const unusualActivity: string[] = [];
  if (summary.transactionCount < 10) {
    unusualActivity.push("Very few transactions detected — the statement may be incomplete.");
  }

  const avgFlow = summary.netFlow / Math.max(monthlyBreakdown.length, 1);
  const lastMonth = monthlyBreakdown[monthlyBreakdown.length - 1];

  return {
    spendingPatterns: spendingPatterns.slice(0, 5),
    unusualActivity,
    savingsOpportunities: savingsOpportunities.slice(0, 5),
    monthlyForecast: {
      projectedBalance: avgFlow,
      projectedIncome: summary.totalCredits / Math.max(monthlyBreakdown.length, 1),
      projectedExpenses: summary.totalDebits / Math.max(monthlyBreakdown.length, 1),
      confidence: Math.min(monthlyBreakdown.length / 6, 0.9),
      narrative: lastMonth
        ? `Based on your ${monthlyBreakdown.length} months of data, next month looks like a net flow of approximately ${formatCurrency(lastMonth.netFlow)}. `
          + (lastMonth.netFlow > 0
            ? "You're on track to save. Keep it up!"
            : "Watch your spending to get back to positive territory.")
        : "More data is needed for an accurate forecast. Upload additional statements for better predictions.",
    },
    cashFlowHealth: healthRatio >= 0.8 ? "excellent" : healthRatio >= 0.6 ? "good" : healthRatio >= 0.4 ? "fair" : "concerning",
    topRecommendations: savingsOpportunities.slice(0, 3),
  };
}

export function generateBusinessFallback(data: StatementData): SpendReviewResult {
  const candidates = runDetection(data);
  if (candidates.length > 0) {
    return formatCandidatesAsInsights(candidates, data);
  }
  return buildEmptySpendReview(data);
}

export function generateFallbackInsights(
  data: StatementData,
  mode: AnalysisMode,
): AIInsights | SpendReviewResult {
  if (mode === "business") {
    return generateBusinessFallback(data);
  }
  return generatePersonalFallback(data);
}
