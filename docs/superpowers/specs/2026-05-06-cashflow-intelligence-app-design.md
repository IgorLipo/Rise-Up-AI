# Cashflow Intelligence App — Design Spec

**Date:** 2026-05-06
**Status:** Design approved, awaiting implementation plan

## Summary

Transform the bank statement reader into a user-based cashflow intelligence app for businesses. Visual redesign (light shell + dark charts, insight-led layout), user accounts with multi-company support, hybrid detection engine (heuristic pattern matching + AI narration), and daily cashflow forecasting to month-end.

Build in 4 sequential phases. Each phase ships independently.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Visual direction | Light shell with dark charts (TradingView/Stripe feel) |
| Dashboard layout | Insight-led — cash position + insight card + forecast chart above fold |
| Auth | Supabase Auth — Email/Password + Google OAuth |
| User-Company | 1 user → multiple companies |
| Forecasting | Hybrid — heuristic detection (TS) + AI narration (AI SDK) |
| Build approach | Phased — 4 subsystems, 4 PRs, 4 deploys |

---

## Phase 1: Auth & Multi-Tenant Foundation

### Auth Setup
- Enable Email/Password + Google OAuth in Supabase dashboard
- Use `@supabase/ssr` for server-side cookie-based auth
- Middleware at `src/middleware.ts` protects all `/dashboard`, `/insights`, `/history`, `/upload`, `/settings` routes
- Unauthenticated users redirected to `/login`
- Auth callback route at `/auth/callback` handles OAuth redirect + session exchange

### Schema Changes

```sql
-- Companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  owner_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Junction: which users access which companies
CREATE TABLE company_members (
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  PRIMARY KEY (company_id, user_id)
);

-- Alter documents for multi-tenancy
ALTER TABLE documents ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE documents ADD COLUMN uploaded_by UUID REFERENCES auth.users(id);
-- Backfill: assign existing docs to a default company (manual SQL)

-- RLS: replace public policies with user-scoped ones
DROP POLICY IF EXISTS "Public read access" ON documents;
DROP POLICY IF EXISTS "Public insert access" ON documents;
DROP POLICY IF EXISTS "Public update access" ON documents;

CREATE POLICY "Company members can read documents" ON documents
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Company members can insert documents" ON documents
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Company members can update documents" ON documents
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
  );
```

### New Files
| File | Purpose |
|------|---------|
| `src/middleware.ts` | Auth guard, redirect to `/login` |
| `src/lib/auth/server.ts` | `getUser()`, `getActiveCompany()`, `requireAuth()` |
| `src/lib/auth/client.ts` | `useUser()`, `useActiveCompany()` hooks |
| `src/app/(auth)/login/page.tsx` | Email + Google sign-in form |
| `src/app/(auth)/register/page.tsx` | Account creation + first company |
| `src/app/(auth)/auth/callback/route.ts` | OAuth callback handler |
| `src/app/(app)/onboarding/page.tsx` | Post-registration company setup |
| `src/app/(app)/settings/page.tsx` | Company profile, members |
| `src/components/nav/company-selector.tsx` | Dropdown for switching companies |

### Data Flow
1. User signs up → `auth.users` row created
2. Onboarding → create `companies` row + `company_members` row (role=owner)
3. Upload statement → document saved with `company_id` + `uploaded_by`
4. All queries filtered by `active_company_id`
5. `active_company_id` stored in a cookie (server) or local state (client)

---

## Phase 2: Detection Engine

Pure TypeScript. No API calls. Runs after PDF parsing, before dashboard render.

### Module: `src/lib/detection/`

```
src/lib/detection/
├── index.ts                    # Public API: detectPatterns(transactions, companyId)
├── merchant-normalizer.ts      # Normalize merchant names
├── pattern-detector.ts         # Group, detect intervals, score confidence
├── subcategory-classifier.ts   # AI-powered classification
└── income-cycle-detector.ts    # Income-specific pattern matching
```

### Algorithm

