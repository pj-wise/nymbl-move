# Decision log

Three kinds of decisions are kept apart on purpose:

- **Call-confirmed:** told to us in the discovery call.
- **Implementation assumptions:** our own calls, where the brief or data was silent.
- **Synthetic data:** values we invented.

## 1. Confirmed in the discovery call

| Decision | Where it shows up |
|---|---|
| Requested PTO is treated as approved for planning. | `awayOn` counts all time off. The UI keeps the source status: "requested, counted as approved". |
| Anyone over 100% goes in a clear warning bucket. | `attentionItems` → red "Over 100%" issues in the header issues menu (bell), by name, with projects and dates. |
| Real staffing weighs seniority, client working style, industry experience and tech stack. | Separate reasons per factor. Style and industry come from synthetic enrichment (see 3). |
| A demanding client may need a senior; an easygoing one could take a junior. The CEO didn't name the category. | Our own labels: `senior-led` and `coaching-friendly`, marked as our wording in `src/data/enrichment.ts`. |
| We may extend the dataset, clearly marked. | `src/data/enrichment.ts` is separate. The source JSON is copied unchanged into `data/source/`. |
| No handoff buffer between assignments. | Olivia Brooks is free from Nov 9 (Inventory Sync ends Fri Nov 6). Omar Haddad is free from Nov 16. |

## 2. Implementation assumptions

