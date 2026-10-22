import { describe, expect, it } from 'vitest'
import { sourceDataset } from '@/data/loadSource'
import { buildPlanContext } from '../capacity'
import { previewAssignment, type PreviewWeek } from '../preview'
import { groupWeeks, summarizeWeeks } from '../weekGroups'

const ctx = buildPlanContext(sourceDataset)
const preview = (roleId: string, personId: string, releaseInternal = false) => {
  const role = sourceDataset.openRoles.find((r) => r.id === roleId)
  const person = ctx.people.get(personId)
  if (!role || !person) throw new Error('bad fixture')
  return previewAssignment(ctx, role, person, { releaseInternal })
}

describe('groupWeeks', () => {
  it('collapses identical weeks but keeps holiday/PTO weeks on their own (Grace on R02)', () => {
    const groups = groupWeeks(preview('R02', 'P12').weeks, false)
    const label = groups.map((g) => `${g.key}x${g.weeks.length}:${g.status}`)
    expect(groups.length).toBeLessThan(10)
    expect(label[0]).toBe('2026-11-16x1:over') // training days
    expect(label[1]).toBe('2026-11-23x1:over') // Thanksgiving
    expect(label[2]).toBe('2026-11-30x3:over') // identical full weeks
    // Every week is still accounted for, in order.
    expect(groups.flatMap((g) => g.weeks.map((w) => w.weekStart))).toEqual(
      preview('R02', 'P12').weeks.map((w) => w.weekStart),
    )
  })

  it('shows a long leave as away periods flagged as conflicts while work is still planned (Hannah on R03)', () => {
    const groups = groupWeeks(preview('R03', 'P09').weeks, false)
    const leave = groups.filter((g) => g.status === 'conflict')
    // Planned hours step down as Member Onboarding (Dec 18) and Design System Refresh (Dec 31) end,
    // so the leave splits where the amount of uncovered work changes. Holidays never split it.
    expect(leave.reduce((n, g) => n + g.weeks.length, 0)).toBe(11)
    expect(leave[0]?.start).toBe('2026-11-16')
    expect(groups.some((g) => g.status === 'away' || g.status === 'reduced')).toBe(false)
  })

  it('never merges weeks with the same utilisation but different commitments', () => {
    const base = preview('R02', 'P21').weeks.find((w) => w.weekStart === '2026-11-30')
    if (!base) throw new Error('no week')
    const other: PreviewWeek = {
      ...base,
      weekStart: '2026-12-07',
      contributions: base.contributions.map((c) => ({ ...c, assignmentId: 'X', projectName: 'Other project' })),
    }
    expect(groupWeeks([base, other], false)).toHaveLength(2)
    expect(groupWeeks([base, { ...base, weekStart: '2026-12-07' }], false)).toHaveLength(1)
  })

  it('starts a new period when tentative work begins, whether or not it is counted (Sofia on R04)', () => {
    const weeks = preview('R04', 'P05').weeks
    for (const includeTentative of [false, true]) {
      expect(groupWeeks(weeks, includeTentative).map((g) => g.key)).toContain('2026-12-07')
    }
  })
})

describe('summarizeWeeks', () => {
  it('counts each week exactly once', () => {
    const weeks = preview('R02', 'P12').weeks
    const s = summarizeWeeks(weeks, false)
    expect(s.over + s.conflict + s.away + s.reduced + s.full + s.room + s.atRisk).toBe(weeks.length)
    expect(s.over).toBe(19)
  })

  it('Olivia on R02: no overload; her Thanksgiving week is away with the new role planned, so a conflict', () => {
    const s = summarizeWeeks(preview('R02', 'P21').weeks, false)
    expect(s.over).toBe(0)
    expect(s.conflict).toBe(1)
  })
})
