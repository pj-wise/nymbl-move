import type { PlanContext, ResolvedAssignment } from './capacity'
import type { Assignment, ISODate, OpenRole, Person, Project } from './types'

/**
 * Project-level staffing as a Delivery Manager sees it. Visibility comes from assignments only
 * (supplied + this session's commits, already replayed into `ctx`), never from a job title.
 */

export const DELIVERY_MANAGER_ROLE = 'Delivery Manager'

export interface DeliveryProject {
  project: Project
  /** The viewer's own Delivery Manager assignment on this project (may be Tentative). */
  assignment: ResolvedAssignment
}

/** Projects where the person holds a current, non-zero Delivery Manager assignment. */
export function deliveryProjectsFor(ctx: PlanContext, personId: string, today: ISODate): DeliveryProject[] {
  const result: DeliveryProject[] = []
  for (const a of ctx.assignmentsByPerson.get(personId) ?? []) {
    if (a.roleOnProject !== DELIVERY_MANAGER_ROLE || a.allocationPct <= 0 || a.effectiveEnd < today) continue
    const project = ctx.projects.get(a.projectId)
    if (project && !result.some((r) => r.project.id === project.id)) result.push({ project, assignment: a })
  }
  return result
}

export type RequestState = 'open' | 'filled'

export interface StaffingRequest {
  role: OpenRole
  state: RequestState
  /** The assignment that filled the request. Its dates are the real start, not the requested one. */
  assignment: Assignment | null
}

/**
 * Open roles on a project and whether each is filled. Only the states the data has:
 * a role is filled once an assignment was committed for it; otherwise it keeps its source status.
 */
export function staffingRequestsFor(
  projectId: string,
  openRoles: OpenRole[],
  filledBy: Map<string, Assignment>,
): StaffingRequest[] {
  return openRoles
    .filter((r) => r.projectId === projectId)
    .map((role) => {
      const assignment = filledBy.get(role.id) ?? null
      return { role, state: assignment || role.status !== 'Open' ? 'filled' : 'open', assignment }
    })
}

export interface StaffingSummary {
  total: number
  open: number
  filled: number
  /** No open requests left (true when the project never had any). */
  fullyStaffed: boolean
}

export function projectStaffingSummary(requests: StaffingRequest[]): StaffingSummary {
  const open = requests.filter((r) => r.state === 'open').length
  return { total: requests.length, open, filled: requests.length - open, fullyStaffed: open === 0 }
}

export interface TeamMember {
  person: Person | undefined
  assignment: ResolvedAssignment
}

/** Current, non-zero assignments on a project, in start-date order. */
export function projectTeam(ctx: PlanContext, projectId: string, today: ISODate): TeamMember[] {
  return ctx.assignments
    .filter((a) => a.projectId === projectId && a.allocationPct > 0 && a.effectiveEnd >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.personId.localeCompare(b.personId))
    .map((assignment) => ({ person: ctx.people.get(assignment.personId), assignment }))
}