| Area | Assumption | Why |
|---|---|---|
| Today | `TODAY = 2026-11-02` constant (`src/domain/dates.ts`). The system clock is never read. | Brief. |
| Intervals | Start and end dates are **inclusive**. Weeks run Mon–Fri. | README says weeks run Mon–Fri; inclusive is the natural reading of "end_date". |
| Daily capacity | `weekly_capacity_hours / 5`, so Chris 4.8h/day and Jake 6.4h/day. Holidays and time off remove that person's daily hours, not a flat 8h. | There's no per-weekday schedule. A pro-rated day is the least-wrong default. |
| Allocation % | A share of the person's own capacity on each day the assignment is active. | README. |
| 0% assignments | Kept as records (shown as a data note), never counted. | A042 is stale history. |
| Missing end date | A038 falls back to the **project end** (Nov 13), flagged `endAssumed` and shown as "end date assumed". The source stays `null`. | Most plausible. PRJ-04 is wrapping up with a final handoff on Nov 13. |
| Employment | No capacity before `start_date` or after `contract_end_date`. | Zoe Adams, Jake Morrison. |
| Internal work | PRJ-08 counts as real load by default. **Release Internal Allocations** (role card, off by default, works like Factor Proposed Projects) evaluates and compares everyone as if their internal work were released, and starts each preview released; affected candidates say so on their card. The per-assignment switch is in the assign dialog, starting from the role toggle; changing it updates the verdict before confirming. One rule everywhere (`isReleasableFor` / `releasedVersion` in `capacity.ts`): the released record ends the day before the role starts (not deleted), and the internal project's lost hours are listed as a decision. | README says people can be pulled off. The brief says don't make it disappear. |
| Tentative work | Excluded from load by default. Always computed as a "would reach X% if won" note. A toggle in the selected role card ranks under the won-scenario. Staffing a Proposed project creates a Tentative assignment. | See PROBLEM_STATEMENT.md. |
| Logged hours | Shown as context ("logged 48h/wk vs 40h planned"), never used as planned load. Fewer logged weeks means missing timesheets, not zero hours. | Actuals ≠ plan. |
| Candidate pool | Same discipline as the role (`person.role === role.roleNeeded`). | Keeps comparisons meaningful. Cross-discipline staffing is a later feature. |
| Week fit | A week *fits* if free hours ≥ role hours on the person's available days. *Away* means no available days because of time off. *Not employed* means before start or after contract end. | Week granularity matches how people talk about staffing. |
| Availability buckets | *Free*: no short weeks and at most 2 weeks away. *Free if released*: same, counting internal hours as releasable. *Partial*: at least 50% of weeks fit. Otherwise *booked*. Constants are in `candidates.ts`. | Tunable thresholds, picked so a vacation is a caveat and an 11-week leave isn't "free". |
| Tiers | **Ready**: free, all required skills listed, level ≥ requested, no contract gap. **Unlikely**: booked, not employed, or no required skill listed. Everything else is **Tradeoff**. | Explainable rules, no weights. |
| Ordering | Tier → (availability, then skills) for usable tiers; (skills, then availability) for booked → avg free % → name. | Deterministic. Strong-but-booked people float to the top of their group. |
| Long absence | Time off of 10+ workdays while still planned triggers a "Coverage gap" warning (Hannah Kim). In a preview, more than 5 workdays of time off inside the role is a *decision*; shorter is *worth knowing*. | Separates vacations from coverage problems. |
| Where data issues show | Three kinds, kept apart. **Staffing issues** (bell in the header, Resource Manager only): problems in the plan someone may need to act on (over 100%, coverage gaps, missing skills or end dates, work planned before a start date or after a contract end). Filterable into staffing conflicts and data issues. Not notifications: derived from the plan on every render, so an issue stays until the problem is fixed, and there is no read/dismiss state. **Employee warnings**: on the candidate card and in the preview, only when they overlap the role's dates (Jake's contract end, requested PTO marked "requested, not yet approved", an inferred end date). The general rules behind the numbers are not shown in the UI at all; they're in [`BUSINESS_RULES.md`](BUSINESS_RULES.md) with where each one surfaces. No record IDs, rule-source labels or calculation explanations in the UI. | Information shows where it affects a decision. The app should read as a product that knows its rules, not as our build notes. |
| Issue links | Clicking an issue opens an open role where the person is a candidate and reveals their card (scrolled into view, expanded, focused). Order: a role they were assigned to this session (so it can be undone), else the selected role if it's their discipline, else the first open role for their discipline (Must fill first, then soonest start). No matching role (e.g. Data Engineers) → no link, and the issue says so. | There's no person page or allocation editing; their card on a relevant role shows their load and why they're booked. `issueTarget` in `attention.ts`. |
| Comparing candidates | Up to 4 people per role (`MAX_COMPARE`), side by side in a drawer that widens with each column (74% / 88% / 96% of the window) and scrolls sideways only if the window is too narrow. Each side is the candidate's existing evaluation plus `previewAssignment` with current commitments (internal work not released), the same call the preview makes, so numbers always match it. Rows are aligned (`comparisonRows` in `domain/comparison.ts`). "Best here" (or "Tied best") is shown only where better is unambiguous (more skills listed, more weeks covered, more free capacity, lighter workload, fewer things to decide) and never on seniority, time off, commitments, timing or demo data. No overall winner. Cleared when the role changes. | Helps an informed choice without switching back and forth; the Resource Manager still decides. |
| Overallocation | Measured on planned %, per weekday, over the next 12 weeks for the issues menu. Spans bridge holidays and time off. | The plan is overcommitted even on a day the person is away. |
| Capacity terms (chart + week by week) | **Working capacity** = working days after holidays and time off × (weekly capacity ÷ 5). **Committed** = existing confirmed work. **Proposed** = this role. **Free** = max(0, capacity − committed − proposed). **Over capacity** = max(0, committed + proposed − capacity), shown separately so free hours are never negative. **Utilization** = (committed + proposed) ÷ capacity. Weeks with no working capacity show **Away**, never 0% or 100%. Tentative work is shown separately ("only if won") and isn't in the totals. | "Available" read as "free to take more work". These terms say what each number is. |
| Proration | One rule everywhere: an allocation applies to the days the person works. 100% in a week with 2 days off = 3 days × 8h = 24h. The detail view shows it per project ("100% × 3 working days × 8h"). | The data has no daily schedule. Prorating keeps a short week from looking over- or under-booked. It's stated in the UI, not hidden. |
| Work planned on days off | Reported separately as hours the plan has on time-off days (and days before start or after contract end), using the same allocation × daily hours. Company holidays are excluded because the whole firm is off. A week with **no working capacity but planned work** is a **coverage conflict** (amber, labelled "Conflict: 24h planned while away"). In partial weeks, the hours are noted in the detail but not counted in utilization, per the proration rule. | Stops a long leave from looking like a quiet, "available" week (Hannah Kim). It doesn't change any underlying number. |
| Week grouping | Consecutive weeks merge only if available, committed, new, tentative and released hours *and* the per-project hours are identical, and there are no days off. Weeks with a holiday or time off never merge. The exception is consecutive fully-away weeks from the same time-off record. Over 100% takes precedence over "reduced availability" for a week's colour, but its time-off chip still shows. | Removes repetition without hiding a difference. Same utilisation with different projects stays separate (covered by a test). |
| Previewing an If-won role | The move being previewed counts in the chart and table even though it will be recorded as tentative. Any over-100% warning then adds "Only if the project is won." | The question on screen is "what happens if I do this?". Hiding the role's own hours made the chart contradict itself. |
| Commit | In-memory only. Commits are a list of changes replayed over the untouched source, so undo and reset are exact. No server and no messages. | Brief: no backend. |
| Over 100% | Allowed, but requires acknowledgement **and** a written reason. Blocked only when the person isn't employed at all during the role. | Over-allocation is sometimes the right short-term call. Make it deliberate, not impossible. |