```
1. MERCHANT NORMALIZATION
   - Strip reference numbers, account codes, payment IDs
   - "OVO ENERGY AQPZP45" → "OVO ENERGY"
   - "PC/SIMPLY BUSINESS 04AFBT9129/010/105" → "SIMPLY BUSINESS"
   - Normalize case and whitespace

2. GROUPING
   - Group transactions by normalized merchant
   - For groups with ≥2 occurrences, run interval detection

3. INTERVAL DETECTION
   - Sort occurrences by date
   - Compute gaps between consecutive dates
   - Classify interval:
     weekly:       6-8 day gaps
     bi-weekly:    13-15 day gaps
     28-day:       27-29 day gaps (not calendar-monthly)
     monthly:      28-31 day gaps, similar day-of-month
     quarterly:    85-95 day gaps
     annual:       350-380 day gaps
     irregular:    none of the above
   - For monthly: track day-of-month variance (±3 days)

4. AMOUNT ANALYSIS
   - Compute mean and coefficient of variation
   - CV < 0.05 → fixed amount (high confidence)
   - CV < 0.15 → similar amount (medium confidence)
   - CV ≥ 0.15 → variable amount (low confidence, may not be a single recurring)

5. CONFIDENCE SCORING
   - Base: 0.5
   - +0.1 per occurrence (max +0.3)
   - +0.2 if amount variance is low (CV < 0.05)
   - +0.1 if interval is consistent (all gaps within range)
   - -0.2 if interval is irregular
   - Clamped to [0, 1]

6. SUBCATEGORY CLASSIFICATION (AI-powered)
   - Batch transactions through AI classifier
   - Maps to: salary, subscriptions, software, car-expenses, rent,
     taxes, loans, supplier-payments, utilities, bank-fees, insurance,
     marketing, travel, office-supplies, professional-services, one-off
   - AI response: { category, subcategory, confidence }
   - Low confidence (<0.7) falls back to keyword matching
   - Results cached alongside transaction data

7. NEXT OCCURRENCE PREDICTION
   - For each recurring item: last_date + interval
   - If next expected date is before month-end, include in forecast
```

### Types

```ts
interface RecurringPayment {
  id: string;
  merchant: string;
  normalizedDescription: string;
  category: string;
  subcategory: string;
  interval: 'weekly' | 'bi-weekly' | '28-day' | 'monthly' | 'quarterly' | 'annual' | 'irregular';
  typicalAmount: number;
  amountVariance: number;
  lastOccurrence: string;
  nextExpected: string;
  confidence: number;
  occurrences: { date: string; amount: number }[];
}

interface DetectedPatterns {
  recurringExpenses: RecurringPayment[];
  recurringIncome: RecurringPayment[];
  oneOffExpenses: Transaction[];
  oneOffIncome: Transaction[];
  subscriptions: RecurringPayment[];
  salaries: RecurringPayment[];
  loans: RecurringPayment[];
  bySubcategory: Record<string, RecurringPayment[]>;
  metadata: {
    totalTransactions: number;
    recurringCount: number;
    oneOffCount: number;
    detectionDate: string;
  };
}
```

### Testing
- Pure functions, no DB/API dependencies
- Test with arrays of mock transactions
- Verify interval detection, confidence scoring, next-occurrence prediction

---

## Phase 3: Cashflow Forecast Engine

Pure TypeScript. Takes detected patterns + current balance + today → daily forecast.

### Module: `src/lib/forecast/`

```
src/lib/forecast/
├── index.ts                 # Public API: generateForecast(patterns, balance, date)
├── daily-forecaster.ts      # Day-by-day projection
├── status-calculator.ts     # Safe/Watch/Risk/Critical
└── risk-detector.ts         # Danger windows, risk items
```

### Algorithm

```
1. INITIALIZE
   - balance = current balance (user-provided or from last statement)
   - today = current date
   - monthEnd = last day of current month

2. BUILD EXPECTED TRANSACTIONS PER DAY
   - For each recurring payment where nextExpected ≤ monthEnd:
     assign to nextExpected date
   - For income: same logic
   - Handle same-day transactions (multiple payments on one day)

3. DAY-BY-DAY PROJECTION
   For each day from today to monthEnd:
     opening = balance
     income = sum of expected credits for that day
     expenses = sum of expected debits for that day
     closing = opening + income - expenses
     balance = closing
     Record DailyForecast entry
     If closing < riskThreshold: flag as risk day

4. STATUS DETERMINATION
   - Safe:   closing > 0 for all days AND closing > (monthlyExpenses * 0.2) at lowest point
   - Watch:  closing dips below (monthlyExpenses * 0.2) on any day
   - Risk:   closing drops below 0 on any day
   - Critical: closing < 0 AND next income date is after the negative-balance window

5. RISK DETECTION
   - Find "danger window": longest consecutive period where balance < threshold
   - Identify which upcoming payments cause the most risk
   - Flag days where large payments cluster
```

### Types

