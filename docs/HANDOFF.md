# Handoff

This is the full context for picking the project up on another machine or in a new Claude Code
session.

**Start here:** read this file, then `README.md` (demo script), `docs/DECISIONS.md` (every assumption)
and `docs/BUSINESS_RULES.md` (the planning rules).

_Last updated: 2026-10-22. State as of commit `14398d5` ("alot. pretty hi-fi")._

---

## 1. What this is

This is the Nymbl Senior Design Engineer take-home, **Option B: the staffing flow**, for the fictional
firm **Harbor & Pine**. The original brief is embedded verbatim at the top of
`docs/AI_PROCESS_LOG.md`.

It's one app with **two workspaces** that share the same in-memory staffing state:

- **Resource Manager (RM).** Pick an open role, compare candidates, preview what the assignment does
  to their workload, and assign (local only, with undo/reset).
- **Delivery Manager (DM).** See the projects you're the DM on: which staffing requests are open or
  filled, who was assigned and when they start.

An account menu (top right) switches workspace, and a clearly labelled **demo sign-in** switches who
is logged in. A bell (top right, RM only) lists staffing issues that need action.

### Hard rules from the brief (still in force)

- **Stack:** React 19 + TypeScript + Vite, Tailwind v4, shadcn/ui (Nova preset, Radix via the
  `radix-ui` package), Lucide, Vitest.
- **Not allowed:** no backend, no Next.js, no state library (one `useReducer` store).
- **"Today" is fixed** at **Mon 2026-11-02** (`TODAY` in `src/domain/dates.ts`). The system clock
  is never read.
- **Supplied data is never edited.** It lives in `data/source/`. Synthetic additions live only in
  `src/data/enrichment.ts` (client-fit data) and `src/data/demoUsers.ts` (mock users and
  permissions), and are tagged **DEMO DATA** wherever they appear.
- **Calculations are pure functions** in `src/domain/`, with tests. Matching is explained with
  tiers and plain-language reasons, never a hidden score.
- **Keyboard access and focus handling** are deliverables, not polish.
- **`AI_PROCESS_LOG.md` must stay honest.** Never fabricate. Leave the ✍️ placeholders for PJ.

---

## 2. Current status

| Check | State |
|---|---|
| `npm test` | **99 tests pass** (9 files in `src/domain/__tests__/`) |
| `npx tsc -b` / `npm run typecheck` | **1 error:** `src/app/AppShell.tsx` imports `FlaskConical` but doesn't use it. PJ commented out the "Prototype: changes stay in this tab" pill (and "(demo date)"). Either delete `FlaskConical` from the import on line 1 or restore the pill. |
| `npm run build` | **Fails for the same reason** (the build runs `tsc -b` first). Fix the import and it builds; the last good build warned that the bundle was just over 500 kB, which is harmless. |
| `npm run lint` | Clean apart from the expected `react(only-export-components)` fast-refresh warnings and the same unused import. |
| Git | Clean working tree. All work is in `14398d5`. Nothing pushed by Claude. |

**Formatting is mixed.** PJ's editor formats on save: some files use double quotes and semicolons,
others single quotes and none. Match whichever style the file you're editing already uses. Don't
reformat whole files.

---

