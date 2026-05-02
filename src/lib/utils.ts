import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency = "£"): string {
  const formatted = Math.abs(amount).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${currency}${formatted}` : `${currency}${formatted}`;
}

export function deriveMerchant(description: string): string {
  const cleaned = description
    .replace(/\b(PAYMENT TO|DIRECT DEBIT|STANDING ORDER|FASTER PAYMENT|BILL PAYMENT|CARD PAYMENT TO|ONLINE PAYMENT|POS \d+|TERMINAL \d+)\b/gi, "")
    .replace(/\bREF:?\s*\S+/gi, "")
    .replace(/\b\d{6,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || description.trim();
}

export function categorizeTransaction(description: string): string {
  const lower = description.toLowerCase();

  // Ordered intentionally — first match wins.
  // Business categories first (more specific patterns), then personal.
  const categories: Record<string, string[]> = {
    // Business-specific categories
    "Tax & HMRC": ["hmrc", "vat payment", "corporation tax", "paye", "self assessment", "national insurance", "tax payment", "hm revenue"],
    Insurance: ["insurance", "public liability", "professional indemnity", "cyber insurance", "simply business", "hiscox", "axa insurance", "aviva", "churchill insurance"],
    "Software & SaaS": ["slack", "notion", "linear", "figma", "canva", "github", "gitlab", "atlassian", "jira", "confluence", "monday.com", "asana", "trello", "basecamp", "clickup", "hubspot", "salesforce", "zendesk", "intercom", "mailchimp", "convertkit", "calendly", "typeform", "webflow", "wix", "squarespace", "shopify", "woocommerce", "godaddy", "namecheap", "google workspace", "microsoft 365", "office 365", "dropbox", "box.com", "notion ai", "chatgpt plus", "claude.ai", "openai", "vercel", "netlify", "heroku", "digitalocean", "aws", "cloudflare", "supabase", "firebase", "sentry", "datadog", "new relic", "logrocket", "hotjar", "google ads", "facebook ads"],
    "Professional Services": ["accountant", "accountancy", "solicitor", "lawyer", "legal ", "barrister", "consultant", "consulting", "auditor", "payroll bureau", "bookkeeper", "bookkeeping", "xero", "quickbooks", "freeagent", "sage", "dext", "receipt bank", "expensify"],
    "Marketing & Advertising": ["google ads", "facebook ads", "instagram ads", "linkedin ads", "tiktok ads", "advertising", "marketing agency", "marketing ", "ad campaign", "sponsored", "promoted", "semrush", "ahrefs", "moz ", "hootsuite", "buffer", "sprout social"],
    "Office & Equipment": ["stationery", "office supplies", "printer", "ink cartridge", "toner", "laptop", "monitor", "keyboard", "mouse", "desk", "chair", "office furniture", "viking direct", "staples", "ryman", "banner", "vistaprint", "moo.com", "printed.com"],
    "Business Travel": ["flight", "hotel", "airbnb", "booking.com", "expedia", "trainline", "national express", "travelodge", "premier inn", "hilton", "marriott", "holiday inn", "car hire", "enterprise rent", "avis ", "hertz", "europcar", "ba flight", "british airways", "easyjet", "ryanair"],
    // Personal categories below — placed after business to let business patterns match first
    Groceries: ["tesco", "sainsbury", "asda", "morrisons", "aldi", "lidl", "waitrose", "ocado", "marks & spencer", "co-op", "supermarket", "grocer"],
    "Eating Out": ["restaurant", "cafe", "coffee", "deliveroo", "uber eats", "just eat", "takeaway", "mcdonald", "nando", "pizza", "greggs", "pret", "starbucks", "costa", "itsu", "wasabi", "the ivy", "ivy restaurant"],
    Entertainment: ["netflix", "spotify", "disney+", "apple.com/bill", "cinema", "theatre", "concert", "ticket", "sky", "bt sport", "now tv", "amazon prime video", "audible", "youtube premium", "gaming subscription"],
    Shopping: ["amazon", "ebay", "etsy", "argos", "john lewis", "ikea", "next", "zara", "h&m", "primark", "asos", "tk maxx", "waterstones", "bookshop", "selfridges", "uniqlo", "nike", "adidas"],
    "Rent & Housing": ["rent", "mortgage", "council tax", "housing"],
    Utilities: ["electric", "gas bill", "energy bill", "broadband", "internet", "phone bill", "water bill", "severn trent", "thames water", "ovo energy", "british gas", "e.on", "edf energy", "scottish power", "bt group", "virgin media", "vodafone", "ee ", "o2 ", "three ", "talktalk"],
    Transport: ["tfl charge", "tfl travel", "transport for london", "uber ride", "bolt ride", "train ticket", "railway", "bus fare", "tube station", "petrol", "fuel", "parking", "taxi", "addison lee"],
    "Health & Fitness": ["pharmacy", "boots", "superdrug", "gym", "fitness", "dentist", "optician", "specsavers", "nhs prescription", "puregym", "david lloyd", "nuffield health"],
    "Bank & Finance Charges": ["overdraft fee", "overdraft charge", "unpaid item", "account fee", "cash deposit fee", "card fee", "transfer fee", "international payment", "foreign exchange", "fx fee", "service charge", "bank charge", "monthly fee", "annual fee"],
    "Payment Processors": ["stripe", "square", "sumup", "paypal", "gocardless", "worldpay", "adyen", "checkout.com", "klarna", "clearpay", "revolut", "wise ", "transferwise", "curve "],
    Income: ["salary", "wage", "payment from", "deposit", "interest", "dividend", "refund", "cashback", "invoice paid", "client payment", "revenue", "royalty"],
    Transfers: ["transfer", "standing order", "direct debit", "dd/", "s/o", "bacs"],
    Other: [],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }

  return "Other";
}
