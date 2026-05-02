import { extractText } from "unpdf";
import type { StatementData, Transaction } from "@/types";
import { categorizeTransaction, deriveMerchant } from "@/lib/utils";

export async function parsePDFStatement(buffer: Buffer): Promise<StatementData> {
  const data = new Uint8Array(buffer);
  const { text } = await extractText(data, { mergePages: true });

  if (!text || text.trim().length === 0) {
    throw new Error("Could not extract text from this PDF. It may be a scanned image.");
  }

  const transactions = extractTransactions(text);
  if (transactions.length === 0) {
    throw new Error(
      "No transactions found in PDF text. The statement format may not be supported yet."
    );
  }

  const accountInfo = extractAccountInfo(text);
  const summary = computeSummary(transactions);
  const monthlyBreakdown = computeMonthlyBreakdown(transactions);
  const categoryBreakdown = computeCategoryBreakdown(transactions);

  return { transactions, accountInfo, summary, monthlyBreakdown, categoryBreakdown };
}

// ── Transaction extraction (multi-strategy) ────────────────────────────

function extractTransactions(text: string): Transaction[] {
  const cleaned = text
    .replace(/[ \t]+/g, " ")
    .replace(/[£€]/g, "£")
    .replace(/\f/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const result = tryNatWestTable(cleaned);
  if (result.length > 0) return result;

  const generic = tryGenericPatterns(cleaned);
  if (generic.length > 0) return generic;

  return tryBruteForce(cleaned);
}

// ── Strategy 1: NatWest / UK table — Date | Desc | Money Out | Money In | Balance

function tryNatWestTable(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isMetaLine(line)) continue;

    // Line MUST start with a date
    let m = line.match(/^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+)/)
      ?? line.match(/^\s*(\d{1,2}\/\d{1,2})\s+(.+)/);
    if (!m) continue;

    const dateStr = m[1];
    const rest = m[2];

    const allAmounts = findAllAmounts(rest);
    if (allAmounts.length === 0) continue;

    // Last amount is usually the running balance — strip it
    // NatWest: Date | Desc | Money Out | Money In | Balance
    // In extracted text: date desc [debitAmt] [creditAmt] [balanceAmt]
    const balance = allAmounts.length > 1 ? allAmounts.pop()! : undefined;
    const txAmounts = allAmounts; // remaining are transaction amounts

    // Description = text before the first amount
    const firstAmtIdx = rest.search(/£?[\d,]+\.\d{2}/);
    let description = firstAmtIdx > 0 ? rest.slice(0, firstAmtIdx).trim() : rest.trim();

    // Absorb next line if it looks like continuation
    if (description.length < 8 && i + 1 < lines.length) {
      const next = lines[i + 1];
      if (!looksLikeTxStart(next) && !isMetaLine(next)) {
        description += " " + next.replace(/£[\d,]+\.\d{2}.*$/, "").trim();
      }
    }

    // Determine type and amount
    let amount: number;
    let type: "credit" | "debit";

    if (txAmounts.length >= 2) {
      // Both Money Out and Money In columns present (rare — e.g. reversal)
      const [debitAmt, creditAmt] = txAmounts;
      if (creditAmt > 0.01 && debitAmt < 0.01) {
        amount = creditAmt; type = "credit";
      } else if (debitAmt > 0.01 && creditAmt < 0.01) {
        amount = debitAmt; type = "debit";
      } else {
        amount = debitAmt > creditAmt ? debitAmt : creditAmt;
        type = debitAmt > creditAmt ? "debit" : "credit";
      }
    } else if (txAmounts.length === 1) {
      amount = txAmounts[0];
      // Heuristic: check description + spacing for direction
      const firstAmtInLine = rest.indexOf("£");
      // Money In amounts are typically indented further right
      type = isLikelyCredit(description) ? "credit" : "debit";
    } else {
      continue;
    }

    const date = normalizeDate(dateStr);
    description = cleanDescription(description).replace(
      /^(?:DD|BACS|CHAPS|FPO|SO|BP|TFR|CR|DR)\s*/i,
      ""
    );
    if (!date || amount <= 0 || description.length < 1) continue;

    transactions.push({
      id: crypto.randomUUID(),
      date,
      description,
      merchant: deriveMerchant(description),
      amount,
      type,
      direction: type === "credit" ? "income" : "expense",
      category: type === "debit" ? categorizeTransaction(description) : "Income",
    });
  }

  return transactions;
}

// ── Strategy 2: Generic date + desc + amount on same line ──────────────

