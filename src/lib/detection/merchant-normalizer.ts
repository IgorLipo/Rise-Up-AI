// Normalize merchant names for pattern matching.
// Strips reference numbers, account codes, payment IDs, dates.

const NOISE_PATTERNS = [
  // Card-number prefix at start (e.g. "9048 31MAY25 CD MERCHANT..." → "MERCHANT...")
  // Banks prepend last-4-of-card before card transactions on statements.
  /^\s*\d{4}\s+/g,
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
  // BP intentionally NOT in this list — collides with BP petrol stations.
  // The handful of legitimate "BP" prefix uses on UK statements are rare enough
  // to keep them in the merchant string; classifier handles them.
  /\b(?:DD|SO|CR)\s+(?=[A-Z])/gi,   // DD=Direct Debit, SO=Standing Order, CR=Credit
  /\b(?:D|C)\s+(?=[A-Z]{3,})/g,        // Single "D" or "C" before a merchant token
  // Payment-processor wrapper prefixes (the merchant name follows the asterisk)
  // "SQ *GLISTENINGPRO" → "GLISTENINGPRO"
  /\bSQ\s*\*/gi,
  /\bSUMUP[\s_]*\*/gi,
  /\bZETTLE[\s_]*\*?/gi,
  /\bIZ\s*\*/gi,
  /\bWHOP[\s_]*\*/gi,
  /\bDNH\s*\*/gi,                       // GoDaddy's wholesale prefix "DNH*GODADDY"
  /\bPP\s*\*/gi,                        // PayPal
  /\bPAYPAL\s*\*/gi,
  // Strip trailing currency / FX suffix block (typical foreign-card statement tail)
  /\b[A-Z]{3}\s+[\d.,]+\s+VRATE\s+[\d.,]+.*$/gi,
  /\bN-S\s+TRN\s+FEE.*$/gi,
  // Date-like noise at end of descriptions
  /\b\d{2}[A-Z]{3}\d{2}\b/g,           // "03JUL25" date format
  // Invoice/reference codes with delimiters — hyphens prevent digit-sequence patterns from matching
  /\b(?:INV|WC|RFQ|PO|ORD)\s*[-:#]?\s*\d{2,}\b/gi,
  // MONZO invoice references: "MONZO INV-12345" → "MONZO"
  /\bMONZO\s+(?:INV|PAY|PYMT|PMT)\s*[-:#]?\s*\d+\b/gi,
  // Payment reference codes: "PMT 12345", "PMT-00123", "PT220686"
  /\bPMT\s*[-:#]?\s*\d+\b/gi,
  /\bPT\d{4,}\b/g,
  // Policy/agreement numbers: "POLICY 123456"
  /\b(?:POLICY|AGREEMENT|CONTRACT)\s*(?:NO|NUMBER|REF)?\s*[-:#]?\s*\d+\b/gi,
  // Company legal suffixes — strip for canonical name purposes
  /\b(?:LTD|LIMITED|PLC|LLP|INC|CORPORATION|CORP|GROUP|HOLDINGS|HOLDING)\b/gi,
  // Transaction type descriptors — not part of merchant name
  /\bINITIAL\s+PAYMENT\b/gi,
  /\bREGULAR\s+PAYMENT\b/gi,
  /\bMONTHLY\s+PAYMENT\b/gi,
  // Trailing country/postcode "GB", "UK", "US", etc.
  /\b(?:GB|UK|US|USA|SG|EU|IE|FR|DE|ES|IT|NL)\b\s*$/g,
];

// Patterns that should preserve a capture group (replace with $1 not blank).
// Run BEFORE the noise loop so the merchant token survives.
const DIGIT_SUFFIX_PRESERVE = /([A-Za-z]{4,})\d{3,}\b/g;

export function normalizeMerchant(description: string): string {
  let cleaned = description;
  // Strip trailing digits from merchant tokens but PRESERVE the merchant name.
  // "SUBWAY25594" → "SUBWAY", "MONZO12345" → "MONZO"
  cleaned = cleaned.replace(DIGIT_SUFFIX_PRESERVE, "$1");
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

// Property-management firms that have many per-property variants. For the
// ONE-OFF flag (cross-month-learner), all variants count as the same firm —
// so a tenant appearing once doesn't get flagged as a one-off if the firm
// has many appearances. But for PATTERN DETECTION, we keep per-property
// granularity (stable amounts per property → cleaner recurrence detection).
export const CANONICAL_FIRM_PATTERNS: RegExp[] = [
  /\btranquil\s*accommoda/i,
  /\bsequoia\s*property/i,
  /\bmidlands?\s*property/i,
  /\bhaus\s*property\s*grou/i,
  /\bonline\s*estate?\s*agen/i,
  /\bamha\s*leiceste/i,
  /\bnasim\s*holding/i,
  /\bthe\s*homebound\s*grou/i,
  /\bace\s*propertie/i,
  /\bmidshire\s*propertie/i,
];

/**
 * Returns the firm name when a description matches a known property-management
 * firm, otherwise null. Used by the one-off classifier to avoid flagging
 * individual property variants as one-offs when the firm itself recurs.
 */
export function canonicalFirmName(description: string): string | null {
  const map: Record<string, string> = {
    "tranquil": "TRANQUIL ACCOMMODA",
    "sequoia": "SEQUOIA PROPERTY",
    "midlands": "MIDLANDS PROPERTY",
    "haus": "HAUS PROPERTY",
    "online estate": "ONLINE ESTATE",
    "amha": "AMHA LEICESTER",
    "nasim": "NASIM HOLDINGS",
    "homebound": "HOMEBOUND",
    "ace propertie": "ACE PROPERTIES",
    "midshire": "MIDSHIRE PROPERTIES",
  };
  for (const [key, canonical] of Object.entries(map)) {
    if (description.toLowerCase().includes(key)) return canonical;
  }
  return null;
}

// Extract the core merchant name — skip address/unit noise and take meaningful words.
// Uses up to 4 words (more than before) for longer merchant names.
export function coreMerchant(description: string): string {
  // Collapse short tokens around ampersands into joined form ("B & Q" → "B&Q")
  // so they survive the single-char skip rule below.
  let normalized = normalizeMerchant(description);
  normalized = normalized.replace(/\b([A-Za-z0-9])\s*&\s*([A-Za-z0-9])\b/g, "$1&$2");

  const words = normalized.split(/\s+/);
  const core: string[] = [];

  for (const rawWord of words) {
    if (core.length >= 4) break;
    // Strip trailing/leading punctuation so "FLAT 1," and "FLAT 1" produce
    // the same core merchant key. Previously, the comma made TRANQUIL
    // ACCOMMODA FLAT 1, … and TRANQUIL ACCOMMODA FLAT 1 … look like two
    // different vendors, breaking recurrence detection and flagging every
    // tenant as a one-off.
    const word = rawWord.replace(/^[^A-Za-z0-9&]+|[^A-Za-z0-9&]+$/g, "");
    if (!word) continue;
    if (/^\d+$/.test(word)) continue;
    if (word.length < 2) continue;
    if (ADDRESS_NOISE.has(word.toLowerCase())) continue;
    if (/^[A-Za-z]\d{1,3}$/.test(word)) continue;
    core.push(word);
  }
  return core.join(" ") || normalized;
}
