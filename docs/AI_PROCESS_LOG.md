# AI process log

An honest record of how AI was used to build this. Sections marked **✍️ PJ to complete** can only be filled in by me: what I personally checked, changed or disagreed with. Nothing in those sections has been pre-written.

## Tools

| Tool | Used for |
|---|---|
| **Claude Code** (CLI agent, model Claude Opus 5.5) | Reading the brief, README and data. Plan-mode scoping. Scaffolding. Writing domain logic, tests, UI and these docs. Running the build and tests. Scripted headless-Chrome checks. |
| **Cursor** | Editor. Holds `.cursor/skills/nymbl/SKILL.md`, a skill file I wrote that summarises the brief, discovery-call notes and rules. Claude Code read it as context. |
| create-vite, shadcn CLI | Scaffolding (React + TS + Vite, Tailwind v4, shadcn/ui Nova preset on Radix). |
| puppeteer-core + local Chrome (throwaway scratch folder, not a project dependency) | Screenshots and keyboard/focus checks during the build. |

✍️ **PJ to complete:** any other tools used (ChatGPT, v0, Figma AI, etc.), or "none".

## Session 1: the build (Claude Code)

### Prompt used

The full initial prompt is below, unedited. *(Edit freely; it's my prompt.)*

<details>
<summary>Initial prompt (CLAUDE_NYMBL_PROMPT.md)</summary>

# Nymbl Senior Design Engineer challenge — Claude prompt

I am interviewing for a design engineer position. I attached the candidate brief/take home assesment and all of the staffing data I was given. Please actually read through the brief, README, and data before starting. There is also a Skill.md added to cursor with more info. Don't just build a generic dashboard.

I want this to feel like something I'd genuinely be comfortable shipping to a client. The role is a mix of UX, frontend engineering, and working with clients to figure out what they need. They specifically want React + TypeScript, keyboard accessibility, a working interaction, and an honest AI process log.

**Stack:** Let's use **React + TypeScript + Vite**, Tailwind CSS, and shadcn/ui. I like Next.js, but this exercise doesn't need a backend, and Vite seems simpler for a quick prototype that we may need to edit live in the interview. Please don't add Next.js unless there's a clear reason we actually need it. Use Lucide icons and keep dependencies pretty lean.

## First, review what I gave you

* Candidate brief PDF (this is the source of truth for the assignment requirements)
* README and `staffing\_data.json` (or the equivalent individual CSV files)
* Treat **Monday, Nov 2, 2026** as the in-app current date — don't use the computer's real date.
* It's a fictional 25-person practice at Harbor \& Pine, inside a 100-person services firm.
* The actual brief asks me to choose **one main surface**, deliver a design concept, code **one key interaction**, keep an AI process log, and write a roughly one-page problem statement. It says approximately **five hours** total. I don't want to spend all that time building something way bigger than they asked for.

Before building, summarize the requirements in a few sentences, point out important oddities in the data, and tell me what you're planning to build and what you're deliberately leaving out. Keep that short and then get going.

## Direction I'd like to take

I lean toward **Option B: the staffing flow**, because it gives me a chance to show both product/UX thinking and engineering. The main experience should let a Resource Manager:

1. Pick an open role and immediately understand what project needs someone, by when, and what that project requires.
2. See sensible candidates, including strong matches who are already booked, with clear explanations of why they match or don't.
3. Compare candidates based on available capacity, relevant skills, seniority, industry/client fit, and scheduling conflicts.
4. Preview a staffing decision and see the before/after impact on that person's load and other project commitments **before committing**.
5. See whether the proposed move is safe, creates a conflict, or needs someone to make a call. Make sure it is obvious what's confirmed vs tentative vs assumed.

Don't turn this into a giant enterprise app. One well-designed, working end-to-end interaction beats ten unfinished screens. A compact Monday summary or alert strip could provide context, but Option B should remain the main surface.

I want the UI to feel polished, modern, fast, and usable, not like a default admin template. Think strong information hierarchy, easy scanning, sensible whitespace and typography, subtle color, and useful details rather than decoration. Desktop first. Please make the UX work for both the Resource Manager deciding on staffing and the Delivery Manager wanting to know when their role will be filled. It should be obvious what the next action is.

## Notes from my call with Nymbl

I asked some discovery questions and got these answers. **These are confirmed assumptions for this challenge, not things to ask them again:**

* It's safe to assume **PTO requests are automatically approved**. Count requested PTO against availability, while preserving the original request status if showing provenance.
* Anyone allocated **over 100%** should appear in a clear **warning / needs-attention bucket**, not just as a subtle color somewhere.
* The sample data doesn't contain all the client/person fit details a real staffing manager would use. The CEO said in real life they'd factor in **seniority, client working style, industry experience, and tech stack**. An easygoing client could be a fit for a junior; a more demanding client might require a senior. He didn't give the exact name for that other client type, so don't pretend he did.
* We can **extend the fictional dataset** to demonstrate fit. Do that thoughtfully, with the added fields/values clearly marked as our own synthetic assumptions. Don't alter the original data or pass fictional additions off as supplied facts.
* People may start a new assignment **immediately after their prior assignment ends**; no handoff buffer needed for this exercise.

## Data handling and actual business rules

Use the provided data as the foundation, not a toy array that coincidentally looks similar. Keep the source unchanged and put any enrichment in a separate fixture/module. I want straightforward typed models and **pure, testable functions** for availability, overlaps, candidate matching, and previewing a staffing move.

Watch for these specific cases while inspecting the real files (verify each in the data):

* Lena Fischer (P07) has an overlapping 80% + 50% confirmed allocation = **130%**, a real warning case.
* The Design System Refresh (PRJ-08) is lower-priority **internal** work; people may be moved off it for client work, but don't make it magically disappear without showing the tradeoff.
* Field Ops Platform (PRJ-06) has several **Must fill** roles, including R01 (.NET/Azure/SQL), R02 (React/TypeScript/Accessibility), and R03 (design). Use these to demonstrate meaningful candidate comparisons.
* Olivia Brooks (P21) finishes an assignment Nov 6 before the Field Ops roles start Nov 16. Avoid treating all historical allocations as current forever.
* Fatima Noor (P23) has an assignment with a **missing end date**. Don't silently patch the source. Surface the uncertainty and, if you use a project end as a fallback, label it as an assumption.
* Enrollment Redesign (PRJ-07) is proposed at **60%** win probability. Tentative work is not the same as confirmed work. Make the effect of including/excluding tentative work understandable.
* Chris Morgan has **24h/week**, Jake Morrison **32h/week** and a contract end date, and Zoe Adams starts **Nov 16**. These matter to capacity calculations.
* Company holidays, PTO and leave must affect usable hours for the relevant week. Don't simply subtract 8h/day for every person regardless of their baseline capacity; document a reasonable pro-rated assumption if daily schedule detail is missing.
* Logged hours are **historical actuals**, not proof of future commitments. Don't silently replace the plan with actuals.
* Ignore stale zero-percent assignments for capacity while retaining them as historical records.

The matching logic should be **explainable**, not some mysterious AI score. Make missing skills different from confirmed lack of skill, avoid inventing qualifications, and never suggest a person is freely available if their assignments/PTO prevent it. For added fit attributes, use a separate demo dataset with a small number of plausible synthetic examples, and label that it's enriched.

For a preview, keep it local/in-memory (no backend needed). A 'commit' in the prototype can update in-memory state and show an obvious success state, with an easy reset. Don't claim the change was saved to a server. If a move causes a >100% allocation or another hard conflict, make it clear and require an explicit decision (or block it if that's the better UX). Show affected commitments, not just one person's percentage.

