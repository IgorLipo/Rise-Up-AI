import { extractText } from "unpdf";
import type { StatementData, Transaction } from "@/types";
import { categorizeTransaction, deriveMerchant } from "@/lib/utils";

export async function parsePDFStatement(buffer: Buffer): Promise<StatementData> {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  const transactions = extractTransactions(text);
  const accountInfo = extractAccountInfo(text);
  const summary = computeSummary(transactions);
  const monthlyBreakdown = computeMonthlyBreakdown(transactions);
  const categoryBreakdown = computeCategoryBreakdown(transactions);

  return {
    transactions,
    accountInfo,
    summary,
    monthlyBreakdown,
    categoryBreakdown,
  };
}

function extractTransactions(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const patterns = [
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\s+(.+?)\s+(-?£?[\d,]+\.\d{2})\s+(-?£?[\d,]+\.\d{2})/i,
    /(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?£?[\d,]+\.\d{2})/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?£?[\d,]+\.\d{2})/i,
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(.+?)\s+(-?[\d,]+\.\d{2})/,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, dateStr, description, amountStr] = match;
        const amount = parseAmount(amountStr);
        const date = normalizeDate(dateStr);
        if (date && !isNaN(amount)) {
          transactions.push({
            id: crypto.randomUUID(),
            date,
            description: description.trim(),
            merchant: deriveMerchant(description),
            amount: Math.abs(amount),
            type: amount < 0 ? "debit" : "credit",
            direction: amount < 0 ? "expense" : "income",
            category: amount < 0 ? categorizeTransaction(description) : "Income",
          });
          break;
        }
      }
    }
  }

  return transactions;
}

function extractAccountInfo(text: string): StatementData["accountInfo"] {
  const info: StatementData["accountInfo"] = {};

  const sortCodeMatch = text.match(/(?:sort[-\s]?code|sort)[:\s]*(\d{2}[-\s]?\d{2}[-\s]?\d{2})/i);
  const accountMatch = text.match(/(?:account[-\s]?(?:number|no))[:\s]*(\d{6,10})/i);
  if (sortCodeMatch && accountMatch) {
    info.accountNumber = `${sortCodeMatch[1]} / ${accountMatch[1]}`;
  }

  const bankMatch = text.match(/(?:HSBC|Barclays|Lloyds|NatWest|Santander|Halifax|TSB|RBS|Nationwide|Monzo|Revolut|Starling|Metro|First Direct)/i);
  if (bankMatch) info.bankName = bankMatch[0];

  const periodMatch = text.match(/(?:from|between)\s+(\d{1,2}\s+\w+\s+\d{4})\s+(?:to|and)\s+(\d{1,2}\s+\w+\s+\d{4})/i);
  if (periodMatch) info.statementPeriod = { from: periodMatch[1], to: periodMatch[2] };

  return info;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[£$€,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? NaN : num;
}

function normalizeDate(raw: string): string | null {
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    const months: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };
    const ukMatch = raw.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})/i);
    if (ukMatch) {
      const day = parseInt(ukMatch[1]);
      const month = months[ukMatch[2].toLowerCase().slice(0, 3)];
      let year = parseInt(ukMatch[3]);
      if (year < 100) year += 2000;
      if (month) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  }
  return d.toISOString().split("T")[0];
}

function computeSummary(transactions: Transaction[]): StatementData["summary"] {
  const credits = transactions.filter((t) => t.type === "credit");
  const debits = transactions.filter((t) => t.type === "debit");

  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0);
  const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0);

  return {
    totalCredits,
    totalDebits,
    netFlow: totalCredits - totalDebits,
    transactionCount: transactions.length,
    averageDebit: debits.length ? totalDebits / debits.length : 0,
    averageCredit: credits.length ? totalCredits / credits.length : 0,
  };
}

function computeMonthlyBreakdown(transactions: Transaction[]): StatementData["monthlyBreakdown"] {
  const monthly = new Map<string, { credits: number; debits: number; count: number }>();

  for (const tx of transactions) {
    const month = tx.date.slice(0, 7);
    const existing = monthly.get(month) || { credits: 0, debits: 0, count: 0 };
    if (tx.type === "credit") existing.credits += tx.amount;
    else existing.debits += tx.amount;
    existing.count++;
    monthly.set(month, existing);
  }

  return Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      credits: data.credits,
      debits: data.debits,
      netFlow: data.credits - data.debits,
      transactionCount: data.count,
    }));
}

function computeCategoryBreakdown(transactions: Transaction[]): StatementData["categoryBreakdown"] {
  const categories = new Map<string, { total: number; count: number }>();
  const debits = transactions.filter((t) => t.type === "debit");

  for (const tx of debits) {
    const cat = tx.category || "Other";
    const existing = categories.get(cat) || { total: 0, count: 0 };
    existing.total += tx.amount;
    existing.count++;
    categories.set(cat, existing);
  }

  const total = Array.from(categories.values()).reduce((s, c) => s + c.total, 0);

  return Array.from(categories.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      percentage: total ? (data.total / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