function tryGenericPatterns(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split("\n");

  const patterns: Array<{ re: RegExp; d: number; de: number; a: number }> = [
    // 12 Jan 2024  DESC  -50.00
    { re: /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\s+(.+?)\s+(-?£?[\d,]+\.\d{2})/i, d: 1, de: 2, a: 3 },
    // 2024-01-15  DESC  -50.00
    { re: /(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?£?[\d,]+\.\d{2})/i, d: 1, de: 2, a: 3 },
    // 01/15/2024  DESC  50.00
    { re: /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?£?[\d,]+\.\d{2})/i, d: 1, de: 2, a: 3 },
  ];

  for (const line of lines) {
    if (isMetaLine(line)) continue;
    for (const { re, d, de, a } of patterns) {
      const m = line.match(re);
      if (!m) continue;
      let amtStr = m[a].replace(/[£,\s]/g, "");
      const isNeg = amtStr.startsWith("-");
      amtStr = amtStr.replace(/^-/, "");
      const amount = parseFloat(amtStr);
      const date = normalizeDate(m[d]);
      const desc = cleanDescription(m[de]);
      if (!date || isNaN(amount) || amount <= 0 || desc.length < 1) continue;
      transactions.push({
        id: crypto.randomUUID(),
        date,
        description: desc,
        merchant: deriveMerchant(desc),
        amount,
        type: isNeg ? "debit" : "credit",
        direction: isNeg ? "expense" : "income",
        category: isNeg ? categorizeTransaction(desc) : "Income",
      });
      break;
    }
  }
  return transactions;
}

// ── Strategy 3: Brute-force — any date-prefixed line with amounts ──────

function tryBruteForce(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (isMetaLine(line)) continue;
    const dm = line.match(/^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/)
           ?? line.match(/^\s*(\d{4}-\d{2}-\d{2})/)
           ?? line.match(/^\s*(\d{1,2}\/\d{1,2})/);
    if (!dm) continue;

    const amounts = findAllAmounts(line);
    if (amounts.length === 0) continue;

    const date = normalizeDate(dm[1]);
    if (!date) continue;

    const dateEnd = (dm.index ?? 0) + dm[0].length;
    const amtIdx = line.search(/£?[\d,]+\.\d{2}/);
    const desc = amtIdx > dateEnd ? line.slice(dateEnd, amtIdx).trim() : line.slice(dateEnd).trim();
    if (desc.length < 1) continue;

    const isCredit = isLikelyCredit(line);
    transactions.push({
      id: crypto.randomUUID(),
      date,
      description: cleanDescription(desc),
      merchant: deriveMerchant(desc),
      amount: amounts[0],
      type: isCredit ? "credit" : "debit",
      direction: isCredit ? "income" : "expense",
      category: isCredit ? "Income" : categorizeTransaction(desc),
    });
  }
  return transactions;
}

// ── Shared helpers ─────────────────────────────────────────────────────

function findAllAmounts(text: string): number[] {
  const amounts: number[] = [];
  const re = /£?(\d{1,3}(?:,\d{3})*\.\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) amounts.push(val);
  }
  return amounts;
}

function isMetaLine(line: string): boolean {
  return /^\s*$/.test(line) ||
    /page\s+\d+/i.test(line) ||
    /continued/i.test(line) ||
    /balance\s+(?:brought|carried)\s+forward/i.test(line) ||
    /^(?:opening|closing)\s+balance/i.test(line) ||
    /statement\s+(?:period|date)/i.test(line) ||
    /sort\s*(?:code)?[\s:]+/i.test(line) ||
    /account\s*(?:number|no)?[\s:]+/i.test(line) ||
    /sheet\s+\d/i.test(line) ||
    /^\s*date\s+description/i.test(line) ||
    /^\s*date\s+details/i.test(line) ||
    /transaction\s*(?:type|details)/i.test(line);
}

function looksLikeTxStart(line: string): boolean {
  return /^\s*\d{1,2}[\/-]\d{1,2}/.test(line) ||
    /^\s*\d{4}-\d{2}-\d{2}/.test(line);
}

function isLikelyCredit(text: string): boolean {
  return /\b(?:credit|deposit|payment\s+in|paid\s+in|transfer\s+in|interest\s+paid|cashback|refund|reversal)\b/i.test(text);
}

function cleanDescription(desc: string): string {
  return desc
    .replace(/£[\d,]+\.\d{2}/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[-–—]\s*/, "")
    .trim();
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

function normalizeDate(raw: string): string | null {
  // DD/MM/YYYY or DD/MM/YY (UK format — must parse manually, not Date())
  let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    const a = parseInt(m[1]), b = parseInt(m[2]);
    // Try DD/MM (UK) first
    if (a <= 31 && b <= 12) {
      return `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }
    // Fallback: MM/DD
    if (b <= 31 && a <= 12) {
      return `${year}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    }
    return null;
  }

  // YYYY-MM-DD (ISO)
  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // DD Mmm YYYY (15 Jan 2024)
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  m = raw.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})/i);
  if (m) {
    const day = parseInt(m[1]);
    const month = months[m[2].toLowerCase().slice(0, 3)];
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Last resort: native Date (for ISO-like strings only)
  const d = new Date(raw);
  if (!isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return d.toISOString().split("T")[0];
  }

  return null;
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