## What I need from you

Work in a repo I can open in Cursor and run locally. Please produce:

1. A well-structured React/Vite/TypeScript app using Tailwind and shadcn/ui, with the core staffing flow actually working with the real data.
2. A **design concept** document (`docs/DESIGN\_CONCEPT.md`): information hierarchy, key screens/flow, rationale, and all required states (empty, overloaded, conflicting, missing data). Include keyboard interactions and what happens to focus when data changes. Use annotated low/mid-fidelity wireframes if useful; don't spend the whole time making mockups before coding.
3. An **AI process log** (`docs/AI\_PROCESS\_LOG.md`) that records what prompts were actually used, tools used, where AI helped, where outputs were wrong or incomplete, and how I reviewed/fixed them. **Do not fabricate actions, reviews or failures.** Leave placeholders where only I can honestly describe my own validation. Include this initial prompt as part of the log, with my ability to edit it.
4. A short **one-page problem statement** (`docs/PROBLEM\_STATEMENT.md`). I'd lean toward the brief's question on whether **unclosed proposed work should count toward load**: recommend separating confirmed vs tentative views, showing a risk scenario, and not quietly treating 60% win probability as 60% staffing capacity. Also identify the biggest risk in the chosen flow (a confident-looking but wrong staffing recommendation) and how we'd mitigate it. This is a recommendation I should be able to defend, not a fake client-confirmed policy.
5. A concise **decision log** (`docs/DECISIONS.md`) listing call-confirmed decisions versus implementation assumptions versus added synthetic data, plus known limitations and what was intentionally cut for time.
6. A few meaningful **Vitest** unit tests for the tricky calculation cases and a short README with how to run the project, tests, and demo the interaction.

The challenge is roughly five hours total. **Prioritize**: correct calculations and a strong flow first; clean accessible UI second; documentation and honest tradeoffs throughout. A genuinely strong, focused prototype is better than trying to make it feature-complete. No backend, auth, payments, unnecessary state library, or huge component library rebuild.

