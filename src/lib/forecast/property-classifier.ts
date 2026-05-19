// Classify a transaction as property-related vs general-business.
//
// "Property" = anything tied to running the rental portfolio:
//   - Rent in / out (landlords, tenants, property-management firms)
//   - Utilities serving the properties
//   - Council tax / business rates on the portfolio
//   - Maintenance contractors working on the properties
//   - Materials / suppliers for property maintenance
//   - Landlord insurance / property-specific insurance
//
// "Non-property" = head-office overhead and personal/director flows:
//   - Salaries, director loans, pension, payroll tax
//   - Software / subscriptions
//   - Vehicle / fuel / parking / tolls
//   - Bank fees / financing / loans
//   - Restaurants / supplies / shopping
//   - Marketing
//
// Validated against the user's 4-month Jan–Apr 2026 actuals:
//   Property income avg £215k (CV 8.8%), Property expense avg £166k (CV 17%),
//   Non-property income avg £28k (CV 97%), Non-property expense avg £78k (CV 8.6%).
//   ~89% of income and ~68% of expenses are property-classified.

const PROPERTY_PATTERNS: RegExp[] = [
  // ── Rent / landlords / property-management firms ─────────────────────
  /\btranquil\s*accommoda/i, /\bsequoia\s*property/i, /\bsequoia\b/i,
  /\bmidlands?\s*property/i, /\bonline\s*estate?/i, /\bhaus\s*property/i,
  /\bamha\s*leiceste/i, /\bnasim\s*holding/i, /\bnasim\b/i,
  /\bk\s*p\s*shahbaz/i, /\bace\s*propertie/i, /\bmidshire\s*propertie/i,
  /\bhomebound/i, /\bgreen\s*acres/i, /\borenzeb/i, /\bpaul\s*mahil/i,
  /\bmahil/i, /\bsandhar\s*investment/i, /\bdaniel\s*mahil/i,
  /\bsavjani\s*holding/i, /\bunited92/i, /\bops\s*rent/i, /\bops\b/i,
  /\bahmad\s*mann/i, /\bshenu\s*investments?/i, /\bhitesh\s*khodiyar/i,
  /\bhiral\s*keshvala/i, /\bruksana\s*rawat/i, /\bpiwowarska/i,
  /\bmayur\s*gohel/i, /\bmohammed\s*vindhani/i, /\bdawood\s*osman/i,
  /\b(?:tenant|landlord|rent|rental|letting)\b/i, /\brnt\b/i,
  /\bproperty\s*(?:management|maint|service|group)\b/i, /\baccommoda/i,
  // ── Utilities serving properties ─────────────────────────────────────
  /\boctopus\s*energy/i, /\bedf\s*energy/i, /\beon\s*next/i,
  /\bovo\s*energy/i, /\bovo\b/i, /\bscottish\s*power/i, /\bscottishpower/i,
  /\bbritish\s*gas/i, /\be\.on\b/i, /\bsevern\s*trent/i, /\bthames\s*water/i,
  /\bbulb/i,
  // ── Council taxes / business rates on properties ─────────────────────
  /\bleicester\s*city\s*coun/i, /\blcc\b/i, /\bcouncil\s*tax/i,
  /\bhbbc/i, /\bblaby\s*district/i, /\bhinckley\s*&\s*boswor/i,
  /\bliverpool\s*county/i, /\bstaffor/i, /\bcamden\s*council/i,
  // ── Property-maintenance contractors ─────────────────────────────────
  /\bkane\s*jones/i, /\bm\s*rayyan\s*sheikh/i, /\brayyan\s*sheikh/i,
  /\bdarius?z?\s*browarek/i, /\bwahiduz\s*zaman/i, /\bshafikuz\s*zaman/i,
  /\bshaheeduz\s*zaman/i, /\bi\s*szachidewicz/i, /\bp\s*zimecki/i,
  /\bsatinder\s*singh/i, /\bfaizan\s*shafiq/i, /\bkenneth\s*obilaso/i,
  /\baltaf\s*daud/i, /\bdavinder\s*singh/i, /\behmad\s*ajij/i,
  /\bmy\s*projectz/i, /\ba[\s.]?g[\s.]?a[hj]med/i, /\bjorge\s*lopes/i,
  /\bm\s*f\s*shahul\s*hameed/i, /\bmujtaba\s*hashimi/i,
  /\bg45\s*property\s*maint/i, /\bdrainage\s*&?\s*pest/i,
  /\bd&s\s*drainage/i, /\bhome\s*care\s*leiceste/i,
  /\bs\s*and\s*a\s*autos/i, /\bbrenda\s*fuller/i, /\bag\s*ahmed/i,
  // ── Materials / suppliers for property maintenance ───────────────────
  /\bikstar\b/i, /\bclh\s*group/i, /\baccess\s*uk/i, /\baccess\b/i,
  /\bsleep\s*assured/i, /\bwelford\s*ironmongers/i, /\bnavsa\s*carpets?/i,
  /\bempire\s*appliances?/i, /\bpower\s*appliances?/i,
  /\bthe\s*lighting\s*store/i, /\bthe\s*bed\s*shop/i,
  // ── Insurance (landlord / property) ──────────────────────────────────
  /\bvitality\s*health/i, /\badmiral\s*insurance/i, /\bveygo/i,
  /\bsimply\s*business/i, /\bzurich/i, /\blvic\b/i,
  /\bpc\/simply\s*business/i, /\bhiscox/i, /\baxa/i, /\baviva/i,
  /\bchurchill/i, /\bdirect\s*line/i, /\bpremium\s*credit/i,
  /\binsurance\b/i,
];

/**
 * Returns true when the transaction description matches a property-related
 * vendor or pattern. Used by the forecaster to split cashflow into
 * property (recurring, stable) and non-property (avg-based, variable).
 */
export function isPropertyTransaction(description: string): boolean {
  for (const p of PROPERTY_PATTERNS) {
    if (p.test(description)) return true;
  }
  return false;
}
