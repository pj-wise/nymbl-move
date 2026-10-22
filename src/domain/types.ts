/** ISO calendar date, `YYYY-MM-DD`. All date maths is done in UTC to avoid DST drift. */
export type ISODate = string

export type Level = 'Junior' | 'Mid' | 'Senior' | 'Lead'
export type EmploymentType = 'Full-time' | 'Part-time' | 'Contractor'
export type ProjectStatus = 'Active' | 'Starting soon' | 'Wrapping up' | 'Proposed' | 'Internal'
export type AssignmentStatus = 'Confirmed' | 'Tentative'
export type RolePriority = 'Must fill' | 'Nice to fill' | 'If won'
export type TimeOffStatus = 'Approved' | 'Requested'

export interface Person {
  id: string
  name: string
  role: string
  level: Level
  employmentType: EmploymentType
  weeklyCapacityHours: number
  location: string
  timezone: string
  startDate: ISODate
  contractEndDate: ISODate | null
  /** Empty array means "nothing recorded", not "no skills". */
  skills: string[]
}

export interface Project {
  id: string
  name: string
  client: string
  status: ProjectStatus
  priority: 'High' | 'Medium' | 'Low'
  startDate: ISODate
  endDate: ISODate
  winProbabilityPct: number | null
  notes: string
}

export interface Assignment {
  id: string
  personId: string
  projectId: string
  roleOnProject: string
  allocationPct: number
  startDate: ISODate
  /** `null` in source data means the end date is missing. */
  endDate: ISODate | null
  status: AssignmentStatus
  /** `source` = supplied dataset, `local` = created/changed in this browser session. */
  origin: 'source' | 'local'
}

export interface OpenRole {
  id: string
  projectId: string
  roleNeeded: string
  level: Level
  skillsRequired: string[]
  allocationPct: number
  startDate: ISODate
  endDate: ISODate
  priority: RolePriority
  status: string
}

export interface TimeOff {
  id: string
  personId: string
  startDate: ISODate
  endDate: ISODate
  type: string
  /** Original status from source. Requested PTO is still counted (discovery-call decision). */
  status: TimeOffStatus
}

export interface Holiday {
  date: ISODate
  name: string
}

export interface HoursLogged {
  personId: string
  projectId: string
  weekStart: ISODate
  hours: number
}

export interface Dataset {
  asOf: ISODate
  company: string
  people: Person[]
  projects: Project[]
  assignments: Assignment[]
  openRoles: OpenRole[]
  timeOff: TimeOff[]
  holidays: Holiday[]
  hoursLogged: HoursLogged[]
}

/** Which planned work counts toward load. */
export type Scenario = 'confirmed' | 'withTentative'

/** Synthetic fit attributes (see src/data/enrichment.ts). Never present in the supplied data. */
export type WorkingStyle = 'senior-led' | 'coaching-friendly' | 'standard'

export interface ClientProfile {
  client: string
  industry: string
  workingStyle: WorkingStyle
  /** Plain-language description shown in the UI. */
  styleNote: string
  /** Level we'd suggest at minimum for this client's style; null = no extra constraint. */
  suggestedMinLevel: Level | null
}

export interface Enrichment {
  clientProfiles: ClientProfile[]
  /** personId → industries. Missing key = not recorded. */
  personIndustryExperience: Record<string, string[]>
}
