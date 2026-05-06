export type Subcategory =
  | "salary" | "subscriptions" | "software" | "car-expenses"
  | "rent" | "taxes" | "loans" | "supplier-payments"
  | "utilities" | "bank-fees" | "insurance" | "marketing"
  | "travel" | "office-supplies" | "professional-services" | "one-off";

interface ClassificationResult {
  category: string;
  subcategory: Subcategory;
  confidence: number;
}

// Keyword-based fallback classifier (runs instantly, no API call)
const SUBCATEGORY_KEYWORDS: Record<Subcategory, RegExp[]> = {
  salary: [/salary|wage|payroll|staff payment/i],
  subscriptions: [/subscription|monthly fee|annual fee|recurring/i],
  software: [/xero|quickbooks|slack|notion|linear|figma|github|gitlab|atlassian|jira|hubspot|salesforce|zendesk|mailchimp|google workspace|microsoft 365|office 365|dropbox|vercel|netlify|heroku|aws|supabase|firebase|sentry|datadog|ahrefs|semrush/i],
  "car-expenses": [/car payment|vehicle|auto loan|car lease|vauxhall|bmw|mercedes|audi|ford|vw |volkswagen|toyota|honda|nissan|porsche|land rover|jaguar|tesla|hyundai|kia|mazda|volvo|lexus/i],
  rent: [/rent|lease payment|property rent|office rent|commercial rent/i],
  taxes: [/hmrc|vat |corporation tax|paye|self assessment|tax payment|hm revenue|national insurance/i],
  loans: [/loan repayment|bank loan|business loan|bounce back loan|cbils/i],
  "supplier-payments": [/supplier|wholesale|distributor|inventory|stock purchase/i],
  utilities: [/electric|gas |energy |water |broadband|internet|phone bill|ovo energy|british gas|e\.on|edf|scottish power|severn trent|thames water|virgin media|vodafone|ee |o2 |three |talktalk|bt group/i],
  "bank-fees": [/overdraft fee|account fee|service charge|bank charge|transaction fee|monthly fee|unpaid item/i],
  insurance: [/insurance|public liability|professional indemnity|simply business|hiscox|axa|aviva|churchill|direct line/i],
  marketing: [/google ads|facebook ads|instagram ads|linkedin ads|advertising|marketing|sponsored|ad campaign/i],
  travel: [/flight|hotel|airbnb|booking\.com|trainline|travelodge|premier inn|car hire|enterprise rent|avis |hertz|ba flight|easyjet|ryanair/i],
  "office-supplies": [/stationery|office supplies|printer|ink |toner|viking direct|staples|ryman|banner|vistaprint|printed\.com/i],
  "professional-services": [/accountant|accountancy|solicitor|lawyer|legal |consultant|consulting|auditor|bookkeeper|bookkeeping/i],
  "one-off": [/./], // catch-all
};

export function classifySubcategory(description: string): ClassificationResult {
  // Iterate in priority order — first match wins (except one-off)
  const entries = Object.entries(SUBCATEGORY_KEYWORDS) as [Subcategory, RegExp[]][];
  for (const [subcategory, patterns] of entries) {
    if (subcategory === "one-off") continue;
    for (const pattern of patterns) {
      if (pattern.test(description)) {
        return { category: mapToCategory(subcategory), subcategory, confidence: 0.7 };
      }
    }
  }
  return { category: "Other", subcategory: "one-off", confidence: 0.4 };
}

function mapToCategory(sub: Subcategory): string {
  const mapping: Record<Subcategory, string> = {
    salary: "Salaries",
    subscriptions: "Subscriptions",
    software: "Software & SaaS",
    "car-expenses": "Car Expenses",
    rent: "Rent & Housing",
    taxes: "Taxes",
    loans: "Loan Repayments",
    "supplier-payments": "Supplier Payments",
    utilities: "Utilities",
    "bank-fees": "Bank Fees",
    insurance: "Insurance",
    marketing: "Marketing",
    travel: "Travel",
    "office-supplies": "Office Supplies",
    "professional-services": "Professional Services",
    "one-off": "Other",
  };
  return mapping[sub];
}
