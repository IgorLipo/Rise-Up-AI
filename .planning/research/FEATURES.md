# Features Research: Business Cashflow Forecasting

**Domain:** Cashflow forecasting for UK small businesses via bank statement PDF upload
**Researched:** 2026-05-11
**Overall confidence:** HIGH (primary sources: Float feature pages, Float/Xero App Store user reviews, PNC patent on recurring detection, Databox UX research, fintech UX anti-pattern analyses)

---

## Executive Summary

The cashflow forecasting market has cleaved into two tiers: (1) deep integrations with live bank feeds and accounting software (Float, Futrli, Agicap) and (2) simple manual-input tools (Pulse). This app occupies a **unique third category**: no live bank connection needed, just upload a PDF statement. That is both a differentiator and a constraint -- it means the app can serve bank-agnostic, privacy-conscious users, but it also means the forecast quality lives or dies on how well it processes the statements it does have.

Across all successful products, the universal table stakes are: **correct numbers**, **clear time boundaries** (what's actual vs. predicted), **a simple monthly survival question answered** ("will I make it to month-end?"), and **specific, actionable risk warnings**. Where tools fail, users abandon them. The most-cited reason for abandonment is forecasts that cannot be trusted because underlying logic is opaque or wrong. The most-cited reason for love is "peace of mind" -- seeing a clear cash outlook and knowing what to do about it.

For this project specifically, the feature work is about **making the existing feature set trustworthy**. The hardest technical challenges are recurring pattern detection with confidence tiers (something PNC patented in 2025, signaling industry recognition of the difficulty) and deduplication of already-occurred transactions (preventing double-counting in forecasts). The highest-impact UX work is the forecast summary card: latest balance, expected remaining income/expenses, predicted month-end balance, lowest expected balance with date, status, and confidence.

---

## Table Stakes

Features that users expect in ANY cashflow tool. Missing any of these = product feels broken or untrustworthy.

| # | Feature | Why Expected | Complexity | Status / Notes |
|---|---------|--------------|------------|----------------|
| TS-01 | **Correct current balance** from latest statement closing balance | Every tool starts from "what do I actually have right now." Wrong number = all forecasts are garbage. Float syncs live from bank; we derive from latest PDF closing balance. | LOW | Currently broken -- showing accumulated net flow (-32K) instead of closing balance (380). This is the #1 critical fix. |
| TS-02 | **Clear actual-vs-predicted boundary** | Users must instantly know what's happened vs. what's projected. Float and Pulse both use a "today" marker line. Confusing this boundary is the #1 trust-killer. | LOW | Forecast must start from latest actual date and forecast only remaining days. Currently not enforced. |
| TS-03 | **Month-end cash position prediction** | The core question every business owner asks: "How will this month end?" Must answer with a single clear number. | MEDIUM | Formula: latestClosingBalance + expectedRemainingIncome - expectedRemainingExpenses. Depends on correct starting balance (TS-01) and correct recurring predictions (TS-05). |
| TS-04 | **Income vs. expenses breakdown** (expected remaining) | Users need to see what's still coming in and what's still going out. Float calls it "cash in/cash out." Without this, the month-end number is unverifiable. | LOW | Sum of expected remaining transactions, grouped by direction. |
| TS-05 | **Recurring transaction detection** | Every tool does this. Float pulls from Xero recurring invoices; Pulse has manual recurring schedules. Our differentiator: learning from history without manual setup. | HIGH | Currently exists but produces low-confidence noise. Needs confidence tiers and deduplication. |
| TS-06 | **Risk warnings that are specific** | Generic "cash is low" is worse than useless -- it trains users to ignore warnings. Float's "death date" concept (date you hit a threshold) is the gold standard. | MEDIUM | Must include: specific vendor name, expected amount, expected date, and what the balance will be if it doesn't arrive. "Balance expected to remain below £500 until Tranquil Accommodation payment of £2,400 arrives around 23-24 May." |
| TS-07 | **Upload triggers full refresh** | When a user uploads a statement, everything downstream must update: validation, learning, reclassification, patterns, forecast. Users will NOT manually trigger refreshes. | LOW | Pipeline must be deterministic and idempotent. Currently partial -- some steps may be skipped. |
| TS-08 | **Upload summary feedback** | After upload, the user must see what changed: what period was imported, latest balance, new vendors found, patterns updated. Float does this by showing the updated graph immediately. | LOW | Currently missing or incomplete. |
| TS-09 | **Transaction categorization (accurate)** | If Leicester City Council is "one-off" when it appears every month, the forecast is wrong. Miscategorization is the #2 trust-killer after wrong balances. | LOW for rules, MEDIUM for AI | Keyword/pattern rules for known vendors + AI for ambiguous. Both must be verified. |
| TS-10 | **Forecast only covers current month by default** | Users want to know about THIS month. 82% of business failures are cash management issues within 90 days. Float's default is 13-week rolling; for our audience, current month-first is correct. | LOW | Completed months show actuals only. Current month shows remaining forecast. Future months on request. |
| TS-11 | **Deduplication of already-occurred transactions** | If a recurring transaction already happened this month, it must not appear in the remaining forecast. Double-counting produces nonsensical forecasts. | MEDIUM | Must check actual transactions in current month against predicted recurring patterns. This is the single most important correctness fix for the forecast. |

---

## Differentiators

Features that set this product apart. Not expected, but valued. These are areas to optimize for competitive advantage.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| DF-01 | **No bank connection needed -- PDF upload only** | Privacy-conscious users. Works with ANY bank that provides PDF statements (currently NatWest only, but extensible). Only tool in the market with this model. Float/Pulse/Futrli all require live bank/OAuth connections. | MEDIUM for format expansion | Differentiator only works if statement parsing is reliable. Must handle edge cases in PDF extraction. |
| DF-02 | **Confidence tiers for recurring predictions** (high/medium/low) | Three tiers: HIGH (4+ months, stable amount/dates) shown in main forecast; MEDIUM shown as "possible"; LOW excluded from main forecast. Float has a single confidence score; Pulse has none. This is more nuanced than any competitor. | HIGH | PNC patented multi-algorithm confidence scoring in 2025. This is genuinely hard -- requires date stability, amount stability, vendor type analysis, and cross-month pattern matching. The patent confirms the industry is still figuring this out. |
| DF-03 | **AI-powered vendor intelligence learning** | The system learns vendor patterns across statements: identifies recurring vs. irregular vs. one-off, same vendor/different property, same vendor/different transaction type, income vs. expense. Competitors require manual recurring setup or just pull from accounting software. | HIGH | `learnFromHistory()` is the core intellectual property. Must separate true recurring from frequent-but-irregular (e.g., Shell fuel stops that happen often but not on a schedule). |
| DF-04 | **Property-specific categorization** | Dedicated handling for property management vendors: rent income, council payments, estate agent fees, property maintenance. This is a niche that Float/Pulse do NOT address -- they treat everything as generic business transactions. | MEDIUM | Requires vendor knowledge base: AMHA Leicester, Green Acres Estate, Haus Property, Midlands Property, Sequoia Property, Leicester City Council, Tranquil Accommodation. |
| DF-05 | **Suspicious transaction detection** (personal expense flagging) | Flags transactions that look personal (fast food, entertainment, personal shopping) vs. business. No competitor does this -- they assume all transactions in connected accounts are business. Since users manually upload statements, they want help separating business from personal. | MEDIUM | Currently has false positives (rent flagged as fast food). Must consider amount, direction, vendor type, AND transaction wording -- not just keywords. |
| DF-06 | **Month cards with per-month accuracy** | Each month gets a self-contained card: period, opening/closing balance, income, expenses, net movement, top sources, unusual items, and forecast accuracy (how close was the prediction?). No competitor presents historical months as rich, comparable cards. | MEDIUM | Depends on having correct closing balances stored per-statement. Currently muddled by accumulated net flow. |
| DF-07 | **Business-useful forecast summary** | A single card showing: latest balance, expected remaining income, expected remaining expenses, predicted month-end balance, lowest expected balance with date, status (Safe/Watch/Risk/Critical), and confidence percentage. This is the "answer card" -- everything else is drill-down. | LOW (UI) but depends on HIGH (logic) | This is the #1 UX differentiator. If this card is right, the product is usable. Everything else supports this card. |

---

## Anti-Features

What to deliberately NOT build. These confuse users, damage trust, or waste effort.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|-------------|-----------|-------------------|
| AF-01 | **Accumulated net flow presented as current balance** | Users compare this to their bank balance. When it does not match, they think the app is broken. This is currently the #1 user-facing bug. | Present latest statement closing balance as current cash position. Show accumulated net flow separately, clearly labeled as "net performance across all statements." |
| AF-02 | **Long-term (6+ month) projections without confidence decay** | Forecasts beyond the current month are inherently low-confidence. Showing them with the same visual weight as the current month erodes trust. Float users complain about this. | Current month: high-confidence daily. Next month: medium-confidence weekly. Beyond: low-confidence monthly, behind a "show more" toggle. |
| AF-03 | **Generic risk messages** | "Cash flow risk detected" is meaningless. Users ignore it after the first time. The QuickBooks Cash Flow Planner was savaged for this. | Every risk message must answer: what (specific vendor/amount), when (date range), consequence (balance drops to X), and action (what to do about it). |
| AF-04 | **Low-confidence items in the main forecast** | Including items with weak evidence (1-2 occurrences, variable amounts) pollutes the forecast with noise. Users dismiss the entire forecast as unreliable. This is what the app currently does. | LOW confidence items go to a separate "Possible upcoming" section, not the main forecast calculation. Only HIGH confidence items affect the predicted month-end balance. |
| AF-05 | **Treating all months as equal in pattern learning** | A vendor that appeared once 8 months ago is not "recurring." Giving it equal weight to a vendor that appears every month for 6 months produces wrong forecasts. | Require minimum occurrence threshold (4+ for HIGH, 2-3 for MEDIUM, 1 for LOW). Factor recency, regularity, and amount stability into confidence. |
| AF-06 | **Forecasting using daily averages instead of actual historical dates** | A vendor that pays on the 23rd of each month is fundamentally different from "average daily income of £80." The latter produces wrong cash positions on specific dates and misses lump-sum risk. | Use actual historical transaction dates to predict future dates. If Tranquil Accommodation paid on the 23rd for 5 of the last 6 months, predict the 23rd (not "around £80/day"). |
| AF-07 | **Over-aggregation in dashboard views** | "Total income: £50K, Total expenses: £45K" hides the timing risk. £45K of expenses on the 3rd and £50K of income on the 28th = 25 days of negative cash. | Show daily or at minimum weekly granularity in the forecast. The "lowest expected balance with date" calls out the timing risk explicitly. |
| AF-08 | **Requiring accounting knowledge to use** | Jargon like "net working capital," "operating cash flow," "free cash flow" alienates small business owners. Float succeeds specifically because it does NOT require accounting knowledge. | Use plain English: "Money in," "Money out," "Expected to have," "Might run short." The status words (Safe/Watch/Risk/Critical) are already good. |
| AF-09 | **Manual recurring setup requirement** | The app's value proposition is "it learns from your statements." If users must manually configure recurring transactions, it's no better than Pulse and worse than Float (which pulls from accounting software). | Learning must be automatic and improve with each upload. The review queue (UI-05, UI-06) exists for corrections, not initial setup. |

---

## Feature Dependencies

What depends on what. These drive phase ordering.

```
TS-01 (correct balance) ─────────────────────────────────────────────────────┐
  └── TS-03 (month-end prediction) ── depends on correct starting balance      │
  └── TS-02 (actual-vs-predicted boundary) ── depends on correct balance date  │
  └── DF-06 (month cards) ── depends on correct per-statement closing balances │
  └── DF-07 (forecast summary card) ── depends on all of the above             │

TS-05 (recurring detection) ──────────────────────────────────────────────────┐
  └── DF-02 (confidence tiers) ── is the classification layer on top          │
  └── TS-11 (deduplication) ── depends on knowing what's recurring            │
  └── TS-04 (income/expenses breakdown) ── depends on knowing what's expected │
  └── TS-06 (specific risk warnings) ── depends on knowing what's expected    │
  └── AF-04 (exclude low-confidence) ── depends on having tiers               │

TS-09 (categorization) ───────────────────────────────────────────────────────┐
  └── DF-04 (property-specific) ── depends on correct vendor classification   │
  └── DF-05 (suspicious detection) ── depends on correct classification       │
  └── DF-03 (vendor intelligence learning) ── depends on correct base labels  │

TS-07 (upload triggers refresh) ──────────────────────────────────────────────┐
  └── TS-08 (upload summary) ── depends on pipeline completing                │
  └── Everything else ── upload is the data ingestion trigger                 │
```

**Critical path:** TS-01 (correct balance) is the root. Everything downstream is wrong until this is fixed. TS-05 (recurring detection + confidence) is the next bottleneck -- without it, TS-03 (month-end prediction) and TS-06 (risk warnings) cannot be correct.

---

## Complexity Assessment

Which features are hard vs. easy within the existing codebase, given the current tech stack (Next.js, Supabase, DeepSeek/Claude AI, unpdf, Recharts).

### LOW Complexity (straightforward fixes, mostly arithmetic or UI)
- **TS-01:** Change `currentBalance` from accumulated net flow to latest statement `closing_balance`. Single source of truth change in the aggregation endpoint.
- **TS-02:** Add a date check in `generateForecast()` -- only forecast from `lastKnownBalanceDate` to month-end.
- **TS-04:** Sum expected remaining transactions grouped by `direction`. Simple aggregation.
- **TS-08:** After upload pipeline completes, return a structured summary object and render it.
- **TS-09 (rules):** Add vendor name/keyword mapping rules. Simple lookup table. Already partially exists.
- **TS-10:** Date range filter in forecast generation. Already exists conceptually.
- **DF-07 (UI):** Render a summary card. Simplest part -- but it depends on all backend logic being correct.

### MEDIUM Complexity (requires careful logic, testing, edge case handling)
- **TS-03:** Correct formula but requires all inputs to be right. Complexity is in dependencies, not the formula itself.
- **TS-06:** Generating specific risk messages requires template logic, vendor name extraction, date range prediction, and balance projection. More engineering than science.
- **TS-11:** Checking whether a predicted recurring transaction already occurred this month. Must match by vendor, amount tolerance, and date. False negatives (missing a match) = double-counted forecast item. False positives (wrong match) = missing a real expected transaction.
- **DF-04:** Property vendor knowledge base. Straightforward to build, but must be maintained as new vendors appear.
- **DF-05:** Suspicious detection with amount/direction/vendor/context awareness. Reduces false positives. Requires multi-signal scoring rather than simple keyword matching.
- **DF-06:** Month cards. Depends on correct per-statement data. UI is straightforward; data accuracy is the risk.

### HIGH Complexity (genuinely hard problems, research-grade)
- **TS-05 (recurring detection):** The core intellectual challenge. PNC Bank patented a multi-algorithm approach to this in 2025. The challenge: real transactions are noisy -- same vendor with different descriptions, amounts that vary slightly, dates that shift by a few days, vendors that are frequent but irregular (fuel stops), vendors that are truly recurring but seasonal. The existing `learnFromHistory()` needs to handle: true recurring (same vendor, same amount, same day of month), frequent irregular (same vendor, different amounts, no date pattern), same vendor/different property (same payee, different amounts, both recurring), same vendor/different transaction type (rent vs. maintenance), and income vs. expense direction.
- **DF-02 (confidence tiers):** The classification layer on top of recurring detection. Requires scoring across multiple dimensions: occurrence count (4+ = high), date stability (same week of month), amount stability (variance within X%), recency (recent months weighted higher), and direction consistency. PNC's patent describes fusing multiple independent scoring algorithms. This is not a simple threshold -- it is a multi-dimensional classification problem.
- **DF-03 (vendor intelligence):** The AI/ML layer. Must learn from limited data (most users have 3-12 statements) and improve with each upload. The distinction between "frequent irregular" (Shell fuel stops) and "true recurring" (rent payment) is subtle and context-dependent. Over-learning from small samples is a real risk.

---

## What Successful Products Get Right (Patterns to Emulate)

Based on Float (4.8/5 from 345+ Xero App Store reviews), Futrli, Pulse, and user research:

1. **"Up and running in minutes"** -- Float's 3-minute setup is the benchmark. For this app, the equivalent is: upload a PDF and see a forecast immediately. First-run experience must work with a single statement (limited but not broken).

2. **The "death date" concept** -- Float's most-loved feature: set a cash threshold and the tool tells you the exact date you'll hit it. Equivalent for this app: "lowest expected balance with date" in the forecast summary.

3. **Scenario toggling** -- Float's 8 scenarios (best/worst/base case) are a differentiator. For this app, the confidence tier system (DF-02) is the equivalent -- showing what's certain vs. possible vs. unlikely is more honest than showing 3 artificial scenarios.

4. **Proactive, not reactive** -- Users love that Float warns them BEFORE a problem. The risk detection (TS-06) must surface issues while there's still time to act.

5. **Visual clarity over data density** -- Float's graph is simple: one line, a "today" marker, a threshold line. Users complain about tools that show too much at once. The forecast summary card (DF-07) is the right abstraction level.

6. **Support accessibility** -- Float's "friendly support team's only a click away" is frequently praised. For a small app, this means clear error messages and obvious ways to get help when something goes wrong.

---

## What Users Hate (Patterns to Avoid)

Based on Float critical reviews, Databox UX research, QuickBooks Cash Flow Planner backlash, and fintech UX anti-pattern studies:

1. **Forecasts with no explanation** -- "#1 user complaint across all forecasting tools" per Databox. Every predicted number must have a traceable source. The insight cards (UI-07) address this.

2. **AI that overrides user knowledge** -- When AI "thinks it knows better" than the data, users abandon. The confidence tiers (DF-02) address this by showing uncertainty instead of false certainty.

3. **Rigid forecasting methods** -- Tools that offer only one method lose users who need flexibility. The three-tier confidence system (high in forecast, medium as possible, low excluded) gives users control.

4. **"AI-powered" as marketing, not function** -- QuickBooks users revolted when AI replaced a working feature with a worse one. AI in this app must serve specific purposes (classification, pattern learning) with measurable accuracy, not be a checkbox feature.

5. **Information overload** -- Dashboards that show everything at once cause decision paralysis. The tab structure (Current Forecast, Monthly History, Accumulated Intelligence, Transactions, Review Queue) is the right organizational model.

6. **Manual data entry burden** -- The #1 reason users retreat to spreadsheets. This app's PDF upload model addresses this directly -- but only if the parsing is reliable and the upload pipeline is seamless.

7. **Hidden assumptions / black-box logic** -- Users won't act on numbers they can't verify. The review queue (UI-05) and insight cards (UI-07) make the logic transparent.

---

## MVP Recommendation for Phase 1 (Backend Logic Fixes)

Based on the research, the priority order within Phase 1 should be:

1. **TS-01: Correct current balance** -- Root cause of all downstream issues. Fix first, verify everything else improves.
2. **TS-09: Categorization fixes** -- Specific vendor rules (Leicester City Council, fuel, subscriptions, property). Quick wins that immediately improve forecast accuracy.
3. **TS-05 + DF-02: Recurring detection with confidence tiers** -- The hardest problem. Start with HIGH confidence only (4+ occurrences, stable), then iterate. This is the intellectual core of the product.
4. **TS-11: Deduplication** -- Only matters after recurring detection works, but before forecast is usable.
5. **TS-02 + TS-03 + TS-04: Forecast generation fixes** -- Start from correct balance, forecast remaining days, show income/expenses breakdown.
6. **TS-06: Specific risk warnings** -- Template-based, depends on forecast being correct.
7. **DF-07: Forecast summary card** -- The UI culmination. Validates that everything above works.

**Deferred to Phase 2 (UI):** Month cards (DF-06), daily forecast readability (UI-01), review queue (UI-05/06), insight cards (UI-07), status display (UI-08), key drivers (UI-09), recommended actions (UI-10).

**Deferred past Phase 2:** Multi-bank format support, long-term projections, scenario planning, multi-entity.

---

## Sources

- [Float Cash Flow Forecasting Features](https://floatapp.com/features) -- Primary source for table stakes feature set
- [Float vs Futrli vs Pulse Comparison](https://cfoadvisors.com/blog/float-vs-dryrun-vs-finmark_-2025-cash-flow-forecasting-software-shoot-out-for-series-a-saas-startups) -- Competitor feature comparison
- [Float Xero App Store Reviews (345+ reviews, 4.8/5)](https://apps.xero.com/uk/industry/accounting/app/float-cashflow-forecasting/) -- User sentiment data
- [Float Trustpilot Reviews (4.5/5)](https://nz.trustpilot.com/review/floatapp.com) -- User love/hate patterns
- [Databox: Why We're Rebuilding Forecasts](https://databox.com/the-story-behind-forecasts) -- UX research on what users actually need
- [Forecast Complaints Analysis 2025](https://bigideasdb.com/complaints/forecast-complaints) -- Aggregated user complaint data
- [QuickBooks Cash Flow Planner User Backlash](https://quickbooks.intuit.com/learn-support/en-uk/other-questions/backwards-step-planner-cashflow/01/1484811) -- AI-as-gimmick anti-pattern case study
- [PNC Patent: Technologies for Prediction of Recurring Transactions (US20250156941A1, 2025-05-15)](https://www.patents-review.com/a/20250156941-technologies-prediction-recurring-transactions.html) -- Multi-algorithm confidence scoring for recurring transaction detection
- [Funnelcast: Revenue Platform Groupthink](https://www.funnelcast.com/post/revenue-platform-groupthink-has-lost-the-plot) -- Second-source-of-truth anti-pattern
- [Bloom Analytics: 5 Common UX Mistakes in Fintech Design](https://www.bloomanalytics.com/5-common-ux-mistakes-in-fintech-design-and-how-to-avoid-them/) -- Anti-pattern catalog
- [MoldStud: Dark Patterns in Fintech UX](https://moldstud.com/articles/p-the-impact-of-dark-patterns-on-fintech-ux-essential-insights-for-developers) -- Trust-destroying patterns
- [Small Business Cash Flow Forecasting Best Practices (Xero, Gusto, Prospa)](https://www.xero.com/us/guides/cash-flow-forecasting/) -- What small business owners actually need
- [Best Cash Flow Forecasting Software in 2026 (Farseer)](https://www.farseer.com/blog/cash-flow-forecasting-software/) -- Enterprise feature landscape
- [Cash Flow Forecasting Tools for UK Companies (AccountancyCloud)](https://accountancycloud.com/blogs/cashflow-forecasting-tools) -- UK-specific tool comparison
- [Cash Flow Forecasting in 2025: Tools, Tips, What's Changed (Clear Accounting)](https://www.clear-accounting.com/cash-flow-forecasting-in-2025-tools-tips-and-whats-changed/) -- Market evolution
