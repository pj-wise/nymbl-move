# Handoff

Context for picking this up on another machine or in a new Claude Code session. Start a session in
the repo and ask it to read this file first, then `README.md` and `docs/DECISIONS.md`.

## What this is

Nymbl Senior Design Engineer take-home, **Option B: staffing flow** for the fictional firm Harbor &
Pine. Two workspaces on one shared staffing state:
- **Resource Manager**: role queue → candidate comparison → assignment preview → commit (in memory, with reset).
- **Delivery Manager**: the signed-in person's own projects, open/filled requests, who was assigned and their start.

Switch between them, and between mock users, from the account menu at the top right. The original brief prompt is embedded verbatim at the top of `docs/AI_PROCESS_LOG.md`.

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
npm test           # Vitest (98 tests passing)
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
| Synthetic data | `src/data/enrichment.ts`, `src/data/demoUsers.ts` (mock users + app roles) |
| Permissions + session | `src/auth/permissions.ts` (app roles → permissions → workspaces), `src/auth/useSession.ts` |
| App shell | `src/app/AppShell.tsx` (header, owns the staffing store), `src/app/AccountMenu.tsx` |
| DM visibility + requests | `src/domain/projectStaffing.ts` |
| Candidate comparison | `src/domain/comparison.ts`, `src/features/staffing/CompareDrawer.tsx` |
| Dates, capacity | `src/domain/dates.ts`, `src/domain/capacity.ts` |
| Candidate tiers + reasons | `src/domain/candidates.ts` |
| Assignment preview + per-week hours | `src/domain/preview.ts` (`previewAssignment`, `PreviewWeek`) |
| Week grouping + statuses | `src/domain/weekGroups.ts` |
| Staffing issues (bell) | `src/domain/attention.ts` (items, categories, `issueTarget`), `src/app/IssuesMenu.tsx`, `src/components/ui/popover.tsx` |
| Business rules (docs only) | `docs/BUSINESS_RULES.md`: the 8 planning rules, their source, and where each surfaces in the UI |
| Tests | `src/domain/__tests__/` |
| UI | `src/features/delivery/` (`DeliveryWorkspace`, `ProjectStaffingCard`); `src/features/staffing/` (`StaffingWorkspace`, `RoleQueue`, `CandidatePanel`, `PreviewPanel`, `LoadChart`, `WeekBreakdown`, `CommitDialog`) |
| Focus helpers | `src/lib/useRovingFocus.ts`, `src/lib/useDeferredFocus.ts` |
| Docs | `docs/DESIGN_CONCEPT.md`, `docs/PROBLEM_STATEMENT.md`, `docs/DECISIONS.md`, `docs/BUSINESS_RULES.md`, `docs/AI_PROCESS_LOG.md` |

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

7. Project status badge (`src/components/ProjectStatusBadge.tsx`): proposed projects are dashed amber with
   the win chance, signed projects solid. Used in the role queue, role header and commitments table.
8. Two workspaces. Job title, app permissions and project membership are kept separate (see
   DECISIONS.md §2b). Delivery Manager visibility comes only from Delivery Manager assignments, so
   Field Ops shows for nobody until R04 is filled. Mock users: Jordan (both), Sofia (DM), Morgan
   (mock RM). Also fixed the page scrolling when focus moved (root container wasn't `relative`, so
   `sr-only` elements escaped `overflow-hidden`).

9. Data-notes cleanup. The "Show N data notes" list is gone. Needs attention keeps only actionable
   problems, plus a new contextual check for work planned outside employment dates.
10. Planning assumptions were briefly shown as a collapsed section in the UI. PJ had it **removed**:
    the rules live in `docs/BUSINESS_RULES.md` instead. The UI shows no rule-source labels, record
    IDs or calculation explanations (the week-breakdown footer went too). Uncertainty is still shown
    where it matters: requested PTO reads "requested, not yet approved", and inferred end dates are
    flagged in the preview without the record ID.