## 2b. Users, permissions and project visibility

| Area | Decision | Why |
|---|---|---|
| Three separate things | **Job title** is `person.role` from the supplied data. **App permissions** come from app roles on a user (`src/auth/permissions.ts`). **Project membership** comes only from assignments. None is derived from another. | A Delivery Manager by title doesn't automatically see every project, and permissions can change without touching staffing data. |
| App roles → permissions | Resource Manager: `staffing:assign`, `requests:create`. Delivery Manager: `projects:view-assigned`. Workspaces are gated by one permission each. | Real auth would supply the roles; everything else reads permissions, not role names. |
| Delivery Manager visibility | A DM sees a project when they hold a current, non-zero assignment on it with `role_on_project = Delivery Manager` (supplied or committed this session). Ended and 0% assignments (A042) don't count. Tentative ones show, marked "only if won". | Visibility follows real staffing. Field Ops has no DM in the data (R04 is open), so nobody sees it until R04 is filled; whoever fills it sees it immediately. |
| Requests before a DM exists | Creating staffing requests is a separate permission (`requests:create`), held by Resource Managers and later a project-admin role. Modelled only; there is no UI to create requests. | A project can get its first requests before it has a DM, and the DM takes over once assigned. |
| Request status | Only **Open** or **Filled**. Filled means an assignment was committed for the role in this session. No approval or pending states. | That's all the data and the flow support. |
| Requested vs actual start | The request's start date is shown as "Needed from … (requested)". The assignee's start is read from the assignment record ("Starts Nov 16 · Confirmed"). In this prototype a new assignment starts on the requested date, but the two are separate fields so they can diverge later. | A need-by date is not a confirmed start. |
| Demo sign-in | The account menu has a labelled demo section to switch the signed-in user. It changes only who is signed in and which workspaces they may use; staffing state is shared and untouched. Workspace UI state (selected role, etc.) is not per user. | A way to test different users without building auth. Not authentication. |

## 3. Synthetic (added) data

All of it lives in `src/data/enrichment.ts`, and every UI use carries a `DEMO DATA` tag. **Show demo fit data** in the account menu (staffing workspace) controls it and is **off by default**, so the app opens on supplied data only. When off, matching then runs with an empty enrichment set, so the client-fit row, seniority-expectation and industry reasons disappear. Tiers and ordering never use it, so they don't change (covered by `demoData.test.ts`). The setting survives Reset demo.

| Field | Values | Notes |
|---|---|---|
| Client industry | Northstar: Energy & utilities. Cedar Health: Healthcare. Pinecrest: Education. Brightwater: Logistics. Summit: Financial services. Ironline: Manufacturing. Lakeshore: Real estate. | Inferred from client names only. |
| Client working style | Northstar and Cedar are *senior-led* (suggested min. level Senior). Pinecrest is *coaching-friendly*. The rest are *standard*. | Cedar's "strict accessibility requirements" is real source data. The style label is ours. |
| Demo users (`src/data/demoUsers.ts`) | Jordan Ellis (P04): Resource Manager + Delivery Manager, granted both for testing. Sofia Marquez (P05): Delivery Manager. Morgan Reyes: invented Resource Manager, not in the dataset (the practice has no Resource Manager). | Permissions only. No assignments are added or changed. |
| Person industry experience | P07, P08, P09, P12, P13, P17, P20, P21 have 1–2 industries each. Everyone else is "not recorded". | Deliberately sparse, so "unknown" stays common and visible. |

## 4. Known limitations

- Candidates are evaluated one role at a time. There's no "if Olivia takes R02, who takes R06?" optimisation, though the lists do update after each commit.
- Partial-allocation suggestions (e.g. "Hannah could do Feb–May") are shown as coverage, not offered as split assignments.
- The skills match is exact string match (case-insensitive). "HTML/CSS" doesn't match "CSS".
- The issues menu has a fixed 12-week horizon. Issue links can only open candidate cards on open roles; there's no person page.
- Desktop only: min width 1200px.
- Keyboard and focus behaviour was checked with a scripted headless Chrome run (see AI_PROCESS_LOG.md). No screen-reader testing has been done yet.

## 5. Cut for time

- The Monday view as a full surface.
- A person detail drawer.
- Editing existing allocations.
- Drag-to-adjust allocation %.
- URL state / deep links.
- Dark mode.
- Component tests (Testing Library).
- Persistence.
