// Entity extraction: detects property references and people/contractors
// from transaction descriptions. Pure TypeScript, no API calls.

import { normalizeMerchant, coreMerchant } from "./merchant-normalizer";

export interface PropertyMatch {
  propertyRef: string; // e.g. "Flat 3", "Property_123_Main_St"
  displayName: string; // e.g. "Flat 3", "123 Main St"
  confidence: number;
  matchType: "flat" | "house" | "postcode" | "address" | "named-property";
}

export interface PersonMatch {
  personName: string;
  normalizedName: string;
  confidence: number;
  role: "director" | "contractor" | "landlord" | "cleaner" | "employee" | "staff" | "unknown";
  indicators: string[];
}

export interface EntityExtractionResult {
  properties: Map<string, PropertyMatch>; // canonical property key → match
  people: Map<string, PersonMatch>;       // normalized person name → match
  propertyTransactions: Map<string, string[]>; // property key → transaction IDs
  personTransactions: Map<string, string[]>;   // person name → transaction IDs
}

// Property patterns
const PROPERTY_PATTERNS: Array<{
  pattern: RegExp;
  type: PropertyMatch["matchType"];
  confidence: number;
  extract: (match: RegExpMatchArray) => string;
}> = [
  // Flat/apartment numbers
  {
    pattern: /(?:flat|apartment|apt)\s*[:#]?\s*(\d+[a-z]?|ground|basement|penthouse)/i,
    type: "flat",
    confidence: 0.8,
    extract: (m) => `Flat ${m[1].toUpperCase()}`,
  },
  // House numbers with street
  {
    pattern: /(\d{1,3}[a-z]?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(?:Road|Rd|Street|St|Avenue|Ave|Lane|Ln|Close|Drive|Crescent|Court|Way|Place|Gardens|Grove)\b/i,
    type: "address",
    confidence: 0.9,
    extract: (m) => `${m[1]} ${m[2]} ${m[0].match(/(?:Road|Rd|Street|St|Avenue|Ave|Lane|Ln|Close|Drive|Crescent|Court|Way|Place|Gardens|Grove)/i)?.[0] ?? ""}`,
  },
  // UK postcodes in descriptions
  {
    pattern: /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i,
    type: "postcode",
    confidence: 0.85,
    extract: (m) => m[1].toUpperCase(),
  },
  // Named properties: "Property at <address>", "<name> property"
  {
    pattern: /(?:property|premises|address|site|location|building)\s*(?:at|:)?\s*([A-Za-z0-9].{3,60}?)(?:\s*,|\s*\.|\s*$|\s+-)/i,
    type: "named-property",
    confidence: 0.7,
    extract: (m) => m[1].trim(),
  },
];

// People/contractor patterns
const PERSON_PATTERNS: Array<{
  pattern: RegExp;
  role: PersonMatch["role"];
  extractName: (match: RegExpMatchArray, desc: string) => string;
}> = [
  {
    pattern: /\b(Director\s*Loan|DIRECTORLOAN|DLA\b|DLJ\b|director['']s?\s*loan)\b.*?([A-Z][a-z]+(?:\s+[A-Z])?(?:\s+[A-Z][a-z]+)?)/i,
    role: "director",
    extractName: (m, desc) => {
      // Try to extract name from director loan pattern
      const afterPattern = desc.slice(m.index! + m[0].length);
      const nameMatch = afterPattern.match(/^[:\s-]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+))/);
      return nameMatch ? nameMatch[1].trim() : m[2]?.trim() ?? "Director";
    },
  },
  {
    pattern: /\b(?:MR|MRS|MS|MISS|DR)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,
    role: "unknown",
    extractName: (m) => m[1].trim(),
  },
  {
    pattern: /\b(WAGES|SALARY|PAYROLL|PAYE)\b.*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    role: "staff",
    extractName: (m) => (m[2]?.trim() ?? "Staff"),
  },
  {
    pattern: /\b(CLEANER|CLEANING)\b.*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    role: "cleaner",
    extractName: (m) => (m[2]?.trim() ?? "Cleaner"),
  },
  {
    pattern: /\b(CONTRACTOR|CONSULTANT)\b.*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    role: "contractor",
    extractName: (m) => (m[2]?.trim() ?? "Contractor"),
  },
  {
    pattern: /\b(LANDLORD|RENT\s+TO|LETTING)\b.*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    role: "landlord",
    extractName: (m) => (m[2]?.trim() ?? "Landlord"),
  },
  {
    pattern: /\b(?:TO|FROM)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/,
    role: "unknown",
    extractName: (m) => m[1].trim(),
  },
];

