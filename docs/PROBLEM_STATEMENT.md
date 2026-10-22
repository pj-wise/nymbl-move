# Problem statement

_To the Nymbl hiring team. This is my recommendation as a designer-engineer, not a policy Harbor & Pine has agreed to._

## The open question: should work on a project that hasn't closed count toward someone's load?

**Recommendation: no, not as load. Show it as a separate, visible risk scenario.**

Two people already hold tentative 50% allocations on Enrollment Redesign (PRJ-07, 60% win probability, decision expected Nov 20): Priya Raman and Sofia Marquez. Sofia is the useful example. She is at 100% confirmed until Member Onboarding ends on Dec 18, then has 50% free, which is exactly what the Field Ops Delivery Manager role (R04) needs. PRJ-07 would take that same 50%. Each of the three choices plays out differently:

1. **Count it in full.** Sofia never frees up, and the Resource Manager (RM) looks elsewhere for Field Ops. If the deal is lost (40% of the time), we turned down a signed client's need for a deal that never happened.
2. **Count it at 60%** ("expected load"). This sounds rigorous and is the worst option. Nobody works 60% of a 50% allocation. Either the project happens and Sofia's 50% is gone, or it doesn't and she has it free. A weighted figure (30%) describes a state that will never exist, and it hides the decision behind arithmetic.
3. **Ignore it.** The RM staffs Sofia on Field Ops. On Nov 20 the deal closes, and from Dec 7 she's planned at up to 200%, with no warning.

So the prototype keeps **one committed baseline** and adds **a clearly separate "if won" layer**:

- Candidate lists and the attention bucket default to _confirmed work only_. This is the plan a client has signed.
- Every preview _also_ computes the won scenario. If it changes anything, the user sees an amber dashed band on the load chart and a plain sentence: "if proposed project is won, Sofia would reach up to 200% (Nov 16–Feb 26). Not counted in the confirmed plan."
- A header switch, **Count tentative work**, re-ranks everything under the won scenario. The RM can ask "who is safe _either way_?" in one click.
- Staffing an _If won_ role creates a **tentative** assignment, never a confirmed one.

This keeps the RM's decision honest. They can choose a person who is safe in both worlds, or knowingly accept a risk that resolves on a known date. That date belongs in the UI ("decision Nov 20"); a probability multiplier doesn't.

**What I'd validate with the client:** whether a tentative allocation should _reserve_ the person for staffing purposes after a threshold (e.g. verbal yes, or more than 80%). If so, that's a third status ("soft hold"), not a different weight.

## Biggest risk: a confident-looking but wrong recommendation

The danger in a staffing flow isn't a missing feature. It's a clean green "Ready" badge on someone who isn't actually a good choice, which the RM trusts because the screen looks sure of itself. This dataset has several ways to produce that:

- **Skills lists are incomplete.** Sam Rivera has no "Accessibility" on his profile. Mei Tanaka has no skills at all. Neither fact proves anything.
- **Availability is a time series, not a snapshot.** Hannah Kim is free on Nov 2 and on leave for 11 weeks of the role. Jake Morrison's contract ends 23 weeks before R05 does.
- **Data is missing or inconsistent.** A038 has no end date. Lena Fischer is already at 130%.
- **The fit factors the CEO cares about don't exist in the data** (client working style, industry). We had to invent demo values.

**How the prototype reduces it**

1. **No opaque score.** Tiers plus a written reason for every factor. The user can disagree with a specific reason rather than a number.
2. **"Unknown" is never shown as "no".** "Accessibility not listed in profile" (grey ?) is different from a confirmed mismatch. Unknown required skills keep someone out of "Ready" without dropping them from the list.
3. **The whole role window is checked week by week**, not just today. A short holiday is a caveat; long leave, contract ends and start dates change availability.
4. **Assumptions are labelled where they're used.** "End date assumed" sits on the commitment itself, and requested PTO says "requested, counted as approved".
5. **Synthetic data is tagged** `DEMO DATA` every time it influences a reason.
6. **The human stays the decider.** Anything other than _Safe_ needs an explicit acknowledgement. Going over 100% needs a written reason, which is kept with the assignment.

**What I'd do next to reduce it further:** watch two RMs use this on a real Monday and note where they overrule "Ready". Add a lightweight "skills confirmed by lead" flag so unknowns can be cleared. Show the plan-vs-actuals gap more prominently, because Grace Liu logging 48h/week against a 40h plan is exactly the kind of fact a good RM would weigh.
