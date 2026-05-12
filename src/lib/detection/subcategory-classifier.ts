export type Subcategory =
  | "salary" | "subscriptions" | "software" | "car-expenses"
  | "rent" | "taxes" | "loans" | "supplier-payments"
  | "utilities" | "bank-fees" | "insurance" | "marketing"
  | "travel" | "office-supplies" | "professional-services"
  | "director-loans" | "property-management" | "property-income"
  | "supplies" | "food-dining"
  | "one-off";

interface ClassificationResult {
  category: string;
  subcategory: Subcategory;
  confidence: number;
}

// Keyword-based fallback classifier (runs instantly, no API call)
// Order matters — first match wins (except one-off which is a catch-all).
// food-dining MUST be before software and subscriptions to prevent
// food brands from matching downstream patterns.
const SUBCATEGORY_KEYWORDS: Record<Subcategory, RegExp[]> = {
  "food-dining": [
    /\bcosta\b/i,
    /\bstarbucks\b/i,
    /\bpret\s*a\s*manger\b/i,
    /\bnero\b/i,
    /\bcaff(?:[eè])\s*nero\b/i,
    /\bgreggs\b/i,
    /\bmcdonald/i,
    /\b(kfc|kentucky)\b/i,
    /\bburger\s*king\b/i,
    /\bdomino.?s\b/i,
    /\bpizza\s*hut\b/i,
    /\bpizza\s*express\b/i,
    /\bwagamama\b/i,
    /\bnando.?s\b/i,
    /\bsubway\b/i,
    /\bdeliveroo\b/i,
    /\bjust\s*eat\b/i,
    /\buber\s*eats?\b/i,
    /\brestaurant\b/i,
    /\btakeaway\b/i,
    /\bcaf[ée]\b/i,
    /\bbakery\b/i,
    /\bsandwich\b/i,
    /\blunch\b/i,
    /\bdinner\b/i,
    /\bbreakfast\b/i,
    /\bmeal\b/i,
  ],
  salary: [/salary|wage|payroll|staff payment/i],
  software: [
    /\bapple\b/i,                            // Apple purchases — Software/Tools per user spec
    /\badobe\b/i,
    /\bcanva\b/i,
    /\bfigma\b/i,
    /\bnotion\b/i,
    /\blinear\b/i,
    /\bgithub\b/i,
    /\bgitlab\b/i,
    /\bvercel\b/i,
    /\bnetlify\b/i,
    /\bheroku\b/i,
    /\bdigital\s*ocean\b/i,
    /\blinode\b/i,
    /\bcloudflare\b/i,
    /\bopenai\b/i,
    /\banthropic\b/i,
    /\bmistral\b/i,
    /\bdeepseek\b/i,
    /\bchatgpt\b/i,
    /xero|quickbooks|slack|notion|linear|figma|github|gitlab|atlassian|jira|hubspot|salesforce|zendesk|mailchimp|google workspace|microsoft 365|office 365|dropbox|vercel|netlify|heroku|aws |supabase|firebase|sentry|datadog|ahrefs|semrush/i,
  ],
  subscriptions: [/subscription|monthly fee|annual fee|recurring/i,
    /amazon\s*prime/i,
    /prime\s*video/i,
    /\bspotify\b/i,
    /\bpuregym\b/i,
    /the\s*gym\s*group/i,
    /monday\.com/i,
    /pdfleader/i,
    /01\.ai/i,
    /\bgamma\b/i,
    /\bnetflix\b/i,
    /\bdisney\b\+?\b/i,
    /\byoutube\s*(premium|music)\b/i,
    /\bgoogle\s*one\b/i],
  "car-expenses": [/car payment|vehicle|auto loan|car lease|car wash|car service|car repair|mot |tyre|autohorn|fleet|vauxhall|bmw|mercedes|audi|\bford\b|vw |volkswagen|toyota|honda|nissan|porsche|land rover|jaguar|tesla|hyundai|kia|mazda|volvo|lexus|american car/i,
    // Fuel/petrol stations
    /\bshell\b(?!\s*(energy|electric))/i,
    /\bbp\b(?!\s*(energy|electric))/i,
    /tesco\s*pay\s*(at|@)\s*pump/i,
    /asda\s*petrol/i,
    /\bmfg\b.*\b(petrol|fuel|forecourt)\b/i,
    /sainsbury.*petrol/i,
    /\bapplegreen\b/i,
    /\besso\b/i,
    /\bmurco\b/i,
    /\bpetrol\b/i,
    /\bfuel\b/i,
    /\bdiesel\b/i,
    /\bauto\s*repair\b/i,
    /\btyre\b/i,
    /\bmechanic\b/i,
    /\bcar\s*(repair|service|wash|valet)\b/i,
    /\bcongestion\s*charge\b/i,
    /\bdart\s*charge\b/i,
    /\bdvla\b/i,
    /\broad\s*tax\b/i,
    /\bvehicle\s*(tax|insurance|repair)\b/i,
    /\brac\b/i,
    /\baa\s*(car|breakdown|insurance)\b/i],
  "property-management": [/property management|property maint|estate agent|sequoia|nasim holdings|osiris property|online estate|property group/i,
    /\bamha\s*leicester\b/i,
    /\bgreen\s*acres\b.*\bestate\b/i,
    /\bhaus\s*property\b/i,
    /\bmidlands\s*property\b/i,
    /\bsequoia\s*property\b/i,
    /\btranquil\s*accommoda\b/i,
    /\baccommoda\b/i,
    /\bletting\b/i,
    /\bproperty\s*(management|maint|service|group|rental)\b/i,
    /\bestate\s*agent\b/i],
  rent: [/\brent\b|lease payment|property rent|office rent|commercial rent|letting|landlord|housing benefit|accommoda|green acres|estate\b/i,
    /\btranquil\s*accom\b/i,
    /\brent\s*(income|payment|receipt|collection)\b/i],
  taxes: [/hmrc|vat |corporation tax|paye|self assessment|tax payment|hm revenue|national insurance|council tax|city council|borough council/i,
    /leicester\s*city\s*council/i,
    /\bcouncil\s*tax\b/i,
    /\bbusiness\s*rates\b/i,
    /\bnon-domestic\s*rates\b/i],
  "director-loans": [/director.?loan|dla|dlj/i],
  loans: [/loan repayment|bank loan|business loan|bounce back loan|cbils|capify|\bloan\b|funding circle|iwoca/i],
  "supplier-payments": [/supplier|wholesale|distributor|inventory|stock purchase/i],
  utilities: [/electric|gas |energy |water |broadband|internet|phone bill|ovo energy|british gas|e\.on|edf|scottish\s*power|severn trent|thames water|virgin media|vodafone|ee |o2 |three |talktalk|bt group|octopus|utility warehouse|anglian water|yorkshire water|welsh water/i],
  "bank-fees": [/overdraft fee|account fee|service charge|bank charge|transaction fee|monthly fee|unpaid item|arranged overdraft/i],
  insurance: [/insurance|public liability|professional indemnity|simply business|hiscox|axa|aviva|churchill|direct line/i],
  marketing: [/google ads|facebook ads|instagram ads|linkedin ads|advertising|marketing|sponsored|ad campaign/i],
  travel: [/flight|hotel|airbnb|booking\.com|trainline|travelodge|premier inn|car hire|enterprise rent|avis |hertz|ba flight|easyjet|ryanair/i],
  "office-supplies": [/stationery|office supplies|printer|ink |toner|viking direct|staples|ryman|banner|vistaprint|printed\.com/i],
  "professional-services": [/accountant|accountancy|solicitor|lawyer|legal |consultant|consulting|auditor|bookkeeper|bookkeeping/i],
  supplies: [/tesco|sainsbury|asda|morrisons|aldi|lidl|waitrose|ocado|co-op|supermarket|grocer|b&q|wickes|screwfix|toolstation|homebase|ikea|currys|argos|amazon/i],
  "property-income": [/rent.*income|property.*income|accommodation.*income|housing.*benefit/i],
  "one-off": [/./],
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
  return { category: "Uncategorized", subcategory: "one-off", confidence: 0.4 };
}

function mapToCategory(sub: Subcategory): string {
  const mapping: Record<Subcategory, string> = {
    salary: "Salaries & Wages",
    subscriptions: "Subscriptions",
    software: "Software/Tools",
    "car-expenses": "Car & Transport",
    rent: "Rent & Property",
    taxes: "Taxes",
    loans: "Loan Repayments",
    "supplier-payments": "Suppliers & Services",
    utilities: "Utilities",
    "bank-fees": "Bank Fees",
    insurance: "Insurance",
    marketing: "Marketing",
    travel: "Travel",
    "office-supplies": "Office Supplies",
    "professional-services": "Professional Services",
    "director-loans": "Director Loans",
    "property-management": "Rent & Property",
    "property-income": "Other Income",
    supplies: "Shopping",
    "food-dining": "Food & Dining",
    "one-off": "Uncategorized",
  };
  return mapping[sub];
}
