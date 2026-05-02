import type { Transaction, StatementData, CandidateFinding, EnrichedTransaction, GroupedTransactionBlock } from "@/types";

// ── Helpers ──

function toEnriched(tx: Transaction): EnrichedTransaction {
  return {
    id: tx.id,
    date: tx.date,
    merchant: tx.merchant || tx.description,
    description: tx.description,
    amount: tx.amount,
    direction: tx.type === "credit" ? "income" : "expense",
    cardholder: tx.cardholder || "",
    category: tx.category || "Other",
  };
}

function merchantKey(merchant: string): string {
  return merchant.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

function severityForAmount(amount: number): "Critical" | "High" | "Medium" | "Low" {
  if (amount > 5000) return "Critical";
  if (amount > 1000) return "High";
  if (amount > 200) return "Medium";
  return "Low";
}

// ── Main Entry Point ──

export function runDetection(data: StatementData): CandidateFinding[] {
  const txns = data.transactions.filter((t) => t.type === "debit");
  const allTxns = data.transactions;

  const detectors = [
    detectRecurringGroups,
    detectDuplicateVendors,
    detectSameAmountDifferentVendors,
    detectWeekendTransactions,
    detectLargeTransactions,
    detectOpaqueTransactions,
    detectPersonalLikeMerchants,
    detectSoftwareOverlap,
    detectIncomeConcentration,
    detectCashFlowRisks,
    detectRoundNumberTransfers,
    detectBankFees,
    detectSubscriptionCreep,
  ];

  if (data.monthlyBreakdown.length >= 2) {
    detectors.push(detectRevenueExpenseGrowth);
  }

  const all: CandidateFinding[] = [];
  for (const detector of detectors) {
    try {
      const results = detector(txns, allTxns, data);
      all.push(...results);
    } catch {
      // Detector failure shouldn't block other detectors
    }
  }

  // Sort by severity then amount, limit to 30
  const severityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  all.sort((a, b) => {
    const sDiff = severityRank[a.severity] - severityRank[b.severity];
    if (sDiff !== 0) return sDiff;
    return b.amount_at_risk - a.amount_at_risk;
  });

  return all.slice(0, 30);
}

// ── Detectors ──

function detectRecurringGroups(debits: Transaction[]): CandidateFinding[] {
  const byMerchant = new Map<string, Transaction[]>();
  for (const tx of debits) {
    const key = merchantKey(tx.merchant || tx.description);
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(tx);
  }

  const results: CandidateFinding[] = [];
  for (const [key, txs] of byMerchant) {
    if (txs.length < 2) continue;
    const total = txs.reduce((s, t) => s + t.amount, 0);
    if (total < 20) continue;

    const merchantName = txs[0].merchant || txs[0].description;
    results.push({
      detection_case_id: 12,
      title: `Recurring payment: ${merchantName}`,
      category: "Recurring vendor",
      severity: severityForAmount(total),
      confidence: txs.length >= 3 ? "High" : "Medium",
      merchant_names: [merchantName],
      transaction_ids: txs.map((t) => t.id),
      amount_at_risk: total,
      frequency: `${txs.length} times in statement period`,
      date_pattern: txs.map((t) => t.date).sort().join(", "),
      evidence_summary: `${merchantName} appears ${txs.length} times totalling £${total.toFixed(2)}.`,
      grouped_transactions: [{
        group_title: `${merchantName} payments`,
        group_reason: `Recurring debit from ${merchantName}`,
        total_value: total,
        transaction_count: txs.length,
        transactions: txs.map(toEnriched),
      }],
    });
  }

  return results;
}

function detectDuplicateVendors(debits: Transaction[]): CandidateFinding[] {
  const results: CandidateFinding[] = [];
  const byMerchant = new Map<string, Transaction[]>();
  for (const tx of debits) {
    const key = merchantKey(tx.merchant || tx.description);
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(tx);
  }

  for (const [, txs] of byMerchant) {
    if (txs.length < 2) continue;
    // Check for same/similar amounts in close date proximity
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        const amountDiff = Math.abs(a.amount - b.amount);
        const daysDiff = Math.abs(parseDate(a.date).getTime() - parseDate(b.date).getTime()) / (1000 * 60 * 60 * 24);
        if (amountDiff < 2 && daysDiff < 31 && daysDiff > 0) {
          const total = a.amount + b.amount;
          results.push({
            detection_case_id: 12,
            title: `Possible duplicate charge: ${a.merchant || a.description}`,
            category: "Duplicate vendor",
            severity: severityForAmount(total),
            confidence: amountDiff < 0.01 ? "High" : "Medium",
            merchant_names: [a.merchant || a.description],
            transaction_ids: [a.id, b.id],
            amount_at_risk: total,
            frequency: `${2} similar charges in ${daysDiff.toFixed(0)} days`,
            date_pattern: `${a.date}, ${b.date}`,
            evidence_summary: `Two charges of £${a.amount.toFixed(2)} and £${b.amount.toFixed(2)} from the same vendor within ${daysDiff.toFixed(0)} days.`,
            grouped_transactions: [{
              group_title: "Potentially duplicated charges",
              group_reason: "Same vendor, nearly identical amount, close dates",
              total_value: total,
              transaction_count: 2,
              transactions: [a, b].map(toEnriched),
            }],
          });
          break;
        }
      }
    }
  }

  return results.slice(0, 5);
}