## How I want you to work

* First inspect the files and tell me your proposed scope and key assumptions briefly.
* Then build incrementally; keep code organized so we can change something live during the 60-minute interview.
* Use strict TypeScript, reusable UI components, accessible shadcn primitives, good empty/loading/error/conflict states, and avoid business rules buried inside JSX.
* Keyboard users need to be able to complete the entire key flow: clear focus, labels, dialogs, escape behavior, logical tab order, and focus restoration after filtering/assigning.
* Don't overengineer. Make smart choices and explain the tradeoffs.
* Run whatever build/tests are available, report the actual results, and tell me what I should manually check.
* If something isn't specified, make a reasonable, documented assumption rather than stalling to ask me ten questions.

Please treat the brief as the grading rubric. I'd like something that shows I can go from a client conversation to a thoughtful, actually working solution, not just a nice-looking demo.


</details>

The session started in Claude Code **plan mode**, so it had to read everything and propose scope before writing code. I approved the plan before implementation began.

### What the AI did, in order

1. **Read the source material.** It read the brief PDF (both pages), the data README, every CSV and the JSON (checking that the JSON and CSVs match), and `SKILL.md`. It computed per-person averages of logged hours with a quick shell script.
2. **Found data issues beyond the prompt's list.** The prompt already named Lena at 130%, A038, Olivia, the part-time and contractor cases, and requested PTO. The AI also surfaced:
   - **Hannah Kim** on approved leave Nov 9–Jan 29 while still planned at 75%.
   - **Mei Tanaka** with an empty skills list, and only 3 of 4 timesheet weeks.
   - **Jake Morrison**'s contract (ends Dec 18) is shorter than R05 (ends May 28).
   - **Grace Liu** and **Ryan Patel** logging about 48h and 44h a week against 40h plans; **Tomás Silva** logging 3.5h against 20h on PRJ-08.
   - **No designer** has both skills R03 asks for.
3. **Wrote a plan** (scope, rules, file structure, test list) for approval.
4. **Built the domain layer first**: pure functions plus a typed adapter. Then it ran a throwaway script printing every role's ranked candidates and several previews, and checked them against the data *before* writing test assertions.
5. **Wrote 32 Vitest tests**, plus one more later for commit replay and undo (33 in total).
6. **Built the UI**, then ran the real app in headless Chrome. It took screenshots and drove the keyboard path: skip link → roles → candidate → preview → dialog → commit → undo → Escape.
7. **Wrote the docs.**

### Where the AI's own first attempt was wrong, and what changed

These are mistakes in the AI's own output that it caught during the session, by checking printed results or screenshots against the data. They are listed because the brief asks where AI was wrong.

| # | What was wrong | How it was caught | Fix |
|---|---|---|---|
| 1 | "Average free %" was computed only over days the person was in, so **Hannah Kim showed "100% free"** for R03 despite 11 weeks of leave. | Printed candidate output | Use nominal capacity (time off counts as not free). Hannah now shows 63%. |
| 2 | "Partly available" was too generous. **Grace Liu (free for 9 of 28 weeks) was labelled partial**, not booked. | Printed output | Added a 50%-of-weeks threshold (`MIN_PARTIAL_COVERAGE`). Grace is now "Strong skill match, but already booked", which is what the prompt asked to surface. |
| 3 | Sorting by skill count first put **Kevin O'Brien (actually free) last** for R04, behind people who are mostly booked. | Printed output | Usable tiers sort by availability first. The booked tier sorts by skill match first. |
| 4 | Jake's headline said "already booked" when the real story is his contract ending. | Printed output | Added a "Not employed for most of the role" headline. |
| 5 | Candidate and role rows put block elements (`div`, `ul`) inside `<button>` (invalid HTML), and the accessible name was the whole row text. | Code review during the build | Phrasing content only. A short `aria-label`, with the details as `aria-describedby`. |
| 6 | Commit dialog focus: committing would unmount the dialog's trigger, so Radix would return focus to nothing. | Reasoning about Radix's focus-return behaviour while writing it | Commit is applied in `onCloseAutoFocus`, after the dialog closes. Focus then moves to the success heading. |
| 7 | Pressing Escape in the (portaled) dialog would also bubble through React to the preview's Escape handler and close the preview too. | Reasoning about React portal event bubbling | The preview ignores key events whose DOM target is outside it. |
| 8 | The "show booked people" disclosure stayed open when switching roles. | Scripted headless run failed to find "Show" on the second role | The list is keyed by role, so it resets. |
| 9 | Docs draft said *three* people had tentative PRJ-07 work (it's two), and described Sofia as "booked from Dec 7" (she's already at 100% until Dec 18). | Re-reading the docs against the data | Corrected PROBLEM_STATEMENT.md. |

