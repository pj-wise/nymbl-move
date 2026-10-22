# Design concept: Staffing flow (Option B)

**Surface:** pick an open role → see who could fill it → compare → preview the impact → resolve or accept tradeoffs → assign (locally) → see everything update.

**Users**
- **Resource Manager (RM)** makes the call. They need to know *who*, *why*, and *what breaks* in seconds.
- **Delivery Manager (DM)** asked for the person. They need to know *is my role covered, and by when*.

**Principle:** the screen always says what is **confirmed**, what is **tentative**, what is **assumed**, and what **needs a decision**. Every status is shown with an icon and words, not colour alone.

---

## 1. Information structure

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ HARBOR & PINE · Staffing      Today is Mon Nov 2 (demo)   [○ Count tentative work]  [Reset]│  ← global context + scenario
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Needs attention · 4 warnings, 1 person over 100%                                         │  ← always-visible bucket
│ [✕ Lena Fischer is at 130%] [! Hannah on leave, still 75%] [! Mei: no skills] [! A038 …] │
│ › Show 4 data notes (requested PTO, contract end, 0% record…)                            │
├───────────────┬────────────────────────────────────────┬─────────────────────────────────┤
│ OPEN ROLES    │ R02 · Field Ops Platform · Northstar   │ PREVIEW · NOT SAVED             │
│ (DM view too) │ Senior Software Engineer, 100%         │ Olivia Brooks → Field Ops       │
│               │ Needs  React, TypeScript, A11y         │ ┌─────────────────────────────┐ │
│ Field Ops 0/5 │ Dates  Nov 16 – May 28 (in 14 days)    │ │ ✓ Safe to assign            │ │  ← verdict first
│ ▸ Sr SWE .NET │ Client Energy · senior-led [DEMO DATA] │ └─────────────────────────────┘ │
│   Must fill   │ ✓ 1 person ready to propose            │ [Move off internal work  ○]     │  ← only if relevant
│   Open·1 ready│────────────────────────────────────────│ Weekly load   Peak 0% → 100%    │
│ ▸ Sr SWE React│ ✓ READY TO PROPOSE (1)                 │ ▁▁▁▁████████████████  ─ 100%    │
│ ▸ Sr Designer │ ┌ Olivia Brooks  Skills 3/3 Free 98% ┐ │ Needs your decision (n)          │
│ ▸ DM          │ │ Senior·40h  ▮▮▮▮▯▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮ │ │ Worth knowing (n)                │
│ ▸ QA (nice)   │ │ ! Vacation Nov 23–25 ✓ Rolls off … │ │ Commitments during the role      │
│               │ └────────────────────────────────────┘ │  Field Ops 100% 40h  New         │
│ Enrollment 0/2│ ! POSSIBLE, WITH A TRADEOFF (3)        │ Why she's on the list            │
│ (60% win)     │   Sam Rivera … A11y not listed         │ Logged vs planned (actuals)      │
│ ▸ SWE If won  │ ? BOOKED OR WEAK FIT (7) › Show,       │─────────────────────────────────│
│ ▸ Designer    │   incl. strong match Grace Liu         │ [ Assign Olivia… ]  Esc closes  │  ← one primary action
└───────────────┴────────────────────────────────────────┴─────────────────────────────────┘
```

**Hierarchy, left to right:** *what needs filling* → *who could fill it* → *what happens if I do it*. Each column answers one question, so the next action is always one step to the right.

**Decisions behind this layout**
- **Roles are the entry point, not people.** The brief's question is "where should the next project go"; the RM starts from demand. The queue is grouped by project with "x/y filled" and "starts in N days". That is the DM's answer without a separate screen.
- **Tiers instead of a score.** Candidates are grouped into *Ready to propose / Possible, with a tradeoff / Booked or weak fit*. A number like "87% match" suggests precision the data can't support. Tiers plus reasons can be argued with.
- **Strong but booked people are never hidden.** The "booked" group is collapsed by default, but its toggle names any strong skill match inside it ("incl. strong skill match Grace Liu"). The RM can still decide to free someone up.
- **Per-week coverage strip on every row.** Availability for a 28-week role can't be judged from one Monday. The strip shows has room / short / away / not employed for each week of the role, so "free now, clash in March" is visible at a glance.
- **Verdict before detail in the preview.** *Safe / Needs a decision / Blocked* comes first, then the evidence: chart, issues, commitments, reasons.
- **The load chart explains itself.** Bars are stacked: *already committed* (grey) and *this role* (indigo). So when someone goes over, you see that it's the new role on top of a full week, not just a tall bar. The scale grows with the peak, with headroom above it, so 200% reads as double rather than "full". The 100% line is drawn above the bars with a tinted over-capacity zone, any part above it is striped red, and a red tick under the axis marks each over-capacity week. A pill states the count: "Over capacity in 19 of 28 weeks".
- **Week-by-week hours on demand.** A collapsed "Show week-by-week hours" section under the chart keeps the preview scannable. When opened, it shows a table with one row per week: *Available / Committed / This role / Total / Load*. Holidays and time off are named under the week, and over-capacity rows say "24h over". Selecting a week (or clicking its bar) expands that row. It shows *which projects* make up the load (Confirmed, This role, Tentative only if won, Released by this move) and the arithmetic: "3 working days available × 8h = 24h (2 days Training)". A "Calculated, not supplied" note states the formula and the even-week assumption.
- **Show affected commitments, not just a percentage.** The preview lists every project the person is on during the role. Released internal work is struck through, with the hours that project loses.
- **Confirmed vs tentative.** The confirmed plan is the default view. Tentative work appears as *amber striped bars* stacked on top of the chart, as "+20h if won" in the weekly table, and a "Worth knowing" note. The header toggle "Count tentative work" re-ranks candidates and the attention bucket under the won-scenario. See PROBLEM_STATEMENT.md.
- **Synthetic data is visibly synthetic.** Every reason that comes from our enrichment carries a dashed violet `DEMO DATA` tag.

## 2. Flow: spotting a problem → acting on it

1. **Spot.** The attention strip shows "Lena Fischer is at 130%", and the queue shows "Field Ops: 0/5 filled, starts in 14 days, Must fill".
2. **Choose a role.** Enter on R03 moves focus to the role heading. The brief says "Nobody is a clean fit."
3. **Compare.** Daniel: "Fits if released from internal work". Hannah: "Only partly available" (leave strip greyed). Lena: booked.
4. **Preview.** Selecting Daniel shows *Needs a decision* and a peak of 90% → **140%**, with red over 100%.
5. **Resolve.** Turning on *Move Daniel off internal work* brings the peak to 100%. A new decision appears: "Design System Refresh (internal) loses 16h/week from Nov 16 to Dec 31. Its owner should know."
6. **Commit.** The dialog lists each decision. Assign stays disabled until "I've reviewed these" is ticked. Going over 100% also requires a written reason.
7. **See the result.** The success panel shows what changed and the decisions accepted. The queue shows "Daniel Okafor (local)" and "1/5 filled". The attention strip and every other role's candidate list now include the new load. Undo restores that role, and Reset demo clears everything.

## 3. Required states

| State | Where | What the user sees |
|---|---|---|
| **Empty** (no role chosen) | Centre + right | "Pick an open role to see who could fill it", with a pointer to Field Ops (4 Must-fill roles, starts Nov 16). Preview says what it *will* show. |
| **Empty** (role chosen, no candidate) | Right | "Select a candidate to preview the move. Nothing changes until you confirm." |
| **Empty** (no warnings) | Attention strip | "✓ Nothing needs attention in the next 12 weeks." |
| **No clean fit** | Role brief | "⚠ Nobody is a clean fit. Every option below needs a tradeoff or a decision." (R03, R04) |
| **Overloaded** | Attention strip + preview | A red card names the person, the %, the projects and the dates. Preview bars above 100% are red and hatched (pattern, not only colour). "Needs your decision: would be over 100%: up to 140% (Nov 16–Dec 31)". |
| **Conflicting** | Preview + dialog | Time off inside the role, contract ending before the role does (Jake), a start date after the role starts, internal work that must be released, a tentative clash if PRJ-07 is won. Each is a sentence, sorted into *Blocking / Needs your decision / Worth knowing*. |
| **Missing data** | Attention strip, rows, preview | A038 has no end date: the app assumes Nov 13 (project end), labelled "end date assumed". Mei has no skills: shown as "?" with "fit is unknown", never "unqualified". A required skill missing from a profile reads "not listed in profile", not "lacks". Mei Tanaka has only 3 of 4 weeks logged: "(1 week missing)", not zero hours. |
| **Blocked** | Preview | The primary button becomes "Blocked: resolve the issue above first" (e.g. person not employed at any point in the role). |
| **Success** | Right + queue | A green panel shows "Assigned in this session", what changed, the decisions accepted and the note. It also states "Not saved to a server and not sent to anyone." |

## 4. Keyboard operability

| Key | Where | Does |
|---|---|---|
| Tab | Page | Skip link → header (scenario toggle, Reset) → attention disclosure → **role list (one tab stop)** → role heading → **candidate list (one tab stop)** → "Show booked" → preview controls → Assign |
| ↑ / ↓ / Home / End | Role list, candidate list | Move between items (roving focus). |
| Enter / Space | Role or candidate | Select it. Focus moves to the panel that just changed (role heading, or preview heading). |
| Space | Switches, checkbox | Toggle tentative scenario / release internal work / acknowledge. |
| Enter / Space | "Show week-by-week hours" | Expand or collapse the weekly table. Focus stays on the toggle. |
| Tab, then Enter | Week rows | Each week is a button. Enter expands its project breakdown in place (`aria-expanded`), with focus kept on the week. |
| Click a bar | Load chart | Mouse shortcut: opens the table, expands that week and moves focus to its row. The chart itself is `aria-hidden`; the table is the accessible version. |
| Esc | Preview | Close the preview and **return focus to the candidate it came from**. |
| Esc | Commit dialog | Close the dialog. Focus returns to the Assign button; the preview stays open. |

**Focus when data changes underneath the user**
- **Selecting a role** focuses the role heading (`tabIndex=-1`), so a screen reader announces the new context. The next Tab reaches the candidates.
- **Selecting a candidate** focuses the preview heading.
- **Toggling "release internal work" or "count tentative work"** keeps focus on the switch. The verdict region is `role=status`, so the new verdict is announced. Lists re-sort, but the order is deterministic (tier → availability/skills → free % → name), so items don't jump without reason.
- **Committing** happens *after* the dialog finishes closing. Focus then moves to the success heading, avoiding Radix returning focus to a button that no longer exists. A polite live region announces "Olivia Brooks assigned to R02 in this session."
- **Undo** focuses the preview heading again. **Reset** disables itself, so focus moves to the page title and the reset is announced.
- **The collapsed "booked" group** always opens if the selected person is inside it, so focus is never trapped in hidden content.
- **Escape inside the portaled dialog** is ignored by the preview's Escape handler (React bubbles portal events), so one Esc never closes two layers.

## 5. Components and how they'd extend

- `Tone` (`Pill`, `ToneText`, `DemoDataTag`): one semantic vocabulary (good / caution / bad / unknown / info / blocked), each mapping to icon + colour + screen-reader prefix. New statuses go here, not into ad-hoc classes.
- `WeekStrip`: per-week fit for any date range. It could be reused for a Monday-view person timeline.
- `LoadChart` and `WeekBreakdown`: stacked weekly hours, plus an expandable table with a per-week project drill-down. Both read the same `PreviewWeek` data, so the chart and table can't disagree. It could take multiple people to preview swaps.
- Domain functions are pure (`src/domain/*`), so a backend could replace `replayCommits` without touching the UI.

## 6. Out of scope (on purpose)

- A full Monday view (only the compact attention strip).
- Editing existing allocations.
- Cross-discipline candidates.
- Multi-role optimisation.
- Mobile.
- Persistence.

See DECISIONS.md.
