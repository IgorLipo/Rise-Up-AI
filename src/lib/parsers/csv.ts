import Papa from "papaparse";
import type { StatementData, Transaction } from "@/types";
import { categorizeTransaction, deriveMerchant } from "@/lib/utils";

export async function parseCSVStatement(buffer: Buffer): Promise<StatementData> {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(`CSV parse error: ${result.errors[0].message}`);
  }

  const transactions = extractTransactions(result.data, result.meta.fields || []);
  const summary = computeSummary(transactions);
  const monthlyBreakdown = computeMonthlyBreakdown(transactions);
  const categoryBreakdown = computeCategoryBreakdown(transactions);

  return {
    transactions,
    accountInfo: detectAccountInfo(result.data, result.meta.fields || []),
    summary,
    monthlyBreakdown,
    categoryBreakdown,
  };
}

function detectColumn(fields: string[], patterns: string[]): string | undefined {
  return fields.find((f) => patterns.some((p) => f.includes(p)));
}

function extractTransactions(
  rows: Record<string, unknown>[],
  fields: string[],
): Transaction[] {
  const dateCol = detectColumn(fields, ["date", "transaction date", "posted date", "value date"]);
  const descCol = detectColumn(fields, ["description", "narrative", "memo", "details", "name", "merchant", "payee"]);
  const amountCol = detectColumn(fields, ["amount", "value", "sum", "transaction amount"]);
  const debitCol = detectColumn(fields, ["debit", "money out", "withdrawal", "paid out"]);
  const creditCol = detectColumn(fields, ["credit", "money in", "deposit", "paid in"]);
  const balanceCol = detectColumn(fields, ["balance", "running balance"]);

  const getVal = (row: Record<string, unknown>, col: string | undefined): string =>
    col ? String(row[col] ?? "") : "";

  const result: Transaction[] = [];

  for (const row of rows) {
    const dateStr = getVal(row, dateCol);
    const desc = getVal(row, descCol);
    const balanceStr = balanceCol ? String(row[balanceCol] ?? "") : "";

    let amount: number;
    let type: "credit" | "debit";

    if (debitCol && creditCol) {
      const debit = parseFloat(getVal(row, debitCol).replace(/[£$€,\s]/g, "") || "0");
      const credit = parseFloat(getVal(row, creditCol).replace(/[£$€,\s]/g, "") || "0");
      if (credit > 0) {
        amount = credit;
        type = "credit";
      } else {
        amount = debit;
        type = "debit";
      }
    } else if (amountCol) {
      const raw = getVal(row, amountCol);
      if (!raw) continue;
      const cleaned = raw.replace(/[£$€,\s]/g, "");
      amount = parseFloat(cleaned);
      type = cleaned.startsWith("-") || amount < 0 ? "debit" : "credit";
      amount = Math.abs(amount);
    } else {
      continue;
    }

    if (!dateStr || !desc || isNaN(amount) || amount === 0) continue;

    const date = normalizeDate(dateStr);
    if (!date) continue;

    result.push({
      id: crypto.randomUUID(),
      date,
      description: desc.trim(),
      merchant: deriveMerchant(desc),
      amount,
      type,
      direction: type === "credit" ? "income" : "expense",
      category: type === "debit" ? categorizeTransaction(desc) : "Income",
      balance: balanceStr ? parseFloat(balanceStr.replace(/[£$€,\s]/g, "")) : undefined,
    });
  }

  return result;
}

function detectAccountInfo(
  rows: Record<string, string>[],
  fields: string[],
): StatementData["accountInfo"] {
  const info: StatementData["accountInfo"] = {};

  const bankCol = detectColumn(fields, ["bank", "institution", "provider"]);
  if (bankCol && rows[0]) info.bankName = rows[0][bankCol];

  const accountCol = detectColumn(fields, ["account number", "account"]);
  if (accountCol && rows[0]) info.accountNumber = rows[0][accountCol];

  return info;
}

function normalizeDate(raw: string): string | null {
  // Try common formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  ];

  for (const fmt of formats) {
    const match = raw.match(fmt);
    if (match) {
      let [, a, b, c] = match;
      let year: number, month: number, day: number;

      if (fmt === formats[0]) {
        [year, month, day] = [parseInt(a), parseInt(b), parseInt(c)];
      } else if (fmt === formats[2]) {
        [month, day, year] = [parseInt(a), parseInt(b), parseInt(c) + 2000];
      } else {
        if (fmt === formats[1] || fmt === formats[3]) {
          [day, month, year] = [parseInt(a), parseInt(b), parseInt(c)];
        } else {
          [month, day, year] = [parseInt(a), parseInt(b), parseInt(c)];
        }
      }

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // Last resort: native Date parse
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

  return null;
}

function computeSummary(transactions: Transaction[]): StatementData["summary"] {
  const credits = transactions.filter((t) => t.type === "credit");
  const debits = transactions.filter((t) => t.type === "debit");
  const totalCredits = credits.reduce((s, t) => s + t.amount, 0);
  const totalDebits = debits.reduce((s, t) => s + t.amount, 0);

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
    const entry = monthly.get(month) || { credits: 0, debits: 0, count: 0 };
    if (tx.type === "credit") entry.credits += tx.amount;
    else entry.debits += tx.amount;
    entry.count++;
    monthly.set(month, entry);
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
    const entry = categories.get(cat) || { total: 0, count: 0 };
    entry.total += tx.amount;
    entry.count++;
    categories.set(cat, entry);
  }

  const grandTotal = Array.from(categories.values()).reduce((s, c) => s + c.total, 0);

  return Array.from(categories.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      percentage: grandTotal ? (data.total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
