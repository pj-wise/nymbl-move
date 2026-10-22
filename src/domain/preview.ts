import {
  awayOn,
  countsToward,
  dailyCapacityHours,
  isReleasableFor,
  overallocatedSpans,
  overlapsRange,
  plannedPctOn,
  releasedVersion,
  resolveAssignment,
  weeklyLoad,
  type AwayDay,
  type OverallocationSpan,
  type PlanContext,
  type ResolvedAssignment,
} from "./capacity";
import { LEVEL_RANK, matchSkills } from "./candidates";
import { formatShort, weekdaysIn } from "./dates";
import type { Assignment, ISODate, OpenRole, Person, Project } from "./types";

/**
 * Previewing a staffing move is a pure function: (plan, role, person, options) → before/after.
 * Nothing is mutated; committing is a separate step that appends the returned changes.
 */

export interface PreviewOptions {
  /** Move the person off internal (reallocatable) work for the role's dates. */
  releaseInternal: boolean;
}

export type IssueSeverity = "blocker" | "decision" | "heads-up";

export interface PreviewIssue {
  severity: IssueSeverity;
  code:
    | "not-employed"
    | "overallocated"
    | "overallocated-if-won"
    | "long-absence"
    | "time-off"
    | "contract-ends"
    | "starts-late"
    | "skills-not-listed"
    | "level-below"
    | "internal-release"
    | "internal-kept"
    | "end-assumed";
  message: string;
}

export interface ReleasedCommitment {
  original: ResolvedAssignment;
  /** Replacement record (ends the day before the role starts), or null if removed entirely. */
  replacement: Assignment | null;
  hoursPerWeekFreed: number;
  from: ISODate;
  until: ISODate;
}

export interface CommitmentImpact {
  assignment: ResolvedAssignment;
  project: Project | undefined;
  kind: "new" | "released" | "unchanged";
  hoursPerWeek: number;
  /** Planned or tentative, so the UI can keep them visually distinct. */
  status: Assignment["status"];
}

export type ContributionKind = "existing" | "new" | "released" | "tentative";

/** One project's share of a person's hours in one week. */
export interface WeekContribution {
  assignmentId: string;
  projectId: string;
  projectName: string;
  allocationPct: number;
  hours: number;
  /** Working days this assignment is counted on in the week (hours = allocation % × daily hours × days). */
  days: number;
  kind: ContributionKind;
  internal: boolean;
}

/**
 * Week-by-week hours for the preview. Every number is derived from supplied data.
 *
 * Proration rule (one rule, used everywhere): an allocation applies to the days the person actually
 * works. Hours = allocation % × (weekly capacity ÷ 5) × working days. A 100% allocation in a week
 * with 2 days off is therefore 24h, not 40h. Days off don't silently disappear, though: the hours
 * the plan has on them are reported separately as `plannedOnDaysOffHours`, and a week with no working
 * days but planned work is a coverage conflict.
 *
 * Terms shown in the UI:
 * - working capacity = capacityHours (after holidays and time off)
 * - committed = existing confirmed work; proposed = this role
 * - free = max(0, capacity − committed − proposed); over capacity = max(0, committed + proposed − capacity)
 * - utilization = (committed + proposed) ÷ capacity; null ("Away") when capacity is 0
 */
export interface PreviewWeek {
  weekStart: ISODate;
  /** The part of the week inside the role window. */
  start: ISODate;
  end: ISODate;
  /** Weekdays in range that aren't company holidays. */
  workdays: number;
  availableDays: number;
  away: AwayDay[];
  capacityHours: number;
  /** Confirmed work already planned, after any release. */
  committedHours: number;
  /** Internal hours this move frees up. */
  releasedHours: number;
  /** Hours the new role adds. */
  newHours: number;
  /** Other tentative work, counted only if it is won. */
  tentativeHours: number;
  /** committed + new. */
  totalHours: number;
  /** Working capacity left after committed + proposed work. Never negative. */
  freeHours: number;
  /** Assigned hours beyond working capacity. 0 when within capacity. */
  overHours: number;
  /**
   * Committed + proposed hours the plan has on days the person can't work (time off, before start,
   * after contract end). Company holidays are excluded: the whole firm is off, so no work is expected.
   */
  plannedOnDaysOffHours: number;
  /** Utilization as % of working capacity; null when the person has no working days (Away). */
  beforePct: number | null;
  afterPct: number | null;
  afterWithTentativePct: number | null;
  contributions: WeekContribution[];
}

export type Verdict = "safe" | "needs-decision" | "blocked";

