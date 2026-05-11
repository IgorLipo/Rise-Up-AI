---
phase: 02
slug: dashboard-ui-experience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 02 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via Next.js) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit` on full project
- **Before verification:** Full suite must be green
- **Max feedback latency:** 60 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 02-01-task1 | 01 | 1 | UI-04 | Tab navigation renders 5 tabs with URL-synced state | type | `npx tsc --noEmit` | ⬜ pending |
| 02-01-task2 | 01 | 1 | UI-04, UI-08 | Dashboard page renders tabs, status with criteria | type | `npx tsc --noEmit` | ⬜ pending |
| 02-01-task3 | 01 | 1 | UI-09 | Key drivers show biggest expected income/expenses | type | `npx tsc --noEmit` | ⬜ pending |
| 02-02-task1 | 02 | 2 | UI-01 | Daily forecast shows top 3-5 items with "+X more" | type | `npx tsc --noEmit` | ⬜ pending |
| 02-02-task2 | 02 | 2 | UI-02, UI-03 | Month cards show individual months with full details | type | `npx tsc --noEmit` | ⬜ pending |
| 02-02-task3 | 02 | 2 | UI-07 | Interactive insight cards with detail panel | type | `npx tsc --noEmit` | ⬜ pending |
| 02-03-task1 | 03 | 3 | UI-05, UI-06 | Review queue with actions and appropriate wording | type | `npx tsc --noEmit` | ⬜ pending |
| 02-03-task2 | 03 | 3 | UI-04 | Transactions tab with category breakdown | type | `npx tsc --noEmit` | ⬜ pending |
| 02-03-task3 | 03 | 3 | UI-10 | Recommended actions section with specific suggestions | type | `npx tsc --noEmit` | ⬜ pending |

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab navigation switches content | UI-04 | Visual UI interaction | Click each tab, verify correct content renders |
| "+X more" expands daily forecast | UI-01 | Visual UI interaction | Click expand button on a day with >5 items |
| Month card click shows detail | UI-02, UI-03 | Visual UI interaction | Click a month card, verify detail view |
| Review action buttons work | UI-06 | Visual UI interaction | Click mark-as-business, verify item dismissed |
| Insight card click opens panel | UI-07 | Visual UI interaction | Click insight card, verify detail panel opens |
| Status badge shows criteria | UI-08 | Visual layout verification | View Safe/Watch/Risk/Critical badge, verify criteria text |
| Recommended actions are specific | UI-10 | Subjective quality | Read action items, verify they reference real data |
| Mobile responsiveness | UI-04 | Visual layout verification | Resize to 375px width, verify tabs stack/scroll |

## Validation Sign-Off

- [ ] All tasks have verification conditions
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
