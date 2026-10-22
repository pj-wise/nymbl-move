import { periodLoad, weeklyLoad, type PeriodLoad, type PlanContext, type ResolvedAssignment } from './capacity'
import { TODAY, formatShort, rangesOverlap } from './dates'
import type { Enrichment, Level, OpenRole, Person, Scenario, TimeOff } from './types'

/**
 * Candidate matching is deliberately rule-based and explainable: every factor produces a plain-language
 * reason, and candidates are grouped into tiers rather than given a single opaque score.
 */

export const LEVEL_RANK: Record<Level, number> = { Junior: 0, Mid: 1, Senior: 2, Lead: 3 }

/** Short vacations are a caveat; longer absences break availability. */
export const MAX_TOLERATED_AWAY_WEEKS = 2
/** Below this share of role weeks covered, someone counts as booked rather than partly available. */
export const MIN_PARTIAL_COVERAGE = 0.5

export type ReasonTone = 'good' | 'caution' | 'bad' | 'unknown'
export type ReasonFactor = 'skills' | 'level' | 'capacity' | 'timing' | 'time-off' | 'industry' | 'style' | 'actuals'

export interface Reason {
  factor: ReasonFactor
  tone: ReasonTone
  text: string
  /** True when the reason relies on our synthetic enrichment, not supplied data. */
  synthetic?: boolean
}

export interface SkillMatch {
  required: string[]
  matched: string[]
  /** Required skills not in the person's profile. Unknown, not proof they lack it. */
  notListed: string[]
  /** The person has no skills recorded at all. */
  profileEmpty: boolean
}

export function matchSkills(person: Person, required: string[]): SkillMatch {
  const have = new Set(person.skills.map((s) => s.toLowerCase()))
  const matched = required.filter((s) => have.has(s.toLowerCase()))
  const notListed = required.filter((s) => !have.has(s.toLowerCase()))
  return { required, matched, notListed, profileEmpty: person.skills.length === 0 }
}

export type WeekFit = 'fits' | 'short' | 'away' | 'not-employed'

export interface RoleWeek {
  load: PeriodLoad
  /** Hours the role needs from this person in the week, on days they're available. */
  neededHours: number
  /** Hours on internal (reallocatable) projects that could be released this week. */
  releasableHours: number
  fit: WeekFit
  fitIfReleased: WeekFit
}

const EPSILON = 0.01

function classifyWeek(load: PeriodLoad, neededHours: number, extraHours: number): WeekFit {
  if (load.workdays === 0) return 'fits' // e.g. a holiday-only stub at the edge of the window
  if (load.availableDays === 0) {
    const employmentGap = load.away.every((d) => d.reason === 'not-started' || d.reason === 'contract-ended')
    return employmentGap ? 'not-employed' : 'away'
  }
  return load.freeHours + extraHours + EPSILON >= neededHours ? 'fits' : 'short'
}

export function roleWeeks(ctx: PlanContext, role: OpenRole, person: Person, scenario: Scenario): RoleWeek[] {
  const daily = person.weeklyCapacityHours / 5
  return weeklyLoad(ctx, person, role.startDate, role.endDate, { scenario }).map((load) => {
    const neededHours = (role.allocationPct / 100) * daily * load.availableDays
    const releasableHours = load.byAssignment
      .filter((a) => ctx.projects.get(a.projectId)?.status === 'Internal')
      .reduce((sum, a) => sum + a.hours, 0)
    return {
      load,
      neededHours,
      releasableHours,
      fit: classifyWeek(load, neededHours, 0),
      fitIfReleased: classifyWeek(load, neededHours, releasableHours),
    }
  })
}

export type Availability = 'free' | 'free-if-released' | 'partial' | 'booked' | 'not-employed'
export type Tier = 'ready' | 'tradeoff' | 'unlikely'

export const TIER_LABEL: Record<Tier, string> = {
  ready: 'Ready to propose',
  tradeoff: 'Possible, with a tradeoff',
  unlikely: 'Booked or weak fit',
}