export interface StaffingPreview {
  role: OpenRole;
  person: Person;
  project: Project | undefined;
  proposed: Assignment;
  released: ReleasedCommitment[];
  weeks: PreviewWeek[];
  commitments: CommitmentImpact[];
  overSpans: OverallocationSpan[];
  overSpansIfWon: OverallocationSpan[];
  peakBeforePct: number;
  peakAfterPct: number;
  peakAfterWithTentativePct: number;
  issues: PreviewIssue[];
  verdict: Verdict;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  safe: "Safe to assign",
  "needs-decision": "Needs a decision",
  blocked: "Blocked",
};

const peak = (values: (number | null)[]) =>
  Math.max(0, ...values.map((v) => v ?? 0));

export function proposedAssignmentFor(
  role: OpenRole,
  person: Person,
  project: Project | undefined,
): Assignment {
  return {
    id: `LOCAL-${role.id}-${person.id}`,
    personId: person.id,
    projectId: role.projectId,
    roleOnProject: role.roleNeeded,
    allocationPct: role.allocationPct,
    startDate: role.startDate,
    endDate: role.endDate,
    // Staffing a proposed project can only ever be tentative until the deal closes.
    status: project?.status === "Proposed" ? "Tentative" : "Confirmed",
    origin: "local",
  };
}

export function previewAssignment(
  ctx: PlanContext,
  role: OpenRole,
  person: Person,
  options: PreviewOptions,
): StaffingPreview {
  const project = ctx.projects.get(role.projectId);
  const current = ctx.assignmentsByPerson.get(person.id) ?? [];
  const proposed = proposedAssignmentFor(role, person, project);

  // Internal work that overlaps the role and could be released.
  const internal = current.filter((a) => isReleasableFor(ctx, a, role));
  const released: ReleasedCommitment[] = options.releaseInternal
    ? internal.map((a) => ({
        original: a,
        replacement: releasedVersion(a, role),
        hoursPerWeekFreed: (a.allocationPct / 100) * person.weeklyCapacityHours,
        from: role.startDate,
        until: a.effectiveEnd,
      }))
    : [];

  const releasedIds = new Set(released.map((r) => r.original.id));
  const existingAfter: ResolvedAssignment[] = [
    ...current.filter((a) => !releasedIds.has(a.id)),
    ...released.flatMap((r) =>
      r.replacement
        ? [
            resolveAssignment(
              r.replacement,
              ctx.projects.get(r.replacement.projectId),
            ),
          ]
        : [],
    ),
  ];
  // The move being previewed always counts, even when it will be recorded as tentative
  // (an If-won role): the question on screen is "what happens if I do this?".
  const proposedForMaths = resolveAssignment(
    { ...proposed, status: "Confirmed" },
    project,
  );
  const after = [...existingAfter, proposedForMaths];

  const before = weeklyLoad(ctx, person, role.startDate, role.endDate, {
    scenario: "confirmed",
  });
  const weeks = weekBreakdown(
    ctx,
    person,
    role,
    current,
    existingAfter,
    proposedForMaths,
    releasedIds,
  );

  const overSpans = overallocatedSpans(
    ctx,
    person,
    role.startDate,
    role.endDate,
    {
      scenario: "confirmed",
      assignments: after,
    },
  );
  const overSpansIfWon = overallocatedSpans(
    ctx,
    person,
    role.startDate,
    role.endDate,
    {
      scenario: "withTentative",
      assignments: after,
    },
  );

  const commitments: CommitmentImpact[] = [
    {
      assignment: resolveAssignment(proposed, project),
      project,
      kind: "new" as const,
    },
    ...current
      .filter(
        (a) =>
          a.allocationPct > 0 && overlapsRange(a, role.startDate, role.endDate),
      )
      .map((a) => ({
        assignment: a,
        project: ctx.projects.get(a.projectId),
        kind: releasedIds.has(a.id)
          ? ("released" as const)
          : ("unchanged" as const),
      })),
  ].map((c) => ({
    ...c,
    hoursPerWeek:
      (c.assignment.allocationPct / 100) * person.weeklyCapacityHours,
    status: c.assignment.status,
  }));

  const issues = collectIssues({
    ctx,
    role,
    person,
    proposed,
    before,
    internal,
    released,
    overSpans,
    overSpansIfWon,
    current,
  });
  const verdict: Verdict = issues.some((i) => i.severity === "blocker")
    ? "blocked"
    : issues.some((i) => i.severity === "decision")
      ? "needs-decision"
      : "safe";

  return {
    role,
    person,
    project,
    proposed,
    released,
    weeks,
    commitments,
    overSpans,
    overSpansIfWon,
    peakBeforePct: peak(weeks.map((w) => w.beforePct)),
    peakAfterPct: peak(weeks.map((w) => w.afterPct)),
    peakAfterWithTentativePct: peak(weeks.map((w) => w.afterWithTentativePct)),
    issues,
    verdict,
  };
}

const pctOf = (hours: number, capacity: number) =>
  capacity > 0 ? Math.round((hours / capacity) * 100) : null;

