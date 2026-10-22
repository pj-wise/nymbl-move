import { describe, expect, it } from 'vitest'
import { sourceDataset } from '@/data/loadSource'
import { buildPlanContext, overallocatedSpans, periodLoad, resolveAssignment } from '../capacity'
import { recentActuals } from '../actuals'
import { weekStartOf, weekdaysIn } from '../dates'

const ctx = buildPlanContext(sourceDataset)
const person = (id: string) => {
  const p = ctx.people.get(id)
  if (!p) throw new Error(`no person ${id}`)
  return p
}
const confirmed = { scenario: 'confirmed' as const }
const withTentative = { scenario: 'withTentative' as const }

describe('dates', () => {
  it('treats intervals as inclusive weekdays', () => {
    expect(weekdaysIn('2026-11-02', '2026-11-08')).toHaveLength(5)
    expect(weekStartOf('2026-11-08')).toBe('2026-11-02') // Sunday → previous Monday
  })
})

describe('source data is not mutated', () => {
  it('keeps the missing end date on A038 as null', () => {
    expect(sourceDataset.assignments.find((a) => a.id === 'A038')?.endDate).toBeNull()
  })

  it('falls back to the project end and flags it as assumed', () => {
    const a038 = ctx.assignments.find((a) => a.id === 'A038')
    expect(a038).toMatchObject({ effectiveEnd: '2026-11-13', endAssumed: true })
  })

  it('does not flag supplied end dates', () => {
    const a = sourceDataset.assignments[0]
    if (!a) throw new Error('no assignments')
    expect(resolveAssignment(a, ctx.projects.get(a.projectId)).endAssumed).toBe(false)
  })
})

describe('overallocation', () => {
  it('finds Lena Fischer at 130% while Claims Dashboard and Dispatch Portal overlap', () => {
    const spans = overallocatedSpans(ctx, person('P07'), '2026-11-02', '2026-12-31', confirmed)
    expect(spans).toEqual([
      { start: '2026-11-02', end: '2026-11-27', peakPct: 130, assignmentIds: ['A015', 'A016'] },
    ])
  })

  it('ignores 0% historical assignments', () => {
    // A042 is Sofia Marquez at 0% on PRJ-01 until Aug 28.
    const load = periodLoad(ctx, person('P05'), '2026-08-03', '2026-08-07', confirmed)
    expect(load.byAssignment.map((a) => a.assignmentId)).not.toContain('A042')
  })
})

describe('capacity baselines', () => {
  it('pro-rates holidays for a 24h part-timer instead of subtracting 8h', () => {
    // Thanksgiving week: 3 working days × 4.8h.
    const load = periodLoad(ctx, person('P15'), '2026-11-23', '2026-11-27', confirmed)
    expect(load.capacityHours).toBeCloseTo(14.4)
    expect(load.committedHours).toBeCloseTo(14.4) // 100% on Agent Mobile App
  })

  it('uses a 32h contractor capacity and stops at the contract end', () => {
    const jake = person('P24')
    expect(periodLoad(ctx, jake, '2026-12-14', '2026-12-18', confirmed).capacityHours).toBeCloseTo(32)
    const after = periodLoad(ctx, jake, '2026-12-21', '2026-12-23', confirmed)
    expect(after.capacityHours).toBe(0)
    expect(after.away.every((d) => d.reason === 'contract-ended')).toBe(true)
  })

  it('has no capacity before a start date', () => {
    const zoe = person('P25')
    expect(periodLoad(ctx, zoe, '2026-11-09', '2026-11-13', confirmed).capacityHours).toBe(0)
    expect(periodLoad(ctx, zoe, '2026-11-16', '2026-11-20', confirmed).capacityHours).toBe(40)
  })

  it('counts requested PTO as time off but keeps its source status', () => {
    const load = periodLoad(ctx, person('P13'), '2026-11-30', '2026-12-04', confirmed)
    expect(load.availableDays).toBe(0)
    expect(load.away[0]?.timeOff?.status).toBe('Requested')
  })

  it('frees Olivia Brooks after Inventory Sync ends Nov 6 (inclusive)', () => {
    const olivia = person('P21')
    expect(periodLoad(ctx, olivia, '2026-11-06', '2026-11-06', confirmed).committedHours).toBe(8)
    expect(periodLoad(ctx, olivia, '2026-11-09', '2026-11-13', confirmed).committedHours).toBe(0)
  })
})

describe('tentative work', () => {
  it('only counts PRJ-07 tentative allocations in the tentative scenario', () => {
    const sofia = person('P05')
    const week = ['2026-12-07', '2026-12-11'] as const
    expect(periodLoad(ctx, sofia, ...week, confirmed).peakPct).toBe(100)
    expect(periodLoad(ctx, sofia, ...week, withTentative).peakPct).toBe(150)
  })
})

describe('actuals', () => {
  it('reports logged hours next to plan without replacing it', () => {
    const grace = recentActuals(ctx, person('P12'), sourceDataset.hoursLogged)
    expect(grace?.avgLoggedHours).toBe(48)
    expect(grace?.avgPlannedHours).toBe(40)
  })

  it('distinguishes missing timesheets from zero hours', () => {
    const mei = recentActuals(ctx, person('P18'), sourceDataset.hoursLogged)
    expect(mei).toMatchObject({ weeksLogged: 3, weeksInPeriod: 4 })
  })
})
