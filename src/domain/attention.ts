import { countsToward, overallocatedSpans, type PlanContext } from "./capacity";
import {
  TODAY,
  addDays,
  formatShort,
  rangesOverlap,
  weekdaysIn,
} from "./dates";
import type { OpenRole, RolePriority, Scenario } from "./types";

/**
 * The "needs attention" bucket: problems in the current plan that someone may need to act on.
 * Over-100% is always listed here explicitly (discovery-call decision), never only as a colour.
 *
 * General rules (requested PTO counted as approved, 0% records ignored, …) are not listed here;
 * see `planningAssumptions`. Person-specific caveats that only matter for a particular role
 * (contract end, time off) show on that candidate and in the preview, checked against the role dates.
 */

export const ATTENTION_HORIZON_DAYS = 12 * 7;
/** Time off at least this long, while still planned on projects, is a coverage gap rather than a vacation. */
export const LONG_ABSENCE_WORKDAYS = 10;

export type AttentionKind =
  | "overallocated"
  | "overallocated-if-won"
  | "absent-while-assigned"
  | "missing-data"
  | "outside-employment";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  /** `warning` = confirmed plan; `notice` = only in the "if proposed project is won" scenario. */
  severity: "warning" | "notice";
  personId?: string;
  title: string;
  detail: string;
}

export function attentionItems(
  ctx: PlanContext,
  scenario: Scenario,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const horizon = addDays(TODAY, ATTENTION_HORIZON_DAYS);
  const projectName = (id: string) => ctx.projects.get(id)?.name ?? id;

  for (const person of ctx.people.values()) {
    const list = ctx.assignmentsByPerson.get(person.id) ?? [];
    const describe = (ids: string[]) =>
      ids
        .map((id) => list.find((a) => a.id === id))
        .filter((a) => a !== undefined)
        .map(
          (a) =>
            `${projectName(a.projectId)} ${a.allocationPct}%${a.status === "Tentative" ? " (tentative)" : ""}`,
        )
        .join(" + ");

    const confirmed = overallocatedSpans(ctx, person, TODAY, horizon, {
      scenario: "confirmed",
    });
    for (const span of confirmed) {
      items.push({
        id: `over-${person.id}-${span.start}`,
        kind: "overallocated",
        severity: "warning",
        personId: person.id,
        title: `${person.name} is at ${span.peakPct}%`,
        detail: `${describe(span.assignmentIds)}, ${formatShort(span.start)}–${formatShort(span.end)}. Confirmed work.`,
      });
    }
    if (scenario === "withTentative") {
      const confirmedKeys = new Set(
        confirmed.map((s) => `${s.start}-${s.end}-${s.peakPct}`),
      );
      for (const span of overallocatedSpans(ctx, person, TODAY, horizon, {
        scenario,
      })) {
        if (confirmedKeys.has(`${span.start}-${span.end}-${span.peakPct}`))
          continue;
        items.push({
          id: `over-won-${person.id}-${span.start}`,
          kind: "overallocated-if-won",
          severity: "notice",
          personId: person.id,
          title: `${person.name} would reach ${span.peakPct}% if proposed project is won`,
          detail: `${describe(span.assignmentIds)}, ${formatShort(span.start)}–${formatShort(span.end)}.`,
        });
      }
    }

    for (const t of ctx.timeOffByPerson.get(person.id) ?? []) {
      if (weekdaysIn(t.startDate, t.endDate).length < LONG_ABSENCE_WORKDAYS)
        continue;
      const active = list.filter(
        (a) =>
          countsToward(a, "confirmed") &&
          rangesOverlap(a.startDate, a.effectiveEnd, t.startDate, t.endDate),
      );
      if (active.length === 0) continue;
      const pct = active.reduce((sum, a) => sum + a.allocationPct, 0);
      items.push({
        id: `absent-${t.id}`,
        kind: "absent-while-assigned",
        severity: "warning",
        personId: person.id,
        title: `${person.name} is on ${t.type.toLowerCase()} but still planned at ${pct}%`,
        detail: `${formatShort(t.startDate)}–${formatShort(t.endDate)}. ${active.map((a) => projectName(a.projectId)).join(", ")} need cover.`,
      });
    }

    if (person.skills.length === 0) {
      items.push({
        id: `noskills-${person.id}`,
        kind: "missing-data",
        severity: "warning",
        personId: person.id,
        title: `${person.name} has no skills recorded`,
        detail:
          'They will show as "skills unknown" in candidate lists, not as unqualified.',
      });
    }

    // Work planned before someone starts or after their contract ends (checked per assignment).
    for (const a of list) {
      if (!countsToward(a, "confirmed") || a.effectiveEnd < TODAY) continue;
      const outside: string[] = [];
      if (a.startDate < person.startDate)
        outside.push(
          `starts ${formatShort(person.startDate)}, but is planned from ${formatShort(a.startDate)}`,
        );
      if (person.contractEndDate && a.effectiveEnd > person.contractEndDate)
        outside.push(
          `contract ends ${formatShort(person.contractEndDate)}, but is planned until ${formatShort(a.effectiveEnd)}`,
        );
      if (outside.length === 0) continue;
      items.push({
        id: `outside-${a.id}`,
        kind: "outside-employment",
        severity: "warning",
        personId: person.id,
        title: `${person.name} is planned outside their employment dates`,
        detail: `${projectName(a.projectId)} ${a.allocationPct}%: ${outside.join("; ")}.`,
      });
    }
  }

  for (const a of ctx.assignments) {
    if (!a.endAssumed || a.allocationPct <= 0 || a.startDate > horizon)
      continue;
    const person = ctx.people.get(a.personId);
    items.push({
      id: `noend-${a.id}`,
      kind: "missing-data",
      severity: "warning",
      personId: a.personId,
      title: `${person?.name ?? a.personId}: ${projectName(a.projectId)} has no end date`,
      detail: `${a.allocationPct}% from ${formatShort(a.startDate)}. Planned to run until the project ends on ${formatShort(a.effectiveEnd)}. Confirm with the project lead.`,
    });
  }

  return items.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1,
  );
}