function detectSameAmountDifferentVendors(debits: Transaction[]): CandidateFinding[] {
  const results: CandidateFinding[] = [];
  const byAmount = new Map<number, Transaction[]>();
  for (const tx of debits) {
    const rounded = Math.round(tx.amount);
    if (!byAmount.has(rounded)) byAmount.set(rounded, []);
    byAmount.get(rounded)!.push(tx);
  }

  for (const [amount, txs] of byAmount) {
    if (txs.length < 2 || amount < 5) continue;
    const uniqueVendors = new Set(txs.map((t) => merchantKey(t.merchant || t.description)));
    if (uniqueVendors.size < 2) continue;

    const total = txs.reduce((s, t) => s + t.amount, 0);
    results.push({
      detection_case_id: 20,
      title: `Identical amount (£${amount}) paid to ${uniqueVendors.size} different vendors`,
      category: "Duplicate/Overlapping spend",
      severity: total > 500 ? "High" : "Medium",
      confidence: "Medium",
      merchant_names: [...new Set(txs.map((t) => t.merchant || t.description))],
      transaction_ids: txs.map((t) => t.id),
      amount_at_risk: total,
      frequency: `${txs.length} transactions of £${amount}`,
      date_pattern: txs.map((t) => t.date).sort().join(", "),
      evidence_summary: `${txs.length} payments of exactly £${amount} to ${uniqueVendors.size} different vendors — may indicate duplicate or equivalent services.`,
      grouped_transactions: [{
        group_title: `£${amount} payments`,
        group_reason: "Identical amounts to different vendors",
        total_value: total,
        transaction_count: txs.length,
        transactions: txs.map(toEnriched),
      }],
    });
  }

  return results.slice(0, 3);
}

function detectWeekendTransactions(debits: Transaction[]): CandidateFinding[] {
  const weekendTxns = debits.filter((t) => isWeekend(t.date) && t.amount > 10);
  if (weekendTxns.length < 2) return [];

  const total = weekendTxns.reduce((s, t) => s + t.amount, 0);
  const merchants = [...new Set(weekendTxns.map((t) => t.merchant || t.description))];

  return [{
    detection_case_id: 22,
    title: `${weekendTxns.length} weekend transactions detected`,
    category: "Stakeholder/Cardholder behaviour",
    severity: total > 500 ? "Medium" : "Low",
    confidence: "Medium",
    merchant_names: merchants.slice(0, 10),
    transaction_ids: weekendTxns.map((t) => t.id),
    amount_at_risk: total,
    frequency: `${weekendTxns.length} transactions on weekends`,
    date_pattern: "Saturday and Sunday transactions",
    evidence_summary: `${weekendTxns.length} transactions totalling £${total.toFixed(2)} occurred on weekends. These may be legitimate but warrant review.`,
    grouped_transactions: [{
      group_title: "Weekend transactions",
      group_reason: "Debit transactions on Saturday or Sunday",
      total_value: total,
      transaction_count: weekendTxns.length,
      transactions: weekendTxns.slice(0, 10).map(toEnriched),
    }],
  }];
}

