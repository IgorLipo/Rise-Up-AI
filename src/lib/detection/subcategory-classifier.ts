export type Subcategory =
  | "salary" | "subscriptions" | "software" | "car-expenses"
  | "rent" | "taxes" | "loans" | "supplier-payments"
  | "utilities" | "bank-fees" | "insurance" | "marketing"
  | "travel" | "office-supplies" | "professional-services"
  | "director-loans" | "property-management" | "property-income"
  | "supplies" | "food-dining"
  | "one-off" | "uncategorized";

interface ClassificationResult {
  category: string;
  subcategory: Subcategory;
  confidence: number;
}

// Keyword-based fallback classifier (runs instantly, no API call)
// Order matters — first match wins.
// food-dining MUST be before software and subscriptions to prevent
// food brands from matching downstream patterns.
const SUBCATEGORY_KEYWORDS: Record<Subcategory, RegExp[]> = {
  "food-dining": [
    // Major chains
    /\bcosta\b/i, /\bstarbucks\b/i,
    /\bpret\b/i,                        // matches "PRET" or "PRET A MANGER" — Pret never appears outside food context
    /\bnero\b/i,
    /\bcaff(?:[eè])\s*nero\b/i, /\bgreggs\b/i, /\bmcdonald/i,
    /\b(?:kfc|kentucky)\b/i, /\bburger\s*king\b/i, /\bdomino.?s\b/i,
    /\bpizza\s*hut\b/i, /\bpizza\s*express\b/i, /\bwagamama\b/i,
    /\bnando.?s\b/i, /\bsubway\b/i, /\bpapa\s*john/i, /\bkrispy\s*kreme\b/i,
    // Delivery
    /\bdeliveroo\b/i, /\bjust\s*eat\b/i, /\buber\s*eats?\b/i,
    // Generic food terms
    /\brestaurant\b/i, /\btakeaway\b/i,
    // Leicester-area spots
    /\bbru\s+(?:oadby|leicester)\b/i, /\boadby\b/i, /\bkonak\b/i,
    /\bkelly.?s?\s*corner\b/i, /\bkhalsa\s*veggie\b/i, /\bperi\s*grill\b/i,
    /\btubo\b/i, /\bdonersty\b/i, /\bsonrisa\b/i, /\bel-vaquero\b/i,
    /\bbatch['’]\s*-\s*leicester\b/i,
    /\bchaiiwala\b/i, /\bthe\s*stage\b/i,
    /\bo\s*ribatejo\b/i, /\bcaste?ro?s?\s*convenience\b/i,
    // More Leicester / Midlands food spots
    /\bcoyote\s*ugly\b/i, /\bwoodys\b/i, /\bgraffiti\s*spiri/i,
    /\bthe\s*italian\s*club\b/i, /\bwreckfish\b/i, /\bla\s*maison\b/i,
    /\btattu\b|t\s*a\s*t\s*t\s*u/i, /\boodles\b/i, /\bbursa\s*shawarma\b/i,
    /\bmcgorums\b/i, /\bpepes\s*piri\s*piri\b/i, /\bsexy\s*fish\b/i,
    /\bjoejuice\b/i, /\bmr\s*bao\b/i,
    /\bbsc\s*plaza\b/i, /\bndaba\b/i,
    /\bandkith\b/i, /\bcltcl\b/i,
    // More UK restaurants / cafes
    /\bsaba\s*uk\b/i, /\bthe\s*antelope\b/i, /\bantelope\s*sw\b/i,
    /\bthe\s*ivy\b/i, /\baroma\s*shawarma\b/i, /\bbursa\s*shawarma\b/i,
    /\bbombay\s*bites\b/i, /\bzest\s*and\s*co\b/i,
    /\ben\s*steak\b/i, /\bls\s*fattoush\b/i, /\btribez\b/i,
    /\bfattoush\b/i, /\bportlands\b/i, /\bmcgorums\b/i,
    /\banmol\s*sweet\b/i, /\btortilla\b/i,
    /\bthe\s*barn\s*burger\b/i, /\bthe\s*barn\s*burge\b/i,
    /\btoddington\s*north\s*pret\b/i,
    /\bcoyote\s*ugly\b/i,
    // London/broader
    /\bgiggling\s*squid\b/i, /\bthai\s*express\b/i, /\bnovikov\b/i,
    /\bsushisamba\b/i, /\bkabul\s*darbar\b/i, /\bhide\s*restaurant\b/i,
    /\bthe\s*pantry\b/i, /\bvolpo\s*lounge\b/i, /\bverso\s*lounge\b/i,
    /\bhotville\b/i, /\bloungers\b/i, /\borange\s*tree\b/i,
    /\bzettle\b.*\b(?:barn|burger|restaurant|cafe|food)\b/i,
    // More chains
    /\bdunkin['’]\s*fosse\b/i, /\besquires\s*coffee\b/i,
    // Cafes, bakeries
    /\bcaf[ée]\b/i, /\bbakery\b/i, /\bsandwich\b/i, /\blunch\b/i,
    /\bdinner\b/i, /\bbreakfast\b/i, /\bmeal\b/i,
    /\bcaf[eé]\s*la\s*blanche\b/i, /\bphilippe\s*conticini\b/i,
    /\bmr\.?\s*baker\b/i, /\bamala\s*catering\b/i,
    /\bdeli\b/i, /\bcatering\b/i, /\bbarbe(?:c|q)ue\b/i,
    /\bpub\b(?!\s*(?:licence|license|property|estate|management|group))\b/i,
    // Food markets / grocers that are clearly food-prep
    /\b(?:sam\s*mart|anna\s*supermarket|highgate\s*plus)\b/i,
  ],
  salary: [
    /\b(?:salary|wages?|payroll|staff\s*payment)\b/i,
    /\b(?:employee|staff)\s*(?:payment|salary|wage)\b/i,
    /\b(?:net\s*pay|gross\s*pay|monthly\s*salary)\b/i,
    /\breimbursement\b/i,
  ],
  software: [
    /\bapple\b(?!\s*(?:store|pay|music|tv|news|arcade|fitness))\b/i,
    /\badobe\b/i, /\bcanva\b/i, /\bfigma\b/i, /\bnotion\b/i,
    /\blinear\b/i, /\bgithub\b/i, /\bgitlab\b/i, /\bvercel\b/i,
    /\bnetlify\b/i, /\bheroku\b/i, /\bdigital\s*ocean\b/i,
    /\blinode\b/i, /\bcloudflare\b/i, /\bopenai\b/i,
    /\banthropic\b/i, /\bmistral\b/i, /\bdeepseek\b/i,
    /\bchatgpt\b/i, /\bsupabase\b/i, /\bfirebase\b/i,
    /\bsentry\b/i, /\bdatadog\b/i, /\bahrefs\b/i, /\bsemrush\b/i,
    /xero|quickbooks|slack|notion|linear|figma|github|gitlab|atlassian|jira|hubspot|salesforce|zendesk|mailchimp|google\s*workspace|microsoft\s*365|office\s*365|dropbox|vercel|netlify|heroku|aws\s/i,
    /\bwhop\b/i, /\bexposcale\b/i, /\btoolsuite\b/i,
    /\bgodaddy\b/i, /\b01\.ai\b/i, /\bppt\.ai\b/i,
    /\bwww\.capital\s*ontap\b/i,
    /\b(?:website|web\s*host|domain|hosting)\b/i,
    /\b(?:software|saas)\b/i,
  ],
  subscriptions: [
    /\b(?:subscription|monthly\s*fee|annual\s*fee|recurring)\b/i,
    /amazon\s*prime/i, /prime\s*video/i, /\bspotify\b/i,
    /\bpure\s*gym\b/i, /the\s*gym\s*group/i,
    /monday\.com/i, /pdfleader/i, /01\.ai/i, /\bgamma\b/i,
    /\bnetflix\b/i, /\bdisney\b\+?\b/i,
    /\byoutube\s*(premium|music)\b/i,
    /\bgoogle\s*one\b/i,
    /\bpreschool\b/i, /\bbemorefit\b/i,
  ],
  "car-expenses": [
    // Car brands
    /car payment|vehicle|auto loan|car lease|car wash|car service|car repair|mot |tyre|autohorn|fleet|vauxhall|bmw|mercedes|audi|\bford\b|vw |volkswagen|toyota|honda|nissan|porsche|land rover|jaguar|tesla|hyundai|kia|mazda|volvo|lexus|american car/i,
    // Fuel/petrol stations
    /\bshell\b(?!\s*(energy|electric))/i,
    /\bbp\b(?!\s*(energy|electric))/i,
    /tesco\s*pay\s*(at|@)\s*pump/i,
    /tesco\s*pfs\b/i,
    /asda\s*petrol/i, /asda\s*pfs\b/i,
    /\bmfg\b/i,
    /\bcostco\s*pfs\b/i,
    /sainsbury.*petrol/i,
    /\bapplegreen\b/i,
    /\besso\b/i, /\bmurco\b/i, /\brontec\b/i,
    /\beg\s*on\s*the\s*move\b/i,
    /\bkenton\s*pk\s*svs\b/i,
    /\boadby\s*filling\b/i,
    /\blittleover\b/i,
    /\bpetrol\b/i, /\bfuel\b/i, /\bdiesel\b/i,
    /\bfilling\s*(?:station|stn)\b/i,
    /\bglisteningpro\b/i, /\bf1\s*provaleting\b/i,
    /\bsq\s*\*f1pro\b/i,    // backstop in case the SQ prefix wasn't stripped
    // Vehicle tests / authorities
    /\bdvsa\s*theory/i, /\bdvsa\b/i,
    // Parking
    /\bpaybyphone\b/i, /\bringgo\b/i,
    /\bncp\b/i, /\bq-park\b/i, /\bq\s*park\b/i,
    /\bhighcross\s*car\s*park\b/i,
    /\bmapp\s*pm\s*parking\b/i,
    /\bsmart\s*parking\b/i,
    /\briverside\s*west\s*car\b/i,
    /\bbarbican\s*centre\s*car\b/i,
    /\bapcoa\b/i, /\bm6\s*toll\b/i, /\bm6toll\b/i,
    /\bcongestion\s*charge\b/i, /\bdart\s*charge\b/i,
    /\bdvla\b/i, /\broad\s*tax\b/i, /\bdvsa\b/i,
    /\bvehicle\s*(tax|insurance|repair)\b/i,
    /\bparking\b/i,
    // Car repair/maintenance
    /\bauto\s*repair\b/i, /\btyre\b/i, /\bmechanic\b/i,
    /\bcar\s*(repair|service|wash|valet|park)\b/i,
    /\bcar\s*repayment\b/i,
    /\bkwik\s*fit\b/i, /\brac\b/i,
    /\baa\s*(car|breakdown|insurance)\b/i,
    // Car wash brands
    /\b(?:usa|american)\s*(?:mobile|hand)?\s*car\s*wash\b/i,
    /\bf1\s*pro\s*valeting\b/i, /\bimo\s*car\s*wash\b/i,
    // Transport for London
    /\btfl\b/i, /\btransport\s*for\s*london\b/i,
    /\blul\b/i, /\btsgn\b/i,
  ],
  "property-management": [
    /property management|property maint|estate agent|sequoia|nasim holdings|osiris property|online estate|property group|properties|united92/i,
    /\bamha\s*leicester\b/i,
    /\bgreen\s*acres\b.*\bestate\b/i,
    /\bhaus\s*property\b/i,
    /\bmidlands\s*property\b/i,
    /\bsequoia\s*property\b/i,
    /\btranquil\s*accommoda\b/i,
    /\baccommoda\b/i,
    /\bmahil\b/i,
    /\bhomebound\b/i,
    /\bletting\b/i,
    /\bproperty\s*(management|maint|service|group|rental)\b/i,
    /\bestate\s*agent\b/i,
    // Additional property companies
    /\bdawood\s*osman\b/i,
    /\bshenu\s*investments?\b/i,
    /\bmm\s*property\b/i,
    /\bpaul\s*mahil\b/i,
    /\blandlord\s*beds?\b/i,
    /\bnasim\s*holdings?\b/i,
    /\bosiris\b/i,
    /\bsandhar\s*investment\b/i,
    /\bops\s*rent\b/i,
  ],
  rent: [
    /\brent\b|lease payment|property rent|office rent|commercial rent|letting|landlord|housing benefit|accommoda|green acres|estate\b/i,
    /\btranquil\s*accom\b/i,
    /\brent\s*(income|payment|receipt|collection)\b/i,
    /\b(?:flat|apartment|unit|house)\s*\d*.*\b(?:rent|lease|let)\b/i,
    /\b(?:rn?t|ops\s*rent)\b/i,
    /\bsandhar\s*investment\b/i,
    /\binvestment\b.*\b(?:flat|apt|house|property)\b/i,
    /\bproperty\s*(?:rental|lease|letting)\b/i,
    /\baccommodation\s*(?:rent|payment|fee)\b/i,
  ],
  taxes: [
    /hmrc|vat |corporation tax|paye|self assessment|tax payment|hm revenue|national insurance/i,
    /\b(?:city|borough|county|district|parish|local|council|coun?c?il)\b.*\b(?:council|cou)\b/i,
    /\b(?:council|cou)\b.*\b(?:tax|rates|payment|charge|bill)\b/i,
    /\bleicester\s*city\s*(?:council|cou)\b/i,
    /\bleic\s*city\s*(?:council|cou)\b/i,
    /\bcouncil\s*tax\b/i,
    /\bbusiness\s*rates\b/i,
    /\bnon-domestic\s*rates\b/i,
    /\bhbbc\b/i,
    /\bpensions?\s*regulat/i,
    /\bcouncil\b(?!\s*estate)/i,
    /\bcou\b(?!\s*(?:estate|property|house))\b/i,
    // Council abbreviations
    /\blcc\b/i,
    /\bl\s*b\s*camden\b/i,
    /\bcamden\b.*\b(?:council|borough)\b/i,
    /\bliverpool\s*(?:city|county)\s*(?:council|cou)\b/i,
    /\b(?:stafford|milton\s*keynes|barnet|hackney|croydon|brent)\b.*\b(?:council|borough)\b/i,
    // Payment portals
    /\bpaynotice\b/i,
    /\bcouncil\s*(?:counter|internet|web|online)\s*pay/i,
    /\bcouncil\s*park\b/i,
    // Tax/debt collectors
    /\bbristow\s*(?:and|&)\s*sutor\b/i,
    /\bcompanies\s*house\b/i, /\bcompanieshouse\b/i,
    /\bland\s*registry\b/i,
    /\bico\.org\b/i,
    /\bkeyivr\b/i, /\bbarnet\.keyivr/i,    // Council IVR payment portal
    /\blcc\s*npu\b/i, /\bwww\.paynotice\b/i,
  ],
  "director-loans": [
    /director.?loan|dla|dlj/i,
    /\brefun\s*dir\s*loan\b/i,
    /\bdirectors?\s*(?:loan|repayment|payment|refund)\b/i,
    /\bdl\s*(?:account|loan)\b/i,
    /\bdirector\s*refund\b/i,
  ],
  loans: [
    /loan repayment|bank loan|business loan|bounce back loan|cbils|capify|\bloan\b|funding circle|iwoca|capital on tap|\bfinance\s*(?:company|plc|ltd|house|group|solution)\b/i,
    /\bcapital\s*on\s*tap\b/i,
    /\b(?:loan|credit|finance)\s*(?:repayment|payment|agreement)\b/i,
  ],
  "supplier-payments": [
    /\b(?:supplier|wholesale|distributor|inventory|stock\s*purchase)\b/i,
    /\binv\b/i, /\binvoice\b/i,
    /\b(?:purchase|supply|procurement)\s*(?:order|invoice|payment)\b/i,
  ],
  utilities: [
    // Energy companies
    /\b(?:octopus|ovo|bulb|edf|e\.on|eon|npower|scottish\s*power|scottishpower|sse|british\s*gas|utility\s*warehouse|utilita|first\s*utility|ebico)\s*(?:energy|electric|gas)?\b/i,
    /\b(?:edf|e\.on|eon)\b/i,
    // Water companies
    /\b(?:severn\s*trent|thames\s*water|anglian\s*water|yorkshire\s*water|welsh\s*water|southern\s*water|wessex\s*water|united\s*utilities)\b/i,
    // Telecom
    /\b(?:vodafone|ee\s*(?:limited|ltd)?|o2|three|talktalk|bt\s*(?:group)?|virgin\s*media|sky\s*(?:broadband|internet)?|plusnet|hyperoptic|zen\s*internet|g\.?network|community\s*fibre)\b/i,
    // Generic utility keywords
    /\b(?:aerial|electric|gas\s|energy\s|water\s|broadband|internet|phone\s*bill|mobile\s*bill)\b/i,
    /\butility\b/i,
  ],
  "bank-fees": [
    /overdraft fee|account fee|service charge|bank charge|transaction fee|monthly fee|unpaid item|arranged overdraft/i,
    /\bbank\s*(?:fee|charge|payment)\b/i,
  ],
  insurance: [
    /\binsurance\b/i,
    /public liability|professional indemnity/i,
    /\b(?:simply\s*business|hiscox|axa|aviva|churchill|direct\s*line|zurich|premium\s*credit|vitality\s*health|admiral|veygo|zenith|allianz|lv=|more\s*than|saga|tesco\s*bank|m&s\s*bank|nationwide|halifax|lloyds|barclays|natwest|hsbc)\s*(?:insurance|assurance|life|health|car|home|motor|van|fleet)?\b/i,
    /\bveygo\b/i, /\badmiral\s*insurance\b/i,
  ],
  marketing: [
    /google ads|facebook ads|instagram ads|linkedin ads|advertising|marketing|sponsored|ad campaign/i,
    /\bace\s*marketing\b/i,
    /\bsocial\s*media\b/i,
    /\b(?:seo|ppc|sem)\b/i,
  ],
  travel: [
    // Flights
    /flight|ryanair|easyjet|ba flight|kiwi\.com|skyscanner/i,
    // Hotels
    /\bhotel\b/i, /\bairbnb\b/i, /\bnovotel\b/i, /\bholiday\s*inn\b/i,
    /\b(?:marriott|hilton|ibis|radisson|ramada|comfort\s*inn|days\s*inn|jurys\s*inn)\b/i,
    /\bleonardo\s*htl\b/i, /\bpremier\s*inn\b/i, /\btravelodge\b/i,
    /\baccommodation\b/i,
    // Transport
    /\btrainline\b/i,
    /\buber\s*(?!eats?\b)/i,
    /\bcar\s*hire\b/i,
    /\benterprise\s*rent/i,
    /\b(?:avis|hertz|europcar|sixt|budget|alamo|thrifty)\b/i,
    // Motorway services
    /\bmoto\b(?!.*(?:repair|service|parts|tyre|tyres))/i,
    /\bwelcome\s*break\b/i,
    /\broadchef\b/i,
    /\bextra\s*(?:moto|services)\b/i,
    /\b(?:motorway|lodge)\s*services?\b/i,
    /\btoddington\b(?!\s*(?:north|south|east|west|road|street|lane))/i,
    /\bservices?\s*(?:station|stop|area)\b/i,
    /\bmilford\s*service/i,             // Milford Services (M1 motorway)
    /\bservice\s*stn?\b/i,              // "SERVICE ST" / "SERVICE STN" common shorthand
    /\briverside\s*west\s*car/i,        // car park / travel — kept here for backstop
    /\b(?:strand\s*palace|premier|travelodge|britannia|leonardo)\b.*\bhtl\b/i,
    /\bleonardo\s*htl\b/i,
    // Tolls
    /\bm6toll\b|\bm6\s*toll\b/i,
    // Booking sites
    /\bbooking\.com\b/i, /\bexpedia\b/i, /\btrivago\b/i,
    // Taxi/ride
    /\b(?:taxi|cab|minicab|chauffeur)\b/i,
    // Airports
    /\bstansted\s*airport\b/i,
    /\bluton\s*(?:exp|airport)\b/i,
  ],
  "office-supplies": [
    /stationery|office supplies|printer|ink |toner|viking direct|staples|ryman|banner|vistaprint|printed\.com/i,
    /\b(?:envelopes?|paper|pens?|pencils?|notebooks?|folders?|binders?)\b/i,
  ],
  "professional-services": [
    /accountant|accountancy|solicitor|lawyer|legal |consultant|consulting|auditor|bookkeeper|bookkeeping|cleaning|cleaner|security|electrical|plumbing|plumber|surveyor|surveying|cctv|alarm|maintenance|repair|\baccount(?:ing|ancy)\s*service\b/i,
    /\b(?:legal|law)\s*(?:firm|practice|services?|advice)\b/i,
    /\b(?:removal|clearance|waste|rubbish|recycling)\s*(?:service|company|firm)?\b/i,
    /\b(?:gardening|landscaping|tree\s*surgery)\b/i,
    /\bic-cleaners\b/i,
    /\b(?:painting|decorating|plastering|carpentry|joinery)\b/i,
    /\bucheck\b/i,
  ],
  supplies: [
    // Supermarkets / convenience stores
    /tesco|sainsbury|asda|morrisons|aldi|lidl|waitrose|ocado|co-op|supermarket|grocer/i,
    /\bselect\s*convenience\b/i, /\bcastros?\s*convenience\b/i,
    /\banna\s*supermarket\b/i, /\bhighgate\s*plus\b/i, /\bsam\s*mart\b/i,
    /\bhotvillle?\b/i, /\bhot\s*ville\b/i,
    /\bwelford\s*ironmongers\b/i,
    // E-commerce wrappers
    /\bamazon\b/i,
    /\bwww\.use\.ai/i,
    // Home/garden
    /b&q|\bb\s*&\s*q\b|wickes|screwfix|toolstation|homebase|ikea|currys|argos|dunelm/i,
    /\bpoundstretcher\b/i, /\bnext\b\s+(?:retail|store)?\s*\d*\s+[A-Za-z]+\s+GB/i,
    // General retail
    /amazon|marks?\s*(?:&|and)\s*spencer|john\s*lewis|debenhams|boots\b|superdrug|wilko|poundland|home\s*bargains|b&m\b/i,
    // Furniture/furnishings
    /\bsoft\s*furnishing\b/i,
    /\bnavsa\s*carpets?\b/i,
    /\bempire\s*appliances?\b/i,
    /\bpower\s*appliances?\b/i,
    /\bthe\s*lighting\s*store\b/i,
    // Department stores
    /\bprimark\b/i, /\btk\s*maxx\b/i, /\bselfridges\b/i, /\buniqlo\b/i,
    // Misc retail
    /\btimpson\b/i, /\bb&m\b/i, /\bapple\s*store\b/i,
    /\b(?:clothing|fashion|apparel)\b/i,
    // Costco supermarket purchases (NOT fuel — Costco PFS routes to car-expenses below)
    /\bcostco\b(?!\s*(?:pfs|petrol|fuel))\b/i,
    // Pharmacy
    /\b(?:pharmacy|chemist|e-surgery|esurgery)\b/i,
    // Flowers/gifts
    /\bst\s*anns?\s*flowers\b/i,
  ],
  "property-income": [
    /rent.*income|property.*income|accommodation.*income|housing.*benefit/i,
    /\b(?:rental|letting)\s*income\b/i,
    // Tenant pays via mobile transfer with a property address in the description.
    // Match house-number + street-name + UK road-type suffix.
    /\b\d{1,4}[a-z]?\s+[A-Za-z]+\s+(?:road|street|drive|avenue|lane|crescent|close|rd|dr|ave|ln|cres|crs|gardens|gdns|terrace|grove|mews|parade)\b/i,
    // Explicit rent token (only as last-resort fallback before uncategorized)
    /\brent(?:al)?\b/i,
  ],
  "one-off": [],
  "uncategorized": [/./],
};

export function classifySubcategory(description: string): ClassificationResult {
  // Test BOTH the raw description and the normalized form. Some patterns
  // (e.g. \bsubway\b) only match after normalization strips suffix digits
  // ("SUBWAY25594" → "SUBWAY"); other patterns rely on raw artefacts like
  // "VIA MOBILE - PYMT" being present.
  const raw = description;
  // Lazy-import to avoid circular dep (normalizer doesn't import this file).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { normalizeMerchant } = require("./merchant-normalizer") as typeof import("./merchant-normalizer");
  const normalized = normalizeMerchant(description);
  const candidates = raw === normalized ? [raw] : [normalized, raw];

  const entries = Object.entries(SUBCATEGORY_KEYWORDS) as [Subcategory, RegExp[]][];
  for (const [subcategory, patterns] of entries) {
    if (subcategory === "uncategorized" || subcategory === "one-off") continue;
    for (const pattern of patterns) {
      for (const candidate of candidates) {
        if (pattern.test(candidate)) {
          return { category: mapToCategory(subcategory), subcategory, confidence: 0.7 };
        }
      }
    }
  }
  return { category: "Uncategorized", subcategory: "uncategorized", confidence: 0.1 };
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
    "one-off": "One-Off",
    "uncategorized": "Uncategorized",
  };
  return mapping[sub];
}
