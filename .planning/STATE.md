# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11)

**Core value:** Upload bank statements, and the app tells business owners clearly how the current month is likely to end, while learning month by month from business history.
**Current focus:** Phase 1 - Backend Logic Fixes

## Current Position

Phase: 1 of 2 (Backend Logic Fixes)
Plan: None yet (TBD)
Status: Ready to plan
Last activity: 2026-05-11 -- Roadmap created with 2 phases, 36 requirements mapped

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: N/A
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- No plans executed yet.

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Split into 2 phases (backend -> UI) -- backend logic fixes are prerequisite for meaningful UI changes
- [Init]: currentBalance = latest statement closing_balance -- accumulated net flow is a separate concept
- [Init]: Three confidence tiers for forecast (HIGH/MEDIUM/LOW) to prevent low-confidence pollution
- [Init]: Forecast only current month by default -- future months on request
- [Init]: Categorization fixes via keyword/pattern rules + AI fallback -- deterministic rules for known vendors

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Fix order is critical -- 10-step dependency chain within Phase 1 must be respected. Skipping ahead will produce incorrect results.
- [Phase 1]: Balance validation tolerance (2p) needs testing against actual NatWest PDF parsing edge cases.
- [Phase 1]: Multi-factor confidence weights (count 30%, month spread 25%, amount 20%, interval 15%, day variance 10%) are principled but should be validated against real user statement data.
- [Phase 1]: Vendor keyword coverage covers known vendors from user's data. New users with different vendors need AI fallback + promote-to-rules mechanism to work correctly.
- [Phase 2]: User trust recovery steps (proactive acknowledgement, show-the-math, one-click verification) should be included.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-11 (roadmap creation)
Stopped at: Roadmap created, Phase 1 ready to plan
Resume file: None
