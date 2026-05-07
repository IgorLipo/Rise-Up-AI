// Detect potentially personal, suspicious, or non-business expenses
// that should be flagged for director/accountant review.

import type { Transaction } from "@/types";
import { coreMerchant, normalizeMerchant } from "./merchant-normalizer";

export interface SuspiciousTransaction {
  transaction: Transaction;
  merchant: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
  suggestedCategory: string;
  shouldExcludeFromBusiness: boolean;
}

// Personal-like merchant patterns (food, retail, entertainment, lifestyle)
const PERSONAL_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /amazon\s*(prime|\.co|music|video|kindle)/i, reason: "Amazon Prime/service may be personal" },
  { pattern: /netflix|disney\+|hulu|hbo\s*max|paramount\+|peacock/i, reason: "Streaming service — verify business purpose" },
  { pattern: /spotify|apple\s*music|youtube\s*(music|premium)|tidal/i, reason: "Music streaming — unlikely to be business expense" },
  { pattern: /deliveroo|uber\s*eats|just\s*eat|grubhub|doordash/i, reason: "Food delivery — likely personal meal" },
  { pattern: /kfc|mcdonald|burger\s*king|subway|domino|pizza\s*hut|nando/i, reason: "Fast food — likely personal meal" },
  { pattern: /pret\s*a\s*manger|costa\s*coffee|starbucks|caffe\s*nero|greggs/i, reason: "Coffee shop — verify business context" },
  { pattern: /zara|h&m|primark|next\s*retail|asos|boohoo|shein|uniqlo/i, reason: "Clothing retailer — verify business purpose" },
  { pattern: /gym|puregym|the\s*gym\s*group|david\s*lloyd|virgin\s*active|nuffield/i, reason: "Gym membership — likely personal" },
  { pattern: /betfair|bet365|ladbrokes|william\s*hill|paddy\s*power|sky\s*bet/i, reason: "Gambling — high risk, verify urgently" },
  { pattern: /onlyfans|patreon.*creator/i, reason: "Content subscription — verify business purpose" },
  { pattern: /cameo|fiverr.*personal/i, reason: "Personal service — verify business purpose" },
  { pattern: /tinder|bumble|hinge|match\.com/i, reason: "Dating app — personal expense" },
  { pattern: /airbnb.*(weekend|holiday|vacation)/i, reason: "Airbnb — verify if business travel or personal" },
  { pattern: /playstation|xbox|nintendo|steam\s*game|epic\s*game/i, reason: "Gaming — likely personal expense" },
  { pattern: /ticketmaster|stubhub|viagogo|eventbrite.*(concert|festival|show)/i, reason: "Event tickets — verify business purpose" },
  { pattern: /apple\.com\/bill|itunes\.com/i, reason: "Apple/iTunes charge — could be personal app/subscription" },
  { pattern: /google\s*play|google\s*one/i, reason: "Google Play/One — verify if business subscription" },
];

// Weekend leisure spending patterns
function isWeekendLeisure(tx: Transaction): boolean {
  const day = new Date(tx.date).getDay();
  if (day !== 0 && day !== 6) return false;

  const leisurePatterns = [
    /restaurant|bar\b|pub\b|club\b|lounge/i,
    /cinema|theatre|bowling|arcade/i,
    /hotel|spa|resort/i,
  ];
  return leisurePatterns.some((p) => p.test(tx.description));
}

// Round number transfers that look like personal drawings
function isSuspiciousDirectorPayment(tx: Transaction): boolean {
  if (tx.type !== "debit") return false;
  const desc = tx.description.toLowerCase();

  // Round numbers are often director drawings
  const isRound = tx.amount % 100 === 0 || tx.amount % 500 === 0;
  const isTransfer = /transfer|faster\s*payment|xfer|via\s*mobile/i.test(desc);
  const isPersonName =
    /to\s+a\/c|via\s+mobile\s*xfer/i.test(desc) && !/rent|supplier|payment\s*to/i.test(desc);

  if (isRound && isTransfer && isPersonName && tx.amount >= 100) {
    return true;
  }
  return false;
}

