# Decision log

Three kinds of decisions are kept apart on purpose:

- **Call-confirmed:** told to us in the discovery call.
- **Implementation assumptions:** our own calls, where the brief or data was silent.
- **Synthetic data:** values we invented.

## 1. Confirmed in the discovery call

| Decision | Where it shows up |
|---|---|
| Requested PTO is treated as approved for planning. | `awayOn` counts all time off. The UI keeps the source status: "requested, counted as approved". |
| Anyone over 100% goes in a clear warning bucket. | `attentionItems` → red "Over 100%" cards in the attention strip, by name, with projects and dates. |
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
| Internal work | PRJ-08 counts as real load. A preview can *release* it from the role's start date. The released record is ended the day before the role starts (not deleted), and the internal project's lost hours are listed as a decision. | README says people can be pulled off. The brief says don't make it disappear. |
| Tentative work | Excluded from load by default. Always computed as a "would reach X% if won" note. Header toggle to rank under the won-scenario. Staffing a Proposed project creates a Tentative assignment. | See PROBLEM_STATEMENT.md. |
| Logged hours | Shown as context ("logged 48h/wk vs 40h planned"), never used as planned load. Fewer logged weeks means missing timesheets, not zero hours. | Actuals ≠ plan. |
| Candidate pool | Same discipline as the role (`person.role === role.roleNeeded`). | Keeps comparisons meaningful. Cross-discipline staffing is a later feature. |
| Week fit | A week *fits* if free hours ≥ role hours on the person's available days. *Away* means no available days because of time off. *Not employed* means before start or after contract end. | Week granularity matches how people talk about staffing. |
| Availability buckets | *Free*: no short weeks and at most 2 weeks away. *Free if released*: same, counting internal hours as releasable. *Partial*: at least 50% of weeks fit. Otherwise *booked*. Constants are in `candidates.ts`. | Tunable thresholds, picked so a vacation is a caveat and an 11-week leave isn't "free". |
| Tiers | **Ready**: free, all required skills listed, level ≥ requested, no contract gap. **Unlikely**: booked, not employed, or no required skill listed. Everything else is **Tradeoff**. | Explainable rules, no weights. |
| Ordering | Tier → (availability, then skills) for usable tiers; (skills, then availability) for booked → avg free % → name. | Deterministic. Strong-but-booked people float to the top of their group. |
| Long absence | Time off of 10+ workdays while still planned triggers a "Coverage gap" warning (Hannah Kim). In a preview, more than 5 workdays of time off inside the role is a *decision*; shorter is *worth knowing*. | Separates vacations from coverage problems. |
| Overallocation | Measured on planned %, per weekday, over the next 12 weeks for the attention strip. Spans bridge holidays and time off. | The plan is overcommitted even on a day the person is away. |
| Capacity terms (chart + week by week) | **Working capacity** = working days after holidays and time off × (weekly capacity ÷ 5). **Committed** = existing confirmed work. **Proposed** = this role. **Free** = max(0, capacity − committed − proposed). **Over capacity** = max(0, committed + proposed − capacity), shown separately so free hours are never negative. **Utilization** = (committed + proposed) ÷ capacity. Weeks with no working capacity show **Away**, never 0% or 100%. Tentative work is shown separately ("only if won") and isn't in the totals. | "Available" read as "free to take more work". These terms say what each number is. |
| Proration | One rule everywhere: an allocation applies to the days the person works. 100% in a week with 2 days off = 3 days × 8h = 24h. The detail view shows it per project ("100% × 3 working days × 8h"). | The data has no daily schedule. Prorating keeps a short week from looking over- or under-booked. It's stated in the UI, not hidden. |
| Work planned on days off | Reported separately as hours the plan has on time-off days (and days before start or after contract end), using the same allocation × daily hours. Company holidays are excluded because the whole firm is off. A week with **no working capacity but planned work** is a **coverage conflict** (amber, labelled "Conflict: 24h planned while away"). In partial weeks, the hours are noted in the detail but not counted in utilization, per the proration rule. | Stops a long leave from looking like a quiet, "available" week (Hannah Kim). It doesn't change any underlying number. |
| Week grouping | Consecutive weeks merge only if available, committed, new, tentative and released hours *and* the per-project hours are identical, and there are no days off. Weeks with a holiday or time off never merge. The exception is consecutive fully-away weeks from the same time-off record. Over 100% takes precedence over "reduced availability" for a week's colour, but its time-off chip still shows. | Removes repetition without hiding a difference. Same utilisation with different projects stays separate (covered by a test). |
| Previewing an If-won role | The move being previewed counts in the chart and table even though it will be recorded as tentative. Any over-100% warning then adds "Only if the project is won." | The question on screen is "what happens if I do this?". Hiding the role's own hours made the chart contradict itself. |
| Commit | In-memory only. Commits are a list of changes replayed over the untouched source, so undo and reset are exact. No server and no messages. | Brief: no backend. |
| Over 100% | Allowed, but requires acknowledgement **and** a written reason. Blocked only when the person isn't employed at all during the role. | Over-allocation is sometimes the right short-term call. Make it deliberate, not impossible. |

## 3. Synthetic (added) data

All of it lives in `src/data/enrichment.ts`, and every UI use carries a `DEMO DATA` tag.

| Field | Values | Notes |
|---|---|---|
| Client industry | Northstar: Energy & utilities. Cedar Health: Healthcare. Pinecrest: Education. Brightwater: Logistics. Summit: Financial services. Ironline: Manufacturing. Lakeshore: Real estate. | Inferred from client names only. |
| Client working style | Northstar and Cedar are *senior-led* (suggested min. level Senior). Pinecrest is *coaching-friendly*. The rest are *standard*. | Cedar's "strict accessibility requirements" is real source data. The style label is ours. |
| Person industry experience | P07, P08, P09, P12, P13, P17, P20, P21 have 1–2 industries each. Everyone else is "not recorded". | Deliberately sparse, so "unknown" stays common and visible. |

## 4. Known limitations

- Candidates are evaluated one role at a time. There's no "if Olivia takes R02, who takes R06?" optimisation, though the lists do update after each commit.
- Partial-allocation suggestions (e.g. "Hannah could do Feb–May") are shown as coverage, not offered as split assignments.
- The skills match is exact string match (case-insensitive). "HTML/CSS" doesn't match "CSS".
- The attention strip has a fixed 12-week horizon and isn't filterable.
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