11. Layout. The attention strip moved into a bell **issues menu** in the header (Resource Manager
    only; separate from the account menu). Issues persist until resolved, filter by conflicts / data
    issues, and link to the person's candidate card on a relevant open role. The grid is now about
    25/50/25 with candidates in the middle. The page has one scroll area under the header, with the
    role queue and preview sticky beside it. Candidate cards are compact (one top reason + "N more")
    with an expand button showing Concerns / Strengths. Item 6's rule about the data-notes toggle is
    moot now.
12. "Count tentative work" moved from the header into the selected role card (next to the
    "ready to propose" line). "Reset demo" moved into the account menu (bottom item, disabled when
    there's nothing to reset). The header now holds only the date, prototype pill, bell and account.

13. "Count tentative work" now sits compact in the top right of the role card (hint as tooltip /
    screen-reader text). Account menu has **Show demo fit data** (staffing workspace only, **off by default**): hides
    the synthetic client-fit / seniority / industry data everywhere; rankings are unaffected.

14. "Open roles" panel lists **only open requests**: once a role is assigned it leaves the list (the
    assignment stays in shared state and shows in the Delivery Manager view). An Open/Filled/All tab
    selector was tried and **removed** at PJ's request; don't re-add it. Instead, tabs filter by
    **project status** (All / Starting soon / Proposed, generated from the statuses of projects that
    have requests, with open counts). Search box (role, skill,
    project, client; every word must match) and priority filter, with a subtle "N open" (or
    "N of M" while filtering) in the header. Project "x/y filled" counts use project totals.
    Project notes have their own "Notes" row in the role card.

15. Preview split into a **compact panel** (verdict, blocking/decision warnings, internal-work
    release, peak + compact chart, Assign) and a **Full breakdown drawer** (`PreviewDrawer.tsx`,
    `components/ui/sheet.tsx`, ~74% width): left column workload (big chart, always-open week by
    week), right column things to check, commitments, and "why on the list" (strengths + concerns not
    already stated as a warning). Header and Assign/Close footer stay fixed. Both views share
    `PreviewParts.tsx` and the same `StaffingPreview`, so numbers can't differ. Drawer and selected
    week live in `ActivePreview`; Esc closes only the drawer; focus returns to whatever opened it;
    a chart-bar click opens the drawer on that week. Week rows now show Capacity/Committed/Proposed/
    Free as four aligned columns, and the per-week calculation is a right-aligned table.

16. **Compare candidates (2–4).** "Compare" checkbox on each candidate card (max 4, `MAX_COMPARE`; others disabled
    with a reason), a sticky bar with Clear / Compare N, and `CompareDrawer.tsx` (widens per column; Preview and Remove per column header): an aligned table
    (names as sticky column headers) built by `comparisonRows` in `src/domain/comparison.ts`. Same
    evaluation + `previewAssignment` as the preview. "Preview X" continues into the normal preview.
    State: `compareIds` in the staffing reducer; cleared on role change, reveal to another role, reset.

17. Role card details are two label/value pairs per row (Needs · Dates, Project · Notes; Client fit
    full width). At PJ's request the candidate column is now fixed-height like the other two: the
    role card stays put and only the candidate list scrolls (compare bar sticks to its bottom). The
    column uses `overflow-clip`, not `overflow-hidden`, so `scrollIntoView` (issue links) scrolls the
    list rather than the column itself.

18. Project status badge moved under the role title. New role-card toggle **Release Internal
    Allocations** (below Factor Proposed Projects, off by default): `candidatesForRole(..., {
    releaseInternal })` evaluates on `releaseInternalForRole(ctx, role)` and adds a caution reason to
    affected people; previews and comparisons start released. The per-person "Release internal
    allocation" switch moved from the preview/drawer into the **assign dialog** (resets the
    acknowledgement when flipped). Release rule extracted to `capacity.ts` and shared with
    `previewAssignment`.

Sessions 1–4 are logged in `docs/AI_PROCESS_LOG.md`. Sessions for items 7–18 aren't logged there yet.

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
- Two workspaces: as Jordan, Delivery shows only Dispatch Portal + Claims Dashboard. Assign Sofia to
  R04, sign in as Sofia: Field Ops appears, R04 filled, "Starts Nov 16 · Confirmed", 4 of 5 open.
- Demo script in `README.md` (R02 → Olivia safe; R03 → Daniel needs a call; R01 → Omar with PTO; toggle tentative).
