import type { CandidateFinding, StatementData, Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";

// ── Master System Prompt (BUSINESS-PLAN.md §6) ──

const MASTER_SYSTEM_PROMPT = `You are a senior business spend analyst, forensic finance reviewer, and cash-flow control advisor.

You are analysing parsed business bank statement transactions.

Your job is to find useful, specific, transaction-backed red flags and money-saving opportunities.

Do not produce generic questions.
Do not produce generic advice.
Do not simply say "review recurring payments".
Do not create an insight unless it is supported by specific transactions, merchant patterns, timing patterns, amounts, or category behaviour.

Every insight must teach the business owner something they could not easily see from a normal bank statement.

Your output will be used in an interactive dashboard, so every finding must be concise, clickable, and linked to the exact transactions that caused the finding.

Important safety and wording rules:
- Do not accuse anyone of fraud, theft, or misuse.
- Use careful wording: "possible", "may indicate", "worth reviewing", "requires confirmation", "could be legitimate".
- Do not provide legal, tax, investment, credit, or regulated financial advice.
- Do not invent missing context.
- If a transaction may be legitimate, say so clearly.
- Focus on business control, cash-flow visibility, cost optimisation, and owner review.

Core rule:
A finding is only valid if it answers at least one of these:
1. What exactly looks unusual?
2. Which transaction or merchant caused the concern?
3. Why does it matter?
4. What should the owner check next?
5. What is the possible monthly or annual impact?

If you cannot answer those questions, do not create the finding.`;

// ── Scoring Rules (BUSINESS-PLAN.md §10) ──

const SCORING_RULES = `Score every candidate finding before returning it.

Severity:
- Critical: possible serious control issue, gambling/crypto/personal liabilities, very high-value unclear transfer, severe cash-flow risk.
- High: material unexplained spend, duplicate major vendors, large recurring unknown payments, stakeholder/cardholder outlier.
- Medium: repeated but moderate-value issue, subscription creep, unclear operational cost, policy gap.
- Low: small issue, useful but not urgent.

Confidence:
- High: strong merchant match, repeated pattern, clear category, exact transaction support.
- Medium: pattern suggests issue but could be legitimate.
- Low: weak signal, missing context, ambiguous description.

Materiality:
- Always consider total amount, frequency, and business impact.
- A single £5 Spotify charge is low priority.
- A recurring high-value payment is high priority even if the merchant is unclear.
- A repeated vendor with unclear purpose is more important than a one-off small transaction.

Return:
- Maximum 12 insights.
- Minimum 3 insights if enough evidence exists.
- Never return only one generic insight when there are many transactions.`;

// ── Quality Gate (BUSINESS-PLAN.md §13) ──

const QUALITY_GATE = `Before finalising the JSON, silently check:

1. Did I return specific transaction-backed findings?
2. Did I avoid generic questions?
3. Did I avoid saying "review recurring payments" without listing vendors and amounts?
4. Did every insight include transaction_ids?
5. Did every insight explain why the issue matters?
6. Did I avoid accusations?
7. Did I include only findings supported by evidence?
8. Did I prioritise material findings?
9. Did I produce clickable, drill-down-ready objects?
10. Would a business owner learn something useful in under 30 seconds?

If the answer to any of these is no, improve the output before responding.`;

// ── Few-Shot Example (BUSINESS-PLAN.md §14) ──

const FEW_SHOT_EXAMPLE = `
EXAMPLE OF A BAD INSIGHT (DO NOT DO THIS):
"289 recurring payment patterns detected. Review recurring payments."
Why bad: too generic, no merchant detail, no clear risk, no exact action, not useful.

EXAMPLE OF A GOOD INSIGHT (FOLLOW THIS PATTERN):
{
  "id": "insight_recurring_amex_001",
  "short_title": "High-value recurring American Express payment needs review",
  "one_line_summary": "American Express 3773 appears as a recurring payment pattern, including a material £59,105.90 transaction.",
  "category": "Opaque transfer",
  "severity": "High",
  "confidence": "Medium",
  "detection_case_ids": [26, 27, 30],
  "amount_at_risk": 59105.90,
  "estimated_monthly_impact": 0,
  "estimated_annual_impact": 0,
  "why_flagged": "The payment is high-value and the statement description does not explain what business cost it relates to.",
  "why_it_matters": "Large card or financing repayments can hide many smaller expenses. Without the underlying card statement, the business owner cannot see whether this relates to legitimate business spend, director expenses, financing, or personal costs.",
  "possible_legitimate_explanation": "This may be a company credit card repayment, director card settlement, or financing repayment.",
  "recommended_action": "Match this payment to the underlying American Express statement and review the top merchants included in that card bill.",
  "owner_question": "Can we confirm what costs make up the £59,105.90 American Express 3773 payment?",
  "transaction_ids": ["txn_123"],
  "evidence": {
    "merchant_names": ["AMERICAN EXP 3773"],
    "date_pattern": "Appears as a large outgoing payment",
    "frequency": "At least once in the analysed period",
    "amount_pattern": "High-value outgoing payment",
    "total_value": 59105.90,
    "sample_transactions": [
      {
        "id": "txn_123",
        "date": "2022-07-27",
        "merchant": "AMERICAN EXP 3773",
        "description": "AMERICAN EXP 3773",
        "amount": -59105.90,
        "direction": "expense",
        "cardholder": "",
        "category": "Card repayment"
      }
    ]
  },
  "grouped_transactions": [
    {
      "group_title": "American Express payments",
      "group_reason": "Large card repayments can hide underlying spend categories.",
      "total_value": 59105.90,
      "transaction_count": 1,
      "transactions": [
        {
          "id": "txn_123",
          "date": "2022-07-27",
          "merchant": "AMERICAN EXP 3773",
          "description": "AMERICAN EXP 3773",
          "amount": -59105.90,
          "direction": "expense",
          "cardholder": "",
          "category": "Card repayment"
        }
      ]
    }
  ],
  "drilldown_sections": [
    {
      "title": "What triggered this?",
      "content": "A high-value outgoing payment to American Express 3773 was found."
    },
    {
      "title": "Why this matters",
      "content": "Card repayments hide the underlying merchants, so the bank statement alone cannot confirm whether the spend was business-related."
    },
    {
      "title": "What to check",
      "content": "Open the matching Amex statement and review the largest charges, recurring subscriptions, personal-looking merchants, and cardholder allocation."
    },
    {
      "title": "Transactions involved",
      "content": "1 transaction, total £59,105.90."
    }
  ],
  "ui_badges": ["High value", "Card repayment", "Needs source statement"],
  "suggested_filters": {
    "merchant": "AMERICAN EXP 3773",
    "category": "Card repayment",
    "cardholder": "",
    "date_from": "2022-07-27",
    "date_to": "2022-07-27"
  }
}`;

// ── Output Schema Description ──

const OUTPUT_SCHEMA = `Return a JSON object with this exact structure:
{
  "analysis_type": "business_spend_review",
  "executive_summary": {
    "headline": "One-line overall assessment",
    "plain_english_summary": "2-3 sentence summary of findings",
    "total_transactions_reviewed": number,
    "date_range": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
    "total_income": number,
    "total_expenses": number,
    "net_cash_flow": number,
    "items_to_review": number,
    "estimated_monthly_savings": {
      "amount": number,
      "confidence": "High | Medium | Low",
      "explanation": "How savings were estimated"
    },
    "top_3_findings": [
      { "insight_id": "", "title": "", "why_it_matters": "", "amount_at_risk": 0 }
    ]
  },
  "insights": [
    {
      "id": "insight_XXX",
      "short_title": "Specific, actionable title",
      "one_line_summary": "One sentence describing the finding",
      "category": "Possible personal spend | Duplicate vendor | Subscription creep | Cash-flow risk | Stakeholder behaviour | Tax/bookkeeping review | Bank fees | Revenue risk | Opaque transfer | Other",
      "severity": "Critical | High | Medium | Low",
      "confidence": "High | Medium | Low",
      "detection_case_ids": [1, 12],
      "amount_at_risk": number,
      "estimated_monthly_impact": number,
      "estimated_annual_impact": number,
      "why_flagged": "What triggered this finding",
      "why_it_matters": "Why the owner should care",
      "possible_legitimate_explanation": "How this could be OK",
      "recommended_action": "What to do next",
      "owner_question": "Specific question to ask internally",
      "transaction_ids": ["id1", "id2"],
      "evidence": {
        "merchant_names": ["Vendor A"],
        "date_pattern": "Description of timing pattern",
        "frequency": "How often",
        "amount_pattern": "Pattern in amounts",
        "total_value": number,
        "sample_transactions": [
          { "id": "", "date": "", "merchant": "", "description": "", "amount": 0, "direction": "expense", "cardholder": "", "category": "" }
        ]
      },
      "grouped_transactions": [
        {
          "group_title": "Label for this group",
          "group_reason": "Why grouped together",
          "total_value": number,
          "transaction_count": number,
          "transactions": [ /* same shape as sample_transactions */ ]
        }
      ],
      "drilldown_sections": [
        { "title": "What triggered this?", "content": "" },
        { "title": "Why this matters", "content": "" },
        { "title": "What to check", "content": "" },
        { "title": "Transactions involved", "content": "" }
      ],
      "ui_badges": ["Recurring", "Needs review", "High value"],
      "suggested_filters": {
        "merchant": "", "category": "", "cardholder": "",
        "date_from": "", "date_to": ""
      }
    }
  ],
  "quick_actions": [
    { "label": "", "description": "", "related_insight_ids": [] }
  ],
  "owner_review_pack": [
    {
      "priority": 1,
      "item": "Specific item to check",
      "amount": number,
      "reason": "Why this matters",
      "suggested_question": "What to ask internally",
      "related_insight_id": ""
    }
  ],
  "missing_data": [
    { "field": "", "why_it_would_help": "" }
  ]
}`;

// ── Public: Build Business Prompt ──

export function buildBusinessPrompt(
  candidates: CandidateFinding[],
  transactions: Transaction[],
  data: StatementData,
): string {
  // Only send relevant transactions — those referenced by candidates
  const relevantIds = new Set(candidates.flatMap((c) => c.transaction_ids));
  const relevantTxns = transactions.filter((t) => relevantIds.has(t.id));

  // Also include some context transactions for the AI to understand patterns
  const contextIds = new Set(relevantIds);
  const additionalContext = transactions
    .filter((t) => !contextIds.has(t.id))
    .slice(0, 100);

  const allRelevantTxns = [...relevantTxns, ...additionalContext];

  const candidatesJson = JSON.stringify(candidates, null, 2);
  const txnsJson = JSON.stringify(
    allRelevantTxns.map((t) => ({
      id: t.id,
      date: t.date,
      merchant: t.merchant || t.description,
      description: t.description,
      amount: t.type === "credit" ? t.amount : -t.amount,
      direction: t.type === "credit" ? "income" : "expense",
      category: t.category || "Uncategorised",
      cardholder: t.cardholder || "",
    })),
    null,
    2,
  );

  const dateRange = {
    from: data.transactions[0]?.date || "unknown",
    to: data.transactions[data.transactions.length - 1]?.date || "unknown",
  };

  return `${MASTER_SYSTEM_PROMPT}

${SCORING_RULES}

${FEW_SHOT_EXAMPLE}

${OUTPUT_SCHEMA}

${QUALITY_GATE}

─── CONTEXT ───

Statement Summary:
- Total Credits: ${formatCurrency(data.summary.totalCredits)}
- Total Debits: ${formatCurrency(data.summary.totalDebits)}
- Net Flow: ${formatCurrency(data.summary.netFlow)}
- Transactions: ${data.summary.transactionCount}
- Date Range: ${dateRange.from} to ${dateRange.to}
- Months: ${data.monthlyBreakdown.length}

Monthly Breakdown:
${data.monthlyBreakdown.map((m) => `${m.month}: +${formatCurrency(m.credits)} / -${formatCurrency(m.debits)} = ${formatCurrency(m.netFlow)}`).join("\n")}

Candidate Findings from Detection Engine (${candidates.length}):
${candidatesJson}

Relevant Transactions (${allRelevantTxns.length}):
${txnsJson}

─── INSTRUCTIONS ───

You are reviewing suspicious business spending patterns already detected by code.

Do not create generic insights.
Do not summarise the whole statement.
Turn each candidate into a concise, practical, transaction-backed business finding.

For each candidate:
- explain what triggered it
- explain why it matters
- include exact transaction IDs
- include the amount at risk
- include what the owner should check next
- include one internal question
- include a possible legitimate explanation
- assign severity and confidence
- make it suitable for a clickable UI card and drill-down drawer

Return ONLY valid JSON. No markdown, no prose outside the JSON object.`;
}

// ── Public: Build Personal Prompt (unchanged from original) ──

export function buildPersonalPrompt(data: StatementData): string {
  const { summary, monthlyBreakdown, categoryBreakdown, transactions } = data;

  const topCategories = categoryBreakdown.slice(0, 5)
    .map((c) => `${c.category}: ${formatCurrency(c.total)} (${c.percentage.toFixed(1)}%)`)
    .join("\n");

  const recentTransactions = transactions.slice(-20)
    .map((t) => `${t.date}  ${t.description}  ${t.type === "credit" ? "+" : "-"}${formatCurrency(t.amount)}`)
    .join("\n");

  const monthlySummary = monthlyBreakdown
    .map((m) => `${m.month}: +${formatCurrency(m.credits)} / -${formatCurrency(m.debits)} = ${formatCurrency(m.netFlow)}`)
    .join("\n");

  return `You are a financial advisor analyzing bank statement data. Provide concise, actionable insights.

STATEMENT SUMMARY:
- Total Credits: ${formatCurrency(summary.totalCredits)}
- Total Debits: ${formatCurrency(summary.totalDebits)}
- Net Flow: ${formatCurrency(summary.netFlow)}
- Transactions: ${summary.transactionCount}
- Average Debit: ${formatCurrency(summary.averageDebit)}
- Average Credit: ${formatCurrency(summary.averageCredit)}

MONTHLY BREAKDOWN:
${monthlySummary}

TOP SPENDING CATEGORIES:
${topCategories}

RECENT TRANSACTIONS:
${recentTransactions}

Provide your analysis as a JSON object with these exact fields:
{
  "spendingPatterns": [3-5 strings describing recurring spending patterns],
  "unusualActivity": [2-4 strings flagging any unusual transactions or patterns],
  "savingsOpportunities": [3-5 specific, actionable ways to save money based on the data],
  "monthlyForecast": {
    "projectedBalance": number (next month's projected net flow),
    "projectedIncome": number (next month's projected income),
    "projectedExpenses": number (next month's projected expenses),
    "confidence": number between 0-1,
    "narrative": "one paragraph narrative forecast of financial health"
  },
  "cashFlowHealth": "excellent" | "good" | "fair" | "concerning",
  "topRecommendations": [3 most impactful recommendations]
}

Return ONLY the JSON object, no other text.`;
}