// Unusual cash withdrawals
function isUnusualCash(tx: Transaction): boolean {
  const desc = tx.description.toLowerCase();
  const isCash = /cash\s*withdrawal|atm\s*withdrawal|cashpoint/i.test(desc);
  const isLarge = tx.amount > 200;
  return isCash && isLarge;
}

// Duplicate subscriptions (same category, multiple similar tools)
function detectDuplicateSubscriptions(
  tx: Transaction,
  allTransactions: Transaction[]
): boolean {
  const core = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();

  // Check if this is a known SaaS/subscription tool
  const saasKeywords = [
    /slack|notion|linear|figma|github|gitlab|jira|hubspot|salesforce/i,
    /zendesk|mailchimp|google\s*workspace|microsoft\s*365|office\s*365/i,
    /dropbox|vercel|netlify|heroku|supabase|firebase|sentry|datadog/i,
    /ahrefs|semrush|moz\s*pro/i,
    /canva|adobe|sketch|invision/i,
  ];

  const isSaas = saasKeywords.some((p) => p.test(core));
  if (!isSaas) return false;

  // Check if there are multiple different SaaS tools in the same month
  const thisMonth = tx.date.slice(0, 7);
  const sameMonthSaas = allTransactions.filter((t) => {
    const tCore = coreMerchant(normalizeMerchant(t.description)).toLowerCase();
    return (
      t.date.slice(0, 7) === thisMonth &&
      t.type === "debit" &&
      tCore !== core &&
      saasKeywords.some((p) => p.test(tCore))
    );
  });

  return sameMonthSaas.length >= 3;
}

export function detectSuspicious(
  transaction: Transaction,
  allTransactions: Transaction[] = []
): SuspiciousTransaction | null {
  const desc = transaction.description;
  const core = coreMerchant(normalizeMerchant(desc)).toLowerCase();

  // Check personal patterns
  for (const { pattern, reason } of PERSONAL_PATTERNS) {
    if (pattern.test(desc) || pattern.test(core)) {
      return {
        transaction,
        merchant: core,
        reason,
        riskLevel: /gambling|onlyfans/i.test(reason) ? "high" : "medium",
        suggestedCategory: "personal-review",
        shouldExcludeFromBusiness: true,
      };
    }
  }

  // Weekend leisure
  if (isWeekendLeisure(transaction)) {
    return {
      transaction,
      merchant: core,
      reason: "Weekend leisure/entertainment spending — verify business purpose",
      riskLevel: "low",
      suggestedCategory: "personal-review",
      shouldExcludeFromBusiness: false,
    };
  }

  // Suspicious director payment
  if (isSuspiciousDirectorPayment(transaction)) {
    return {
      transaction,
      merchant: core,
      reason: "Round payment to individual — could be director drawing or personal transfer",
      riskLevel: "medium",
      suggestedCategory: "director-loans",
      shouldExcludeFromBusiness: false,
    };
  }

  // Unusual cash
  if (isUnusualCash(transaction)) {
    return {
      transaction,
      merchant: core,
      reason: `Large cash withdrawal of £${transaction.amount.toFixed(2)} — verify business purpose`,
      riskLevel: "medium",
      suggestedCategory: "personal-review",
      shouldExcludeFromBusiness: false,
    };
  }

  // Duplicate subscriptions
  if (detectDuplicateSubscriptions(transaction, allTransactions)) {
    return {
      transaction,
      merchant: core,
      reason: "Multiple similar SaaS tools — possible duplicate subscription",
      riskLevel: "medium",
      suggestedCategory: "software",
      shouldExcludeFromBusiness: false,
    };
  }

  return null;
}

// Batch detection across all transactions
export function detectAllSuspicious(
  transactions: Transaction[]
): SuspiciousTransaction[] {
  return transactions
    .map((tx) => detectSuspicious(tx, transactions))
    .filter((s): s is SuspiciousTransaction => s !== null);
}
