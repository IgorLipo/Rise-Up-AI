// Normalize merchant names for pattern matching.
// Strips reference numbers, account codes, payment IDs, dates.

const NOISE_PATTERNS = [
  /\bREF:?\s*\S+/gi,
  /\bFP\s+\d{2}\/\d{2}\/\d{2}\s+\d+\s*\w*\b/gi,
  /\b\d{6,}\b/g,                        // Pure digit sequences (reference numbers)
  // Only strip alphanumeric codes with 3+ consecutive digits (real reference codes).
  // This preserves company names like "UNITED92" (letters then short number suffix).
  /\b[A-Z]{1,3}[0-9]{3,}[A-Z0-9]*\b/g,
  /\bVIA\s+MOBILE\s*-\s*PYMT\b/gi,
  /\bPAYMENT TO\b/gi,
  /\bDIRECT DEBIT\b/gi,
  /\bSTANDING ORDER\b/gi,
  /\bBILL PAYMENT\b/gi,
  /\bCARD PAYMENT TO\b/gi,
  /\bOnline Transaction\b/gi,
  /\bAutomated Credit\b/gi,
  /\bOnLine Transaction\b/gi,
  // Bank statement prefixes for card/debit/credit transactions
  /\bCD\s+(?=[A-Z])/gi,                 // "CD MERCHANT" → "MERCHANT"
  /\b(?:DD|SO|BP|CR)\s+(?=[A-Z])/gi,   // DD=Direct Debit, SO=Standing Order, BP=Bill Payment, CR=Credit
  // Date-like noise at end of descriptions
  /\b\d{2}[A-Z]{3}\d{2}\b/g,           // "03JUL25" date format
];

export function normalizeMerchant(description: string): string {
  let cleaned = description;
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned || description.trim();
}

// Words to skip when extracting the core merchant name.
// These are address/unit indicators, bank prefixes that survived normalization,
// and other non-name words.
const ADDRESS_NOISE = new Set([
  "flat", "apt", "apartment", "unit", "suite", "rm", "room",
  "floor", "flr", "house", "building", "bldg", "ops",
  "nth", "north", "sth", "south", "est", "east", "wst", "west",
  "co", "gb", "uk",
  "via", "mobile", "pymt",
]);

// Extract the core merchant name — skip address/unit noise and take meaningful words.
// Uses up to 4 words (more than before) for longer merchant names.
export function coreMerchant(description: string): string {
  const normalized = normalizeMerchant(description);
  const words = normalized.split(/\s+/);
  const core: string[] = [];

  for (const word of words) {
    if (core.length >= 4) break;
    // Skip pure digits
    if (/^\d+$/.test(word)) continue;
    // Skip single characters
    if (word.length < 2) continue;
    // Skip address/unit noise
    if (ADDRESS_NOISE.has(word.toLowerCase())) continue;
    // Skip short unit-like codes: e.g. "F23", "A12", "B7"
    if (/^[A-Za-z]\d{1,3}$/.test(word)) continue;
    core.push(word);
  }
  return core.join(" ") || normalized;
}
