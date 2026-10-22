import { countsToward, overallocatedSpans, type PlanContext } from './capacity'
import { TODAY, addDays, formatShort, rangesOverlap, weekdaysIn } from './dates'
import type { Dataset, Scenario } from './types'

/**
 * The "needs attention" bucket. Over-100% is always listed here explicitly (discovery-call decision),
 * never only as a colour somewhere else.
 */

export const ATTENTION_HORIZON_DAYS = 12 * 7
/** Time off at least this long, while still planned on projects, is a coverage gap rather than a vacation. */
export const LONG_ABSENCE_WORKDAYS = 10

export type AttentionKind =
  | 'overallocated'
  | 'overallocated-if-won'
  | 'absent-while-assigned'
  | 'missing-data'
  | 'contract-ending'
  | 'requested-pto'
  | 'ignored-record'

export interface AttentionItem {
  id: string
  kind: AttentionKind
  severity: 'warning' | 'notice'
  personId?: string
  title: string
  detail: string
}

export function attentionItems(ctx: PlanContext, dataset: Dataset, scenario: Scenario): AttentionItem[] {
  const items: AttentionItem[] = []
  const horizon = addDays(TODAY, ATTENTION_HORIZON_DAYS)
  const projectName = (id: string) => ctx.projects.get(id)?.name ?? id

  for (const person of ctx.people.values()) {
    const list = ctx.assignmentsByPerson.get(person.id) ?? []
    const describe = (ids: string[]) =>
      ids
        .map((id) => list.find((a) => a.id === id))
        .filter((a) => a !== undefined)
        .map((a) => `${projectName(a.projectId)} ${a.allocationPct}%${a.status === 'Tentative' ? ' (tentative)' : ''}`)
        .join(' + ')

    const confirmed = overallocatedSpans(ctx, person, TODAY, horizon, { scenario: 'confirmed' })
    for (const span of confirmed) {
      items.push({
        id: `over-${person.id}-${span.start}`,
        kind: 'overallocated',
        severity: 'warning',
        personId: person.id,
        title: `${person.name} is at ${span.peakPct}%`,
        detail: `${describe(span.assignmentIds)}, ${formatShort(span.start)}–${formatShort(span.end)}. Confirmed work.`,
      })
    }
    if (scenario === 'withTentative') {
      const confirmedKeys = new Set(confirmed.map((s) => `${s.start}-${s.end}-${s.peakPct}`))
      for (const span of overallocatedSpans(ctx, person, TODAY, horizon, { scenario })) {
        if (confirmedKeys.has(`${span.start}-${span.end}-${span.peakPct}`)) continue
        items.push({
          id: `over-won-${person.id}-${span.start}`,
          kind: 'overallocated-if-won',
          severity: 'notice',
          personId: person.id,
          title: `${person.name} would reach ${span.peakPct}% if tentative work is won`,
          detail: `${describe(span.assignmentIds)}, ${formatShort(span.start)}–${formatShort(span.end)}.`,
        })
      }
    }

    for (const t of ctx.timeOffByPerson.get(person.id) ?? []) {
      if (weekdaysIn(t.startDate, t.endDate).length < LONG_ABSENCE_WORKDAYS) continue
      const active = list.filter(
        (a) => countsToward(a, 'confirmed') && rangesOverlap(a.startDate, a.effectiveEnd, t.startDate, t.endDate),
      )
      if (active.length === 0) continue
      const pct = active.reduce((sum, a) => sum + a.allocationPct, 0)
      items.push({
        id: `absent-${t.id}`,
        kind: 'absent-while-assigned',
        severity: 'warning',
        personId: person.id,
        title: `${person.name} is on ${t.type.toLowerCase()} but still planned at ${pct}%`,
        detail: `${formatShort(t.startDate)}–${formatShort(t.endDate)}. ${active.map((a) => projectName(a.projectId)).join(', ')} need cover.`,
      })
    }

    if (person.skills.length === 0) {
      items.push({
        id: `noskills-${person.id}`,
        kind: 'missing-data',
        severity: 'warning',
        personId: person.id,
        title: `${person.name} has no skills recorded`,
        detail: 'They will show as "skills unknown" in candidate lists, not as unqualified.',
      })
    }

    if (person.contractEndDate && person.contractEndDate >= TODAY && person.contractEndDate <= horizon) {
      items.push({
        id: `contract-${person.id}`,
        kind: 'contract-ending',
        severity: 'notice',
        personId: person.id,
        title: `${person.name}'s contract ends ${formatShort(person.contractEndDate)}`,
        detail: `${person.employmentType}, ${person.weeklyCapacityHours}h/week. Not available after that date.`,
      })
    }
  }

  for (const a of ctx.assignments) {
    const person = ctx.people.get(a.personId)
    if (a.endAssumed) {
      items.push({
        id: `noend-${a.id}`,
        kind: 'missing-data',
        severity: 'warning',
        personId: a.personId,
        title: `${person?.name ?? a.personId}: ${projectName(a.projectId)} has no end date`,
        detail: `Assignment ${a.id} at ${a.allocationPct}%. We assume it ends with the project on ${formatShort(a.effectiveEnd)}. Confirm with the project lead.`,
      })
    }
    if (a.allocationPct === 0 && a.origin === 'source') {
      items.push({
        id: `zero-${a.id}`,
        kind: 'ignored-record',
        severity: 'notice',
        personId: a.personId,
        title: `${a.id} is a 0% assignment`,
        detail: `${person?.name ?? a.personId} on ${projectName(a.projectId)} until ${formatShort(a.effectiveEnd)}. Kept as history; it doesn't count toward load.`,
      })
    }
  }

  for (const t of dataset.timeOff) {
    if (t.status !== 'Requested') continue
    items.push({
      id: `pto-${t.id}`,
      kind: 'requested-pto',
      severity: 'notice',
      personId: t.personId,
      title: `${ctx.people.get(t.personId)?.name ?? t.personId}: ${t.type.toLowerCase()} requested, not yet approved`,
      detail: `${formatShort(t.startDate)}–${formatShort(t.endDate)}. Counted as time off for planning.`,
    })
  }

  return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'warning' ? -1 : 1))
}
