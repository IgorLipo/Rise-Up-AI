// Normalize merchant names for pattern matching.
// Strips reference numbers, account codes, payment IDs, dates.

const NOISE_PATTERNS = [
  /\bREF:?\s*\S+/gi,
  /\bFP\s+\d{2}\/\d{2}\/\d{2}\s+\d+\s*\w*\b/gi,
  /\b\d{6,}\b/g,                        // Pure digit sequences (reference numbers)
  /\b(?:[A-Z]{2,}[0-9][A-Z0-9]*|[0-9]+[A-Z]{2,}[A-Z0-9]*)\b/g,  // Mixed alphanumeric codes (not merchant names)
  /\bVIA\s+MOBILE\s*-\s*PYMT\b/gi,
  /\bPAYMENT TO\b/gi,
  /\bDIRECT DEBIT\b/gi,
  /\bSTANDING ORDER\b/gi,
  /\bBILL PAYMENT\b/gi,
  /\bCARD PAYMENT TO\b/gi,
  /\bOnline Transaction\b/gi,
  /\bAutomated Credit\b/gi,
  /\bOnLine Transaction\b/gi,
];

export function normalizeMerchant(description: string): string {
  let cleaned = description;
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned || description.trim();
}

// Extract the core merchant name — first 2-4 words after stripping noise
export function coreMerchant(description: string): string {
  const normalized = normalizeMerchant(description);
  const words = normalized.split(" ");
  // Take first 3 words, but stop at obvious separators
  const core: string[] = [];
  for (const word of words) {
    if (core.length >= 3) break;
    if (/^\d+$/.test(word)) continue;
    if (word.length < 2) continue;
    core.push(word);
  }
  return core.join(" ") || normalized;
}
