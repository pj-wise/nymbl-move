import type { PreviewWeek } from "./preview";
import type { ISODate } from "./types";

/**
 * Collapses runs of identical weeks so the breakdown reads as periods ("Nov 30 – Dec 18, 3 weeks at
 * 200%") instead of 28 near-duplicate rows. Purely presentational: no numbers are recalculated.
 *
 * Weeks merge only when they are identical in every respect the UI shows: working capacity, committed
 * hours, new hours, tentative and released hours, and the exact set of projects with their hours.
 * Weeks with any holiday or time off never merge with anything, so availability changes always stand
 * alone. The one exception is a run of fully-away weeks from the same time-off record (e.g. an
 * 11-week leave), which is one fact and is shown as one period.
 */

/**
 * over: assigned beyond working capacity. conflict: no working days but work is still planned.
 * away: no working days and nothing planned. reduced: some days off. at-risk: over only if tentative
 * work is won. full / room: within capacity.
 */
export type WeekStatus =
  | "over"
  | "conflict"
  | "away"
  | "reduced"
  | "at-risk"
  | "full"
  | "room";

export interface WeekGroup {
  /** First week's Monday; stable id for the group. */
  key: ISODate;
  weeks: PreviewWeek[];
  start: ISODate;
  end: ISODate;
  status: WeekStatus;
}

export interface WeekSummary {
  over: number;
  /** Away all week while work is still planned. */
  conflict: number;
  /** Away all week, nothing planned. */
  away: number;
  /** Weeks with some days off but some working capacity left. */
  reduced: number;
  /** Exactly at 100% of working capacity. */
  full: number;
  room: number;
  /** Within capacity now, over if proposed project is won (only counted when tentative work is shown). */
  atRisk: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function weekStatus(
  w: PreviewWeek,
  includeTentative: boolean,
): WeekStatus {
  if (w.workdays > 0 && w.capacityHours === 0)
    return w.plannedOnDaysOffHours > 0 ? "conflict" : "away";
  if ((w.afterPct ?? 0) > 100) return "over";
  if (w.away.length > 0) return "reduced";
  if (includeTentative && (w.afterWithTentativePct ?? 0) > 100)
    return "at-risk";
  return (w.afterPct ?? 0) >= 100 ? "full" : "room";
}

function signature(w: PreviewWeek, includeTentative: boolean): string {
  const away = w.workdays > 0 && w.capacityHours === 0;
  if (w.away.length > 0 && !away) return `partial-away:${w.weekStart}`; // never merges
  const awayKey = away
    ? [...new Set(w.away.flatMap((d) => (d.timeOff ? [d.timeOff.id] : [])))]
        .sort()
        .join(",") || `away:${w.weekStart}`
    : "";
  return JSON.stringify([
    round(w.capacityHours),
    round(w.committedHours),
    round(w.newHours),
    includeTentative ? round(w.tentativeHours) : 0,
    round(w.releasedHours),
    round(w.plannedOnDaysOffHours),
    awayKey,
    w.contributions.map((c) => [c.assignmentId, c.kind, round(c.hours)]).sort(),
  ]);
}

export function groupWeeks(
  weeks: PreviewWeek[],
  includeTentative: boolean,
): WeekGroup[] {
  const groups: WeekGroup[] = [];
  let previous = "";
  for (const w of weeks) {
    const sig = signature(w, includeTentative);
    const last = groups.at(-1);
    if (last && sig === previous) {
      last.weeks.push(w);
      last.end = w.end;
    } else {
      groups.push({
        key: w.weekStart,
        weeks: [w],
        start: w.start,
        end: w.end,
        status: weekStatus(w, includeTentative),
      });
    }
    previous = sig;
  }
  return groups;
}

export function summarizeWeeks(
  weeks: PreviewWeek[],
  includeTentative: boolean,
): WeekSummary {
  const summary: WeekSummary = {
    over: 0,
    conflict: 0,
    away: 0,
    reduced: 0,
    full: 0,
    room: 0,
    atRisk: 0,
  };
  for (const w of weeks) {
    const status = weekStatus(w, includeTentative);
    if (status === "over") summary.over++;
    else if (status === "conflict") summary.conflict++;
    else if (status === "away") summary.away++;
    else if (status === "reduced") summary.reduced++;
    else if (status === "at-risk") summary.atRisk++;
    else if (status === "full") summary.full++;
    else summary.room++;
  }
  return summary;
}
