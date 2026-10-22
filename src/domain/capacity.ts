import { addDays, inRange, maxDate, minDate, weekStartOf, weeksIn, weekdaysIn } from './dates'
import type { Assignment, Dataset, Holiday, ISODate, Person, Project, Scenario, TimeOff } from './types'

/**
 * Capacity conventions (see docs/DECISIONS.md):
 * - Assignment and time-off intervals are inclusive of both start and end dates.
 * - A working day is Mon–Fri, minus company holidays.
 * - Daily capacity = weekly_capacity_hours / 5 (pro-rated: 24h/wk → 4.8h/day), because the data has no
 *   per-weekday schedule. A holiday therefore removes 4.8h for Chris Morgan, not 8h.
 * - allocation_pct is a share of the person's own capacity on each day the assignment is active.
 * - 0% assignments are kept as records but never consume capacity.
 */

export interface ResolvedAssignment extends Assignment {
  /** End date used for maths. Equals `endDate` unless the source was missing it. */
  effectiveEnd: ISODate
  /** True when `effectiveEnd` was inferred (from the project end) rather than supplied. */
  endAssumed: boolean
}

export interface PlanContext {
  people: Map<string, Person>
  projects: Map<string, Project>
  holidays: Map<ISODate, Holiday>
  timeOffByPerson: Map<string, TimeOff[]>
  assignments: ResolvedAssignment[]
  assignmentsByPerson: Map<string, ResolvedAssignment[]>
}

export function resolveAssignment(a: Assignment, project: Project | undefined): ResolvedAssignment {
  if (a.endDate) return { ...a, effectiveEnd: a.endDate, endAssumed: false }
  // Missing end date: fall back to the project's end and flag it. Source stays null.
  const fallback = project?.endDate ?? a.startDate
  return { ...a, effectiveEnd: fallback, endAssumed: true }
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}

export function buildPlanContext(dataset: Dataset, assignments: Assignment[] = dataset.assignments): PlanContext {
  const projects = new Map(dataset.projects.map((p) => [p.id, p]))
  const resolved = assignments.map((a) => resolveAssignment(a, projects.get(a.projectId)))
  return {
    people: new Map(dataset.people.map((p) => [p.id, p])),
    projects,
    holidays: new Map(dataset.holidays.map((h) => [h.date, h])),
    timeOffByPerson: groupBy(dataset.timeOff, (t) => t.personId),
    assignments: resolved,
    assignmentsByPerson: groupBy(resolved, (a) => a.personId),
  }
}

/** Does this assignment consume capacity under the chosen scenario? */
export function countsToward(a: Assignment, scenario: Scenario): boolean {
  if (a.allocationPct <= 0) return false
  return a.status === 'Confirmed' || scenario === 'withTentative'
}

export function dailyCapacityHours(person: Person): number {
  return person.weeklyCapacityHours / 5
}

export type AwayReason = 'holiday' | 'time-off' | 'not-started' | 'contract-ended'

export interface AwayDay {
  date: ISODate
  reason: AwayReason
  label: string
  /** Set for time off, so the UI can show the original status (e.g. Requested). */
  timeOff?: TimeOff
}

export function isEmployedOn(person: Person, date: ISODate): boolean {
  if (date < person.startDate) return false
  if (person.contractEndDate && date > person.contractEndDate) return false
  return true
}

/** Why a person can't work on a weekday, or null if they can. */
export function awayOn(ctx: PlanContext, person: Person, date: ISODate): AwayDay | null {
  if (date < person.startDate) return { date, reason: 'not-started', label: `Starts ${person.startDate}` }
  if (person.contractEndDate && date > person.contractEndDate)
    return { date, reason: 'contract-ended', label: `Contract ended ${person.contractEndDate}` }
  const holiday = ctx.holidays.get(date)
  if (holiday) return { date, reason: 'holiday', label: holiday.name }
  const timeOff = ctx.timeOffByPerson.get(person.id)?.find((t) => inRange(date, t.startDate, t.endDate))
  if (timeOff) return { date, reason: 'time-off', label: timeOff.type, timeOff }
  return null
}

export interface LoadOptions {
  scenario: Scenario
  /** Override the person's assignment list (used by the preview to model a change). */
  assignments?: ResolvedAssignment[]
}

function personAssignments(ctx: PlanContext, person: Person, opts: LoadOptions): ResolvedAssignment[] {
  return opts.assignments ?? ctx.assignmentsByPerson.get(person.id) ?? []
}