export interface CandidateEvaluation {
  person: Person
  role: OpenRole
  scenario: Scenario
  skills: SkillMatch
  /** person level − role level, in steps. */
  levelDelta: number
  weeks: RoleWeek[]
  counts: { fits: number; short: number; away: number; notEmployed: number; total: number }
  availability: Availability
  /**
   * Average share of nominal capacity free across the role window (time off counts as not free).
   * Can be negative when over-booked.
   */
  avgFreePct: number
  internalAssignments: ResolvedAssignment[]
  timeOffInWindow: TimeOff[]
  /** Weeks short if tentative work were also counted (only meaningful in the confirmed scenario). */
  shortWeeksWithTentative: number
  tier: Tier
  headline: string
  reasons: Reason[]
}

function countWeeks(weeks: RoleWeek[], key: 'fit' | 'fitIfReleased') {
  const counts = { fits: 0, short: 0, away: 0, notEmployed: 0, total: weeks.length }
  for (const w of weeks) {
    const f = w[key]
    if (f === 'fits') counts.fits++
    else if (f === 'short') counts.short++
    else if (f === 'away') counts.away++
    else counts.notEmployed++
  }
  return counts
}

function availabilityOf(weeks: RoleWeek[]): Availability {
  const c = countWeeks(weeks, 'fit')
  const r = countWeeks(weeks, 'fitIfReleased')
  if (c.notEmployed === c.total) return 'not-employed'
  if (c.short === 0 && c.notEmployed === 0 && c.away <= MAX_TOLERATED_AWAY_WEEKS) return 'free'
  if (r.short === 0 && r.notEmployed === 0 && r.away <= MAX_TOLERATED_AWAY_WEEKS) return 'free-if-released'
  if (r.fits >= r.total * MIN_PARTIAL_COVERAGE) return 'partial'
  return 'booked'
}

