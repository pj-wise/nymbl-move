/**
 * App permissions, kept separate from two other things they are easy to confuse with:
 * - a person's job title (`person.role` in the supplied data), and
 * - which projects they work on (derived from assignments, see `src/domain/projectStaffing.ts`).
 *
 * There is no authentication yet. A real identity provider would supply `AppUser.appRoles`;
 * everything below only reads them, so it can stay as-is when that arrives.
 */

import type { Person } from '@/domain/types'

export type Permission =
  /** Compare candidates and assign people to open roles. */
  | 'staffing:assign'
  /**
   * Raise staffing requests (open roles) on a project. Modelled, no UI yet. Held by Resource
   * Managers so a project can get its first requests before it has a Delivery Manager; a future
   * `project-admin` role would hold it too.
   */
  | 'requests:create'
  /** See the projects you're assigned to as Delivery Manager, and their staffing. */
  | 'projects:view-assigned'

/** Application roles. Not job titles: a Delivery Manager by title may hold either, both or neither. */
export type AppRole = 'resource-manager' | 'delivery-manager'

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  'resource-manager': ['staffing:assign', 'requests:create'],
  'delivery-manager': ['projects:view-assigned'],
}

export const APP_ROLE_LABEL: Record<AppRole, string> = {
  'resource-manager': 'Resource Manager',
  'delivery-manager': 'Delivery Manager',
}

export interface AppUser {
  id: string
  name: string
  /** Link to `people` when the user is an employee in the dataset; null otherwise. */
  personId: string | null
  /** Only used when there is no linked person; otherwise the title comes from `person.role`. */
  jobTitle?: string
  appRoles: AppRole[]
}

export type Workspace = 'staffing' | 'delivery'

export const WORKSPACES: { id: Workspace; label: string; requires: Permission }[] = [
  { id: 'staffing', label: 'Resource Manager', requires: 'staffing:assign' },
  { id: 'delivery', label: 'Delivery Manager', requires: 'projects:view-assigned' },
]

export const WORKSPACE_LABEL: Record<Workspace, string> = {
  staffing: 'Resource Manager',
  delivery: 'Delivery Manager',
}

export function permissionsOf(user: AppUser): Set<Permission> {
  return new Set(user.appRoles.flatMap((r) => ROLE_PERMISSIONS[r]))
}

export function can(user: AppUser, permission: Permission): boolean {
  return permissionsOf(user).has(permission)
}

export function workspacesFor(user: AppUser): Workspace[] {
  return WORKSPACES.filter((w) => can(user, w.requires)).map((w) => w.id)
}

/** Job title comes from the person record (supplied data), not from app roles. */
export function jobTitleOf(user: AppUser, people: Map<string, Person>): string {
  const person = user.personId ? people.get(user.personId) : undefined
  return person ? `${person.role} · ${person.level}` : (user.jobTitle ?? '')
}
