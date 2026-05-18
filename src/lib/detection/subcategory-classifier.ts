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
    // Extended restaurant / cafe list (from invoice deep-dive)
    /\bcattle\s*and\s*smoke\b/i, /\bribeye\s*steakhouse\b/i,
    /\brio'?s\s*piri\s*piri\b/i, /\bohannes\s*burger\b/i,
    /\bnoodle\s*house\b/i, /\bthe\s*mayan\b/i, /\bzizzi\b/i,
    /\bjoeandthejuice\b/i, /\btamatanga\b/i, /\bpeara\b/i,
    /\bafrikana\b/i, /\blokma\s*shawarma\b/i,
    /\bls\s*secret\s*garden\b/i, /\bangus\s*&\s*wagyu\b/i,
    /\bsoho\s*coffee\b/i, /\bsmokyz\b/i, /\bbatch'?d\b/i,
    /\bthe\s*farmhouse\b/i, /\bthe\s*broadway\s*bar\b/i,
    /\bnicco\s*bar\b/i, /\brailway\s*hinckley\b/i,
    /\bpak\s*foods\b/i, /\bone\s*stop\b/i, /\bamigo\s*leicester\b/i,
    /\bmorr\s*(?:tamworth|leicester)\b/i, /\bmorrisons\b/i,
    /\bmeet\s*bros\b/i, /\bharrys\s*kings?\s*cross\b/i,
    /\bresta\s*coffee\b/i, /\btea\s*time\s*leicester\b/i,
    /\bthe\s*effervesce\b/i, /\bsumup\s*\*the\s*effervesce\b/i,
    /\bgk\s*leicester\b/i, /\bafrican\s*heritage\b/i,
    /\bpremier\s*post\s*office\b/i,           // small retail / convenience
    /\bcompare\s*the\s*market\b/i,
    /\bco\s*op\s*live\b/i,
    /\bexpo\s*city\s*croydon\b/i,
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
    /\baccess\s*uk\s*ltd\b/i, /\bcom678\b/i,    // Access UK ERP suite
    /\bwww\.use\.ai\b/i,
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
    /\bsam\s*preston\b/i,                  // health & fitness / team events
    /\bcarisbrooke\s*ltc\b/i,              // tennis club
    /\bevolution\s*fitness\b/i,
    /\bufs\s*\*evolution/i,
    /\bwww\.e\.org\b/i,                    // Energy UK membership
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
    // Vehicle insurance / lease
    /\blvic\b/i,
    // Tolls / parking
    /\bmersey\s*tunnel\b/i,
    /\bsimple\s*intelligent\s*par/i,
    /\bplaces\s*for\s*london\b/i,         // PfL parking / TfL fares
    // Petrol stations spelled out
    /\bsf\s*connect\b/i,                  // service-station SF Connect chain
    /\bservice\s*statio?\b/i,             // generic SERVICE STATIO
    /\bs\/stn\b/i,                        // S/STN abbreviation
    /\bhowkins\s*service/i,
    /\bnewport\s*pagnell\s*n-?\s*sta/i,
    /\bst\s*peters\s*road\s*service/i,
    /\bonstr\s*\(?e\)?\s*basingstoke/i,   // Milton Keynes onstreet
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
    /\bonline\s*estat\b/i,                  // Online Estate Ltd
    /\bmidshire\s*propertie?\b/i,
    /\brydell\s*ltd\b/i,
    /\bwayoflife\.com\b/i,
    /\bk\s*p\s*shahbaz\b/i,                 // Property fee collector
    /\bpmg\b/i,                             // Property Management Group
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
    /\bhinckley\s*&?\s*boswor/i,           // Hinckley & Bosworth Borough Council
    /\bstaffor[a-z]*\.gov\.uk\b/i,         // Stafford BC parking / fees
    /\bnest\s*it\d+/i,                     // NEST workplace pension
    /\bnest\b.*\bpension\b/i,
    /\bpensions?\s*regul/i,                // The Pensions Regulator (already partial)
    /\bworkplace\s*pension\b/i,
  ],
  "director-loans": [
    /director.?loan|dla|dlj/i,
    /\brefun.?d?\s*dir/i,                  // RefunDirLoan, RefudDirLoan, RefunDireLoan
    /\bdire?\s*loan/i,                     // DireLoan variants
    /\bdirectors?\s*(?:loan|repayment|payment|refund|renumeration|remuneration)\b/i,
    /\bd\s*re[nm]umer/i,                   // "D RENUMERATION" / "D REMUNERATION"
    /\bdl\s*(?:account|loan)\b/i,
    /\bdirector\s*refund\b/i,
    // Named operators recurring as director / partner cash flows.
    // (Conservative — only when accompanied by typical director-loan tokens.)
    /\bophir\s*lahav\b/i,
    /\bol\s*management\b.*\b(?:loan|refun|dire)/i,
    /\bhamza\s*ahmed\b.*\b(?:revolut|d\s*re[nm]umer|withdrawl|repayment|sent\s*from)/i,
    /\bag\s*ophir\s*lahav\b/i,
  ],
  loans: [
    /loan repayment|bank loan|business loan|bounce back loan|cbils|capify|\bloan\b|funding circle|iwoca|capital on tap|\bfinance\s*(?:company|plc|ltd|house|group|solution)\b/i,
    /\bcapital\s*on\s*tap\b/i,
    /\b(?:loan|credit|finance)\s*(?:repayment|payment|agreement)\b/i,
    /\bpropel\s*finance\b/i,
    // Royal Bank / RBS recurring outflows look like loan / CC payments
    /\broyal\s*bank\b\s*\d{1,2}[a-z]{3}\b/i,
    // Internal credit-card statement clearance: "30MAY A/C 37523686"
    /\b\d{1,2}[a-z]{3}\s+a\/c\s*\d{4,}\b/i,
  ],
  "supplier-payments": [
    /\b(?:supplier|wholesale|distributor|inventory|stock\s*purchase)\b/i,
    /\binv\b/i, /\binvoice\b/i,
    /\b(?:purchase|supply|procurement)\s*(?:order|invoice|payment)\b/i,
    /\bikstar\b/i,                         // Major materials supplier
    /\bclh\s*group\b/i,                    // Industrial tools / kit
    /\biks?tar\s*limited\b/i,
    /\bsi-\s?\d{3,}\b/i,                   // "SI-30033" supply-invoice prefix
    /\bpo-?\s?\d{3,}\b/i,                  // "PO-004" purchase-order prefix
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
    /\bacc-nwestplat\b/i,                  // NatWest Platinum platform fee
    /\bfp\s*reject\b/i,                    // Failed Faster Payment
    /\bbmach\b/i,                          // Barclays ATM (cash withdrawal)
    /\bnotemachine\b/i,                    // Third-party ATM
    /\bpost\s*office\s*\d{1,2}[a-z]{3}\b/i, // Post Office counter cash
    /\broyal\s*bank\s+\d{1,2}[a-z]{3}\b/i, // RBS routine sweep (also matched in loans; first-match wins)
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
    /\bminuteman\s*press\b/i,                 // Flyers / posters
    /\baa\s*print\b/i,                        // Print supplier
    /\b(?:flyers?|leaflets?|posters?|signage|brochures?)\b/i,
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
    // Couriers / parcel shipping
    /\bfedex\b/i, /\bdpd\b/i, /\bparcelforce\b/i,
    /\bhlt[_\s]*lon[_\s]*metropole\b/i,        // Hilton London Metropole
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
    /\bic-cleaners\b/i, /\bhome\s*care\s*leiceste/i,
    /\b(?:painting|decorating|plastering|carpentry|joinery)\b/i,
    /\bucheck\b/i,
    // Property-tradespeople / contractors (recurring small invoices from
    // named individuals tied to property refurb).
    /\bkane\s*jones\b/i,
    /\bdavinder\s*singh\b/i,
    /\bm\s*rayyan\s*sheikh\b/i, /\brayyan\s*sheikh\b/i,
    /\bdarius?z?\s*browarek\b/i,
    /\bwahiduz\s*zaman\b/i, /\bshafikuz\s*zaman\b/i,
    /\bi\s*szachidewicz\b/i,
    /\ba[\s.]?g[\s.]?a[hj]med\b/i,            // "A G AHMED" / "A G AJMED"
    /\bsatinder\s*singh\b/i,
    /\bg\s*moa?hmmed\s*haydar\b/i,           // electrician
    /\bmy\s*projectz\b/i,
    /\bfaizan\s*shafiq\b/i,
    /\bbrenda\s*fuller\b/i,
    /\bkenneth\s*obilaso\b/i,                 // removals / site clearance
    /\baltaf\s*daud\b/i,
    /\bd&s\s*drainage\b/i,
    /\bjs\s*job\s*sorted\b/i,                 // recruitment
    /\bs\s*and\s*a\s*autos\b/i,               // mechanic — fits car-expenses but routed here
    /\baa\s*print\b/i, /\bminuteman\s*press\b/i,  // print / marketing
    /\bdariusz\s*browarek\b/i,
    /\bp\s*zimecki\b/i,                       // builder
    /\bsleep\s*assured\b/i,
    /\bjorge\s*lopes\b/i, /\baccess\s*uk\b.*\binitial\s*payment\b/i,
    /\bshona\s*fabulous\s*fac\b/i,            // events / face painting
    /\bst\s*francis\s*communi/i,              // room hire
    /\bking\s*inflatables\b/i,
    /\bjulia\s*boguslawska\b/i,               // staff reimbursement
    /\bfahad\s*ahmed\s*reimburs/i,
    /\b(?:initial\s*payment|inv\s*no|invoice\s*no)\b/i,
    /\breimburs?ment\b/i,
    /\bcarpentry\b|\bjoinery\b|\bbuilder\b|\bcontractor\b/i,
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

/**
 * Classify a transaction description.
 *
 * Hard rule: never returns "uncategorized" to callers. If no keyword pattern
 * matches, falls back to a direction-aware best-guess essence category
 * (the caller passes `direction` so we can route credits → property-income
 * and debits → supplier-payments). The original "uncategorized" subcategory
 * is no longer surfaced anywhere — it's an internal-only state inside
 * matching loops.
 */
export function classifySubcategory(
  description: string,
  direction?: "credit" | "debit"
): ClassificationResult {
  const raw = description;
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

  // Fallback: route by direction. We never expose "uncategorized" to callers.
  // The "one-off" flag is tracked separately (cross-month learner sets it
  // when a vendor has only ever appeared once) — the subcategory still
  // reflects the essence of the transaction.
  if (direction === "credit") {
    return { category: "Other Income", subcategory: "property-income", confidence: 0.3 };
  }
  return { category: "Suppliers & Services", subcategory: "supplier-payments", confidence: 0.3 };
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
