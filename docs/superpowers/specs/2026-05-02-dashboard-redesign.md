# Dashboard Redesign — Card Grid + Mobile-First UX

## Summary

Redesign the dashboard from a single scrolling page into a modular card grid with bottom tab navigation, a floating back button, document history, and prominent insight cards that upsell the detail drawer. Mobile-first with responsive breakpoints.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Dashboard layout | Card grid (Stripe-style) |
| Navigation | Floating back button + bottom tab bar |
| Spend Breakdown chart | Donut chart with legend cards |
| Insight presentation | Prominent cards with severity accents, teasing drawer |
| Document history | New section showing past uploads + insight summaries |

## Navigation

### Bottom Tab Bar

Four tabs fixed at the bottom on mobile (`max-width: 768px`). On desktop (`>= 768px`), the tab bar becomes a left sidebar or top nav.

| Tab | Icon | Route |
|-----|------|-------|
| Dashboard | Chart/Home | `/dashboard` |
| Insights | Lightbulb/Search | `/insights` |
| History | Clock/Document | `/history` |
| Upload | Plus/Upload | `/upload` |

Active tab: amber-500 icon + label, inactive: warm-black/30 (light) or warm-white/20 (dark).

### Floating Back Button

- Circular, 40px, glass effect with subtle shadow
- Positioned `fixed` top-left (top-4 left-4) with z-50
- Visible on all pages except dashboard
- Arrow icon (←) with "Back" tooltip on hover
- Uses `router.back()` with fallback to `/dashboard`

## Dashboard Layout (Card Grid)

### Section Order (top to bottom)

1. **Hero Strip** — 2 dark cards side-by-side (full width on mobile, stacked):
   - Net Cash Flow: amount, trend arrow, health badge, mini progress bar
   - Needs Your Attention: count of unreviewed findings, total amount at risk, severity breakdown pills

2. **Quick Stats Row** — 4 tiles (2x2 on mobile):
   - Revenue, Total Spend, Avg Transaction, Transaction Count
   - Each with amount, optional trend indicator

3. **Charts Row** — 2 cards side-by-side (stacked on mobile):
   - Spend Breakdown: Donut chart (Recharts PieChart with innerRadius) + legend cards
   - Cash Flow Trend: Area chart (existing, preserved)

4. **Insight Feed** — 2-column grid (1-column on mobile):
   - Each card: severity left border, category badge, amount at risk, short title, merchant tags
   - Click opens InsightDrawer
   - "View all N findings →" link when >6 cards

5. **Owner Review Pack** — Top 5 priority items (existing component, preserved)

6. **Recent Activity** — Last 10 transactions as compact list items with date, merchant, category, amount
   - Clickable rows that highlight on hover

7. **Document History** — Cards for previously uploaded statements:
   - Each card: filename, upload date, # of insights, cash flow summary
   - Click navigates to that document's insights page

## Spend Breakdown Chart Fix

Current PieChart renders broken "little squares." Fix:

- Use Recharts `PieChart` with `innerRadius={60}` and `outerRadius={100}` (donut)
- Render total amount in the center using a custom label or absolutely positioned div
- Replace Recharts `<Legend>` with custom legend cards below the chart (colored dot + category name + amount + percentage)
- Fallback: if `pieData` is empty, show "No category data" placeholder
- ResponsiveContainer with `height={300}` on desktop, `height={260}` on mobile

## Mobile Responsiveness

### Breakpoints
- Mobile: `< 640px` (single column)
- Tablet: `640px - 1024px` (2-column grids)
- Desktop: `> 1024px` (full layout)

### Key fixes
- Summary card amounts: truncate with `text-ellipsis` or use smaller font on mobile (`text-xl` instead of `text-2xl`)
- Grid cards: `grid-cols-2` on mobile for quick stats, `grid-cols-1` for insight cards
- Charts: full width, stacked vertically
- Bottom tab bar: visible only on mobile (`md:hidden`)
- Floating back button: smaller (36px) on mobile

## Document History Board

### New route: `/history`

- Lists all previously uploaded statements (stored in sessionStorage for now, Supabase later)
- Each entry shows:
  - Statement filename
  - Upload timestamp
  - Analysis mode (personal/business)
  - Insight count + top finding summary
  - Cash flow health badge
- Empty state: "No document history" with CTA to upload
- Data source: reads from sessionStorage keys (`statementData_*`, `statementInsights_*`)

### Storage strategy (pre-Supabase)

Store history entries in sessionStorage as a JSON array under key `documentHistory`:
```json
[{
  "id": "uuid",
  "filename": "statement-may.csv",
  "uploadedAt": "2026-05-02T10:30:00Z",
  "mode": "business",
  "insightCount": 8,
  "topFinding": "3 analytics tools overlap",
  "cashFlowHealth": "good",
  "netFlow": 4250
}]
```

## Implementation Files

### New files
- `src/components/nav/bottom-tab-bar.tsx` — 4-tab mobile navigation
- `src/components/nav/floating-back.tsx` — Circular back button
- `src/components/charts/spend-breakdown-donut.tsx` — Donut chart + legend cards
- `src/components/history/document-history-card.tsx` — Individual history entry
- `src/app/(app)/history/page.tsx` — Document history board page
- `src/lib/history.ts` — sessionStorage read/write helpers

### Modified files
- `src/app/(app)/dashboard/page.tsx` — Restructure into card grid sections
- `src/app/(app)/layout.tsx` — Add BottomTabBar + FloatingBack to app layout
- `src/app/globals.css` — Tab bar styles, floating button styles, mobile breakpoints
- `src/app/(app)/upload/page.tsx` — Save to document history on successful upload
- `src/app/(app)/insights/page.tsx` — Consistent card styling with dashboard

## Verification

1. `npm run build` passes with zero TypeScript errors
2. Mobile viewport (375px): cards stack single-column, bottom tab visible, no overflow
3. Desktop: full card grid, no tab bar, floating back hidden
4. Donut chart renders with legend cards, no "little squares"
5. Tab navigation switches between Dashboard/Insights/History/Upload
6. Floating back button navigates to previous page or dashboard fallback
7. Document history shows entries after upload
8. Dark mode: all new components render correctly