export type IssueCategory = "conflict" | "data";

/** Filter groups in the notification center. */
export const ISSUE_CATEGORY: Record<AttentionKind, IssueCategory> = {
  overallocated: "conflict",
  "overallocated-if-won": "conflict",
  "absent-while-assigned": "conflict",
  "outside-employment": "conflict",
  "missing-data": "data",
};

const PRIORITY_ORDER: Record<RolePriority, number> = {
  "Must fill": 0,
  "Nice to fill": 1,
  "If won": 2,
};

export interface IssueTarget {
  roleId: string;
  personId: string;
}

/**
 * Where to send the user to act on an issue: an open role on which this person is a candidate.
 * 1. a role they were assigned to in this session (so it can be reviewed or undone),
 * 2. the selected role, if it's for their discipline and still open,
 * 3. the first open role for their discipline (Must fill first, then soonest start).
 * Null when no open role fits, e.g. there are no Data Engineer roles.
 */
export function issueTarget(
  item: AttentionItem,
  opts: {
    ctx: PlanContext;
    openRoles: OpenRole[];
    filledRoles: Map<string, string>;
    selectedRoleId: string | null;
  },
): IssueTarget | null {
  const person = item.personId ? opts.ctx.people.get(item.personId) : undefined;
  if (!person) return null;
  for (const [roleId, personId] of opts.filledRoles) {
    if (personId === person.id) return { roleId, personId };
  }
  const candidates = opts.openRoles
    .filter(
      (r) =>
        r.roleNeeded === person.role &&
        r.status === "Open" &&
        !opts.filledRoles.has(r.id),
    )
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.startDate.localeCompare(b.startDate),
    );
  const role =
    candidates.find((r) => r.id === opts.selectedRoleId) ?? candidates[0];
  return role ? { roleId: role.id, personId: person.id } : null;
}