```ts
interface DailyForecast {
  date: string;
  openingBalance: number;
  expectedIncome: number;
  expectedExpenses: number;
  closingBalance: number;
  transactions: ExpectedTransaction[];
  riskFlag: boolean;
  riskMessage?: string;
}

interface ExpectedTransaction {
  merchant: string;
  expectedAmount: number;
  category: string;
  subcategory: string;
  recurring: boolean;
  confidence: number;
  recurrence: RecurringPayment | null;
}

interface MonthEndForecast {
  currentBalance: number;
  predictedMonthEnd: number;
  remainingIncome: number;
  remainingExpenses: number;
  status: 'safe' | 'watch' | 'risk' | 'critical';
  confidence: number;
  dailyForecast: DailyForecast[];
  nextIncomeDate: string | null;
  dangerWindow: { from: string; to: string; lowestBalance: number } | null;
  biggestRisks: RiskItem[];
  generatedAt: string;
}

interface RiskItem {
  type: 'low-balance-window' | 'large-payment' | 'payment-cluster' | 'no-income';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  relatedTransactions: string[];
  actionable: string;
}
```

### AI Narration
- Forecast data passed to AI SDK for natural-language insight generation
- AI generates the "what you need to know" insight card text
- AI generates per-risk explanations and recommendations
- Structured prompt with forecast data → human-readable narrative

---

## Phase 4: Visual Redesign + Dashboard

### Design System

**Theme:** Light shell with dark chart areas
- Shell: white (#fff) backgrounds, #f8f9fa page background, #e5e7eb borders
- Charts: dark (#111) backgrounds, green (#22c55e) income, red (#ef4444) expenses, amber (#fbbf24) risk
- Typography: system font stack, clean hierarchy
- Cards: white, 1px #e5e7eb border, 10px radius, subtle shadow on hover
- Status badges: green/amber/red/neutral — pill shape
- Spacing: 16px grid, 12px gaps between cards

### Globals.css Rewrite
- Remove current dark-theme glass morphism styles
- Replace with light-shell CSS custom properties
- Dark variant only for chart containers (`.chart-dark`)
- New color tokens: `--color-brand`, `--color-success`, `--color-warning`, `--color-danger`
- Responsive container widths

### Dashboard Layout

**Above the fold:**
1. Nav: minimalist, logo left, company selector + avatar right
2. Cash position row: 3 cards — today's balance, predicted month-end, status badge
3. Insight card: "what you need to know" — prominent, actionable, AI-generated
4. Daily forecast chart: dark background, bar chart showing each day's projected balance

**Below the fold:**
5. Income vs Expenses summary cards — with expected payment breakdowns
6. Category breakdown — expandable, clickable cards per category
7. Biggest risks list — actionable items
8. Recent transactions table

### Charts (Recharts)
- Daily forecast: bar chart (green=income day, red=expense day, amber=risk)
- Monthly trend: line chart with income/expense/balance lines
- Category donut: kept from current, moved to dark chart area
- All charts on dark (#111) backgrounds with light text

### Interactive Elements
- **Insight card:** clickable → opens detail drawer with related transactions, historical pattern, forecast logic, confidence, recommended action
- **Category card:** clickable → opens detail drawer (existing CategoryDetailDrawer, adapted)
- **Forecast bar:** hover/click → shows that day's expected transactions
- **Risk item:** clickable → scrolls to relevant part of forecast

### New Pages
| Route | Purpose |
|-------|---------|
| `/dashboard` | Main dashboard (redesigned) |
| `/insights` | All insights, filterable |
| `/forecast` | Full-screen forecast view (day-by-day scroll) |
| `/transactions` | All transactions, searchable, filterable by category/subcategory |
| `/upload` | Upload statements (kept, adapted) |
| `/settings` | Company profile, members, bank integration |
| `/settings/company` | Edit company details |

### Mobile
- Cards stack vertically
- Forecast chart: horizontal scroll with fixed labels
- Insight card: full-width, prominent
- Company selector: bottom sheet
- Bottom nav: Dashboard, Forecast, Transactions, Upload

### Empty States
- No statements: "Upload your first bank statement to see your cashflow forecast" with CTA
- No recurring detected: "Upload more statements to help us learn your patterns"
- Insufficient data: "We need at least 2 months of statements for reliable forecasts"

### Loading States
- Skeleton cards for cash position, insight, chart
- Progressive loading: critical data first (balance + status), then charts, then insights

### AI Integration for Insights
- AI SDK generates insight card text from forecast data
- Triggered after detection + forecast complete
- Structured prompt: `{ forecast, patterns, companyName }` → `{ headline, summary, risks, recommendations }`
- Results cached; regenerated on new upload or manual refresh

---

## Implementation Order

1. **Phase 1:** Auth + Multi-Tenant (unblocks everything)
2. **Phase 2:** Detection Engine (logic only, testable)
3. **Phase 3:** Forecast Engine (depends on Phase 2)
4. **Phase 4:** Visual Redesign + Dashboard (depends on all above)

Each phase: implement → test → commit → deploy → verify before next phase.
