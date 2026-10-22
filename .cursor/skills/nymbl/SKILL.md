Mission and scope

- Build one coherent staffing decision flow (brief Option B) for a fictional services firm, not an entire resource-management suite.
- Solve the core problem: who can fill an open project role, why, with what capacity impact, and what must be resolved before confirming.
- Target the take-home's ~5-hour scope and deliverables. Desktop-first only.
- The primary user is the Resource Manager. Secondary user: Delivery Manager seeking staffing status.
- Favor a small, genuinely working prototype that can be edited during a 20-minute live challenge over a broad but shallow demo.
- Source of truth: candidate challenge PDF + supplied staffing README/CSV/JSON. The discovery-call notes below are user-provided additional requirements.
  Technology
- React + TypeScript + Vite; Tailwind CSS; shadcn/ui primitives; Lucide icons.
- Prefer function components, hooks, simple local state/context if needed, and pure domain utilities. No backend required.
- Strict TS (avoid any), clear domain types, module boundaries, and deterministic testable calculations.
- Vitest for domain logic tests. Don't add dependencies without value.
- shadcn components are building blocks; don't blindly ship a stock dashboard template. Preserve accessible behavior.
  Data integrity / date rules
- App 'today' is 2026-11-02, regardless of system clock. Prefer a single demo-date constant; allow explicit date/week navigation when useful.
- Supplied data: 25 people, 8 projects, 42 assignments, 7 open roles, 8 time-off records, 5 holidays, 145 logged-hours entries.
- Never mutate the original supplied JSON/CSV. Parse/normalize once and keep enrichment separate and explicitly labeled.
- allocation_pct means share of the individual's weekly_capacity_hours; 100% for a 24h employee means 24 hours, not 40.
- Treat assignment date intervals consistently, including the end date (document your convention), and calculate overlap for the selected week/role interval.
- Confirmed assignments consume planned committed load during their active dates. Tentative assignments/proposed projects remain clearly distinct; display a scenario toggle or explanatory comparison rather than quietly mixing them into confirmed load.
- Internal project PRJ-08 assignments are currently real workload, but have a special reallocatable property; showing a candidate as potentially movable must not erase the original obligation silently.
- Requested PTO is assumed automatically approved per discovery call; subtract relevant absence from available capacity, while retaining original status/provenance.
- Account for holidays, approved leave/training, individual start dates, and contractor end dates.
- If hours per weekday are unspecified, compute/describe a pro-rated working-day baseline for non-40h workers rather than always subtracting 8 hours/day.
- Past logged hours are actuals used to contextualize/flag plan-vs-actual gaps; they are not future planned assignments.
- Missing dates/skills/other fields stay visibly uncertain. Never silently manufacture or 'fix' source values.
- A zero-percent historical assignment does not consume capacity.
- Do not mark an employee available before their employment start date or after contractor end date.
- No transition buffer: once a previous assignment ends, the employee may start a new one immediately.
  Discovery-call requirements (confirmed by user)

1. Assume PTO requests are auto-approved for staffing availability.
2. Create a prominent Over 100% / Needs Attention warning bucket for confirmed overallocations.
3. Candidate fit should include skills/tech stack, seniority, industry experience, and client working style where known.
4. Extend the mock data with separately labeled synthetic client/employee fit fields where it demonstrates the UX. An accommodating client may suit a junior; a more demanding client may require a senior. Don't represent made-up criteria as original data.
5. Assume zero-day handoff between assignments.
   Specific dataset cases to preserve in demo/tests

- P07 Lena Fischer: 80% Claims Dashboard + 50% Dispatch Portal in overlapping periods = 130% confirmed allocation.
- PRJ-08 Design System Refresh: internal work that may be reallocated, but not invisibly.
- PRJ-06 Field Ops Platform: multiple Must fill roles; R01 .NET/Azure/SQL, R02 React/TypeScript/Accessibility, R03 Product Designer; strong foundation for realistic candidate comparison.
- P21 Olivia Brooks: PRJ-04 assignment ends 2026-11-06, prior to PRJ-06 starting 2026-11-16.
- P23 Fatima Noor: assignment A038 has no end date; flag incomplete record instead of silently inferring an end.
- PRJ-07 Enrollment Redesign: Proposed at 60% win probability; tentative allocations are not confirmed.
- P15 Chris Morgan: part-time 24h/week. P24 Jake Morrison: 32h/week contractor ending 2026-12-18. P25 Zoe Adams: starts 2026-11-16.
- PTO examples: P11 Ryan Patel and P13 Omar Haddad have Requested vacation in source (auto-approved for planning under the call decision).
  Candidate matching and recommendation integrity
