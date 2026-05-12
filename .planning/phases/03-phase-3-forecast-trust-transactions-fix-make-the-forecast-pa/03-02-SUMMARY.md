---
phase: 03-phase-3-forecast-trust-transactions-fix-make-the-forecast-pa
plan: 02
type: execute
subsystem: transactions
tags: [transactions, classification, keyword-classifier, food-dining, search, drill-down, text-selection]
status: complete
completed: "2026-05-12T12:03:19Z"
duration: "6 minutes"

requires:
  - P3-09 (Correct category assignments — Costa=Food, Apple=Software, Amazon=Shopping)
  - P3-10 (Practical category list with Food & Dining, Shopping, Uncategorized)
  - P3-11 (Search input filtering transactions)
  - P3-12 (Clickable category drill-down)
  - P3-13 (Transaction row formatting: Date|Merchant|Category badge|Amount)
  - P3-14 (Selectable/copyable text throughout)

depends_on:
  - 03-01-PLAN.md (Forecast Trust — API response structure for categories)

provides:
  - Fixed keyword classifier with new food-dining subcategory and correct brand assignments
  - Rebuilt Transactions tab with search, category drill-down, View all, text selection
  - Updated category labels across classifier and UI components

affects:
  - Dashboard Transactions tab UX
  - Category classification accuracy
  - Subcategory type system

tech-stack:
  added: []
  patterns:
    - "Keyword classifier priority ordering (food-dining before software/subscriptions)"
    - "Client-side transaction filtering via useMemo (search + category drill-down)"
    - "Category breakdown as clickable filter control (onCategoryClick callback)"

key-files:
  created: []
  modified:
    - src/lib/detection/subcategory-classifier.ts (keyword maps, Subcategory type, mapToCategory)
    - src/types/index.ts (Subcategory union export)
    - src/components/dashboard/transactions-tab.tsx (complete rebuild)
    - src/components/dashboard/category-breakdown.tsx (onCategoryClick, active highlight, labels)
    - src/app/globals.css (text selection rules)
    - src/app/(app)/dashboard/page.tsx (simplified TransactionsTab props)

key-decisions:
  - "food-dining placed FIRST in SUBCATEGORY_KEYWORDS to prevent downstream misclassification (e.g., Costa matching utilities)"
  - "Apple universally classified as Software/Tools per user specification (single catch-all pattern)"
  - "OpenAI/ChatGPT moved from subscriptions to software"
  - "Display label 'Uncategorized' for one-off fallback rather than 'One-off costs'"
  - "Category filter drives transactions list client-side (no API call on drill-down)"
  - "TransactionsTab computes totalTransactions internally from categories array"

metrics:
  plan: 03-02
  tasks: 2
  files: 6
  duration: 6 minutes
  commits: 2
---

# Phase 03 Plan 02: Transactions Fix & Rebuild Summary

## One-Liner

Fixed keyword classifier with new food-dining subcategory, rebuilt Transactions tab with search/drill-down/text-selection, and updated all category labels to match the user's practical list.

## Tasks Completed

### Task 1: Fix keyword classifier misclassifications, add food-dining subcategory, and rebuild category list

**Commit:** `dfefe0b`

**Changes:**
- Added `"food-dining"` to Subcategory union in both `subcategory-classifier.ts` and `types/index.ts`
- Created `"food-dining"` keyword entry with 28 food brand/meal patterns (Costa, Starbucks, Pret, McDonald's, KFC, Burger King, Domino's, Deliveroo, Just Eat, Uber Eats, etc.) placed FIRST in the keywords object to win over downstream patterns
- Moved Apple patterns from subscriptions to software: removed `/apple\.com\/bill/i` and `/\bapple\b.*\b(media|services|icloud|app store)\b/i` from subscriptions, added `/\bapple\b/i` as first pattern in software array
- Moved OpenAI/ChatGPT patterns from subscriptions to software
- Added broader software patterns: Adobe, Canva, Figma, Notion, Linear, GitHub, GitLab, Vercel, Netlify, Heroku, DigitalOcean, Linode, Cloudflare, Anthropic, Mistral, DeepSeek
- Updated `mapToCategory` with new display labels: "Salaries & Wages", "Software/Tools", "Car & Transport", "Rent & Property", "Suppliers & Services", "Shopping", "Food & Dining", "Uncategorized"
- Updated `CATEGORY_LABELS` in `category-breakdown.tsx` to match the new labels

### Task 2: Rebuild Transactions tab with search, category drill-down, View all toggle, proper row formatting, and fix global text selection

**Commit:** `a8183af`

**Changes:**
- **`globals.css`**: Added text selection CSS rules targeting data elements (`.select-text`, `.transaction-row`, table, `.transactions-tab *`, etc.) with `user-select: text` overrides
- **`category-breakdown.tsx`**: Added `onCategoryClick` and `activeCategory` props; made each category row call `onCategoryClick` on click; highlighted active category with `bg-zinc-100`; added `cursor-pointer` when `onCategoryClick` is provided
- **`transactions-tab.tsx`**: Complete rebuild with:
  - Search `<input>` filtering by description, category label, raw category key, or amount string
  - Category filter badge (dismissible) when `activeCategory` is set
  - Clickable `CategoryBreakdown` embedded with `onCategoryClick` callback driving `activeCategory`
  - Flattened, deduplicated, filtered, and date-sorted transaction list via `useMemo`
  - Transaction rows formatted as: Date (monospaced, 24ch) | Description (truncated) | Category badge (small pill) | Amount (right-aligned, color-coded green for credits, red for debits)
  - "--" prefix for debits, "+" prefix for credits
  - View all / Show less toggle when more than 20 transactions
  - Empty states: "No transactions match your search." and "No transactions yet."
  - Internal computation of `totalTransactions` from categories data
- **`page.tsx`**: Removed `totalTransactions` and `onViewAllTransactions` props from TransactionsTab usage; passes only `categories`

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` exits 0 with no errors across all modified files
- Manual verification items (performed by verifier):
  - Costa Coffee classification as "Food & Dining"
  - Apple classification as "Software/Tools"
  - Amazon classification as "Shopping"
  - Search filtering in real time
  - Category click drill-down
  - Text selection and copyability
  - View all toggle behavior

## Known Stubs

None — all modified components are fully wired to their data sources.

## Threat Flags

None — no new endpoints, auth paths, or file access patterns introduced beyond what was already in the plan's threat model.

## Self-Check: PASSED

All 6 modified files exist on disk. Both commits (dfefe0b, a8183af) found in git history. Content verified against acceptance criteria.
