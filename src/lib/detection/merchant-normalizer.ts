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

// Comprehensive canonical firm pattern table.
// Empirically mined from the user's 6,294-transaction CSV: 59 fragmented
// recurring vendors representing £1.2M/month of activity were being mis-
// classified as one-offs because per-occurrence suffixes (property name,
// invoice number, account ref, month tag, policy number) made each tx
// look like a different vendor.
//
// Order matters: more specific patterns first.
const CANONICAL_FIRM_TABLE: Array<[RegExp, string]> = [
  // ── Property-mgmt firms (multi-property variants) ─────────────────────
  [/\btranquil\s*accommoda/i, "TRANQUIL ACCOMMODA"],
  [/\bsequoia\s*property/i, "SEQUOIA PROPERTY"],
  [/\bsequoia\b/i, "SEQUOIA PROPERTY"],
  [/\bmidlands?\s*property/i, "MIDLANDS PROPERTY"],
  [/\bhaus\s*property/i, "HAUS PROPERTY"],
  [/\bonline\s*estat/i, "ONLINE ESTATE"],
  [/\bamha\s*leiceste/i, "AMHA LEICESTER"],
  [/\bnasim\s*holdings?/i, "NASIM HOLDINGS"],
  [/\bnasim\b/i, "NASIM"],
  [/\bhomebound/i, "HOMEBOUND"],
  [/\bace\s*propertie/i, "ACE PROPERTIES"],
  [/\bmidshire\s*propertie/i, "MIDSHIRE PROPERTIES"],
  [/\bgreen\s*acres/i, "GREEN ACRES"],
  [/\bsavjani\s*holding/i, "SAVJANI HOLDINGS"],
  [/\bunited92/i, "UNITED92"],
  [/\bshenu\s*investment/i, "SHENU INVESTMENTS"],
  [/\bsandhar\s*investment/i, "SANDHAR INVESTMENT"],
  [/\bahmad\s*mann/i, "AHMAD MANN"],
  [/\blandlord\s*beds?/i, "LANDLORD BEDS"],
  [/\bwww\.wayoflife/i, "WAYOFLIFE"],
  [/\bdaniel\s*mahil/i, "DANIEL MAHIL"],
  [/\bpaul\s*mahil/i, "PAUL MAHIL"],
  [/\bmahil\b/i, "MAHIL"],
  // ── Individual landlords / tenants (each = one canonical vendor) ─────
  [/\bk\s*p\s*shahbaz/i, "K P SHAHBAZ"],
  [/\bpiwowarska/i, "PIWOWARSKA"],
  [/\bhitesh\s*khodiyar/i, "HITESH KHODIYAR"],
  [/\bhiral\s*keshvala/i, "HIRAL KESHVALA"],
  [/\bruksana\s*rawat/i, "RUKSANA RAWAT"],
  [/\bmayur\s*gohel/i, "MAYUR GOHEL"],
  [/\borenzeb/i, "ORENZEB"],
  [/\bmohammed\s*vindhani/i, "MOHAMMED VINDHANI"],
  [/\bdawood\s*osman/i, "DAWOOD OSMAN"],
  // ── Salaries (every month gets a "Salary MM/YY" suffix → looks new) ──
  [/\bophir\s*lahav/i, "OPHIR LAHAV"],
  [/\bhamza\s*ahmed/i, "HAMZA AHMED"],
  [/\bia\s*choudhury\b/i, "CHOUDHURY"],
  [/\baadam\s*choudhury/i, "CHOUDHURY"],
  [/\bchoudhury\b/i, "CHOUDHURY"],
  [/\bjulia\s*boguslawska/i, "JULIA BOGUSLAWSKA"],
  [/\bmya\s*noble/i, "MYA NOBLE"],
  [/\bfahad\s*ahmed/i, "FAHAD AHMED"],
  [/\bmahtab\s*ahmed/i, "MAHTAB AHMED"],
  [/\blahav\s*o\s*director/i, "LAHAV O"],
  [/\bag\s*ophir\s*lahav/i, "LAHAV O"],
  [/\bol\s*management/i, "OL MANAGEMENT"],
  // ── Contractors (each has invoice-number-per-occurrence) ─────────────
  [/\bkane\s*jones/i, "KANE JONES"],
  [/\bm\s*rayyan\s*sheikh/i, "M RAYYAN SHEIKH"],
  [/\brayyan\s*sheikh/i, "M RAYYAN SHEIKH"],
  [/\bwahiduz\s*zaman/i, "WAHIDUZ ZAMAN"],
  [/\bshafikuz\s*zaman/i, "SHAFIKUZ ZAMAN"],
  [/\bshaheeduz\s*zaman/i, "SHAHEEDUZ ZAMAN"],
  [/\bi\s*szachidewicz/i, "I SZACHIDEWICZ"],
  [/\bp\s*zimecki/i, "P ZIMECKI"],
  [/\bdarius?z?\s*browarek/i, "DARIUSZ BROWAREK"],
  [/\bsatinder\s*singh/i, "SATINDER SINGH"],
  [/\bfaizan\s*shafiq/i, "FAIZAN SHAFIQ"],
  [/\bkenneth\s*obilaso/i, "KENNETH OBILASO"],
  [/\baltaf\s*daud/i, "ALTAF DAUD"],
  [/\bdavinder\s*singh/i, "DAVINDER SINGH"],
  [/\behmad\s*ajij/i, "EHMAD AJIJ"],
  [/\bmy\s*projectz/i, "MY PROJECTZ"],
  [/\ba[\s.]?g[\s.]?a[hj]med/i, "A G AHMED"],
  [/\bjorge\s*lopes/i, "JORGE LOPES"],
  [/\bm\s*f\s*shahul\s*hameed/i, "M F SHAHUL HAMEED"],
  [/\bmujtaba\s*hashimi/i, "MUJTABA HASHIMI"],
  [/\bg45\s*property\s*maint/i, "G45 PROPERTY MAINT"],
  [/\bbanner\s*&\s*associat/i, "BANNER & ASSOCIATES"],
  [/\bd&s\s*drainage/i, "D&S DRAINAGE"],
  [/\bbrenda\s*fuller/i, "BRENDA FULLER"],
  // ── Materials / suppliers (invoice-numbered per tx) ──────────────────
  [/\bikstar\b/i, "IKSTAR"],
  [/\bclh\s*group/i, "CLH GROUP"],
  [/\baccess\s*uk/i, "ACCESS UK"],
  [/\baccess\b/i, "ACCESS"],
  [/\bsleep\s*assured/i, "SLEEP ASSURED"],
  // ── Utilities (account-ref-per-tx) ───────────────────────────────────
  [/\boctopus\s*energy/i, "OCTOPUS ENERGY"],
  [/\boctopus\b/i, "OCTOPUS ENERGY"],
  [/\bedf\s*energy/i, "EDF ENERGY"],
  [/\bedf\s*card/i, "EDF ENERGY"],
  [/\bedf\b/i, "EDF ENERGY"],
  [/\beon\s*next/i, "EON NEXT"],
  [/\be\.on\s*next/i, "EON NEXT"],
  [/\be\.on\b/i, "EON NEXT"],
  [/\bovo\s*energy/i, "OVO ENERGY"],
  [/\bovo\b/i, "OVO ENERGY"],
  [/\bscottish\s*power/i, "SCOTTISH POWER"],
  [/\bscottishpower/i, "SCOTTISH POWER"],
  [/\bbritish\s*gas/i, "BRITISH GAS"],
  [/\bsevern\s*trent/i, "SEVERN TRENT"],
  [/\bthames\s*water/i, "THAMES WATER"],
  // ── Insurance (policy-number-per-tx) ─────────────────────────────────
  [/\bzurich/i, "ZURICH"],
  [/\bvitality\s*health/i, "VITALITY HEALTH"],
  [/\bpc\/simply\s*business/i, "SIMPLY BUSINESS"],
  [/\bsimply\s*business/i, "SIMPLY BUSINESS"],
  [/\badmiral\s*insurance/i, "ADMIRAL"],
  [/\badmiral\b/i, "ADMIRAL"],
  [/\bveygo/i, "VEYGO"],
  [/\blvic\b/i, "LVIC"],
  // ── Taxes / pensions / councils ──────────────────────────────────────
  [/\bhmrc\s*sdds/i, "HMRC"],
  [/\bhmrc\s*ndds/i, "HMRC"],
  [/\bhmrc\b/i, "HMRC"],
  [/\bnest\s*it\d/i, "NEST"],
  [/\bnest\b/i, "NEST"],
  [/\bpensions?\s*regul/i, "PENSIONS REGULATOR"],
  [/\bhbbc/i, "HINCKLEY & BOSWORTH"],
  [/\bhinckley\s*&?\s*boswor/i, "HINCKLEY & BOSWORTH"],
  [/\bleicester\s*city\s*coun/i, "LEICESTER CITY COUNCIL"],
  [/\blcc\s*ct/i, "LEICESTER CITY COUNCIL"],
  [/\blcc\s*customer/i, "LEICESTER CITY COUNCIL"],
  [/\blcc\s*npu/i, "LEICESTER CITY COUNCIL"],
  [/\blcc\b/i, "LEICESTER CITY COUNCIL"],
  [/\bblaby\s*district/i, "BLABY DISTRICT"],
  [/\bliverpool\s*county/i, "LIVERPOOL COUNTY"],
  [/\bcamden\s*council/i, "CAMDEN COUNCIL"],
  [/\bstaffor/i, "STAFFORD"],
  [/\bbarnet\.keyivr/i, "BARNET"],
  // ── Vehicle ──────────────────────────────────────────────────────────
  [/\bautohorn\s*fleet/i, "AUTOHORN"],
  [/\bautohorn\b/i, "AUTOHORN"],
  // ── Banking / financing ──────────────────────────────────────────────
  [/\bcapital\s*on\s*tap/i, "CAPITAL ON TAP"],
  [/\bwww\.capital\s*ontap/i, "CAPITAL ON TAP"],
  [/\bcapify/i, "CAPIFY"],
  [/\bpropel\s*finance/i, "PROPEL FINANCE"],
  [/\broyal\s*bank/i, "ROYAL BANK"],
  [/\bctcs\s*barclays/i, "CTCS BARCLAYS"],
  [/\bbmach\b/i, "BMACH ATM"],
  [/\bnotemachine/i, "NOTEMACHINE ATM"],
  [/\bacc-nwestplat/i, "NWESTPLAT FEE"],
  [/\bunpaid\s*item\s*fee/i, "UNPAID ITEM FEE"],
  [/\b\d{1,2}[a-z]{3}\s+a\/c\s*\d{4,}/i, "A/C STATEMENT"],
  // ── Subscriptions / software ─────────────────────────────────────────
  [/\bvodafone/i, "VODAFONE"],
  [/\bee\s*limited/i, "EE"],
  [/\bee\s*ltd/i, "EE"],
  [/\baerial\s*direct/i, "AERIAL DIRECT"],
  [/\bopenai/i, "OPENAI"],
  [/\bchatgpt/i, "OPENAI"],
  [/\b01\.ai/i, "01.AI"],
  [/\bgodaddy/i, "GODADDY"],
  [/\bdnh\*godaddy/i, "GODADDY"],
  [/\bexposcale/i, "EXPOSCALE"],
  [/\bsam\s*preston/i, "SAM PRESTON"],
  [/\bevolution\s*fitness/i, "EVOLUTION FITNESS"],
  [/\bufs\s*\*evolution/i, "EVOLUTION FITNESS"],
  [/\bpure\s*gym/i, "PURE GYM"],
  [/\bpuregym\s*limited/i, "PURE GYM"],
  [/\bbemorefit/i, "BEMOREFIT"],
  [/\bcarisbrooke/i, "CARISBROOKE"],
  [/\bwww\.e\.org/i, "WWW.E.ORG"],
  // ── Marketing / print ────────────────────────────────────────────────
  [/\baa\s*print/i, "AA PRINT"],
  [/\bminuteman\s*press/i, "MINUTEMAN PRESS"],
  [/\bace\s*marketing/i, "ACE MARKETING"],
  // ── Misc recurring ───────────────────────────────────────────────────
  [/\bcome\s*toge/i, "INTER-COMPANY"],
  [/\bsame\s*company\s*accou/i, "INTER-COMPANY"],
  [/\bfp\s*reject/i, "FP REJECT"],
  // ── Supermarkets (per-store variants) ────────────────────────────────
  [/\basda\s*superstor/i, "ASDA"],
  [/\basda\s*stores?/i, "ASDA"],
  [/\baldi\b/i, "ALDI"],
  [/\bsainsbury'?s?\s*petrol/i, "SAINSBURYS PETROL"],
  [/\bsainsburys\s*s\/mkts?/i, "SAINSBURYS"],
  [/\btesco\s*pfs/i, "TESCO PETROL"],
  [/\btesco\s*stores?/i, "TESCO"],
  [/\bcostco\s*pfs/i, "COSTCO PETROL"],
  [/\bcostco\s*wholesale/i, "COSTCO"],
  [/\bmarks\s*&\s*spencer/i, "M&S"],
  [/\bm&s\b/i, "M&S"],
  [/\btkmaxx/i, "TK MAXX"],
  [/\btk\s*maxx/i, "TK MAXX"],
  [/\bsq\s*\*f1pro/i, "F1PROVALETING"],
  [/\bf1provaleting/i, "F1PROVALETING"],
];

/**
 * Returns the firm name when a description matches a known recurring vendor,
 * otherwise null. Used as the PRIMARY vendor key in cross-month detection so
 * per-occurrence suffixes (property name, invoice number, account ref, month
 * tag, policy number) don't fragment a single vendor into many one-offs.
 */
export function canonicalFirmName(description: string): string | null {
  for (const [pattern, name] of CANONICAL_FIRM_TABLE) {
    if (pattern.test(description)) return name;
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
