import OpenAI from "openai";
import { classifySubcategory, type Subcategory } from "./subcategory-classifier";
import { normalizeMerchant, coreMerchant } from "./merchant-normalizer";

export interface AIClassification {
  subcategory: Subcategory;
  confidence: number;
  reasoning: string;
}

export interface NewVendorEntry {
  merchantRaw: string;
  merchantNormalized: string;
  subcategory: Subcategory;
  confidence: number;
  reasoning: string;
}

// In-memory cache: merchant → classification
const classificationCache = new Map<string, AIClassification>();

const CLASSIFIER_PROMPT = `You are a financial transaction classifier for a UK business bank account.

Classify each merchant/description into exactly ONE subcategory. Use the business context — this is a property management / supported accommodation company.

Categories:
- rent: Rent payments to landlords, property owners, letting agents, housing benefit
- property-management: Estate agents, property maintenance, property management fees
- utilities: Gas, electric, water, broadband, phone, energy companies (Octopus, ScottishPower, OVO, E.ON, EDF, British Gas, Severn Trent)
- taxes: HMRC, VAT, council tax, PAYE, corporation tax
- loans: Loan repayments, director loans, bounce back loans, Capify, Funding Circle
- car-expenses: Vehicle payments, car wash, car service, Autohorn, fleet, fuel, parking, MOT
- insurance: Business insurance, public liability, Simply Business, Hiscox, AXA
- software: SaaS, cloud hosting, Google Workspace, Microsoft 365, Xero, QuickBooks
- salary: Payroll, staff payments, wages
- supplies: Groceries, retail, hardware, office supplies (Tesco, Amazon, B&Q, Argos, IKEA)
- bank-fees: Bank charges, overdraft fees, account fees
- subscriptions: Recurring subscriptions, monthly fees
- professional-services: Accountants, solicitors, consultants, bookkeepers
- marketing: Advertising, Google Ads, Facebook Ads
- travel: Hotels, flights, train tickets, car hire
- office-supplies: Stationery, printing, office equipment
- supplier-payments: Wholesale, distributors, inventory
- director-loans: Director loan repayments or receipts (DLA, DLJ, director loan)
- one-off: Only if none of the above fit with confidence

Return a JSON object mapping each merchant name to: { "subcategory": "...", "confidence": 0.0-1.0, "reasoning": "short reason" }

Example:
{
  "GREEN ACRES ESTATE": { "subcategory": "rent", "confidence": 0.95, "reasoning": "Estate agent rent payment to property landlord" },
  "OCTOPUS CZV456Y": { "subcategory": "utilities", "confidence": 0.95, "reasoning": "Octopus Energy utility payment" },
  "LAHAV O DIRECTORLOANJULY": { "subcategory": "director-loans", "confidence": 0.95, "reasoning": "Director loan transaction" }
}`;

export async function classifyWithAI(
  merchants: string[],
  knownVendors?: Map<string, AIClassification>
): Promise<{ classifications: Map<string, AIClassification>; newVendors: NewVendorEntry[] }> {
  const result = new Map<string, AIClassification>();
  const newVendors: NewVendorEntry[] = [];
  const uncached = new Map<string, string>(); // core merchant → original description

  for (const desc of merchants) {
    const core = coreMerchant(normalizeMerchant(desc)).toLowerCase();
    // Check in-memory cache first
    const cached = classificationCache.get(core);
    if (cached) {
      result.set(desc, cached);
      continue;
    }
    // Check known vendors (from DB, passed in by caller)
    if (knownVendors?.has(core)) {
      const vendor = knownVendors.get(core)!;
      classificationCache.set(core, vendor);
      result.set(desc, vendor);
      continue;
    }
    uncached.set(core, desc);
  }

  if (uncached.size === 0) return { classifications: result, newVendors };

  // Try DeepSeek for uncached merchants
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const deepseek = new OpenAI({
        baseURL: "https://api.deepseek.com/v1",
        apiKey: process.env.DEEPSEEK_API_KEY,
      });

      const merchantList = [...uncached.entries()].map(([core, desc]) =>
        `"${desc.slice(0, 80)}"`
      ).join("\n");

      const completion = await deepseek.chat.completions.create({
        model: "deepseek-v4-flash",
        temperature: 0.1,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: `${CLASSIFIER_PROMPT}\n\nClassify these merchants:\n${merchantList}`,
        }],
        response_format: { type: "json_object" },
      });

      const text = completion.choices[0]?.message?.content;
      if (text) {
        const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");

        for (const [core, desc] of uncached) {
          const responseKey = Object.keys(json).find((k) =>
            core.includes(k.toLowerCase()) || k.toLowerCase().includes(core)
          );
          if (responseKey && json[responseKey]?.subcategory) {
            const classification: AIClassification = {
              subcategory: json[responseKey].subcategory,
              confidence: Math.min(1, Math.max(0, json[responseKey].confidence ?? 0.8)),
              reasoning: json[responseKey].reasoning ?? "",
            };
            classificationCache.set(core, classification);
            result.set(desc, classification);
            newVendors.push({
              merchantRaw: desc,
              merchantNormalized: core,
              subcategory: classification.subcategory,
              confidence: classification.confidence,
              reasoning: classification.reasoning,
            });
          }
        }
      }
    } catch {
      // AI failed — fall through to keyword classifier
    }
  }

  // Fallback: use keyword classifier for any remaining uncached merchants
  for (const [core, desc] of uncached) {
    if (result.has(desc)) continue;
    const kwResult = classifySubcategory(desc);
    const classification: AIClassification = {
      subcategory: kwResult.subcategory,
      confidence: kwResult.confidence,
      reasoning: "Keyword-based classification",
    };
    classificationCache.set(core, classification);
    result.set(desc, classification);
  }

  return { classifications: result, newVendors };
}

// Batch classify all transactions in a statement
export async function classifyTransactions(
  descriptions: string[],
  knownVendors?: Map<string, AIClassification>
): Promise<{
  results: Map<string, { subcategory: Subcategory; confidence: number }>;
  newVendors: NewVendorEntry[];
}> {
  // Deduplicate by core merchant
  const unique = new Map<string, string>();
  for (const desc of descriptions) {
    const core = coreMerchant(normalizeMerchant(desc)).toLowerCase();
    if (!unique.has(core)) unique.set(core, desc);
  }

  const { classifications, newVendors } = await classifyWithAI([...unique.values()], knownVendors);
  const result = new Map<string, { subcategory: Subcategory; confidence: number }>();

  for (const desc of descriptions) {
    const core = coreMerchant(normalizeMerchant(desc)).toLowerCase();
    const match = classifications.get(unique.get(core) ?? desc);
    if (match) {
      result.set(desc, { subcategory: match.subcategory, confidence: match.confidence });
    } else {
      const kw = classifySubcategory(desc);
      result.set(desc, { subcategory: kw.subcategory, confidence: kw.confidence });
    }
  }

  return { results: result, newVendors };
}

export function clearClassificationCache() {
  classificationCache.clear();
}
