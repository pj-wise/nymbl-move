import raw from '../../data/source/staffing_data.json'
import type {
  Assignment,
  AssignmentStatus,
  Dataset,
  EmploymentType,
  Level,
  OpenRole,
  Person,
  Project,
  ProjectStatus,
  RolePriority,
  TimeOffStatus,
} from '@/domain/types'

/**
 * Typed adapter around the supplied JSON. The JSON file itself is never modified;
 * this only renames fields to camelCase and checks enum values so bad data fails loudly
 * instead of silently flowing into capacity maths.
 */

type RawData = typeof raw

function oneOf<T extends string>(value: string, allowed: readonly T[], field: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new Error(`Unexpected ${field} value in source data: "${value}"`)
}

const LEVELS = ['Junior', 'Mid', 'Senior', 'Lead'] as const
const EMPLOYMENT = ['Full-time', 'Part-time', 'Contractor'] as const
const PROJECT_STATUS = ['Active', 'Starting soon', 'Wrapping up', 'Proposed', 'Internal'] as const
const PRIORITY = ['High', 'Medium', 'Low'] as const
const ASSIGNMENT_STATUS = ['Confirmed', 'Tentative'] as const
const ROLE_PRIORITY = ['Must fill', 'Nice to fill', 'If won'] as const
const TIME_OFF_STATUS = ['Approved', 'Requested'] as const

export function adaptDataset(data: RawData): Dataset {
  return {
    asOf: data.as_of,
    company: data.company,
    people: data.people.map(
      (p): Person => ({
        id: p.person_id,
        name: p.name,
        role: p.role,
        level: oneOf<Level>(p.level, LEVELS, 'level'),
        employmentType: oneOf<EmploymentType>(p.employment_type, EMPLOYMENT, 'employment_type'),
        weeklyCapacityHours: p.weekly_capacity_hours,
        location: p.location,
        timezone: p.timezone,
        startDate: p.start_date,
        contractEndDate: p.contract_end_date ?? null,
        skills: [...p.skills],
      }),
    ),
    projects: data.projects.map(
      (p): Project => ({
        id: p.project_id,
        name: p.name,
        client: p.client,
        status: oneOf<ProjectStatus>(p.status, PROJECT_STATUS, 'project status'),
        priority: oneOf(p.priority, PRIORITY, 'project priority'),
        startDate: p.start_date,
        endDate: p.end_date,
        winProbabilityPct: p.win_probability_pct ?? null,
        notes: p.notes ?? '',
      }),
    ),
    assignments: data.assignments.map(
      (a): Assignment => ({
        id: a.assignment_id,
        personId: a.person_id,
        projectId: a.project_id,
        roleOnProject: a.role_on_project,
        allocationPct: a.allocation_pct,
        startDate: a.start_date,
        endDate: a.end_date ?? null,
        status: oneOf<AssignmentStatus>(a.status, ASSIGNMENT_STATUS, 'assignment status'),
        origin: 'source',
      }),
    ),
    openRoles: data.open_roles.map(
      (r): OpenRole => ({
        id: r.open_role_id,
        projectId: r.project_id,
        roleNeeded: r.role_needed,
        level: oneOf<Level>(r.level, LEVELS, 'role level'),
        skillsRequired: [...r.skills_required],
        allocationPct: r.allocation_pct,
        startDate: r.start_date,
        endDate: r.end_date,
        priority: oneOf<RolePriority>(r.priority, ROLE_PRIORITY, 'role priority'),
        status: r.status,
      }),
    ),
    timeOff: data.time_off.map((t) => ({
      id: t.time_off_id,
      personId: t.person_id,
      startDate: t.start_date,
      endDate: t.end_date,
      type: t.type,
      status: oneOf<TimeOffStatus>(t.status, TIME_OFF_STATUS, 'time off status'),
    })),
    holidays: data.holidays.map((h) => ({ date: h.date, name: h.name })),
    hoursLogged: data.hours_logged.map((h) => ({
      personId: h.person_id,
      projectId: h.project_id,
      weekStart: h.week_start,
      hours: h.hours,
    })),
  }
}

export const sourceDataset: Dataset = adaptDataset(raw)