// Known common merchant terms that should NOT be treated as people
const NON_PERSON_TERMS = new Set([
  "bank", "credit", "debit", "card", "payment", "transfer", "standing", "order",
  "direct", "debit", "bacs", "faster", "chaps", "interest", "charge", "fee",
  "limited", "ltd", "plc", "llp", "company", "service", "services", "group",
  "holdings", "international", "uk", "europe", "global", "solutions", "systems",
  "technology", "technologies", "energy", "power", "water", "gas", "electric",
  "communications", "media", "financial", "insurance", "capital", "partners",
]);

export function extractProperties(description: string): PropertyMatch[] {
  const results: PropertyMatch[] = [];
  const seen = new Set<string>();

  for (const { pattern, type, confidence, extract } of PROPERTY_PATTERNS) {
    const match = description.match(pattern);
    if (!match) continue;
    const ref = extract(match).toLowerCase().replace(/[^a-z0-9 ]/g, "_").replace(/\s+/g, "_");
    if (seen.has(ref)) continue;
    seen.add(ref);

    results.push({
      propertyRef: ref,
      displayName: extract(match),
      confidence,
      matchType: type,
    });
  }

  return results;
}

export function extractPeople(description: string): PersonMatch[] {
  const results: PersonMatch[] = [];
  const seen = new Set<string>();

  for (const { pattern, role, extractName } of PERSON_PATTERNS) {
    const match = description.match(pattern);
    if (!match) continue;
    const name = extractName(match, description).trim();

    // Skip non-person terms
    const lower = name.toLowerCase();
    const words = lower.split(/\s+/);
    if (words.some((w) => NON_PERSON_TERMS.has(w))) continue;
    if (words.length < 2 && role === "unknown") continue;
    if (name.length < 3) continue;

    const normalized = name.toLowerCase().replace(/[^a-z ]/g, "").trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    results.push({
      personName: name,
      normalizedName: normalized,
      confidence: role === "unknown" ? 0.5 : 0.75,
      role,
      indicators: [match[0].trim()],
    });
  }

  return results;
}

// Run entity extraction across all transactions
export function extractEntities(descriptions: Array<{ id: string; description: string }>): EntityExtractionResult {
  const propertyMap = new Map<string, PropertyMatch>();
  const peopleMap = new Map<string, PersonMatch>();
  const propertyTransactions = new Map<string, string[]>();
  const personTransactions = new Map<string, string[]>();

  for (const { id, description } of descriptions) {
    const properties = extractProperties(description);
    for (const prop of properties) {
      if (!propertyMap.has(prop.propertyRef)) {
        propertyMap.set(prop.propertyRef, prop);
      } else if (prop.confidence > propertyMap.get(prop.propertyRef)!.confidence) {
        propertyMap.set(prop.propertyRef, prop);
      }

      const txIds = propertyTransactions.get(prop.propertyRef) ?? [];
      txIds.push(id);
      propertyTransactions.set(prop.propertyRef, txIds);
    }

    const people = extractPeople(description);
    for (const person of people) {
      if (!peopleMap.has(person.normalizedName)) {
        peopleMap.set(person.normalizedName, person);
      } else if (person.confidence > peopleMap.get(person.normalizedName)!.confidence) {
        peopleMap.set(person.normalizedName, person);
      }

      const txIds = personTransactions.get(person.normalizedName) ?? [];
      txIds.push(id);
      personTransactions.set(person.normalizedName, txIds);
    }
  }

  return {
    properties: propertyMap,
    people: peopleMap,
    propertyTransactions,
    personTransactions,
  };
}

// For integration with vendor intel: map properties and people to vendor entries
export function entityAttributesForVendor(
  canonicalName: string,
  descriptions: string[]
): { linkedProperty: string | null; linkedPerson: string | null; personRole: string | null } {
  let linkedProperty: string | null = null;
  let linkedPerson: string | null = null;
  let personRole: string | null = null;

  for (const desc of descriptions) {
    if (!linkedProperty) {
      const props = extractProperties(desc);
      if (props.length > 0) linkedProperty = props[0].displayName;
    }
    if (!linkedPerson) {
      const people = extractPeople(desc);
      if (people.length > 0) {
        linkedPerson = people[0].personName;
        personRole = people[0].role;
      }
    }
    if (linkedProperty && linkedPerson) break;
  }

  return { linkedProperty, linkedPerson, personRole };
}