## 3. Setup

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
npm test           # Vitest
npm run typecheck  # tsc -b
npm run build
npm run lint       # oxlint
```

- Node 20+ is required (built on Node 25).
- If a local browser can't reach the dev server, start it with `npx vite --host 127.0.0.1`. On
  some machines Vite binds to IPv6 only.
- When Claude Code runs the dev server in the background it's stopped after the 2-hour limit.
  Restart it if `127.0.0.1:5173` stops answering.
- After `npm install` on PJ's Mac, `package-lock.json` lost 78 lines. That was never reviewed, and
  the change is now committed.

---

## 4. Product tour (what's on screen)

### Header (always)

From left to right:
- "Harbor & Pine / Staffing"
- The demo date
- **Bell:** staffing issues, RM workspace only
- **Account menu**

### Account menu (`src/app/AccountMenu.tsx`)

- **Header:** user name and job title (from `people`).
- **Workspace:** a radio group listing only the workspaces the user is permitted.
- **Demo sign-in** (tagged DEMO DATA, "not real authentication"):
  - Jordan Ellis (RM + DM)
  - Sofia Marquez (DM only)
  - Demo User (RM only, mock person, not in the dataset)
- **Show demo fit data** (RM workspace only, **off by default**). It adds the synthetic
  client-seniority and industry data everywhere; rankings are unchanged.
- **Reset demo** (disabled when there's nothing to reset). It clears commits and keeps the user,
  workspace and demo-data setting.
- **Focus after a switch:** goes to the new workspace's heading, and the switch is announced in the
  live region.

### Bell / staffing issues (`src/app/IssuesMenu.tsx`)

- The badge count, plus a popover with the filters **All / Staffing conflicts / Data issues**.
- **Issues are derived from the plan on every render:** there's no read or dismiss state, so they
  disappear only when the problem is fixed.
- **Kinds:**
  - Over 100%
  - Over 100% if won (only with Factor Proposed Projects on; shown dashed)
  - Coverage gap (long leave while planned)
  - Missing data (no skills; no end date)
  - Outside employment dates (work planned before a start date or after a contract end)
- **Clicking an issue** opens a relevant open role and **reveals** that person's candidate card:
  scrolled into view, expanded and focused. `issueTarget` in `attention.ts` chooses the role:
  1. The role the person was assigned to this session.
  2. The selected role, if it's their discipline.
  3. The first open role for their discipline (Must fill first).
  4. Otherwise no link: Fatima Noor is a Data Engineer and there's no Data Engineer role.
- **Keyboard:** Esc closes the popover and focus returns to the bell.

### Resource Manager workspace (`src/features/staffing/`)

Three fixed-height columns (about 24 / 48 / 28%), each sticky under the header.

**1. Open roles** (`RoleQueue.tsx`)
- Header: "Open roles" with a subtle "N open" count, or "N of M" while filtering.
- **Project-status tabs** (All / Starting soon / Proposed), generated from the statuses of projects
  that have requests.
- **Search** (role, skill, project or client; every word must match) and a **priority** filter
  (native select with a custom caret).
- **Only open requests are listed.** An assigned role leaves the list, but it stays in shared state
  and shows as filled in the DM view.
- Roles are grouped by project, showing "x/y filled" for the whole project and a project status
  badge.
- Proposed projects get dashed amber cards.
- Arrow keys move between roles.

**2. Role card + candidates** (`CandidatePanel.tsx`)

*The role card* (fixed at the top of the column):
- An ID line, then the title.
- Under the title: the **project status badge** and a readiness line ("1 person is ready to
  propose" / "Nobody is a clean fit" / "Filled by …").
- Two toggles at the top right:
  - **Factor Proposed Projects:** counts tentative work as load.
  - **Remove Internal Allocations:** evaluates everyone as if internal work were released. In code
    this is still called "release internal". PJ relabelled the UI.
- Details as two label/value pairs per row: Needs · Dates, then Project · Notes. Client fit takes
  a full row and only appears when demo data is on.

*The candidate list* (the only part of this column that scrolls):
- Tier groups: **Ready to propose / Possible, with a tradeoff / Booked or weak fit**. The last is
  collapsed by default but opens if it holds the selected or revealed person.
- **Compact cards:**
  - Name, level and capacity
  - Skills x/y
  - Free now %
  - Headline with a week strip
  - The top reason plus "+N more"
  - A **Compare** checkbox
  - An **expand** chevron, which shows Concerns and Strengths
- Only the focused card's checkbox and chevron are Tab stops.
- A **compare bar** sticks to the bottom: Clear and **Compare N** (2–4 people).

**3. Assignment preview** (`PreviewPanel.tsx`, compact)
- Person → project.
- Verdict box (**Safe to assign / Needs a decision / Blocked**), with blocker and decision warnings
  inline.
- A note when the numbers assume internal work is released.
- Peak utilization before → after, an over-capacity count and a compact load chart.
- A link to the full breakdown.
- The **Assign** button at the bottom.
- **Esc** clears the selected candidate.

**Full breakdown drawer** (`PreviewDrawer.tsx`, about 74% width)
- **Left column:** big chart and an always-open **week by week** view. Periods group identical
  weeks. Each period shows four aligned columns (Capacity / Committed / Proposed / Free) and expands
  to a right-aligned calculation table.
- **Right column:**
  - Things to check (all warnings, by severity)
  - Commitments (three-column table: Project / Allocation / Dates and status)
  - "Why X is on the list": Strengths, plus "Also consider", which leaves out anything a warning
    already says
- The header and footer (Close + Assign) are fixed.
- **Esc closes only the drawer.** Focus returns to whatever opened it.
- **Chart bars:** clicking one opens the drawer on that week, with focus on it.

**Assign dialog** (`CommitDialog.tsx`)
- Has the per-assignment **"Release internal allocation"** switch. It starts from the role toggle,
  and flipping it updates the verdict live and resets the acknowledgement.
- **Needs a decision** requires ticking "I've reviewed these issues".
- **Going over 100%** also requires a written reason.
- **Blocked** can't be assigned.
- **After assigning:** the panel shows "Assigned in this session" with What changed, Decisions you
  accepted, the Note, **Undo** and **Next open Must fill role**.

**Compare drawer** (`CompareDrawer.tsx`)
- 2–4 candidates in aligned rows. The drawer width is 74%, 88% or 96% depending on the count, and
  the table scrolls sideways only if the window is too narrow.
- **Rows:**
  - Skills
  - Seniority
  - Coverage of the role's dates (week strip)
  - Free capacity
  - Workload after assigning
  - Verdict and warnings
  - Time off
  - Current commitments
  - Start / roll-off / contract
  - Client fit (DEMO DATA, only when on)
- **"Best here" / "Tied best"** appear only where better is unambiguous. There's no overall winner.
- **Each column header** has **Preview X** (continues into the normal preview) and **Remove**.
  Removing down to one closes the drawer and focuses that person's card.
- **Cleared** when the role changes.

### Delivery Manager workspace (`src/features/delivery/`)

- **"Your projects"** shows only projects where the signed-in person has a current, non-zero
  **Delivery Manager assignment**. Field Ops has none, because R04 (its DM role) is open.
- **Each project card** shows:
  - Status badge, client and dates
  - "You: Delivery Manager, 50%" (marked tentative if relevant)
  - A **Fully staffed** or **N of M requests open** pill
- **Staffing requests table** (Role / Needed from / Status / Assigned):
  - "Needed from" is the requested date.
  - The assigned start is read from the **assignment record** and labelled Confirmed or Tentative.
- A collapsed **Team on this project** list.
- An empty state for DMs with no projects. None of the demo users hits it, but a test covers it.
- **Demo flow:** as Jordan, Delivery shows Dispatch Portal and Claims Dashboard only. Assign Sofia to
  R04 in Staffing, then sign in as Sofia: Field Ops appears with R04 filled, "Starts Nov 16 ·
  Confirmed".

---

## 5. Architecture

```
App
└─ AppShell (src/app)              owns useStaffingState() + useSession()
   ├─ header: date · IssuesMenu (RM) · AccountMenu
   ├─ one scroll area: StaffingWorkspace | DeliveryWorkspace | "no access"
   └─ aria-live region (state.announcement)
