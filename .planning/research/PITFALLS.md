# Pitfalls Research: Cashflow Forecasting

**Domain:** Business cashflow forecasting from bank statements
**Researched:** 2026-05-11
**Overall confidence:** HIGH (verified against research, existing codebase bugs, and documented real-world failures)

## Critical Trust-Destroying Mistakes

These are the mistakes that make users abandon a financial tool permanently. They are ordered by the speed at which they destroy trust -- from instant (minutes) to gradual (weeks).

### 1. Wrong Balance Display (Anchor Error)

**What goes wrong:** The dashboard shows a balance that contradicts what the user sees in their bank account. In this app: `currentBalance` = accumulated net flow (-32,822.66) instead of the latest statement closing balance (380.93). User thinks they are 32K overdrawn when they actually have 380 in the bank.

**Why it happens:** The code computes `currentBalance` as the sum of all credits minus debits across all statements (`accumulatedNetFlow`), then labels it "Current Balance." The latest statement `closing_balance` -- which is the actual bank-verified number -- is ignored or stored separately. This is a semi-additive measure problem: the app naively sums point-in-time flows as if they were additive, producing a mathematically meaningless number.

**Real-world precedent:** Quicken Simplifi had an identical bug where entering a transaction today would reduce yesterday's displayed balance. Users documented it publicly and called it "basic math" failure. The Simplifi user's quote: "The projection is all but useless to me right now, yet it's the primary feature that first drew me to Simplifi over the competition."

**Warning signs:**
- Balance shown does not match any single bank statement's closing balance
- Balance drifts further from reality with each uploaded statement
- Negative balances appear when the business is actually solvent
- Users report "my bank says X but your app says Y"

**Prevention:**
- `currentBalance` must ALWAYS be anchored to the latest statement's `closing_balance`
- Accumulated net flow must be labeled distinctly (e.g., "Total Performance") and shown separately
- Add a balance validation check: `closing_balance === previous_balance + paid_in - withdrawn` for every statement
- Never present a computed number as "Current Balance" unless it ties to a bank-verified figure
- Reconcile before presenting: if the app's computed balance does not equal the bank's closing balance, flag the discrepancy instead of silently showing the wrong number

**Phase:** Both Phase 1 (backend fix) and Phase 2 (UI separation). Backend must fix the computation first. UI must show "Current Cash Position" and "Accumulated Performance" as separate, clearly labeled sections.

---

### 2. Forecast Anchored to Wrong Base Balance

**What goes wrong:** The forecast starts from a wrong number. If `currentBalance` is -32,822.66, the forecast computes month-end as that minus predicted expenses plus predicted income, producing a massively negative number (e.g., -44,000). The user sees a forecast that says they will be catastrophically negative -- when in reality their bank balance is 380 and they will likely end the month around 200. The forecast creates panic about a problem that does not exist.

**Why it happens:** The forecast takes `currentBalance` as its starting parameter with no validation of what that number actually represents. Every subsequent computation (daily balances, risk detection, danger windows, status calculations) cascades from this wrong base. The forecast output is mathematically consistent but anchored to garbage.

**Real-world precedent:** Bennett Financials documented cases where CFO forecasts showed $200,000 available while actual bank balance was $47,000 -- because the forecast was anchored to an accrued/accumulated figure rather than the actual cash position. The gap destroys credibility instantly.