export function evaluateCandidate(
  ctx: PlanContext,
  role: OpenRole,
  person: Person,
  scenario: Scenario,
  enrichment: Enrichment,
): CandidateEvaluation {
  const project = ctx.projects.get(role.projectId)
  const weeks = roleWeeks(ctx, role, person, scenario)
  const counts = countWeeks(weeks, 'fit')
  const availability = availabilityOf(weeks)
  const skills = matchSkills(person, role.skillsRequired)
  const levelDelta = LEVEL_RANK[person.level] - LEVEL_RANK[role.level]

  const windowLoad = periodLoad(ctx, person, role.startDate, role.endDate, { scenario })
  const nominalHours = windowLoad.workdays * (person.weeklyCapacityHours / 5)
  const avgFreePct = nominalHours > 0 ? (windowLoad.freeHours / nominalHours) * 100 : 0

  const assignments = ctx.assignmentsByPerson.get(person.id) ?? []
  const internalAssignments = assignments.filter(
    (a) =>
      a.allocationPct > 0 &&
      ctx.projects.get(a.projectId)?.status === 'Internal' &&
      rangesOverlap(a.startDate, a.effectiveEnd, role.startDate, role.endDate),
  )
  const timeOffInWindow = (ctx.timeOffByPerson.get(person.id) ?? []).filter((t) =>
    rangesOverlap(t.startDate, t.endDate, role.startDate, role.endDate),
  )
  const shortWeeksWithTentative =
    scenario === 'confirmed'
      ? roleWeeks(ctx, role, person, 'withTentative').filter((w) => w.fit === 'short').length
      : counts.short

  const reasons: Reason[] = []

  // Skills
  if (skills.profileEmpty) {
    reasons.push({ factor: 'skills', tone: 'unknown', text: 'No skills recorded in profile, so fit is unknown' })
  } else {
    if (skills.matched.length > 0)
      reasons.push({ factor: 'skills', tone: 'good', text: `Has ${skills.matched.join(', ')}` })
    if (skills.notListed.length > 0)
      reasons.push({
        factor: 'skills',
        tone: skills.matched.length === 0 ? 'bad' : 'unknown',
        text: `${skills.notListed.join(', ')} not listed in profile`,
      })
  }

  // Level
  if (levelDelta === 0) reasons.push({ factor: 'level', tone: 'good', text: `${person.level}, as requested` })
  else if (levelDelta > 0)
    reasons.push({ factor: 'level', tone: 'good', text: `${person.level}, above the ${role.level} ask` })
  else reasons.push({ factor: 'level', tone: 'caution', text: `${person.level}, below the ${role.level} ask` })

  // Capacity across the full window
  const needPct = role.allocationPct
  const pct = Math.max(0, Math.round(avgFreePct))
  switch (availability) {
    case 'free':
      reasons.push({ factor: 'capacity', tone: 'good', text: `Has ${needPct}% free for the whole role` })
      break
    case 'free-if-released':
      reasons.push({
        factor: 'capacity',
        tone: 'caution',
        text: `Fits only if moved off internal work (${internalAssignments.map((a) => ctx.projects.get(a.projectId)?.name).join(', ')})`,
      })
      break
    case 'partial':
      reasons.push({
        factor: 'capacity',
        tone: 'caution',
        text: `Covers ${countWeeks(weeks, 'fitIfReleased').fits} of ${counts.total} weeks; ${pct}% free on average`,
      })
      break
    case 'booked':
      reasons.push({ factor: 'capacity', tone: 'bad', text: `Booked: ${pct}% free on average, needs ${needPct}%` })
      break
    case 'not-employed':
      reasons.push({ factor: 'capacity', tone: 'bad', text: 'Not employed during this role' })
      break
  }
  if (scenario === 'confirmed' && shortWeeksWithTentative > counts.short) {
    reasons.push({
      factor: 'capacity',
      tone: 'caution',
      text: `${shortWeeksWithTentative - counts.short} more weeks short if tentative work is won`,
    })
  }

  // Timing: roll-offs, start dates, contract ends
  for (const a of assignments) {
    if (a.status !== 'Confirmed' || a.allocationPct === 0) continue
    if (a.effectiveEnd >= TODAY && a.effectiveEnd < role.startDate) {
      reasons.push({
        factor: 'timing',
        tone: 'good',
        text: `Rolls off ${ctx.projects.get(a.projectId)?.name ?? a.projectId} ${formatShort(a.effectiveEnd)}${a.endAssumed ? ' (end date assumed)' : ''}`,
      })
    }
  }
  if (person.startDate > TODAY) {
    reasons.push({
      factor: 'timing',
      tone: person.startDate <= role.startDate ? 'good' : 'caution',
      text: `New hire, starts ${formatShort(person.startDate)}`,
    })
  }
  if (person.contractEndDate && person.contractEndDate < role.endDate) {
    reasons.push({
      factor: 'timing',
      tone: 'bad',
      text: `Contract ends ${formatShort(person.contractEndDate)}, before the role ends ${formatShort(role.endDate)}`,
    })
  }

  // Time off (requested PTO counts, but we keep its status visible)
  for (const t of timeOffInWindow) {
    reasons.push({
      factor: 'time-off',
      tone: 'caution',
      text: `${t.type} ${formatShort(t.startDate)}–${formatShort(t.endDate)}${t.status === 'Requested' ? ' (requested, counted as approved)' : ''}`,
    })
  }

  // Synthetic fit factors
  const profile = project ? enrichment.clientProfiles.find((c) => c.client === project.client) : undefined
  if (profile) {
    const industries = enrichment.personIndustryExperience[person.id]
    if (!industries) {
      reasons.push({ factor: 'industry', tone: 'unknown', text: 'Industry experience not recorded', synthetic: true })
    } else if (industries.includes(profile.industry)) {
      reasons.push({ factor: 'industry', tone: 'good', text: `${profile.industry} experience`, synthetic: true })
    }
    if (profile.suggestedMinLevel && LEVEL_RANK[person.level] < LEVEL_RANK[profile.suggestedMinLevel]) {
      reasons.push({
        factor: 'style',
        tone: 'caution',
        text: `${profile.client} usually needs ${profile.suggestedMinLevel}+ people`,
        synthetic: true,
      })
    } else if (profile.workingStyle === 'coaching-friendly' && levelDelta < 0) {
      reasons.push({
        factor: 'style',
        tone: 'good',
        text: `${profile.client} is comfortable coaching less senior people`,
        synthetic: true,
      })
    }
  }

  const tier = tierOf({ availability, skills, levelDelta, person, role, counts })
  return {
    person,
    role,
    scenario,
    skills,
    levelDelta,
    weeks,
    counts,
    availability,
    avgFreePct,
    internalAssignments,
    timeOffInWindow,
    shortWeeksWithTentative,
    tier,
    headline: headlineOf(availability, skills, tier, counts),
    reasons,
  }
}

