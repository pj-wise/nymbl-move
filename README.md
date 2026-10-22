# Harbor & Pine: staffing flow prototype

Nymbl Senior Design Engineer challenge, **Option B: the staffing flow**. A Resource Manager picks an open role, compares candidates with plain-language reasons, previews the before/after impact on load and on other commitments, and assigns someone in memory. A Delivery Manager sees their own projects: which staffing requests are open or filled, who was assigned and when they start. Both workspaces share one staffing state, so a change in one shows up in the other immediately.

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

1. The **bell** in the header (4) lists staffing issues someone may need to act on: Lena Fischer at 130%, Hannah Kim on leave while still planned, Mei Tanaka with no skills recorded, and Fatima Noor's Inventory Sync assignment with no end date. Filter by staffing conflicts or data issues. Issues stay until the plan changes, not when read. Click one to jump to that person's candidate card on a relevant open role (Lena → R03, expanded and focused). Fatima has no open Data Engineer role, so hers has no link. Person-specific caveats appear on the candidate and in the preview only when they overlap the role, e.g. Jake's contract end on R05, Omar's requested PTO on R01. The rules behind the numbers aren't shown in the app; they're in `docs/BUSINESS_RULES.md`.
2. **R02, Senior Software Engineer (React/TS/A11y).**
   - Olivia Brooks is _Ready_: she rolls off Inventory Sync Nov 6 and the verdict is _Safe_.
   - Sam Rivera is free but "Accessibility not listed in profile".
   - Grace Liu is a strong match but booked.
   - Assign Olivia. The queue shows 1/5 filled and the success panel lists what changed.
3. **R03, Senior Product Designer.** Nobody is a clean fit.
   - Pick Daniel Okafor: peak **90% → 140%**, _Needs a decision_.
   - Turn on **Release Internal Allocations** in the role card: Daniel now counts as free (his card says Design System Refresh hours are counted as released), and his preview drops to 100% with the Design System Refresh "loses 16h/week" tradeoff. In the assign dialog you can still switch the release off for this one assignment.
   - Assign. The dialog requires an acknowledgement.
4. **R01** → Omar Haddad is _Safe_, with requested PTO Nov 30–Dec 4 marked "requested, not yet approved". Tick **Compare** on Omar and Aisha Bello (up to 4 people), then **Compare 2**: skills, coverage across the role's dates, workload after assigning and warnings line up side by side. **Preview Omar** continues into the normal preview.
5. **R04** → Sofia Marquez goes over 100% in confirmed work. If Enrollment Redesign is won she hits 200% (amber bars). Flip **Count tentative work** in the role card and she drops to "Booked".
6. **Why is someone (un)available?** In any preview, click a bar in the load chart, or open **Full breakdown** (top right of the preview) for the week-by-week view, commitments and fit side by side. Identical weeks are grouped into periods with colour-coded capacity bars; holiday and PTO weeks stand alone with amber chips. Try Grace Liu on R02, week of Nov 16: 2 training days leave 24h, Claims Dashboard already takes 24h, and the role adds 24h, so 200%. Daniel on R03 with internal work released shows the Design System Refresh hours struck through.
7. **Two workspaces, one state.** Open the account menu (top right, _Jordan Ellis_).
   - Switch the workspace to **Delivery Manager**: Jordan sees only Dispatch Portal and Claims Dashboard, the projects he's actually assigned to, both fully staffed. No Field Ops: it has no Delivery Manager yet (R04 is open).
   - Switch back to **Resource Manager**, open **R04**, pick Sofia Marquez and assign her.
   - Under **Demo sign-in**, choose **Sofia Marquez**. She only has Delivery Manager access, so she lands there. Field Ops now appears with R04 _Filled_ by Sofia, "Starts Nov 16 · Confirmed", 4 of 5 requests still open. Requested dates are labelled separately from the actual start.
   - Sign in as **Demo User** (mock Resource Manager, not in the dataset): Staffing only, with the same R04 assignment.
8. **Show demo fit data** (account menu, off by default) adds our synthetic client seniority and industry data, tagged DEMO DATA; rankings stay the same either way. **Reset demo** (in the account menu) restores the supplied data in every workspace. It keeps whoever is signed in.

The **Open roles** list has project-status tabs (All / Starting soon / Proposed), a search box (role, skill, project or client) and a priority filter. Assigned roles leave the list; they show as filled in the Delivery Manager view.

Keyboard only: the account menu opens with Enter and moves with ↑/↓. After a switch, focus lands on the new workspace's heading and the change is announced. In the staffing workspace: Tab to the role list, move with ↑/↓, open with Enter, Tab into candidates, ↑/↓ + Enter, then Tab to _Assign_. Esc closes the dialog or the preview, and focus returns to where you were.

## Where things are

```
data/source/                 supplied dataset, unchanged (JSON + CSV + README)
src/data/loadSource.ts       typed adapter over the JSON (snake_case → camelCase, enum checks)
src/data/enrichment.ts       SYNTHETIC client/person fit data, labelled "demo data" in the UI
src/data/demoUsers.ts        SYNTHETIC mock users and their app roles (demo sign-in)
src/auth/                    permissions model (app roles → permissions → workspaces) + session state
src/app/                     AppShell (shared header, owns the staffing store), AccountMenu, IssuesMenu (bell)
src/domain/                  pure, tested business rules
  dates.ts                   TODAY, inclusive weekday maths
  capacity.ts                daily/weekly load, time off, employment dates, >100% spans
  candidates.ts              skill/level/availability evaluation, tiers, reasons, ordering
  preview.ts                 before/after preview, issues, verdict, applyPreview
  attention.ts               "needs attention" bucket
  actuals.ts                 logged-vs-planned context
  projectStaffing.ts         Delivery Manager visibility, request open/filled, project team
  __tests__/                 Vitest
src/features/delivery/       Delivery Manager workspace: DeliveryWorkspace, ProjectStaffingCard
src/features/staffing/       Resource Manager workspace: StaffingWorkspace, RoleQueue, CandidatePanel, PreviewPanel, CommitDialog, LoadChart, WeekBreakdown
  useStaffingState.ts        reducer; commits are replayed over the source (undo/reset are exact)
src/components/              Tone (status vocabulary) + shadcn/ui primitives
docs/                        DESIGN_CONCEPT · PROBLEM_STATEMENT · DECISIONS · BUSINESS_RULES · AI_PROCESS_LOG
```

Good places for live edits:

- Tier rules and thresholds: `src/domain/candidates.ts` (`MAX_TOLERATED_AWAY_WEEKS`, `MIN_PARTIAL_COVERAGE`, `tierOf`).
- Issue severity: `collectIssues` in `src/domain/preview.ts`.
- Attention horizon: `src/domain/attention.ts`.
- Demo fit data: `src/data/enrichment.ts`.

## Not done (on purpose)

- No backend, auth or persistence. Commits live in memory, and the UI says so. "Demo sign-in" is a prototype switch, not authentication.
- No UI to create staffing requests. The permission for it is modelled (`requests:create`).
- No full Monday view, allocation editing, or cross-discipline candidates.
- No mobile.
- No component tests. Keyboard and focus were checked with a scripted headless-Chrome run, not a screen reader.

See `docs/DECISIONS.md` for every assumption and limitation.
