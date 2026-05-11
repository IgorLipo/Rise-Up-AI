---
phase: 01
slug: backend-logic-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via Next.js) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` on modified files
- **After every plan wave:** Run `npx vitest run` on affected tests
- **Before verification:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 1 | BAL-04 | N/A | Integer pence arithmetic prevents floating-point drift | unit | `npx vitest run src/lib/financial/__tests__/math.test.ts` | ❌ W0 | ⬜ pending |
| 01-02 | 01 | 2 | BAL-01, BAL-02, BAL-04 | T-01 | closingBalance never falls back to computed values | unit | `grep -c 'closing_balance' src/app/api/documents/aggregate/route.ts` | ✅ | ⬜ pending |
| 01-03 | 01 | 2 | CAT-01, CAT-02, CAT-03, CAT-04 | T-02 | Deterministic rules run before AI classification | unit | `grep -c 'vendorCategories' src/lib/detection/subcategory-classifier.ts` | ✅ | ⬜ pending |
| 01-04 | 01 | 3 | BAL-03, BAL-05 | T-03 | currentPosition and accumulatedPerformance never mixed in same object | integration | `grep 'currentPosition' src/app/(app)/dashboard/page.tsx` | ✅ | ⬜ pending |
| 01-05 | 01 | 4 | FOR-01, FOR-02 | T-04 | catchUpBalance never projects from accumulated net flow, deduplicates within statement period | unit | `npx vitest run src/lib/forecast/__tests__/catch-up.test.ts` | ❌ W0 | ⬜ pending |
| 01-06 | 01 | 5 | FOR-06, FOR-09, CAT-05 | T-05 | 5-factor weighted confidence scoring produces HIGH/MEDIUM/LOW tiers | unit | `npx vitest run src/lib/detection/__tests__/confidence.test.ts` | ❌ W0 | ⬜ pending |
| 01-07 | 01 | 6 | FOR-03, FOR-04, FOR-05, FOR-07, FOR-08, FOR-10 | T-06 | Only HIGH confidence items in main forecast, dedup before inclusion, item statuses assigned | integration | `npx vitest run src/lib/forecast/__tests__/forecast.test.ts` | ❌ W0 | ⬜ pending |
| 01-08 | 01 | 5 | SUS-01, SUS-02, SUS-03 | T-07 | Credits skip personal patterns, >£200 skip small-purchase patterns, known business vendors whitelisted | unit | `npx vitest run src/lib/detection/__tests__/suspicious.test.ts` | ❌ W0 | ⬜ pending |
| 01-09 | 01 | 7 | RIS-01 | T-08 | Risk messages include vendor names, amounts, dates, and income timing | unit | `grep -c 'vendorName' src/lib/forecast/risk-detector.ts` | ✅ | ⬜ pending |
| 01-10 | 01 | 8 | UPL-01, UPL-02 | T-09 | Upload triggers full pipeline: validate→learn→reclassify→patterns→forecast, returns UploadSummary | integration | `grep 'runUploadPipeline' src/lib/pipeline/upload-pipeline.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/financial/__tests__/math.test.ts` — stubs for BAL-04 (integer pence, balance validation)
- [ ] `src/lib/forecast/__tests__/catch-up.test.ts` — stubs for FOR-01, FOR-02 (catchUp dedup)
- [ ] `src/lib/detection/__tests__/confidence.test.ts` — stubs for FOR-06, FOR-09 (confidence tiers)
- [ ] `src/lib/forecast/__tests__/forecast.test.ts` — stubs for FOR-03 through FOR-08, FOR-10
- [ ] `src/lib/detection/__tests__/suspicious.test.ts` — stubs for SUS-01 through SUS-03
- [ ] `src/lib/pipeline/upload-pipeline.ts` — new file for UPL-01, UPL-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard displays currentPosition.balance as hero metric | BAL-05 | Visual verification of UI rendering | Navigate to /dashboard, confirm hero card shows latest statement closing balance, not accumulated net flow |
| Forecast summary shows business-useful top section | FOR-10 | Visual layout verification | Navigate to /forecast, confirm summary shows latest balance, expected income/expenses, predicted month-end, status, confidence % |
| Upload flow triggers and shows summary | UPL-02 | End-to-end browser interaction | Upload a statement PDF, verify summary toast/panel shows imported period, latest balance, new vendors, updated patterns, forecast status |
| Risk messages are specific (vendor names, dates, amounts) | RIS-01 | Subjective quality assessment | View risk messages on dashboard, confirm they name specific vendors, amounts, and dates rather than generic text |
| Categorized vendors appear under correct categories | CAT-01 through CAT-04 | Visual category breakdown check | View category breakdown, confirm Leicester City Council under council, Shell/BP under car-expenses, Apple/Spotify under subscriptions |

---

## Validation Sign-Off

- [ ] All tasks have `<acceptance_criteria>` with grep-verifiable conditions
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