function detectLargeTransactions(debits: Transaction[]): CandidateFinding[] {
  const sorted = [...debits].sort((a, b) => b.amount - a.amount);
  const topCount = Math.max(5, Math.ceil(sorted.length * 0.05));
  const large = sorted.slice(0, topCount).filter((t) => t.amount > 200);

  const results: CandidateFinding[] = [];
  for (const tx of large) {
    results.push({
      detection_case_id: 26,
      title: `Large payment: £${tx.amount.toFixed(2)} to ${tx.merchant || tx.description}`,
      category: "High-value unclear payment",
      severity: severityForAmount(tx.amount),
      confidence: "Medium",
      merchant_names: [tx.merchant || tx.description],
      transaction_ids: [tx.id],
      amount_at_risk: tx.amount,
      frequency: "One-time in statement period",
      date_pattern: tx.date,
      evidence_summary: `${tx.merchant || tx.description} received a £${tx.amount.toFixed(2)} payment. Confirm this is expected and has a clear business purpose.`,
      grouped_transactions: [{
        group_title: "Large payment",
        group_reason: "Top 5% largest debit transaction",
        total_value: tx.amount,
        transaction_count: 1,
        transactions: [toEnriched(tx)],
      }],
    });
  }

  return results.slice(0, 5);
}

function detectOpaqueTransactions(debits: Transaction[]): CandidateFinding[] {
  const opaqueKeywords = [
    "paypal", "apple.com/bill", "google ", "meta pay", "curve ",
    "revolut", "wise ", "transferwise", "stripe", "klarna",
  ];

  const matched = debits.filter((t) =>
    opaqueKeywords.some((k) => (t.merchant || t.description).toLowerCase().includes(k)),
  );

  if (matched.length < 2) return [];

  const total = matched.reduce((s, t) => s + t.amount, 0);
  const merchants = [...new Set(matched.map((t) => t.merchant || t.description))];

  return [{
    detection_case_id: 30,
    title: `${matched.length} opaque payments through intermediaries`,
    category: "Opaque transfer",
    severity: total > 1000 ? "High" : "Medium",
    confidence: "Medium",
    merchant_names: merchants,
    transaction_ids: matched.map((t) => t.id),
    amount_at_risk: total,
    frequency: `${matched.length} transactions`,
    date_pattern: matched.map((t) => t.date).sort().join(", "),
    evidence_summary: `${matched.length} payments totalling £${total.toFixed(2)} went through payment intermediaries. The final merchant is unclear — review these for business purpose.`,
    grouped_transactions: [{
      group_title: "Opaque intermediary payments",
      group_reason: "Payment methods that obscure the final merchant",
      total_value: total,
      transaction_count: matched.length,
      transactions: matched.map(toEnriched),
    }],
  }];
}

function detectPersonalLikeMerchants(debits: Transaction[]): CandidateFinding[] {
  const personalPatterns: Record<number, { keywords: string[]; label: string }> = {
    1: { keywords: ["netflix", "spotify", "disney+", "apple tv", "youtube premium", "audible", "prime video"], label: "Personal streaming" },
    2: { keywords: ["amazon prime", "amazon digital", "kindle", "audible"], label: "Personal Amazon services" },
    3: { keywords: ["deliveroo", "uber eats", "just eat", "takeaway"], label: "Food delivery" },
    5: { keywords: ["asos", "zara", "h&m", "nike", "adidas", "selfridges", "uniqlo", "primark"], label: "Fashion/retail" },
    6: { keywords: ["puregym", "david lloyd", "nuffield health", "gym", "spa", "salon", "cosmetics"], label: "Beauty/wellness/gym" },
  };

  const results: CandidateFinding[] = [];
  for (const [caseId, { keywords, label }] of Object.entries(personalPatterns)) {
    const matched = debits.filter((t) =>
      keywords.some((k) => (t.merchant || t.description).toLowerCase().includes(k)),
    );
    if (matched.length === 0) continue;

    const total = matched.reduce((s, t) => s + t.amount, 0);
    const merchants = [...new Set(matched.map((t) => t.merchant || t.description))];
    results.push({
      detection_case_id: parseInt(caseId),
      title: `Possible ${label.toLowerCase()} spend: ${merchants.slice(0, 3).join(", ")}`,
      category: "Possible personal/non-business expense",
      severity: total > 200 ? "Medium" : "Low",
      confidence: "Medium",
      merchant_names: merchants,
      transaction_ids: matched.map((t) => t.id),
      amount_at_risk: total,
      frequency: `${matched.length} transactions`,
      date_pattern: matched.map((t) => t.date).sort().join(", "),
      evidence_summary: `${matched.length} transactions matching ${label.toLowerCase()} patterns totalling £${total.toFixed(2)}. Confirm these are legitimate business expenses.`,
      grouped_transactions: [{
        group_title: label,
        group_reason: `Matches known ${label.toLowerCase()} vendor patterns`,
        total_value: total,
        transaction_count: matched.length,
        transactions: matched.map(toEnriched),
      }],
    });
  }

  return results;
}