function weekBreakdown(
  ctx: PlanContext,
  person: Person,
  role: OpenRole,
  current: ResolvedAssignment[],
  existingAfter: ResolvedAssignment[],
  proposed: ResolvedAssignment,
  releasedIds: Set<string>,
): PreviewWeek[] {
  const load = (
    assignments: ResolvedAssignment[],
    scenario: "confirmed" | "withTentative",
  ) =>
    weeklyLoad(ctx, person, role.startDate, role.endDate, {
      scenario,
      assignments,
    });
  const before = load(current, "confirmed");
  // Includes tentative work; split back out by assignment status below.
  const existing = load(existingAfter, "withTentative");
  const added = load([proposed], "confirmed");
  const byId = new Map([...current, ...existingAfter].map((a) => [a.id, a]));
  const daily = dailyCapacityHours(person);
  const plannedAfter = [...existingAfter, proposed];

  return before.map((b, i) => {
    let plannedOnDaysOffHours = 0;
    for (const day of weekdaysIn(b.start, b.end)) {
      const off = awayOn(ctx, person, day);
      if (!off || off.reason === "holiday") continue;
      plannedOnDaysOffHours +=
        (plannedPctOn(plannedAfter, day, "confirmed") / 100) * daily;
    }

    const e = existing[i] ?? b;
    const contributions: WeekContribution[] = [];
    let committedHours = 0;
    let tentativeHours = 0;
    for (const c of e.byAssignment) {
      const a = byId.get(c.assignmentId);
      if (!a || c.hours <= 0) continue;
      const tentative = a.status === "Tentative";
      if (tentative) tentativeHours += c.hours;
      else committedHours += c.hours;
      contributions.push(
        contribution(
          ctx,
          a,
          c.hours,
          tentative ? "tentative" : "existing",
          daily,
        ),
      );
    }

    let releasedHours = 0;
    for (const c of b.byAssignment) {
      if (!releasedIds.has(c.assignmentId)) continue;
      const stillCounted =
        e.byAssignment.find((x) => x.assignmentId === c.assignmentId)?.hours ??
        0;
      const freed = c.hours - stillCounted;
      const a = byId.get(c.assignmentId);
      if (a && freed > 0) {
        releasedHours += freed;
        contributions.push(contribution(ctx, a, freed, "released", daily));
      }
    }

    const newHours = added[i]?.committedHours ?? 0;
    if (newHours > 0)
      contributions.push(contribution(ctx, proposed, newHours, "new", daily));

    const totalHours = committedHours + newHours;
    return {
      freeHours: Math.max(0, b.capacityHours - totalHours),
      overHours: Math.max(0, totalHours - b.capacityHours),
      plannedOnDaysOffHours,
      weekStart: b.weekStart,
      start: b.start,
      end: b.end,
      workdays: b.workdays,
      availableDays: b.availableDays,
      away: b.away,
      capacityHours: b.capacityHours,
      committedHours,
      releasedHours,
      newHours,
      tentativeHours,
      totalHours,
      beforePct: pctOf(b.committedHours, b.capacityHours),
      afterPct: pctOf(totalHours, b.capacityHours),
      afterWithTentativePct: pctOf(
        totalHours + tentativeHours,
        b.capacityHours,
      ),
      contributions,
    };
  });
}

function contribution(
  ctx: PlanContext,
  a: ResolvedAssignment,
  hours: number,
  kind: ContributionKind,
  daily: number,
): WeekContribution {
  const project = ctx.projects.get(a.projectId);
  return {
    assignmentId: a.id,
    projectId: a.projectId,
    projectName: project?.name ?? a.projectId,
    allocationPct: a.allocationPct,
    hours,
    days:
      a.allocationPct > 0
        ? Math.round(hours / ((a.allocationPct / 100) * daily))
        : 0,
    kind,
    internal: project?.status === "Internal",
  };
}

function spanText(spans: OverallocationSpan[]): string {
  return spans
    .map(
      (s) =>
        `up to ${s.peakPct}% (${formatShort(s.start)}–${formatShort(s.end)})`,
    )
    .join("; ");
}

