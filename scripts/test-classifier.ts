// Quick test: verify classifier against user's specific acceptance criteria examples
import { classifySubcategory } from "../src/lib/detection/subcategory-classifier";
import { normalizeMerchant, coreMerchant } from "../src/lib/detection/merchant-normalizer";

const testCases = [
  { desc: "GREEN ACRES ESTATE 210 Welford Road", expected: "rent" },
  { desc: "SCOTTISHPOWER 16154627601", expected: "utilities" },
  { desc: "OCTOPUS CZV456Y", expected: "utilities" },
  { desc: "TESCO STORES 4636", expected: "supplies" },
  { desc: "AMERICAN CAR WASH", expected: "car-expenses" },
  { desc: "LAHAV O DIRECTORLOANJULY", expected: "director-loans" },
  { desc: "CAPIFY 2912BA6F-1338-4E13", expected: "loans" },
  { desc: "AUTOHORN FLEET SERVICES", expected: "car-expenses" },
  { desc: "LEICESTER CITY COUNCIL", expected: "taxes" },
  { desc: "SEVERN TRENT WATER", expected: "utilities" },
  { desc: "OVO ENERGY LTD", expected: "utilities" },
  { desc: "BRITISH GAS", expected: "utilities" },
  { desc: "SIMPLY BUSINESS 04AFBT9129", expected: "insurance" },
  { desc: "XERO SUBSCRIPTION", expected: "software" },
  { desc: "ONLINE ESTATE AGENTS 378 gipsy lane", expected: "property-management" },
  { desc: "TRANQUIL ACCOMMODA 144A EAST PARK ROA", expected: "rent" },
  { desc: "BOUNCE BACK LOAN REPAYMENT", expected: "loans" },
  { desc: "HMRC VAT PAYMENT", expected: "taxes" },
];

console.log("=== Testing Keyword Classifier ===\n");

let pass = 0;
let fail = 0;

for (const { desc, expected } of testCases) {
  const result = classifySubcategory(desc);
  const normalized = coreMerchant(normalizeMerchant(desc));
  const status = result.subcategory === expected ? "✅" : "❌";
  if (result.subcategory === expected) pass++;
  else fail++;

  console.log(`${status} "${desc.slice(0, 50)}"`);
  console.log(`   Normalized: "${normalized}"`);
  console.log(`   Got: ${result.subcategory} (conf: ${result.confidence}) — Expected: ${expected}`);
  console.log();
}

console.log(`\n${pass}/${testCases.length} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