function detectSoftwareOverlap(debits: Transaction[]): CandidateFinding[] {
  const saasCategories: Record<string, string[]> = {
    Collaboration: ["slack", "teams", "zoom", "google meet", "notion", "confluence", "monday.com", "asana", "trello", "basecamp", "clickup"],
    Storage: ["dropbox", "google drive", "box.com", "onedrive", "sharepoint"],
    CRM: ["hubspot", "salesforce", "zendesk", "intercom", "pipedrive"],
    Design: ["figma", "canva", "adobe", "sketch", "invision"],
    Accounting: ["xero", "quickbooks", "freeagent", "sage", "dext"],
    Hosting: ["aws", "azure", "google cloud", "digitalocean", "heroku", "vercel", "netlify"],
  };

  const results: CandidateFinding[] = [];
  for (const [category, keywords] of Object.entries(saasCategories)) {
    const matched = debits.filter((t) =>
      keywords.some((k) => (t.merchant || t.description).toLowerCase().includes(k)),
    );
    if (matched.length < 2) continue;

    const uniqueTools = new Set(matched.map((t) => merchantKey(t.merchant || t.description)));
    if (uniqueTools.size < 2) continue;

    const total = matched.reduce((s, t) => s + t.amount, 0);
    results.push({
      detection_case_id: 11,
      title: `Possible ${category.toLowerCase()} tool overlap: ${uniqueTools.size} tools detected`,
      category: "Duplicate/Overlapping SaaS",
      severity: total > 200 ? "High" : "Medium",
      confidence: "Medium",
      merchant_names: [...new Set(matched.map((t) => t.merchant || t.description))],
      transaction_ids: matched.map((t) => t.id),
      amount_at_risk: total,
      frequency: `${matched.length} transactions across ${uniqueTools.size} tools`,
      date_pattern: matched.map((t) => t.date).sort().join(", "),
      evidence_summary: `Multiple ${category.toLowerCase()} tools may be overlapping. Total spend: £${total.toFixed(2)}. Consider consolidating to reduce waste.`,
      grouped_transactions: [{
        group_title: `${category} tools`,
        group_reason: `Multiple vendors in the ${category.toLowerCase()} category`,
        total_value: total,
        transaction_count: matched.length,
        transactions: matched.map(toEnriched),
      }],
    });
  }

  return results.slice(0, 3);
}

function detectIncomeConcentration(_debits: Transaction[], allTxns: Transaction[]): CandidateFinding[] {
  const credits = allTxns.filter((t) => t.type === "credit");
  if (credits.length < 2) return [];

  const byPayer = new Map<string, number>();
  for (const tx of credits) {
    const key = merchantKey(tx.merchant || tx.description);
    byPayer.set(key, (byPayer.get(key) || 0) + tx.amount);
  }

  const totalIncome = [...byPayer.values()].reduce((s, v) => s + v, 0);
  if (totalIncome === 0) return [];

  const sorted = [...byPayer.entries()].sort((a, b) => b[1] - a[1]);
  const topPayer = sorted[0];
  const concentration = topPayer[1] / totalIncome;

  if (concentration < 0.6) return [];

  const payerTxns = credits.filter((t) => merchantKey(t.merchant || t.description) === topPayer[0]);

  return [{
    detection_case_id: 31,
    title: `Revenue concentration: one source is ${(concentration * 100).toFixed(0)}% of income`,
    category: "Cash flow & Revenue health",
    severity: concentration > 0.8 ? "High" : "Medium",
    confidence: "High",
    merchant_names: [payerTxns[0]?.merchant || payerTxns[0]?.description || "Unknown"],
    transaction_ids: payerTxns.map((t) => t.id),
    amount_at_risk: topPayer[1],
    frequency: `${payerTxns.length} income transactions`,
    date_pattern: payerTxns.map((t) => t.date).sort().join(", "),
    evidence_summary: `One income source contributes ${(concentration * 100).toFixed(0)}% of total revenue (£${topPayer[1].toFixed(2)} of £${totalIncome.toFixed(2)}). Losing this source would severely impact the business.`,
    grouped_transactions: [{
      group_title: "Concentrated income source",
      group_reason: "Single payer above 60% of total income",
      total_value: topPayer[1],
      transaction_count: payerTxns.length,
      transactions: payerTxns.map(toEnriched),
    }],
  }];
}