function collectIssues(input: {
  ctx: PlanContext;
  role: OpenRole;
  person: Person;
  proposed: Assignment;
  before: ReturnType<typeof weeklyLoad>;
  internal: ResolvedAssignment[];
  released: ReleasedCommitment[];
  overSpans: OverallocationSpan[];
  overSpansIfWon: OverallocationSpan[];
  current: ResolvedAssignment[];
}): PreviewIssue[] {
  const {
    ctx,
    role,
    person,
    proposed,
    before,
    internal,
    released,
    overSpans,
    overSpansIfWon,
    current,
  } = input;
  const ifWon =
    proposed.status === "Tentative" ? " Only if the project is won." : "";
  const issues: PreviewIssue[] = [];
  const name = person.name.split(" ")[0] ?? person.name;

  const employmentGap = (reason: string) =>
    reason === "not-started" || reason === "contract-ended";
  const employedDays = before.reduce(
    (n, w) =>
      n + w.workdays - w.away.filter((d) => employmentGap(d.reason)).length,
    0,
  );
  if (employedDays <= 0) {
    issues.push({
      severity: "blocker",
      code: "not-employed",
      message: `${name} is not employed at any point during this role.`,
    });
  }

  if (overSpans.length > 0) {
    issues.push({
      severity: "decision",
      code: "overallocated",
      message: `${name} would be over 100% of capacity: ${spanText(overSpans)}.${ifWon}`,
    });
  }
  if (
    overSpansIfWon.length > 0 &&
    spanText(overSpansIfWon) !== spanText(overSpans)
  ) {
    issues.push({
      severity: "heads-up",
      code: "overallocated-if-won",
      message: `if proposed project is won, ${name} would reach ${spanText(overSpansIfWon)}. Not counted in the confirmed plan.`,
    });
  }

  if (person.startDate > role.startDate) {
    issues.push({
      severity: "decision",
      code: "starts-late",
      message: `${name} starts ${formatShort(person.startDate)}, after the role starts ${formatShort(role.startDate)}.`,
    });
  }
  if (person.contractEndDate && person.contractEndDate < role.endDate) {
    issues.push({
      severity: "decision",
      code: "contract-ends",
      message: `Contract ends ${formatShort(person.contractEndDate)}; the role runs to ${formatShort(role.endDate)}. Someone else is needed after that, or an extension.`,
    });
  }

  for (const t of ctx.timeOffByPerson.get(person.id) ?? []) {
    if (t.endDate < role.startDate || t.startDate > role.endDate) continue;
    const days = before.reduce(
      (n, w) => n + w.away.filter((d) => d.timeOff?.id === t.id).length,
      0,
    );
    const status =
      t.status === "Requested" ? " Requested, not yet approved." : "";
    issues.push({
      severity: days > 5 ? "decision" : "heads-up",
      code: days > 5 ? "long-absence" : "time-off",
      message: `${t.type} ${formatShort(t.startDate)}–${formatShort(t.endDate)} (${days} working days in this role).${status}`,
    });
  }

  const skills = matchSkills(person, role.skillsRequired);
  if (skills.profileEmpty) {
    issues.push({
      severity: "decision",
      code: "skills-not-listed",
      message: `${name} has no skills recorded. Confirm with their lead before assigning.`,
    });
  } else if (skills.notListed.length > 0) {
    issues.push({
      severity: "decision",
      code: "skills-not-listed",
      message: `${skills.notListed.join(", ")} not listed in ${name}'s profile. Unknown, not confirmed missing.`,
    });
  }
  if (LEVEL_RANK[person.level] < LEVEL_RANK[role.level]) {
    issues.push({
      severity: "decision",
      code: "level-below",
      message: `${person.level}; the role asks for ${role.level}.`,
    });
  }

  for (const r of released) {
    const projectName =
      ctx.projects.get(r.original.projectId)?.name ?? r.original.projectId;
    issues.push({
      severity: "decision",
      code: "internal-release",
      message: `${projectName} (internal) loses ${round(r.hoursPerWeekFreed)}h/week from ${formatShort(r.from)} to ${formatShort(r.until)}. Its owner should know.`,
    });
  }
  if (released.length === 0) {
    for (const a of internal) {
      issues.push({
        severity: "heads-up",
        code: "internal-kept",
        message: `Keeps ${a.allocationPct}% on ${ctx.projects.get(a.projectId)?.name ?? a.projectId} (internal) until ${formatShort(a.effectiveEnd)}.`,
      });
    }
  }

  for (const a of current) {
    if (
      a.endAssumed &&
      countsToward(a, "confirmed") &&
      a.effectiveEnd >= role.startDate
    ) {
      issues.push({
        severity: "decision",
        code: "end-assumed",
        message: `${ctx.projects.get(a.projectId)?.name ?? a.projectId} has no end date for ${name}. Planned to run until the project ends on ${formatShort(a.effectiveEnd)}; confirm before relying on it.`,
      });
    }
  }

  return issues;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Apply a committed preview to an assignment list, returning a new list.
 * Released internal work is ended the day before the role starts (or removed if it starts later).
 */
export function applyPreview(
  assignments: Assignment[],
  preview: StaffingPreview,
): Assignment[] {
  const releasedById = new Map(preview.released.map((r) => [r.original.id, r]));
  const out: Assignment[] = [];
  for (const a of assignments) {
    const release = releasedById.get(a.id);
    if (!release) out.push(a);
    else if (release.replacement) out.push(release.replacement);
  }
  out.push(preview.proposed);
  return out;
}
