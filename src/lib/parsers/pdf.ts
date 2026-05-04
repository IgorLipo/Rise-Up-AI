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
  // Normalize whitespace: collapse all runs to single space, compress multiple spaces
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/[£€]/g, "£")
    .trim();

  // Try NatWest format first (handles continuous text, no line breaks needed)
  const natwest = tryNatWestContinuous(cleaned);
  if (natwest.length > 0) return natwest;

  // Fall back to line-based strategies for other banks
  const lines = cleaned
    .replace(/\f/g, "\n")
    .split("\n")
    .filter(Boolean);

  const generic = tryGenericPatterns(lines);
  if (generic.length > 0) return generic;

  return tryBruteForce(lines);
}

// ── Month parsing ──────────────────────────────────────────────────────

const MONTHS_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseNatWestDate(raw: string, fallbackYear: number): string | null {
  const m = raw.match(
    /^(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:\s+(\d{4}))?$/i
  );
  if (!m) return null;
  const day = parseInt(m[1]);
  const month = MONTHS_MAP[m[2].toLowerCase()];
  const year = m[3] ? parseInt(m[3]) : fallbackYear;
  if (!month || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractStatementYear(text: string): number {
  let m = text.match(/Statement\s+Date\s+\d{1,2}\s+\w+\s+(\d{4})/i);
  if (m) return parseInt(m[1]);
  m = text.match(/Period\s+Covered\s+\d{1,2}\s+\w+\s+(\d{4})/i);
  if (m) return parseInt(m[1]);
  m = text.match(/(\d{1,2}\s+\w+\s+(\d{4}))\s+BROUGHT\s+FORWARD/i);
  if (m) return parseInt(m[2]);
  return new Date().getFullYear();
}

// ── Strategy 1: NatWest — continuous text (no line breaks) ─────────────

const TX_PREFIXES = [
  "Automated Credit",
  "OnLine Transaction",
  "Card Transaction",
  "Direct Debit",
  "Cash Withdrawal",
  "Charges",
];

// Matches: <prefix> <description> <amount> <balance>
// Uses a non-capturing group with negative lookahead to ensure we don't
// overrun into the next transaction, a date header, or a page boundary.
const TX_RE = new RegExp(
  `(${TX_PREFIXES.join("|")})\\s+` +
    `((?:(?!${TX_PREFIXES.join("|")}|\\d{1,2}\\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\\b|RETSTMT|Account Name|BROUGHT FORWARD|Take control|Switching|Need help|Statement Abbrev|How to contact|Important info|Dispute Resol).)*?)` +
    `([\\d,]+\\.[0-9]{2})\\s+([\\d,]+\\.[0-9]{2})`,
  "gi"
);

function tryNatWestContinuous(text: string): Transaction[] {
  const statementYear = extractStatementYear(text);
  if (!statementYear) return [];

  const transactions: Transaction[] = [];

  // Iterate over all transaction matches
  let m: RegExpExecArray | null;
  while ((m = TX_RE.exec(text)) !== null) {
    const prefix = m[1];
    const rawDesc = m[2];
    const amountStr = m[3];
    // m[4] is balance, captured but not used

    // Find the most recent date before this transaction
    const textBefore = text.slice(0, m.index);
    const date = findLatestDate(textBefore, statementYear);
    if (!date) continue;

    const amount = parseFloat(amountStr.replace(/,/g, ""));
    let description = rawDesc.trim();

    // Strip trailing partial words / noise
    description = cleanDescription(description);

    // Skip lines that are actually BROUGHT FORWARD variants
    if (/^BROUGHT\s+FORWARD/i.test(description)) continue;
    // Skip footer/header noise that slipped through
    if (description.length < 2) continue;
    if (/^(?:MR|MS|MRS)\s+[A-Z]/i.test(description)) continue;

    // Only card transaction refunds are genuine credits (merchant returns money).
    // OnLine Transaction / Direct Debit "refunds" are payments OUT to someone —
    // the word "refund" in the description just names the purpose of the payment.
    const isCredit =
      prefix === "Automated Credit" ||
      (prefix === "Card Transaction" && /\bREFUND\b/i.test(description));

    transactions.push({
      id: crypto.randomUUID(),
      date,
      description,
      merchant: deriveMerchant(description),
      amount,
      type: isCredit ? "credit" : "debit",
      direction: isCredit ? "income" : "expense",
      category: isCredit ? "Income" : categorizeTransaction(description),
    });
  }

  return transactions;
}

function findLatestDate(
  textBefore: string,
  year: number
): string | null {
  // Find all date-like patterns in the text before this transaction
  const dateRe =
    /\b(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b(?:\s+\d{4})?)\s*/gi;
  const dates: Array<{ date: string; pos: number }> = [];
  let dm: RegExpExecArray | null;
  while ((dm = dateRe.exec(textBefore)) !== null) {
    const parsed = parseNatWestDate(dm[1], year);
    if (parsed) {
      dates.push({ date: parsed, pos: dm.index });
    }
  }

  // Return the latest (last position) date
  if (dates.length === 0) return null;
  dates.sort((a, b) => b.pos - a.pos);
  return dates[0].date;
}

// ── Strategy 2: Generic date + desc + amount on same line ──────────────

function tryGenericPatterns(lines: string[]): Transaction[] {
  const transactions: Transaction[] = [];

  const patterns: Array<{ re: RegExp; d: number; de: number; a: number }> = [
    // 12 Jan 2024  DESC  -50.00
    {
      re: /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\s+(.+?)\s+(-?£?[\d,]+\.\d{2})/i,
      d: 1,
      de: 2,
      a: 3,
    },
    // 2024-01-15  DESC  -50.00
    {
      re: /(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?£?[\d,]+\.\d{2})/i,
      d: 1,
      de: 2,
      a: 3,
    },
    // 01/15/2024  DESC  50.00
    {
      re: /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(-?£?[\d,]+\.\d{2})/i,
      d: 1,
      de: 2,
      a: 3,
    },
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

function tryBruteForce(lines: string[]): Transaction[] {
  const transactions: Transaction[] = [];

  for (const line of lines) {
    if (isMetaLine(line)) continue;
    const dm =
      line.match(/^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/) ??
      line.match(/^\s*(\d{4}-\d{2}-\d{2})/) ??
      line.match(/^\s*(\d{1,2}\/\d{1,2})/);
    if (!dm) continue;

    const amounts = findAllAmounts(line);
    if (amounts.length === 0) continue;

    const date = normalizeDate(dm[1]);
    if (!date) continue;

    const dateEnd = (dm.index ?? 0) + dm[0].length;
    const amtIdx = line.search(/£?[\d,]+\.\d{2}/);
    const desc =
      amtIdx > dateEnd
        ? line.slice(dateEnd, amtIdx).trim()
        : line.slice(dateEnd).trim();
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
  return (
    /^\s*$/.test(line) ||
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
    /transaction\s*(?:type|details)/i.test(line)
  );
}

function isLikelyCredit(text: string): boolean {
  return /\b(?:credit|deposit|payment\s+in|paid\s+in|transfer\s+in|interest\s+paid|cashback|refund|reversal)\b/i.test(
    text
  );
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

  const sortCodeMatch = text.match(
    /(?:sort[-\s]?code|sort)[:\s]*(\d{2}[-\s]?\d{2}[-\s]?\d{2})/i
  );
  const accountMatch = text.match(
    /(?:account[-\s]?(?:number|no))[:\s]*(\d{6,10})/i
  );
  if (sortCodeMatch && accountMatch) {
    info.accountNumber = `${sortCodeMatch[1]} / ${accountMatch[1]}`;
  }

  const bankMatch = text.match(
    /(?:HSBC|Barclays|Lloyds|NatWest|Santander|Halifax|TSB|RBS|Nationwide|Monzo|Revolut|Starling|Metro|First Direct)/i
  );
  if (bankMatch) info.bankName = bankMatch[0];

  const periodMatch = text.match(
    /(?:from|between)\s+(\d{1,2}\s+\w+\s+\d{4})\s+(?:to|and)\s+(\d{1,2}\s+\w+\s+\d{4})/i
  );
  if (periodMatch)
    info.statementPeriod = { from: periodMatch[1], to: periodMatch[2] };

  return info;
}

function normalizeDate(raw: string): string | null {
  // DD/MM/YYYY or DD/MM/YY (UK format — must parse manually, not Date())
  let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    const a = parseInt(m[1]),
      b = parseInt(m[2]);
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
  m = raw.match(
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})/i
  );
  if (m) {
    const day = parseInt(m[1]);
    const month = MONTHS_MAP[m[2].toLowerCase().slice(0, 3)];
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

function computeSummary(
  transactions: Transaction[]
): StatementData["summary"] {
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

function computeMonthlyBreakdown(
  transactions: Transaction[]
): StatementData["monthlyBreakdown"] {
  const monthly = new Map<
    string,
    { credits: number; debits: number; count: number }
  >();

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

function computeCategoryBreakdown(
  transactions: Transaction[]
): StatementData["categoryBreakdown"] {
  const categories = new Map<string, { total: number; count: number }>();
  const debits = transactions.filter((t) => t.type === "debit");

  for (const tx of debits) {
    const cat = tx.category || "Other";
    const existing = categories.get(cat) || { total: 0, count: 0 };
    existing.total += tx.amount;
    existing.count++;
    categories.set(cat, existing);
  }

  const total = Array.from(categories.values()).reduce(
    (s, c) => s + c.total,
    0
  );

  return Array.from(categories.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      percentage: total ? (data.total / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
