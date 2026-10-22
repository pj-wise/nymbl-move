import { periodLoad, type PlanContext } from './capacity'
import { addDays } from './dates'
import type { HoursLogged, Person } from './types'

/**
 * Logged hours are historical actuals. They are shown next to the plan as context
 * (e.g. someone consistently logging 48h against a 40h plan) and never replace planned load.
 */

export interface ActualsSummary {
  weeksLogged: number
  /** Weeks covered by the timesheet export; fewer logged weeks = missing timesheets, not zero hours. */
  weeksInPeriod: number
  avgLoggedHours: number
  avgPlannedHours: number
  /** avgLogged - avgPlanned; positive = working more than planned. */
  gapHours: number
}

export function recentActuals(
  ctx: PlanContext,
  person: Person,
  hoursLogged: HoursLogged[],
): ActualsSummary | null {
  const entries = hoursLogged.filter((h) => h.personId === person.id)
  if (entries.length === 0) return null

  const weeks = [...new Set(entries.map((h) => h.weekStart))].sort()
  const totalLogged = entries.reduce((sum, h) => sum + h.hours, 0)
  const totalPlanned = weeks.reduce(
    (sum, monday) =>
      sum + periodLoad(ctx, person, monday, addDays(monday, 4), { scenario: 'confirmed' }).committedHours,
    0,
  )
  const avgLoggedHours = totalLogged / weeks.length
  const avgPlannedHours = totalPlanned / weeks.length
  return {
    weeksLogged: weeks.length,
    weeksInPeriod: new Set(hoursLogged.map((h) => h.weekStart)).size,
    avgLoggedHours,
    avgPlannedHours,
    gapHours: avgLoggedHours - avgPlannedHours,
  }
}
