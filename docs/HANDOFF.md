# Handoff

Context for picking this up on another machine or in a new Claude Code session. Start a session in
the repo and ask it to read this file first, then `README.md` and `docs/DECISIONS.md`.

## What this is

Nymbl Senior Design Engineer take-home, **Option B: staffing flow** for the fictional firm Harbor &
Pine. One screen: role queue → candidate comparison → assignment preview → commit (in memory, with
reset). The original brief prompt is embedded verbatim at the top of `docs/AI_PROCESS_LOG.md`.

Hard rules from the brief, still in force:

- React + TypeScript + Vite, Tailwind v4, shadcn/ui (Nova preset, Radix), Lucide, Vitest. No
  backend, no Next.js, no state library.
- "Today" is fixed at **Mon 2026-11-02** (`TODAY` in `src/domain/dates.ts`).
- Supplied data in `data/source/` is never edited. Synthetic additions live only in
  `src/data/enrichment.ts` and are labelled "demo data" in the UI.
- Calculations are pure functions in `src/domain/`, with tests. Matching is explained with reasons
  and tiers, never a hidden score.
- Keyboard access and focus handling are deliverables, not polish.
- `AI_PROCESS_LOG.md` must stay honest. Never fabricate; leave ✍️ placeholders where only PJ can
  describe their own validation.

## Setup

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest (50 tests passing at handoff)
npm run typecheck
npm run build
npm run lint       # oxlint; only fast-refresh warnings expected
```

If a browser on the same machine can't reach the dev server, start it with
`npx vite --host 127.0.0.1` (Vite bound to IPv6 only on the original PC).

## Where things are

| Area | Files |
| --- | --- |
| Source data adapter | `src/data/loadSource.ts` (snake_case → camelCase, enum checks) |
| Synthetic data | `src/data/enrichment.ts` |
| Dates, capacity | `src/domain/dates.ts`, `src/domain/capacity.ts` |
| Candidate tiers + reasons | `src/domain/candidates.ts` |
| Assignment preview + per-week hours | `src/domain/preview.ts` (`previewAssignment`, `PreviewWeek`) |
| Week grouping + statuses | `src/domain/weekGroups.ts` |
| "Needs attention" items | `src/domain/attention.ts` |
| Tests | `src/domain/__tests__/` |
| UI | `src/features/staffing/` (`StaffingFlow`, `RoleQueue`, `CandidatePanel`, `PreviewPanel`, `LoadChart`, `WeekBreakdown`, `CommitDialog`, `AttentionStrip`) |
| Focus helpers | `src/lib/useRovingFocus.ts`, `src/lib/useDeferredFocus.ts` |
| Docs | `docs/DESIGN_CONCEPT.md`, `docs/PROBLEM_STATEMENT.md`, `docs/DECISIONS.md`, `docs/AI_PROCESS_LOG.md` |

## Domain rules (summary; full table in DECISIONS.md)

- Inclusive dates, Mon–Fri working days. Daily capacity = weekly capacity ÷ 5.
- Allocations are prorated to the days the person works (100% in a week with 2 days off = 3 × 8h = 24h).
- 0% assignments are ignored. A missing end date falls back to the project end and is flagged as assumed.
- Requested PTO counts as time off (status kept visible). Internal PRJ-08 work is releasable.
- Tentative work is a separate "only if won" scenario and never counts as load by default.
- Commits are change records replayed over the untouched source (`replayCommits` in `useStaffingState.ts`).

### Capacity terms (agreed wording, use consistently)

- **Working capacity**: hours they can work that week after holidays and time off.
- **Committed**: existing confirmed work.
- **Proposed**: the role being assigned.
- **Free** = max(0, capacity − committed − proposed). It is never negative; excess shows as "Xh over capacity".
- **Utilization** = (committed + proposed) ÷ capacity.
- Weeks with no working capacity read **Away**. If work is still planned on those days, it's a **conflict** (`plannedOnDaysOffHours`; company holidays excluded).
- Don't use the word "available"; users read it as "free to take more work".

### Week-by-week view

Weeks are grouped into periods only when every number, project and day off is identical. Weeks with a
holiday or time off never merge, except a run of fully-away weeks from the same time-off record.
Statuses: over, conflict, away, reduced, at-risk, full, room (green / amber / red bars).

## History of the work (in order)

1. Built the flow and docs from the plan.
2. Increased contrast and dividers between cards and sections.
3. Added the expandable week-by-week breakdown and rebuilt the chart so 100% → 200% is obvious
   (stacked bars, dynamic scale, 100% line on top, red over-capacity stripes).
4. Redesigned the breakdown from a table into grouped period cards with a summary at the top.
5. Terminology pass (the terms above). Found and fixed one real calculation gap: fully-away
   weeks hid the work still planned during them; now flagged as a conflict.
6. Tried moving the data-notes toggle into the "Needs attention" header row. PJ asked for it to be
   **reverted**, so it stays below the warning cards. Don't redo it.

Sessions 1–4 are logged in `docs/AI_PROCESS_LOG.md`.

## Open judgement calls (flagged to PJ, not yet decided)

- Olivia Brooks's Thanksgiving week is a **conflict** in the week view, but her overall verdict stays
  **Safe** (verdict rules unchanged on purpose).
- Company holidays are excluded from "planned on days off".
- A week that is over capacity *and* has time off is coloured red but keeps its amber time-off chip.
- If-won roles count in the preview chart (treated as confirmed for the maths), with the warning
  suffixed "Only if the project is won."

## Still for PJ to do

- Fill the ✍️ placeholders in `docs/AI_PROCESS_LOG.md` (own review and validation).
- Hand-check what automation couldn't: screen reader announcements, colour contrast, focus visibility.
- Decide the judgement calls above.

## Verification notes

UI changes were checked with headless Chrome (puppeteer-core) scripts that lived in a temp folder on
the original PC. **They are not in this repo.** On a new machine, re-verify in a real browser, or
recreate a small puppeteer script if needed. Useful spot checks:

- Grace Liu (R02): 28 weeks collapse into 7 periods.
- Hannah Kim: her leave shows as conflict periods.
- Sofia, week of Dec 21: "Capacity 24h · Committed 12h · Proposed +12h · Free 0h", 100%.
- Olivia, Thanksgiving week: Away with "Conflict: 24h planned while away".
- Demo script in `README.md` (R02 → Olivia safe; R03 → Daniel needs a call; R01 → Omar with PTO; toggle tentative).