function detectCashFlowRisks(_debits: Transaction[], _allTxns: Transaction[], data: StatementData): CandidateFinding[] {
  const results: CandidateFinding[] = [];
  const months = data.monthlyBreakdown;

  const negativeMonths = months.filter((m) => m.netFlow < 0);
  if (negativeMonths.length >= months.length / 2 && months.length >= 2) {
    results.push({
      detection_case_id: 34,
      title: `${negativeMonths.length} of ${months.length} months had negative cash flow`,
      category: "Cash flow & Revenue health",
      severity: negativeMonths.length >= months.length * 0.75 ? "Critical" : "High",
      confidence: "High",
      merchant_names: [],
      transaction_ids: [],
      amount_at_risk: negativeMonths.reduce((s, m) => s + Math.abs(m.netFlow), 0),
      frequency: `${negativeMonths.length} negative months`,
      date_pattern: negativeMonths.map((m) => m.month).join(", "),
      evidence_summary: `The business had negative net cash flow in ${negativeMonths.length} of ${months.length} months. Review spending and revenue timing urgently.`,
      grouped_transactions: [],
    });
  }

  if (data.accountInfo.closingBalance && data.accountInfo.closingBalance < data.summary.totalDebits * 0.5) {
    results.push({
      detection_case_id: 35,
      title: "Low cash buffer: closing balance may not cover upcoming obligations",
      category: "Cash flow & Revenue health",
      severity: "High",
      confidence: "Medium",
      merchant_names: [],
      transaction_ids: [],
      amount_at_risk: data.summary.totalDebits - (data.accountInfo.closingBalance || 0),
      frequency: "End of statement period",
      date_pattern: "",
      evidence_summary: `Closing balance of £${data.accountInfo.closingBalance?.toFixed(2)} may not be sufficient to cover next month's estimated outgoings.`,
      grouped_transactions: [],
    });
  }

  return results;
}

function detectRoundNumberTransfers(debits: Transaction[]): CandidateFinding[] {
  const roundAmounts = [500, 1000, 2500, 5000, 10000];
  const matched = debits.filter((t) => {
    return roundAmounts.some((r) => Math.abs(t.amount - r) < 1) &&
      (t.description.toLowerCase().includes("transfer") ||
       t.description.toLowerCase().includes("payment") ||
       t.description.toLowerCase().includes("faster payment"));
  });

  if (matched.length < 1) return [];

  const total = matched.reduce((s, t) => s + t.amount, 0);

  return [{
    detection_case_id: 27,
    title: `${matched.length} round-number transfer(s) detected`,
    category: "Opaque transfer",
    severity: total > 5000 ? "High" : "Medium",
    confidence: "Medium",
    merchant_names: matched.map((t) => t.merchant || t.description),
    transaction_ids: matched.map((t) => t.id),
    amount_at_risk: total,
    frequency: `${matched.length} transfers`,
    date_pattern: matched.map((t) => `${t.date}: £${t.amount}`).join(", "),
    evidence_summary: `${matched.length} round-number transfers totalling £${total.toFixed(2)}. These may be dividends, contractor payments, or personal transfers — confirm the purpose.`,
    grouped_transactions: [{
      group_title: "Round-number transfers",
      group_reason: "Exactly even amounts, often personal or dividend transfers",
      total_value: total,
      transaction_count: matched.length,
      transactions: matched.map(toEnriched),
    }],
  }];
}