### Tooling hiccups (not code bugs)

- The shadcn CLI prompted interactively for a preset. It was re-run with `-p nova`. The current shadcn uses its own `cn` package instead of `clsx` + `tailwind-merge`. Kept as generated.
- The Claude-in-Chrome browser extension couldn't reach the local dev server (Chrome error page on both `localhost` and `127.0.0.1`). Vite had also first bound to IPv6 only. Visual checks were done instead with puppeteer-core driving the locally installed Chrome, from a scratch folder outside the repo.
- All 32 domain tests passed on their first run. **Caveat:** the expected values were written *after* inspecting the printed results, so they are regression tests of reviewed behaviour, not independent proof. The AI cross-checked several of them against the raw CSVs by reasoning (e.g. Daniel 50% + 40% + new 50% = 140%; Grace 100% on PRJ-02 until Mar 26 → 9 of 28 weeks free), but an independent human check is still worth doing.

### Where AI helped most

- Reading all the data at once and listing the edge cases with IDs.
- Turning the call notes into explicit, testable rules (`DECISIONS.md`).
- Fast iteration on wording that avoids overclaiming ("not listed in profile" rather than "lacks").

## Session 2: contrast pass and week-by-week breakdown (Claude Code)

Prompts I used (the first is verbatim; the second is summarised, so paste the full text if you want it on record):

1. *"the open roles column needs a bit more contrast between cards. Overall all sections need a bit more dividing/contrast as everything is very hard to distinguish between."*
2. *(Summary)* Add an expandable week-by-week breakdown (available hours, committed, what the new role adds, total, with PTO/holidays). Fix the chart saying "peak 100% → 200%" without visibly showing it. Allow clicking a week to see which projects contribute. Use only supplied data, label anything calculated, and keep the existing design.

What the AI did:
- **Contrast:** darker page background, panels with stronger borders and shadows, white role/candidate cards on tinted list areas, dividers between project groups, tiers and preview sections. Styling only.
- **Diagnosed the chart issue before changing it.** A scan of every role × candidate preview showed "100% → 200%" for every fully booked engineer on R01/R02 (e.g. Grace Liu). The screenshot showed three causes:
  - The scale was capped at 200%, so 200% looked like a merely "full" bar.
  - The 100% line was rendered *underneath* the bars, so it vanished exactly where people were overloaded.
  - All load was one colour, so you couldn't see that the new role was what pushed someone over.
- **Fixed it** with stacked bars (committed vs this role), a dynamic scale with headroom, the 100% line drawn on top, red stripes above capacity, over-capacity ticks and a count pill.
- **Moved the weekly numbers into the domain layer** (`PreviewWeek` in `src/domain/preview.ts`), so the chart, the table and the project drill-down all read one calculation. Added 6 tests with hand-checkable cases (e.g. Grace, week of Nov 16: 3 days × 8h = 24h available, 24h committed + 24h new = 200%; Chris at 24h/week, Thanksgiving week = 3 × 4.8h).

Where the AI's output was wrong or needed a decision:
- Its first preview logic left an If-won role's own hours out of the chart (because the assignment is tentative), so the chart could contradict the header. It now counts the move being previewed and appends "Only if the project is won" to the over-100% warning. **This is a judgement call worth reviewing.**
- Clicking a bar first used `scrollIntoView`, which scrolled the whole page and left a white band at the bottom (seen in a screenshot). It now scrolls only the preview column, and the app shell is `overflow-hidden`.
- The table header was cramped ("AVAILABLECOMMITTED") and the toggle's accessible name ran together ("hours28 weeks"). Both were fixed.
- The visible table replaces the old screen-reader-only table under the chart. The chart is still `aria-hidden`; the breakdown is the accessible version.

Checked: `npm test` (39 passing), `tsc -b`, `vite build`, plus headless-Chrome screenshots and a keyboard run (toggle → week → Enter shows projects → Esc).

✍️ **PJ to complete:** did the breakdown answer "why" the way a Resource Manager would ask it? Anything to cut?

## My review and validation

✍️ **PJ to complete.** Suggested prompts for myself, all to be answered honestly:

- [ ] Did I run `npm test` / `npm run build` myself? Results:
- [ ] Which candidate rankings did I check against the CSVs by hand? Did any disagree with my own judgement?
- [ ] Did I walk the keyboard-only path myself (Tab, ↑↓, Enter, Esc)? With a screen reader? Which one?
- [ ] What did I change in the code or copy after the AI's version, and why?
- [ ] Which AI suggestions did I reject?
- [ ] Anything in the docs I'd phrase differently in my own voice?

## Later sessions

✍️ **PJ to complete:** add any follow-up prompts or iterations here (date, prompt, what changed).
