import { describe, expect, it } from 'vitest'
import { can, workspacesFor } from '@/auth/permissions'
import { demoUsers } from '@/data/demoUsers'
import { sourceDataset } from '@/data/loadSource'
import { buildPlanContext } from '../capacity'
import { TODAY } from '../dates'
import { proposedAssignmentFor } from '../preview'
import {
  deliveryProjectsFor,
  projectStaffingSummary,
  projectTeam,
  staffingRequestsFor,
} from '../projectStaffing'
import type { Assignment } from '../types'

const ctx = buildPlanContext(sourceDataset)
const ids = (personId: string, c = ctx) => deliveryProjectsFor(c, personId, TODAY).map((d) => d.project.id)
const role = (id: string) => {
  const r = sourceDataset.openRoles.find((x) => x.id === id)
  if (!r) throw new Error(`no role ${id}`)
  return r
}

// Sofia (P05) assigned to R04, the Field Ops Delivery Manager role, as a commit would do it.
const sofiaOnR04 = proposedAssignmentFor(role('R04'), ctx.people.get('P05')!, ctx.projects.get('PRJ-06'))
const afterCommit = buildPlanContext(sourceDataset, [...sourceDataset.assignments, sofiaOnR04])
const filledBy = new Map<string, Assignment>([['R04', sofiaOnR04]])

describe('delivery project visibility comes from assignments, not job title', () => {
  it('shows Jordan only the projects he manages', () => {
    expect(ids('P04')).toEqual(['PRJ-01', 'PRJ-02'])
  })

  it('shows Sofia her projects, keeps the tentative one, and ignores the 0% record', () => {
    expect(ids('P05')).toEqual(['PRJ-03', 'PRJ-05', 'PRJ-07'])
    expect(deliveryProjectsFor(ctx, 'P05', TODAY).find((d) => d.project.id === 'PRJ-07')?.assignment.status).toBe(
      'Tentative',
    )
  })

  it('gives nobody Field Ops until its Delivery Manager role is filled', () => {
    for (const id of ['P04', 'P05', 'P06']) expect(ids(id)).not.toContain('PRJ-06')
  })

  it('adds Field Ops for Sofia once she is assigned to R04, and only for her', () => {
    expect(ids('P05', afterCommit)).toContain('PRJ-06')
    expect(ids('P04', afterCommit)).toEqual(['PRJ-01', 'PRJ-02'])
  })

  it('returns nothing for someone with no Delivery Manager assignments', () => {
    expect(ids('P12')).toEqual([])
    expect(ids('NOBODY')).toEqual([])
  })
})

describe('staffing requests', () => {
  it('reports every Field Ops request as open in the supplied data', () => {
    const summary = projectStaffingSummary(staffingRequestsFor('PRJ-06', sourceDataset.openRoles, new Map()))
    expect(summary).toEqual({ total: 5, open: 5, filled: 0, fullyStaffed: false })
  })

  it('marks a committed role filled with the assignment record', () => {
    const requests = staffingRequestsFor('PRJ-06', sourceDataset.openRoles, filledBy)
    const r04 = requests.find((r) => r.role.id === 'R04')
    expect(r04).toMatchObject({ state: 'filled', assignment: { personId: 'P05', status: 'Confirmed' } })
    expect(projectStaffingSummary(requests)).toMatchObject({ open: 4, filled: 1, fullyStaffed: false })
  })

  it('reads the start from the assignment, not the request', () => {
    const later = { ...sofiaOnR04, startDate: '2026-11-23' }
    const r04 = staffingRequestsFor('PRJ-06', sourceDataset.openRoles, new Map([['R04', later]])).find(
      (r) => r.role.id === 'R04',
    )
    expect(r04?.role.startDate).toBe('2026-11-16')
    expect(r04?.assignment?.startDate).toBe('2026-11-23')
  })

  it('treats a project with no requests as fully staffed', () => {
    expect(projectStaffingSummary(staffingRequestsFor('PRJ-01', sourceDataset.openRoles, new Map()))).toEqual({
      total: 0,
      open: 0,
      filled: 0,
      fullyStaffed: true,
    })
  })
})

describe('project team', () => {
  it('lists current assignments and drops ended or 0% ones', () => {
    const team = projectTeam(ctx, 'PRJ-01', TODAY).map((m) => m.assignment.id)
    expect(team).toContain('A008')
    expect(team).not.toContain('A042')
  })

  it('includes a session assignment', () => {
    expect(projectTeam(afterCommit, 'PRJ-06', TODAY).map((m) => m.person?.name)).toContain('Sofia Marquez')
  })
})

describe('demo permissions', () => {
  const user = (id: string) => demoUsers.find((u) => u.id === id)!

  it('gives each mock user only the workspaces they were granted', () => {
    expect(workspacesFor(user('jordan'))).toEqual(['staffing', 'delivery'])
    expect(workspacesFor(user('sofia'))).toEqual(['delivery'])
    expect(workspacesFor(user('rm-demo'))).toEqual(['staffing'])
  })

  it('keeps request creation with staffing, not delivery', () => {
    expect(can(user('rm-demo'), 'requests:create')).toBe(true)
    expect(can(user('sofia'), 'requests:create')).toBe(false)
  })
})