function detectBankFees(debits: Transaction[]): CandidateFinding[] {
  const feeKeywords = [
    "overdraft fee", "overdraft charge", "unpaid item", "account fee",
    "monthly fee", "service charge", "bank charge", "transfer fee",
    "cash deposit fee", "card fee", "annual fee",
  ];

  const matched = debits.filter((t) =>
    feeKeywords.some((k) => (t.merchant || t.description).toLowerCase().includes(k)) ||
    (t.category === "Bank & Finance Charges"),
  );

  if (matched.length === 0) return [];

  const total = matched.reduce((s, t) => s + t.amount, 0);

  return [{
    detection_case_id: 41,
    title: `${matched.length} bank fee(s) detected totalling £${total.toFixed(2)}`,
    category: "Bank & Finance Charges",
    severity: total > 100 ? "Medium" : "Low",
    confidence: "High",
    merchant_names: matched.map((t) => t.merchant || t.description),
    transaction_ids: matched.map((t) => t.id),
    amount_at_risk: total,
    frequency: `${matched.length} charges`,
    date_pattern: matched.map((t) => t.date).sort().join(", "),
    evidence_summary: `${matched.length} bank or finance charges totalling £${total.toFixed(2)}. Annualised: approximately £${(total * 12).toFixed(2)}. Review whether these can be reduced or eliminated.`,
    grouped_transactions: [{
      group_title: "Bank fees and charges",
      group_reason: "Avoidable bank and finance charges",
      total_value: total,
      transaction_count: matched.length,
      transactions: matched.map(toEnriched),
    }],
  }];
}

function detectSubscriptionCreep(debits: Transaction[]): CandidateFinding[] {
  const smallRecurring = debits.filter((t) => t.amount >= 3 && t.amount <= 50);
  if (smallRecurring.length < 4) return [];

  const byMerchant = new Map<string, Transaction[]>();
  for (const tx of smallRecurring) {
    const key = merchantKey(tx.merchant || tx.description);
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(tx);
  }

  const recurringVendors = [...byMerchant.entries()].filter(([, txs]) => txs.length >= 1);
  if (recurringVendors.length < 4) return [];

  const total = recurringVendors.reduce((s, [, txs]) => s + txs.reduce((ss, t) => ss + t.amount, 0), 0);
  const allTxns = recurringVendors.flatMap(([, txs]) => txs);

  return [{
    detection_case_id: 46,
    title: `${recurringVendors.length} recurring small charges totalling £${total.toFixed(2)}/period`,
    category: "Subscription creep",
    severity: total > 100 ? "Medium" : "Low",
    confidence: "High",
    merchant_names: recurringVendors.map(([key]) => key).slice(0, 10),
    transaction_ids: allTxns.map((t) => t.id),
    amount_at_risk: total,
    frequency: `${allTxns.length} recurring charges`,
    date_pattern: "Recurring throughout statement period",
    evidence_summary: `${recurringVendors.length} small recurring subscriptions or charges totalling £${total.toFixed(2)}. These add up silently — review for necessity.`,
    grouped_transactions: [{
      group_title: "Small recurring charges",
      group_reason: "Many small charges create material monthly burn",
      total_value: total,
      transaction_count: allTxns.length,
      transactions: allTxns.slice(0, 15).map(toEnriched),
    }],
  }];
}

function detectRevenueExpenseGrowth(_debits: Transaction[], _allTxns: Transaction[], data: StatementData): CandidateFinding[] {
  const months = data.monthlyBreakdown;
  if (months.length < 2) return [];

  const latest = months[months.length - 1];
  const previous = months[months.length - 2];

  if (previous.credits === 0 || previous.debits === 0) return [];

  const incomeGrowth = (latest.credits - previous.credits) / previous.credits;
  const expenseGrowth = (latest.debits - previous.debits) / previous.debits;

  if (expenseGrowth <= incomeGrowth) return [];

  return [{
    detection_case_id: 33,
    title: "Expenses growing faster than income",
    category: "Cash flow & Revenue health",
    severity: expenseGrowth - incomeGrowth > 0.2 ? "High" : "Medium",
    confidence: "Medium",
    merchant_names: [],
    transaction_ids: [],
    amount_at_risk: latest.debits - previous.debits,
    frequency: "Month-over-month comparison",
    date_pattern: `${previous.month} → ${latest.month}`,
    evidence_summary: `Income grew ${(incomeGrowth * 100).toFixed(0)}% while expenses grew ${(expenseGrowth * 100).toFixed(0)}% — a gap of ${((expenseGrowth - incomeGrowth) * 100).toFixed(0)}pp. If sustained, this will erode cash reserves.`,
    grouped_transactions: [],
  }];
}