```

### Staffing store (`src/features/staffing/useStaffingState.ts`)

A single `useReducer` holds both data and UI state:

- **Data:**
  - `commits[]`: change records replayed over the untouched source (`replayCommits`), so undo and
    reset are exact.
- **Selection:**
  - `selectedRoleId`, `selectedPersonId`.
- **Scenario toggles:**
  - `scenario` (`confirmed` | `withTentative`).
  - `releaseInternalAll`: the role-card toggle.
  - `releaseInternal`: the per-preview choice, starting from `releaseInternalAll`.
- **Other UI:**
  - `showDemoData` (default `false`; survives reset).
  - `reveal`, from the issues menu.
  - `compareIds` (max `MAX_COMPARE` = 4; cleared on role change and reset).
  - `announcement`.
- **Derived values:**
  - `ctx` (`buildPlanContext`) and `candidateCtx` (the plan without this role's own commit).
  - `candidates` (`candidatesForRole`), `preview` (`previewAssignment`) and `comparison`.
  - `attention`, `commitsByRole`, `filledBy`, and `enrichment` (real or `NO_ENRICHMENT`).

### Session (`src/auth/useSession.ts`)

- A separate small reducer holding `{ userId, workspace }`.
- Switching user or workspace **never touches staffing data**.
- **`permissions.ts`** keeps job title (`person.role`), app roles and project membership separate:
  - App roles: `resource-manager` → `staffing:assign`, `requests:create`; `delivery-manager` →
    `projects:view-assigned`.
  - Workspaces are gated by permission.
  - `requests:create` is modelled but has no UI.

### One source for every number

- The compact preview, the drawer and the comparison all render from the same `StaffingPreview`
  and `CandidateEvaluation`.
- Shared UI pieces are in `PreviewParts.tsx`.
- The internal-release rule is defined once in `capacity.ts` (`isReleasableFor`,
  `releasedVersion`, `releaseInternalForRole`). Both `previewAssignment` and
  `candidatesForRole({ releaseInternal })` use it.

---

## 6. File map

| Area | Files |
|---|---|
| Supplied data | `data/source/` (JSON + CSV + README). **Never edit.** |
| Source adapter | `src/data/loadSource.ts` (snake_case → camelCase, enum checks) |
| Synthetic data | `src/data/enrichment.ts` (client fit, industry; `NO_ENRICHMENT`), `src/data/demoUsers.ts` |
| Permissions / session | `src/auth/permissions.ts`, `src/auth/useSession.ts` |
| Shell + header menus | `src/app/AppShell.tsx`, `AccountMenu.tsx`, `IssuesMenu.tsx` |
| Dates, capacity, release rule | `src/domain/dates.ts`, `src/domain/capacity.ts` |
| Matching (tiers, reasons, order) | `src/domain/candidates.ts` |
| Preview maths, issues, verdict | `src/domain/preview.ts` |
| Week grouping | `src/domain/weekGroups.ts` |
| Staffing issues | `src/domain/attention.ts` (`attentionItems`, `ISSUE_CATEGORY`, `issueTarget`) |
| Comparison rows | `src/domain/comparison.ts` (`comparisonRows`, `MAX_COMPARE`) |
| DM visibility / requests | `src/domain/projectStaffing.ts` |
| Actuals context | `src/domain/actuals.ts` |
| Tests | `src/domain/__tests__/` (capacity, staffing, weekGroups, projectStaffing, contextualWarnings, issues, demoData, comparison, releaseInternal) |
| RM UI | `src/features/staffing/` (`StaffingWorkspace` incl. the two role-card toggles, `RoleQueue`, `CandidatePanel`, `PreviewPanel`, `PreviewDrawer`, `PreviewParts`, `CompareDrawer`, `CommitDialog`, `LoadChart`, `WeekBreakdown`, `WeekStrip`, `useStaffingState`) |
| DM UI | `src/features/delivery/` (`DeliveryWorkspace`, `ProjectStaffingCard`) |
| Shared components | `src/components/Tone.tsx` (tones, `Pill`, `ToneText`, `DemoDataTag`), `ProjectStatusBadge.tsx`, `ui/` (shadcn: button, checkbox, dialog, dropdown-menu, label, popover, sheet, switch, textarea) |
| Focus helpers | `src/lib/useRovingFocus.ts`, `src/lib/useDeferredFocus.ts` |
| Docs | `docs/DESIGN_CONCEPT.md`, `PROBLEM_STATEMENT.md`, `DECISIONS.md`, `BUSINESS_RULES.md`, `AI_PROCESS_LOG.md`, this file |

---

## 7. Domain rules (summary; full detail in DECISIONS.md and BUSINESS_RULES.md)

- **Dates:** inclusive, with Mon–Fri working days. Daily capacity = weekly capacity ÷ 5.
- **Allocations are prorated** to the days someone works. 100% in a week with 2 days off is
  3 × 8h = 24h.
- **0% assignments** (A042) are kept as records but never counted.
- **A missing end date** (A038) falls back to the project end and is flagged "end date assumed".
- **Requested PTO counts as time off.** The UI says "requested, not yet approved".
- **Tentative work** is excluded unless Factor Proposed Projects is on. It's always available as
  an "if won" note.
- **Internal work** (PRJ-08, Design System Refresh) is real load. It can be released for a role:
  the record ends the day before the role starts, and the lost hours are listed as a decision.
- **Over 100%** is allowed, but needs an acknowledgement plus a written reason. **Blocked** only
  when the person isn't employed at all during the role.
- **Tiers:**
  - **Ready:** free, all skills listed, level at or above the ask, no contract gap.
  - **Unlikely:** booked, not employed, or no required skill listed.
  - **Tradeoff:** everything else.
- Client-fit demo data never affects tiers or ordering.

### Capacity wording (agreed; use exactly)

- **Capacity:** hours they can work that week after holidays and time off.
- **Committed:** existing confirmed work.
- **Proposed:** this role.
- **Free** = max(0, capacity − committed − proposed). It's never negative; the excess shows as
  "Xh over capacity".
- **Utilization** = (committed + proposed) ÷ capacity.
- A week with no working capacity is **Away**. If work is still planned in it, it's a
  **Conflict**. Company holidays are excluded from that.
- **Don't use the word "available".** Users read it as "free to take more work".

---

## 8. PJ's decisions: keep these, don't redo them

1. **Rules stay out of the UI.**
   - The Planning Assumptions section was **removed** from the UI. The rules live in
     `docs/BUSINESS_RULES.md`.
   - The UI shows no "agreed in discovery call" / "our assumption" labels, no assignment or
     time-off record IDs, and no calculation explanations. Role IDs like R04 are fine.
2. **Uncertainty is still shown where it affects a decision.** That means inferred end dates,
   requested PTO, missing skills, tentative work and DEMO DATA tags.
3. **No "Needs attention" strip.** Issues live in the bell. The old data-notes toggle and strip
   are gone.
4. **The Open roles panel lists only open roles.** The Open / Filled / All tabs were tried and
   **removed**. Tabs are by **project status** instead.
5. **The middle column is fixed-height:** the role card is fixed and only the candidate list
   scrolls. The column uses `overflow-clip`, not `overflow-hidden`, so `scrollIntoView` scrolls the
   list, not the column.
6. **Role card layout:**
   - The project status badge sits **under** the title.
   - The two toggles sit at the top right.
   - Details are two label/value pairs per row.
   - Notes have their own label.
7. **The per-person internal release switch** lives in the **assign dialog**, not the preview.
8. **Demo fit data is off by default.**
9. **Comparison:**
   - Up to 4 people.
   - No automatic winner.
   - It reuses the same matching and preview calculations.
   - Choosing someone continues into the normal preview; there's no separate assignment flow.
10. **Users vs titles vs projects:** job title, app permissions and project membership are separate.
    A DM sees a project only through a DM assignment, never because of their title. Jordan isn't
    given Field Ops.
11. **Separate menus:** the bell is separate from the account menu.
12. **Delivery Manager view:** keep it simple. No analytics, messaging or editing.
13. **PJ's own edits in code:**
    - Toggle labels "Factor Proposed Projects" and "Remove Internal Allocations".
    - Preview switch label "Release internal allocation".
    - Demo user renamed to "Demo User".
    - Prototype pill commented out.

---

## 9. History (condensed)

1. Built the flow and docs from the plan. Then: contrast pass, expandable week-by-week breakdown,
   rebuilt chart (stacked bars, 100% line, over-capacity stripes), terminology pass (found and
   fixed: fully-away weeks hid planned work, now a conflict).
2. Project status badge (`ProjectStatusBadge.tsx`). Proposed projects are dashed amber with the
   win chance.
3. **Two workspaces:**
   - Permissions model, demo sign-in, and the DM workspace.
   - Fix: root `relative` so `sr-only` elements don't make the page scroll.
4. **Data-notes cleanup:**
   - Needs attention became actionable-only, plus the employment-dates check.
   - A Planning Assumptions section was added, then removed, and moved to `BUSINESS_RULES.md`.
   - Copy changed to "requested, not yet approved", and record IDs were removed.
5. **Layout:**
   - Bell issues menu with reveal-on-click.
   - 25 / 50 / 25 grid.
   - Compact expandable candidate cards.
   - Tentative toggle moved into the role card; Reset moved into the account menu.
   - Demo-data toggle added, now off by default.
6. **Open roles:** search and priority filter, then project-status tabs.
7. **Preview:** compact panel plus full-breakdown drawer; week-by-week realigned.
8. **Compare:** 2, then up to 4 candidates.
9. **Role card compaction**, plus the internal-release toggle. The release rule moved to
   `capacity.ts`. The commitments table in the drawer was refitted to 3 columns, and the fake
   "Rolls off Design System Refresh" reason is dropped when released.

Sessions 1–4 are logged in `docs/AI_PROCESS_LOG.md`. **Everything after that (items 2–9 above)
isn't logged there yet.**

---

## 10. Open judgement calls (flagged to PJ, not decided)

- **Olivia Brooks's Thanksgiving week** is a **conflict** in the week view, but her verdict stays
  **Safe** (verdict rules unchanged on purpose).
- **Company holidays** are excluded from "planned on days off".
- **A week that's over capacity and also has time off** is red but keeps its amber time-off chip.
- **If-won roles** count in the preview chart (treated as confirmed for the maths), with "Only if
  the project is won."
- **The preview ignores Factor Proposed Projects.** With it on, the compact preview still says
  "Confirmed work only. If proposed project is won, peak rises to …". Is that intended, or should
  the preview follow the toggle? Not investigated.
- **Shared RM UI state:** the selected role, candidate and compare picks aren't per user. They
  carry over when switching demo users.
- **The empty DM state** isn't reachable with the demo users. Give "Demo User" the DM role in
  `demoUsers.ts` to see it.

---

## 11. Still for PJ to do

- **Fix the build:** remove `FlaskConical` from `src/app/AppShell.tsx`, or restore the pill.
- **Fill the ✍️ placeholders** in `docs/AI_PROCESS_LOG.md`, and log the sessions after session 4.
- **Hand-check what automation couldn't:** screen-reader announcements, colour contrast and focus
  visibility.
- **Decide the judgement calls** above.
- **Optionally review the docs.** They describe the toggle as "Release Internal Allocations" while
  the UI now says "Remove Internal Allocations". Update the docs or the label so they match.

---

## 12. Verification checklist (re-run after changes)

These were checked in Chrome via the Claude-in-Chrome extension. There are no browser test scripts
in the repo. Domain logic is covered by Vitest.

- **R02 → Olivia Brooks** is Ready / Safe. Grace Liu's 28 weeks collapse into 7 periods in the week
  by week view.
- **R03 → Daniel Okafor** needs a decision (90% → 140%).
  - Turn on **Remove Internal Allocations**: Daniel shows as free, his card notes the release, and
    the preview shows 100% with the Design System Refresh tradeoff.
  - In the assign dialog, switching the release off brings back "over 100%" and the required
    reason.
- **R01 → Omar Haddad** is Safe, with "Vacation Nov 30–Dec 4 (requested, not yet approved)".
  - Compare Omar and Aisha: Omar is best on skills and coverage. Aisha's numbers match her own
    preview (100% → 200%).
- **R04 → Sofia Marquez** goes over 100%. With **Factor Proposed Projects** on, the bell goes from
  4 to 5 with her "if won" item.
- **Bell:**
  - Lena → R03 with her card revealed, and the role card stays in view.
  - Fatima has no link.
  - Esc returns focus to the bell.
- **Two workspaces:**
  - As Jordan, Delivery shows only Dispatch Portal and Claims Dashboard.
  - Assign Sofia to R04, then sign in as Sofia: Field Ops appears, R04 is filled, "Starts Nov 16 ·
    Confirmed".
  - Reset demo clears the commit everywhere and keeps the user.
- **Keyboard:**
  - Roles: ↑ / ↓ and Enter.
  - Candidates: ↑ / ↓, then Tab to Compare and the chevron.
  - Menus open with Enter and close with Esc.
  - Drawers focus their title on open, Esc closes only the drawer, and focus returns to the opener.