/** Sum of allocation % active on a day, ignoring whether the person is actually in that day. */
export function plannedPctOn(assignments: ResolvedAssignment[], date: ISODate, scenario: Scenario): number {
  let pct = 0
  for (const a of assignments) {
    if (countsToward(a, scenario) && inRange(date, a.startDate, a.effectiveEnd)) pct += a.allocationPct
  }
  return pct
}

export interface PeriodLoad {
  weekStart: ISODate
  start: ISODate
  end: ISODate
  /** Weekdays in the period that aren't company holidays. */
  workdays: number
  /** Workdays the person is employed and not on time off. */
  availableDays: number
  capacityHours: number
  committedHours: number
  freeHours: number
  /** Highest planned allocation on any available day; null when the person isn't available at all. */
  peakPct: number | null
  away: AwayDay[]
  byAssignment: { assignmentId: string; projectId: string; hours: number }[]
}

export function periodLoad(
  ctx: PlanContext,
  person: Person,
  start: ISODate,
  end: ISODate,
  opts: LoadOptions,
): PeriodLoad {
  const list = personAssignments(ctx, person, opts)
  const daily = dailyCapacityHours(person)
  const byAssignment = new Map<string, { assignmentId: string; projectId: string; hours: number }>()
  const away: AwayDay[] = []
  let workdays = 0
  let availableDays = 0
  let committedHours = 0
  let peakPct: number | null = null

  for (const date of weekdaysIn(start, end)) {
    if (!ctx.holidays.has(date)) workdays++
    const off = awayOn(ctx, person, date)
    if (off) {
      away.push(off)
      continue
    }
    availableDays++
    let dayPct = 0
    for (const a of list) {
      if (!countsToward(a, opts.scenario) || !inRange(date, a.startDate, a.effectiveEnd)) continue
      dayPct += a.allocationPct
      const hours = (a.allocationPct / 100) * daily
      committedHours += hours
      const entry = byAssignment.get(a.id) ?? { assignmentId: a.id, projectId: a.projectId, hours: 0 }
      entry.hours += hours
      byAssignment.set(a.id, entry)
    }
    peakPct = Math.max(peakPct ?? 0, dayPct)
  }

  const capacityHours = availableDays * daily
  return {
    weekStart: weekStartOf(start),
    start,
    end,
    workdays,
    availableDays,
    capacityHours,
    committedHours,
    freeHours: capacityHours - committedHours,
    peakPct,
    away,
    byAssignment: [...byAssignment.values()],
  }
}

/** One PeriodLoad per week touched by [start, end], each clipped to the range. */
export function weeklyLoad(
  ctx: PlanContext,
  person: Person,
  start: ISODate,
  end: ISODate,
  opts: LoadOptions,
): PeriodLoad[] {
  return weeksIn(start, end).map((monday) =>
    periodLoad(ctx, person, maxDate(monday, start), minDate(addDays(monday, 4), end), opts),
  )
}

export interface OverallocationSpan {
  start: ISODate
  end: ISODate
  peakPct: number
  assignmentIds: string[]
}

/**
 * Contiguous runs of weekdays where planned allocation exceeds 100%.
 * Holidays and time off don't break a run: the plan itself is over-committed either way.
 */
export function overallocatedSpans(
  ctx: PlanContext,
  person: Person,
  from: ISODate,
  to: ISODate,
  opts: LoadOptions,
): OverallocationSpan[] {
  const list = personAssignments(ctx, person, opts)
  const spans: OverallocationSpan[] = []
  let current: OverallocationSpan | null = null

  for (const date of weekdaysIn(from, to)) {
    const pct = isEmployedOn(person, date) ? plannedPctOn(list, date, opts.scenario) : 0
    if (pct > 100) {
      const ids = list
        .filter((a) => countsToward(a, opts.scenario) && inRange(date, a.startDate, a.effectiveEnd))
        .map((a) => a.id)
      if (current) {
        current.end = date
        current.peakPct = Math.max(current.peakPct, pct)
        for (const id of ids) if (!current.assignmentIds.includes(id)) current.assignmentIds.push(id)
      } else {
        current = { start: date, end: date, peakPct: pct, assignmentIds: ids }
      }
    } else if (current) {
      spans.push(current)
      current = null
    }
  }
  if (current) spans.push(current)
  return spans
}

export function overlapsRange(a: ResolvedAssignment, start: ISODate, end: ISODate): boolean {
  return a.startDate <= end && start <= a.effectiveEnd
}

/** Strip derived fields so a resolved assignment can be stored back as a plain record. */
export function toAssignment({ effectiveEnd: _end, endAssumed: _assumed, ...rest }: ResolvedAssignment): Assignment {
  return rest
}
