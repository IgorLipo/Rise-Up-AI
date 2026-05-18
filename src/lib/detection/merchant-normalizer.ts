// Normalize merchant names for pattern matching.
// Strips reference numbers, account codes, payment IDs, dates.

const NOISE_PATTERNS = [
  /\bREF:?\s*\S+/gi,
  /\bFP\s+\d{2}\/\d{2}\/\d{2}\s+\d+\s*\w*\b/gi,
  /\b\d{6,}\b/g,                        // Pure digit sequences (reference numbers)
  /\b\d{10,}[A-Za-z]?\b/g,              // Long digit sequences with optional letter suffix
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
  // Invoice/reference codes with delimiters — hyphens prevent digit-sequence patterns from matching
  /\b(?:INV|WC|RFQ|PO|ORD)\s*[-:#]?\s*\d{2,}\b/gi,
  // MONZO invoice references: "MONZO INV-12345" → "MONZO"
  /\bMONZO\s+(?:INV|PAY|PYMT|PMT)\s*[-:#]?\s*\d+\b/gi,
  // Payment reference codes: "PMT 12345", "PMT-00123"
  /\bPMT\s*[-:#]?\s*\d+\b/gi,
  // Policy/agreement numbers: "POLICY 123456"
  /\b(?:POLICY|AGREEMENT|CONTRACT)\s*(?:NO|NUMBER|REF)?\s*[-:#]?\s*\d+\b/gi,
  // Company legal suffixes — strip for canonical name purposes
  /\b(?:LTD|LIMITED|PLC|LLP|INC|CORPORATION|CORP|GROUP|HOLDINGS|HOLDING)\b/gi,
  // Transaction type descriptors — not part of merchant name
  /\bINITIAL\s+PAYMENT\b/gi,
  /\bREGULAR\s+PAYMENT\b/gi,
  /\bMONTHLY\s+PAYMENT\b/gi,
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
  // Road/street types (full forms and common UK abbreviations)
  "road", "rd", "street", "st", "avenue", "ave", "lane", "ln",
  "close", "drive", "dr", "crescent", "cres", "court", "ct",
  "way", "place", "pl", "gardens", "gdns", "grove", "terrace",
  "mews", "walk", "parade", "hill", "mount", "rise", "vale",
  "view", "fields", "green", "wood", "heath", "common", "end",
  "broadway", "circus", "square", "sq", "wharf", "quay",
  "bridge", "row", "path", "gate", "approach", "courtyard",
  "park", // "park" as address suffix (e.g. "Regents Park"), not business
  "estate", "est", // "estate" as in "housing estate" / "trading estate"
  "centre", "center", "central", // industrial/business centre
  "north", "south", "east", "west", // already present in abbreviated form above
  "upper", "lower", "great", "little",
  // Company legal suffixes
  "ltd", "limited", "plc", "llp", "inc", "corp", "corporation", "group", "holdings", "holding",
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