- Show objective fit factors separately: required skills covered/unknown, level relative to need, usable hours across needed dates, conflicting existing work, and any enriched client/industry match.
- Source data may not contain enough information for all fit factors. Distinguish unknown from not qualified and synthetic demo attributes from verified source attributes.
- Don't hide people solely because they aren't free. Surface valuable constrained matches with a plain explanation when useful.
- Avoid mysterious ML/AI confidence scores. If a score is used, document weights and show interpretable reasons; user retains final decision.
- Availability for a multi-month role cannot be inferred from a single Monday: validate relevant dates and identify future clashes.
- Candidate choices must lead to a real in-memory preview of affected commitments and warnings.
  UX / accessibility
- Screen state should always answer: what is current, what is planned, what is tentative/uncertain, and what needs action.
- Core flow: choose role -> review candidates -> compare -> preview before/after -> resolve/block conflict -> confirm locally -> see updated result; provide reset.
- Label local simulation clearly: no real server save, no external communications.
- Prominent bucket for overallocations; never rely on color alone. Explain warnings and impacts in words.
- Required design states: empty, overloaded, conflicting, missing data; plus confirmation/success, if implemented.
- Keyboard operability is a deliverable: logical focus order, visible focus indicators, labeled controls, accessible dialogs, Escape, focus return, and stable focus when live data updates/filters.
- Prefer semantic HTML, readable contrast, and accessible loading/status messages where needed.
- Desktop-first, easy to scan in seconds. Avoid gratuitous animations, charts, and visual noise.
  Architecture / file conventions
  Suggested layout (adjust if sensible):
  src/
  data/ # supplied data adapter, separate synthetic enrichment
  domain/ # models, capacity, overlap, recommendation rules
  components/ # presentation and shared primitives
  features/staffing/ # role picker, candidate comparison, preview/commit
  lib/ # date/formatting utilities
  tests/ # domain/unit tests

docs/
DESIGN_CONCEPT.md
AI_PROCESS_LOG.md
PROBLEM_STATEMENT.md
DECISIONS.md

- Avoid deep component files with embedded scheduling rules.
- Prefer pure functions with named inputs; explain percentages vs hours and relevant time windows.
- Use deterministic ordering/tie-breakers for candidates so the demo doesn't jump around unexpectedly.
- Keep the code runnable and ready for live edits.
  Explicit deliverables from candidate brief

1. Design concept: wireframe-to-mid-fidelity, hierarchy, important states, action flow, annotations, keyboard and focus behavior.
2. Coded prototype: one working key interaction in React + TS using supplied dataset, no backend.
3. AI process log: actual tool usage, real prompts, useful outputs, incorrect suggestions, what user verified/changed. Never invent user actions or retrospectives.
4. One-page problem statement: choose one open question and argue a recommendation, then describe the biggest decision risk and its mitigation.
   Recommended position for the problem statement: for not-yet-won work, keep a committed-load baseline plus a visibly tentative scenario. A 60% project win probability doesn't mean allocating 60% of a person's capacity. Present this as candidate recommendation, not client-approved business rule.

Optional high-fidelity work is not mandatory. Do not let polish prevent meeting all four required deliverables.
Completion checklist

- [ ] Exact dataset date and source fields respected
- [ ] Over-100% warning appears and can be investigated
- [ ] Part-time/contractor/start-date/holiday/PTO cases handled
- [ ] Tentative vs confirmed vs added enrichment visibly distinguished
- [ ] Missing data remains surfaced
- [ ] Role -> candidate -> preview -> in-memory commit flow works
- [ ] Full keyboard path and focus behavior checked manually
- [ ] Unit tests for date overlap, partial capacity, PTO, proposed work and conflict detection
- [ ] npm run build and npm test results honestly documented
- [ ] Design concept, AI log, problem statement and decision log present
- [ ] User can run and edit prototype in the live interview
      How to collaborate
- Read source materials before writing code. State important findings and a narrow implementation plan.
- Don't ask unnecessary questions; make documented reasonable assumptions.
- Prioritize business correctness, decision clarity and accessibility above volume of features.
- Explain important tradeoffs concisely, in plain language.
- Do not claim design review, usability testing, client approval, or tests happened unless they actually happened.
