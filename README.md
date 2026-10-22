# Harbor & Pine: staffing flow prototype

Nymbl Senior Design Engineer challenge, **Option B: the staffing flow**. A Resource Manager picks an open role, compares candidates with plain-language reasons, previews the before/after impact on load and on other commitments, and assigns someone in memory. A Delivery Manager can see which roles are covered.

All data is fictional. "Today" is fixed at **Mon Nov 2, 2026**.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest, domain logic
npm run typecheck
npm run build
```

Requires Node 20+. Built and tested on Node 25.

## Two-minute demo

1. The **Needs attention** strip shows Lena Fischer at 130%, Hannah Kim on leave while still planned, Mei Tanaka with no skills recorded, and A038 with no end date.
2. **R02, Senior Software Engineer (React/TS/A11y).**
   - Olivia Brooks is *Ready*: she rolls off Inventory Sync Nov 6 and the verdict is *Safe*.
   - Sam Rivera is free but "Accessibility not listed in profile".
   - Grace Liu is a strong match but booked.
   - Assign Olivia. The queue shows 1/5 filled and the success panel lists what changed.
3. **R03, Senior Product Designer.** Nobody is a clean fit.
   - Pick Daniel Okafor: peak **90% → 140%**, *Needs a decision*.
   - Turn on **Move Daniel off internal work**: peak drops to 100%, and the Design System Refresh "loses 16h/week" is listed as the tradeoff.
   - Assign. The dialog requires an acknowledgement.
4. **R01** → Omar Haddad is *Safe*, with requested PTO Nov 30–Dec 4 "counted as approved".
5. **R04** → Sofia Marquez goes over 100% in confirmed work. If Enrollment Redesign is won she hits 200% (amber bars). Flip **Count tentative work** in the header and she drops to "Booked".
6. **Why is someone (un)available?** In any preview, click a bar in the load chart, or open **Show week by week**. Identical weeks are grouped into periods with colour-coded capacity bars; holiday and PTO weeks stand alone with amber chips. Try Grace Liu on R02, week of Nov 16: 2 training days leave 24h, Claims Dashboard already takes 24h, and the role adds 24h, so 200%. Daniel on R03 with internal work released shows the Design System Refresh hours struck through.
7. **Reset demo** restores the supplied data.

Keyboard only: Tab to the role list, move with ↑/↓, open with Enter, Tab into candidates, ↑/↓ + Enter, then Tab to *Assign*. Esc closes the dialog or the preview, and focus returns to where you were.

## Where things are

```
data/source/                 supplied dataset, unchanged (JSON + CSV + README)
src/data/loadSource.ts       typed adapter over the JSON (snake_case → camelCase, enum checks)
src/data/enrichment.ts       SYNTHETIC client/person fit data, labelled "demo data" in the UI
src/domain/                  pure, tested business rules
  dates.ts                   TODAY, inclusive weekday maths
  capacity.ts                daily/weekly load, time off, employment dates, >100% spans
  candidates.ts              skill/level/availability evaluation, tiers, reasons, ordering
  preview.ts                 before/after preview, issues, verdict, applyPreview
  attention.ts               "needs attention" bucket
  actuals.ts                 logged-vs-planned context
  __tests__/                 Vitest
src/features/staffing/       UI: RoleQueue, CandidatePanel, PreviewPanel, CommitDialog, AttentionStrip, LoadChart, WeekBreakdown
  useStaffingState.ts        reducer; commits are replayed over the source (undo/reset are exact)
src/components/              Tone (status vocabulary) + shadcn/ui primitives
docs/                        DESIGN_CONCEPT · PROBLEM_STATEMENT · DECISIONS · AI_PROCESS_LOG
```

Good places for live edits:
- Tier rules and thresholds: `src/domain/candidates.ts` (`MAX_TOLERATED_AWAY_WEEKS`, `MIN_PARTIAL_COVERAGE`, `tierOf`).
- Issue severity: `collectIssues` in `src/domain/preview.ts`.
- Attention horizon: `src/domain/attention.ts`.
- Demo fit data: `src/data/enrichment.ts`.

## Not done (on purpose)

- No backend, auth or persistence. Commits live in memory, and the UI says so.
- No full Monday view, allocation editing, or cross-discipline candidates.
- No mobile.
- No component tests. Keyboard and focus were checked with a scripted headless-Chrome run, not a screen reader.

See `docs/DECISIONS.md` for every assumption and limitation.