function tierOf(e: {
  availability: Availability
  skills: SkillMatch
  levelDelta: number
  person: Person
  role: OpenRole
  counts: { short: number }
}): Tier {
  if (e.availability === 'booked' || e.availability === 'not-employed') return 'unlikely'
  if (e.skills.matched.length === 0) return 'unlikely'
  const contractShort = e.person.contractEndDate !== null && e.person.contractEndDate < e.role.endDate
  if (e.availability === 'free' && e.skills.notListed.length === 0 && e.levelDelta >= 0 && !contractShort) return 'ready'
  return 'tradeoff'
}

function headlineOf(
  availability: Availability,
  skills: SkillMatch,
  tier: Tier,
  counts: CandidateEvaluation['counts'],
): string {
  const fullSkills = skills.notListed.length === 0 && !skills.profileEmpty
  if (tier === 'ready') return 'Skills and capacity fit the full role'
  if (counts.notEmployed > counts.total / 2) return 'Not employed for most of the role'
  if (availability === 'booked' && fullSkills) return 'Strong skill match, but already booked'
  if (availability === 'booked') return 'Already booked'
  if (availability === 'not-employed') return 'Not employed during the role'
  if (availability === 'free-if-released') return 'Fits if released from internal work'
  if (availability === 'partial') return 'Only partly available'
  if (skills.profileEmpty) return 'Skills not recorded'
  if (skills.matched.length === 0) return 'Required skills not listed'
  return 'Free, but some skills not listed'
}

const AVAILABILITY_ORDER: Record<Availability, number> = {
  free: 0,
  'free-if-released': 1,
  partial: 2,
  booked: 3,
  'not-employed': 4,
}
const TIER_ORDER: Record<Tier, number> = { ready: 0, tradeoff: 1, unlikely: 2 }

/**
 * Deterministic ordering so the list never jumps around between renders.
 * Within usable tiers, availability leads (who can actually start); among booked/weak candidates,
 * skill match leads so strong-but-busy people stay visible at the top of that group.
 */
export function compareCandidates(a: CandidateEvaluation, b: CandidateEvaluation): number {
  const byAvailability = AVAILABILITY_ORDER[a.availability] - AVAILABILITY_ORDER[b.availability]
  const bySkills = b.skills.matched.length - a.skills.matched.length
  const [first, second] = a.tier === 'unlikely' ? [bySkills, byAvailability] : [byAvailability, bySkills]
  return (
    TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
    first ||
    second ||
    b.avgFreePct - a.avgFreePct ||
    a.person.name.localeCompare(b.person.name)
  )
}

/** Same discipline as the role. Cross-discipline candidates are out of scope (see DECISIONS.md). */
export function candidatesForRole(
  ctx: PlanContext,
  role: OpenRole,
  scenario: Scenario,
  enrichment: Enrichment,
): CandidateEvaluation[] {
  return [...ctx.people.values()]
    .filter((p) => p.role === role.roleNeeded)
    .map((p) => evaluateCandidate(ctx, role, p, scenario, enrichment))
    .sort(compareCandidates)
}