**Warning signs:**
- Forecast shows large negative balances that contradict the user's lived experience
- Month-end prediction is worse than any single month in the user's history
- Forecast changes dramatically after uploading a new statement (should only change by the new statement's net flow)
- Predicted month-end balance does not approximate: `latestClosingBalance + expectedRemainingIncome - expectedRemainingExpenses`

**Prevention:**
- Forecast MUST start from latest statement `closing_balance`, not from any computed field
- Validate the starting balance: if it is not a bank-verified number, flag the forecast as "estimated" with a confidence percentage
- Add a sanity check: if predicted month-end is more than 2x the worst historical monthly net flow, flag it as potentially wrong
- The forecast formula must be: `predictedMonthEnd = latestStatementClosingBalance + expectedRemainingIncome - expectedRemainingExpenses`
- Each forecast output should include its anchor point: "Based on statement closing balance of X on date Y"

**Phase:** Phase 1 (backend). This is dependent on Pitfall 1 being fixed first.

---

### 3. Recurring Transaction Double-Counting

**What goes wrong:** A recurring payment that already occurred during the latest statement period gets forecast again in the current month. Example: Latest statement covers May 1-31 and includes a council tax payment on May 3. The forecast starts from May 31 and projects the next council tax payment as May 3 of next month -- but if the user is viewing the forecast on May 1 of the next month, the system forecasts the payment again even though it already happened.

In this app specifically: `catchUpBalance()` iterates recurring expenses and applies them forward from `lastOccurrence` date using average gap. If `lastOccurrence` is May 3 and gap is 30 days, it projects June 2 -- correctly. But if the statement period ended May 15 and the last occurrence date in the system is April 3 (because the May 3 transaction is inside the latest statement period and hasn't been processed as a new occurrence yet), it will incorrectly project May 3 as a future payment, even though it was already accounted for in the statement's closing balance.

**Why it happens:** The system does not check whether a projected recurring transaction date falls within a period already covered by a bank statement. The statement's `closing_balance` already reflects all transactions up to `period_to`. Any recurring payment projected on or before `period_to` has already been accounted for.

**Real-world precedent:** Quicken Simplifi had this exact bug: the bank reported an updated balance reflecting a cleared car payment, but the synced transaction hadn't arrived yet. The forecast system used the new balance AND still deducted the payment, producing a double-count. Users called it out as rendering projections "all but useless."

**Warning signs:**
- Same vendor appears twice in a forecast period (once in statement, once as projected)
- Forecasted payments have dates before or on the latest statement's `period_to`
- Balance drops by more than expected expenses in a single day
- Total forecasted outgoings exceed historical monthly maximums

**Prevention:**
- Before projecting a recurring transaction, check: is `projectedDate > latestStatement.period_to`?
- If `projectedDate <= latestStatement.period_to`, the transaction is already reflected in `closing_balance` -- skip it
- Deduplication logic: for each projected transaction, verify it does not match an actual transaction in the current statement period by vendor + approximate amount + date proximity
- `catchUpBalance()` needs an explicit parameter: `statementPeriodEnd` date, and must not apply any recurring transaction with a projected date <= that date
- Track `lastStatementPeriodEnd` separately from `lastKnownDate` to distinguish "last time we know the balance" from "last date we should start projecting from"

**Phase:** Phase 1 (FOR-02, FOR-07)

---

### 4. Low-Confidence Pattern Pollution

**What goes wrong:** A vendor that appears only once or twice, with irregular timing and variable amounts, is included in the forecast as if it were a reliable recurring transaction. The forecast becomes noisy -- it includes random one-offs mixed with genuine recurring payments. The user cannot distinguish which predicted items to trust.

In this app: the confidence calculation in `cross-month-learner.ts` marks a vendor as recurring with only 2 appearances across 2 months (`uniqueMonths >= 2 && uniqueDates >= 2`). A vendor seen twice with a 90-day gap gets forecast as if it were monthly. The confidence formula adds points for appearance count and months seen but never filters out low-confidence items from the forecast output.

**Why it happens:** The recurrence detection threshold is too permissive. The forecast includes ALL detected recurring patterns regardless of confidence. There is no confidence tier that gates what appears in the main forecast vs. what is shown as "possible" vs. what is excluded entirely.

**Real-world precedent:** Academic research (Springer, 2019) on "Uncertainty Modelling in Deep Networks: Forecasting Short and Noisy Series" found that on financial time series, the cost of a wrong prediction is higher than making no prediction at all. Systems that include low-confidence predictions degrade user trust more than systems that admit uncertainty. The Simplifi community explicitly requested a minimum of 3 occurrences before auto-detecting recurring transactions.

**Warning signs:**
- Forecast includes vendors the user does not recognize as recurring
- Same vendor appears with widely varying amounts (CV > 50%)
- Forecast changes significantly when a new statement is added (should stabilize with more data)
- User questions "why is this showing up every month?"

**Prevention:**
- Three confidence tiers with different forecast treatment:
  - **HIGH** (4+ months, stable amount, consistent interval): Include in main forecast, show as "Expected"
  - **MEDIUM** (2-3 months, somewhat variable): Include but mark as "Possible," show with confidence badge
  - **LOW** (<2 months or highly variable): Exclude from main forecast, show in a separate "Uncertain" section
- Minimum recurrence threshold: 3+ appearances across 3+ distinct months before HIGH confidence
- Amount variance check: if amountVariance (CV) > 0.3, cap confidence at MEDIUM regardless of appearance count
- Interval consistency check: if the standard deviation of gaps between occurrences exceeds 50% of the mean gap, it is not a reliable recurring pattern
- The forecast output must include a `confidence` field per predicted item so the UI can render appropriate visual treatment

**Phase:** Phase 1 (FOR-09, CAT-05). Must be done before Phase 2 UI work.

---

### 5. Categorization Failure for Known Vendors

**What goes wrong:** Vendors with clear, well-known business purposes are misclassified. Leicester City Council (hundreds of transactions across many months) is classified as a "one-off." Shell, BP, Tesco fuel stations are scattered across "supplies," "one-off," and "other" instead of being unified under "car-expenses." Apple, Spotify, Amazon Prime, OpenAI, Monday.com are treated as generic purchases rather than "subscriptions/software."

This destroys trust because the user sees the system confidently making wrong claims about their business. They think: "If it cannot even recognize my council tax, how can I trust the forecast?"

**Why it happens:** The classification system relies primarily on pattern-based keyword matching and AI inference without a deterministic rules layer for known vendor categories. In `cross-month-learner.ts`, classification is done once via `classifySubcategory(tx.description)` at first encounter and never corrected by batch patterns. The `suspicious-detector.ts` uses regex patterns designed for personal expense detection, not business vendor categorization. There is no vendor-to-category mapping table for UK-specific business vendors.

**Real-world precedent:** Neo Financial users reported Apple Care (a recurring subscription) misclassified as "Apple Streaming Online." Walmart grocery purchases classified as "Wholesale." The root cause was reliance on third-party MCC codes that did not reflect real-world use. Pave app users reported bills with variable dates/amounts never being detected as recurring because the system required perfect pattern consistency.

**Warning signs:**
- Same vendor appears in multiple different categories across statements
- High-volume vendor (10+ transactions) shows as "one-off"
- User must manually re-categorize the same vendor repeatedly
- Categories that match no real business taxonomy (e.g., council tax under "miscellaneous")

**Prevention:**
- Implement a deterministic vendor-to-category mapping layer that runs BEFORE AI classification:
  ```
  Leicester City Council, [any] Council → council-tax (recurring)
  Shell, BP, Tesco Pay at Pump, ASDA Petrol, MFG, Sainsbury's Petrol → car-expenses (recurring)
  Apple, Amazon Prime, Prime Video, Spotify, PureGym, OpenAI, Monday.com, Gamma, PDFLeader, 01.AI → subscriptions/software (recurring)
  AMHA Leicester, Green Acres Estate, Haus Property, Midlands Property, Sequoia Property → property-management (recurring)
  ```
- AI classification is the fallback for vendors not in the rules table
- When AI classifies a vendor, log it for review. If the same vendor appears 3+ times with the same AI classification, promote it to the rules table
- Batch re-classification: after learning, re-run classification on all transactions with the learned vendor data
- Use amount and direction as classification signals: a 1,500 credit from "Tranquil Accommodation" is income, not a food purchase

**Phase:** Phase 1 (CAT-01 through CAT-04)

---

### 6. Suspicious Detector False Positives

**What goes wrong:** The suspicious transaction detector flags legitimate business transactions as suspicious/personal, creating noise that users must dismiss. In this app specifically: rent/property income from "Tranquil Accommodation" is flagged as "fast food" because the detector's PERSONAL_PATTERNS regex matches on substrings without checking transaction direction (credit vs. debit) or amount.

When users see the system flagging their rent income as suspicious fast food, trust in the entire detection system collapses. They will either ignore all flags (including real ones) or abandon the review feature entirely.

**Why it happens:** The detector uses pattern matching on merchant name alone, without considering:
- Transaction direction (credits are income, not expenses, so fast food patterns should not match credit transactions)
- Transaction amount (a 1,500 credit is not a personal coffee purchase)
- Vendor type context (accommodation-related vendors are property income, not food)
- The detector runs regex patterns in order and returns the FIRST match -- so a broad pattern like `/kfc|mcdonald|burger.*king|subway|domino|pizza.*hut|nando/i` could match a substring in an unrelated vendor name

**Real-world precedent:** AML systems using rule-based detection flag up to 95% false positives (Thetaray research). The AI alternative reduces false positives by up to 90% by learning normal customer behavior patterns first. Alert fatigue from false positives is well-documented: users learn to ignore all alerts when most are wrong.

**Warning signs:**
- Credit (income) transactions flagged as expense-related suspicious patterns
- Large business amounts (1000+) flagged by patterns designed for small personal purchases
- Same vendor flagged repeatedly despite user dismissing the flag
- Flag reasons that contradict the transaction type (e.g., "fast food" on a 1,500 credit)

**Prevention:**
- DIRECTION GATE: Credit transactions (income) must never match expense-related patterns (food, shopping, entertainment). Add `tx.type === "debit"` check before testing food/retail/entertainment patterns.
- AMOUNT GATE: Transactions above a business threshold (e.g., 200) should not match small-purchase personal patterns without additional signals
- VENDOR TYPE PRE-CHECK: Before running personal pattern matching, check if the vendor name contains known business signals (accommodation, property, estate, management, rent)
- Add a "not suspicious" feedback mechanism: when a user dismisses a flag, suppress future flags for that vendor
- Run the detector AFTER categorization: if a transaction is already classified as property/rent income, skip personal expense detection
- Pattern specificity: ensure regex patterns are anchored or specific enough to avoid substring false matches (e.g., `/\bnando\b/i` not `/nando/i`)

**Phase:** Phase 1 (SUS-01, SUS-02, SUS-03)

---

### 7. Generic and Unhelpful Risk Messages

**What goes wrong:** Risk alerts say things like "Low balance: 2024-05-03 -- 2024-05-18" and "Balance drops as low as -500 during this window" with the action "Review upcoming payments and consider delaying non-critical ones." This is generic, non-specific, and provides zero business context. The user cannot act on it because they do not know WHICH payments are causing the problem, WHEN their next income arrives, or WHAT specific action would actually help.

Users learn to ignore these alerts. After seeing the same generic message 5 times, it becomes background noise. When a genuinely critical situation arises, the alert is tuned out.

**Why it happens:** The risk detector (`risk-detector.ts`) only surfaces patterns from the daily forecast data (low balance windows, large payment days, payment clusters) without enriching them with vendor names, income timing, or business context. The `actionable` field is a hardcoded string, not generated from the actual data. The detector does not know that the user's largest income source (Tranquil Accommodation) arrives on specific dates, so it cannot say "hold on until the 23rd when your rent income arrives."

**Real-world precedent:** The Financial Brand's research (Keynova Group) found that only 53% of major U.S. banks send real-time alerts, and alerts sent out of real-time are meaningless. Billcut's research on Indian fintech found that static "low balance" alerts are reactive, not preventive, and users ignore them. The emerging best practice is scenario-based alerts: "Your EMI is coming up, but your balance looks short by 1,800." Users need to know what, why, how severe, and what to do.

**Warning signs:**
- Risk messages are identical regardless of which vendors cause the problem
- No mention of specific income sources that will resolve the situation
- Actions are generic ("review payments") rather than specific ("delay the Amazon payment by 3 days")
- Risks are presented as a flat list without severity differentiation
- No temporal context (when does the situation improve? what event changes it?)

**Prevention:**
- Risk messages must include vendor names: "Balance expected to drop to -500 on May 15 after council tax (350) and Shell fuel (80) payments"
- Risk messages must include income context: "Remains below threshold until Tranquil Accommodation payment arrives around May 23-24"
- Risk messages must include timing: "Low balance window: 4 days (May 15-19)"
- Generate `actionable` text from data, not hardcoded strings:
  - If large expense on date X and income on date Y where Y > X: "Consider requesting payment extension for [vendor] until after [income source] arrives on [date]"
  - If multiple expenses cluster on one day: "Spreading [vendor A] and [vendor B] across different days would keep balance above threshold"
- Risk severity calculation must consider: depth below threshold, duration of low balance, proximity to next income, total monthly expense coverage
- Risk messages must include a "why this matters" explanation: "If the Shell payment clears before the council tax refund, you may incur overdraft fees"
- Categorize risks: Cash Flow (timing), Coverage (total income vs expenses), Concentration (too many payments on one day)

**Phase:** Primarily Phase 1 (RIS-01). Enhanced in Phase 2 with UI-08, UI-09, UI-10.

---

### 8. Dashboard Mixing Accumulated Data with Current Position

**What goes wrong:** The dashboard displays accumulated totals (sum of all transactions across all statements) alongside current-period data without clear separation. The user sees "Total Income: 150,000" next to "Current Balance: -32,822" and cannot reconcile these numbers. The accumulated stats reflect all historical activity, while the current position reflects only the latest unpaid period. Mixing them creates cognitive dissonance and confusion.

In this app: the same dashboard shows `currentBalance` (which is actually accumulated net flow), `accumulated.totalIncome`, `accumulated.totalExpenses`, and monthly breakdowns -- all without a clear conceptual boundary between "what is the current state of my business" and "how has my business performed over time."

**Why it happens:** The aggregate endpoint returns both accumulated and current data in a flat structure. The dashboard renders them in adjacent cards without visual or conceptual separation. There is no tab, section header, or visual treatment that distinguishes "Current Position" from "Historical Performance."

**Real-world precedent:** Monzo's community documented users abandoning the app's Trends feature because payday spikes (accumulated value) made daily spending trends unreadable. Users reverted to spreadsheets. The Nimiq wallet community proposed clearly separating "Spendable" vs. "Total" balances after users tried to spend locked funds. The WalletWise GitHub issue (#52) documented "Phantom Wealth" where accumulated balance from previous months disappeared when the month changed, causing users to lose visibility of their actual financial position.

**Warning signs:**
- Users ask "why does this number not match that number?"
- Dashboard shows both "current balance" and "total income" without explaining their relationship
- Numbers that represent different time scopes are placed side by side
- Changing a date filter changes the "current balance" (current position should not depend on filter range)

**Prevention:**
- Split the dashboard into tabs with clear conceptual boundaries:
  - **Current Forecast:** Latest statement balance, remaining expected income/expenses, predicted month-end, risk status (point-in-time, forward-looking)
  - **Monthly History:** Individual month cards with opening/closing balance, income, expenses, net movement (period-based, backward-looking)
  - **Accumulated Intelligence:** Total stats, vendor learning, categorization patterns (aggregated, backward-looking)
  - **Review Queue:** Flagged transactions, suspicious items, categorization suggestions
- Never show accumulated totals on the same card/panel as current-position data
- Use different visual treatments: current position uses prominent, large numbers; accumulated data uses smaller, secondary visual weight
- Label everything explicitly with its time scope: "As of May 11, 2026" vs. "Since January 2024"
- Add tooltips that explain where each number comes from: "This is the closing balance from your latest NatWest statement dated April 30, 2026"

**Phase:** Phase 2 (UI-03, UI-04, UI-05). Requires Phase 1 backend fixes first.

---

### 9. Balance Not Reconciling to Source Documents

**What goes wrong:** The app shows a balance or forecast that cannot be traced back to any uploaded bank statement. When the user asks "where did this number come from?" there is no clear audit trail. The computed `currentBalance` is derived from transaction summation plus catch-up projections, but if it diverges from the latest statement's `closing_balance`, the user has no way to understand why.

Financial tools have a unique trust requirement: every number must be traceable to a source document. Users of accounting software (QuickBooks, Xero) expect this. When a number appears without provenance, it is assumed to be wrong.

**Why it happens:** The system computes balances through multiple transformations (statement parsing, transaction aggregation, pattern projection) without preserving the chain of derivation. The original `closing_balance` from the PDF statement is extracted but then overridden by computed values. There is no reconciliation step that compares computed vs. stated balances.

**Real-world precedent:** The xfactrs analysis documented: "Finance leaders are trusted, or not, based on one thing above all else: reliability. If your numbers change unexpectedly, do not reconcile, or require constant caveats, people stop listening." The Bennett Financials article emphasized: "Numbers must tie (management accounts to bank; revenue to operational data; KPIs to P&L) before dashboards and charts."

**Warning signs:**
- Computed balance differs from statement closing balance
- Adding a new statement changes the current balance by more than the new statement's net flow
- No way for the user to click through from a balance number to see how it was computed
- User reports that an app number contradicts their bank statement

**Prevention:**
- Every statement must pass a validation check: `Math.abs(closingBalance - (previousBalance + paidIn - withdrawn)) < 0.01`
- If validation fails, flag the statement with an error and do not include its transactions in the balance computation
- Add an audit trail: `Current Balance (380.93) = Latest Statement Closing Balance (Apr 30, 2026) [+ Catch-up: +200 income, -150 expenses since Apr 30]`
- Provide a "View Source" action on balance displays that shows which statement the balance comes from
- When catch-up projections are applied, clearly indicate "Estimated balance (includes projections since Apr 30)"
- Never silently override a bank-verified number with a computed one. If the computed number differs, surface the discrepancy as a warning.

**Phase:** Phase 1 (BAL-04). Enhanced in Phase 2 with UI drill-down.

---

### 10. No Confidence Signaling on Forecast Output

**What goes wrong:** All forecast items are presented with equal visual weight and certainty. A council tax payment that has occurred every month for 12 months looks the same as a one-off Amazon purchase that the system guessed might recur. The user cannot distinguish what is reliable from what is speculative. This is a form of "performance theatre" -- the forecast looks comprehensive and authoritative, but users who check it against reality find it unreliable.

**Why it happens:** The forecast does not attach confidence metadata to individual line items. The `MonthEndForecast` interface has a single `confidence` number (average of all pattern confidences) but does not expose per-item confidence to the UI. The daily forecast shows all transactions as equal.

**Real-world precedent:** Multiple sources confirm this pattern. The Schlott Co. analysis warned: "The model becomes performance theatre, and trust decays." Research on financial time series forecasting found that systems which include low-confidence predictions without signaling degrade user trust more than systems that admit uncertainty. The Simplifi community requested confidence indicators on auto-detected recurring items.

**Warning signs:**
- Forecast includes items the user has never seen before
- First-time vendors appear alongside 12-month recurring vendors with identical visual treatment
- User manually deletes forecast items they know are wrong
- Forecast accuracy varies wildly month to month

**Prevention:**
- Every forecasted item must have a `confidence` field (0-1) displayed in the UI
- Three visual tiers:
  - **HIGH confidence (0.8+):** Solid styling, "Expected" label, included in main forecast total
  - **MEDIUM confidence (0.5-0.79):** Muted styling, "Possible" label, shown in forecast but not in the main predicted-month-end total
  - **LOW confidence (<0.5):** Faint styling, "Uncertain" label, collapsed by default, excluded from forecast totals
- Confidence is derived from: number of historical occurrences, consistency of interval, consistency of amount, recency of last occurrence
- Show confidence rationale on hover/click: "Based on 8 occurrences over 6 months, typically 350 every 28-31 days"
- Allow user to promote/demote confidence: "This is definitely recurring" or "This was a one-time thing"

**Phase:** Phase 1 (FOR-08, FOR-09). Phase 2 (UI-07) for interactive drill-down.

---

## Validation Checklist

Before considering any fix complete, verify each of these conditions:

### Balance Integrity
- [ ] `currentBalance` equals latest statement's `closing_balance` (within 0.01 tolerance)
- [ ] Accumulated net flow is displayed separately and labeled as "Total Performance" or "Cumulative Net"
- [ ] Balance validation passes for every uploaded statement: `closing === opening + credits - debits`
- [ ] Date filter changes do NOT change the `currentBalance` value (current position is point-in-time)
- [ ] User can trace any balance number back to its source statement

### Forecast Accuracy
- [ ] Forecast starts from latest statement `closing_balance`, NOT from accumulated net flow
- [ ] Predicted month-end approximates: `closingBalance + expectedRemainingIncome - expectedRemainingExpenses`
- [ ] No recurring transaction is projected on a date <= latest statement `period_to`
- [ ] HIGH confidence items require 3+ months of consistent history
- [ ] LOW confidence items are excluded from the main forecast total
- [ ] After uploading a new statement, the forecast changes by approximately the new statement's net flow
- [ ] Forecast does NOT produce balances more than 2x worse than the worst historical month

### Categorization Correctness
- [ ] Leicester City Council transactions → council-tax category (not one-off)
- [ ] Shell, BP, Tesco fuel, ASDA Petrol, MFG, Sainsbury's Petrol → car-expenses category
- [ ] Apple, Amazon Prime, Spotify, OpenAI, Monday.com → subscriptions/software category
- [ ] AMHA Leicester, Green Acres Estate, Haus Property → property-management category
- [ ] Same vendor never appears in two different categories across statements

### Suspicious Detection Quality
- [ ] Credit (income) transactions are never flagged as personal expenses
- [ ] Large business amounts (1000+) are not flagged by small-purchase patterns
- [ ] Tranquil Accommodation income → property/rent, NOT fast food or personal
- [ ] Each flagged item shows: vendor, amount, reason, suggested category, confidence
- [ ] Dismissing a flag suppresses future flags for that vendor

### Risk Message Quality
- [ ] Risk messages include specific vendor names
- [ ] Risk messages include income timing context
- [ ] Risk messages include actionable, specific suggestions
- [ ] Risk severity is calculated from: depth below threshold, duration, proximity to next income
- [ ] No generic "review your payments" actions remain

### Dashboard Clarity
- [ ] "Current Position" and "Historical Performance" are in separate sections/tabs
- [ ] Every number has a visible time scope label
- [ ] Accumulated totals are visually subordinate to current position
- [ ] User can find the source transaction for any displayed number

---

## User Trust Recovery

After these bugs are fixed, additional steps are needed to rebuild user trust. A financial tool that has shown wrong numbers carries a trust deficit that technical fixes alone do not resolve.

### Immediate (Phase 1 completion)

1. **Proactive acknowledgement.** Show a banner on first load after the fix: "We have corrected how your balance and forecast are calculated. Your current balance is now based on your latest bank statement closing balance. Learn more about what changed."

2. **Show the math.** Display the balance derivation inline: "380.93 (NatWest statement, Apr 30) = your current balance. Previously we showed accumulated net flow (-32,822.66), which was incorrect."

3. **One-click verification.** Add a "Verify this balance" action that shows the source statement date, closing balance figure as it appears on the PDF, and a screenshot/thumbnail of the relevant statement line.

4. **Reset expectations.** If the user has been seeing a wrong balance for weeks, explicitly state: "Your previously displayed balance may have been incorrect. The number shown now is your verified bank balance."

### Short-term (Phase 2 completion)

5. **Accuracy transparency.** Show forecast accuracy metrics: "Last month we predicted X, actual was Y (Z% accuracy)." This builds confidence that the system is improving.

6. **User correction loop.** Every AI-classified item should have a "Correct this" action. Corrections must visibly improve future results. When a user corrects a categorization, show: "Updated. This will apply to all past and future [vendor] transactions."

7. **Confidence honesty.** Explicitly mark uncertain items: "We are not confident about this -- only 2 occurrences in your history." Honesty about uncertainty builds more trust than false certainty.

8. **Progressive confidence.** As the user uploads more statements, show that the system is learning: "With 6 months of data, your forecast is now 85% accurate (up from 60% with 2 months)."

### Long-term (Post-Phase 2)

9. **User-controlled forecast.** Allow users to adjust the forecast: exclude a vendor, change a predicted amount, mark a date as unusual. The system should adapt visibly.

10. **Recovery from errors.** If the system makes a wrong prediction, show a "We got this wrong" acknowledgment with an explanation of why and how it will improve.

---

## What Makes This Different from Generic Software Pitfalls

These are not generic "test your code" or "use version control" recommendations. Each pitfall is specific to financial forecasting:

| Generic Pitfall | Cashflow-Specific Version |
|-----------------|--------------------------|
| "Wrong calculations" | Balance anchored to accumulated flow instead of bank-verified closing balance |
| "Bad data" | Recurring transactions double-counted because statement coverage period is not checked |
| "Poor UX" | Accumulated performance metrics presented as current cash position |
| "Missing features" | Forecast includes low-confidence noise instead of filtering by confidence tier |
| "Vague error messages" | Risk alerts say "low balance" without naming WHICH payments cause it or WHEN income resolves it |
| "Classification errors" | Keyword matching flags rent income as fast food because it ignores transaction direction and amount |
| "Missing validation" | Computed balances silently diverge from bank statements without reconciliation checks |

The common thread: financial tools are unique because users have an external source of truth (their bank). Any discrepancy between the app and the bank instantly destroys trust. The app must be MORE conservative and MORE transparent than a generic SaaS tool.

---

## Sources

- Quicken Simplifi community: "Incorrect balance from bank causes incorrect projections" -- https://community.simplifimoney.com/discussion/comment/43083/
- Quicken Simplifi community: "'In the past' balance unreliable in Projected Cash Flow" -- https://community.simplifimoney.com/discussion/comment/10094/
- Simplifi community: "Feedback and suggestions -- recurring transactions too aggressive" -- https://community.simplifimoney.com/discussion/16265/
- Neo Financial: "Recurring payments incorrectly classified" -- https://neofinancial.discourse.group/t/frustration-recurring-payments-incorrectly-classified/2260
- Pave App: "Why are some bills not being detected" -- https://support.paveapp.com/hc/en-gb/articles/28423544593565
- WalletWise GitHub Issue #52: "Phantom Wealth: User wallet balance resets monthly" -- https://github.com/SoumyaMishra-7/WalletWise/issues/52
- Nimiq Forum: "Distinguishing Spendable vs Total Balance" -- https://forum.nimiq.community/t/improving-the-wallet-ux-by-distinguishing-spendable-vs-total-balance/2435
- Monzo Community: "Better way to balance your money in Trends" -- https://community.monzo.com/t/better-way-to-balance-your-money-in-trends-is-here/136721
- Bennett Financials: "Why CFO-Level Forecasting Fails Without Clean Books" -- https://bennettfinancials.com/why-cfo-level-forecasting-fails-without-clean-books-underneath/
- xfactrs: "When Forecasts Fail, It's Usually a Data Problem" -- https://xfactrs.com/revenue-reconciliation/when-forecasts-fail-its-usually-a-data-problem/
- The Schlott Co.: "9 Hidden Breakpoints in SaaS Financial Models" -- https://theschlottco.com/9-hidden-breakpoints-in-saas-financial-models-that-sabotage-forecast-accuracy/
- Financial Leadership Foundations: "Poor Data Quality Will Undermine You Faster Than You Think" (Mar 2026)
- Billcut: "Scenario-Based Alerts in Finance Apps" -- https://www.billcut.com/blogs/scenario-based-alerts-in-finance-apps-think-ahead/
- The Financial Brand: "More Banking Apps Offer Predictive Insights, But Many Alerts Arrive Too Late" -- https://thefinancialbrand.com/news/mobile-banking-trends/more-bank-mobile-banking-apps-forecast-balances-but-alerts-need-improvement-192404
- Forbes / Melissa Houston: "AI Won't Fix A Broken Financial Strategy -- But It Will Expose It" (Feb 2026)
- Thetaray: "How AI Reduces Noise and Spots Real Risk" -- https://thetaray.com/debunking-the-false-positives-myth-how-ai-reduces-noise-and-spots-real-risk/
- Springer: "Uncertainty Modelling in Deep Networks: Forecasting Short and Noisy Series" (2019)
- Oliver Wyman: "4 Ways To Improve Customer Remediation In Financial Services" (2023)
- Pendo: "How Global Payments Rebuilt User Trust After a Product Launch Gone Wrong" -- https://www.pendo.io/pendomonium/from-crisis-to-comeback-how-global-payments-rebuilt-user-trust/
- Pragmatic Coders: "Top 10 UX Mistakes Fintech Apps Make" -- https://www.pragmaticcoders.com/blog/ux-mistakes-in-fintech-apps
