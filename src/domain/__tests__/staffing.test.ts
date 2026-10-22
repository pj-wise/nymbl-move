import { describe, expect, it } from 'vitest'
import { enrichment } from '@/data/enrichment'
import { sourceDataset } from '@/data/loadSource'
import { attentionItems } from '../attention'
import { buildPlanContext } from '../capacity'
import { candidatesForRole, evaluateCandidate, matchSkills } from '../candidates'
import { applyPreview, previewAssignment } from '../preview'

const ctx = buildPlanContext(sourceDataset)
const role = (id: string) => {
  const r = sourceDataset.openRoles.find((x) => x.id === id)
  if (!r) throw new Error(`no role ${id}`)
  return r
}
const person = (id: string) => {
  const p = ctx.people.get(id)
  if (!p) throw new Error(`no person ${id}`)
  return p
}
const names = (roleId: string) =>
  candidatesForRole(ctx, role(roleId), 'confirmed', enrichment).map((c) => `${c.tier}:${c.person.name}`)

describe('skill matching', () => {
  it('treats an empty profile as unknown, not unqualified', () => {
    expect(matchSkills(person('P18'), ['React'])).toMatchObject({ profileEmpty: true, matched: [] })
  })
})

describe('candidate ranking', () => {
  it('R01: Omar Haddad is the only ready .NET/Azure/SQL candidate', () => {
    const list = names('R01')
    expect(list[0]).toBe('ready:Omar Haddad')
    expect(list.filter((n) => n.startsWith('ready'))).toHaveLength(1)
  })

  it('R02: Olivia ready, Sam needs a call on accessibility, Grace is a strong but booked match', () => {
    const list = names('R02')
    expect(list[0]).toBe('ready:Olivia Brooks')
    expect(list).toContain('tradeoff:Sam Rivera')
    expect(list).toContain('unlikely:Grace Liu')
    const grace = evaluateCandidate(ctx, role('R02'), person('P12'), 'confirmed', enrichment)
    expect(grace.headline).toBe('Strong skill match, but already booked')
  })

  it('R03: nobody is ready; Daniel fits only if released from internal work', () => {
    const list = candidatesForRole(ctx, role('R03'), 'confirmed', enrichment)
    expect(list.some((c) => c.tier === 'ready')).toBe(false)
    expect(list[0]?.person.name).toBe('Daniel Okafor')
    expect(list[0]?.availability).toBe('free-if-released')
  })

  it('R03: Hannah Kim is not shown as free during her leave', () => {
    const hannah = evaluateCandidate(ctx, role('R03'), person('P09'), 'confirmed', enrichment)
    expect(hannah.availability).toBe('partial')
    expect(hannah.counts.away).toBeGreaterThan(2)
  })

  it('R05: Jake Morrison is not available beyond his contract end', () => {
    const jake = evaluateCandidate(ctx, role('R05'), person('P24'), 'confirmed', enrichment)
    expect(jake.tier).toBe('unlikely')
    expect(jake.reasons.some((r) => r.text.startsWith('Contract ends Dec 18'))).toBe(true)
  })

  it('R05: Zoe Adams is ready because she starts before the role does', () => {
    expect(names('R05')[0]).toBe('ready:Zoe Adams')
  })

  it('order is deterministic', () => {
    expect(names('R02')).toEqual(names('R02'))
  })

  it('labels synthetic fit reasons', () => {
    const omar = evaluateCandidate(ctx, role('R01'), person('P13'), 'confirmed', enrichment)
    const industry = omar.reasons.find((r) => r.factor === 'industry')
    expect(industry).toMatchObject({ synthetic: true, tone: 'good' })
  })
})

describe('preview', () => {
  it('Olivia on R02 is safe', () => {
    const p = previewAssignment(ctx, role('R02'), person('P21'), { releaseInternal: false })
    expect(p.verdict).toBe('safe')
    expect(p.peakAfterPct).toBe(100)
  })

  it('Daniel on R03 without a release goes to 140% and needs a decision', () => {
    const p = previewAssignment(ctx, role('R03'), person('P08'), { releaseInternal: false })
    expect(p.verdict).toBe('needs-decision')
    expect(p.peakAfterPct).toBe(140)
    expect(p.issues.map((i) => i.code)).toContain('overallocated')
  })

  it('releasing Daniel from Design System Refresh shows the tradeoff instead of hiding it', () => {
    const p = previewAssignment(ctx, role('R03'), person('P08'), { releaseInternal: true })
    expect(p.peakAfterPct).toBe(100)
    expect(p.issues.find((i) => i.code === 'internal-release')?.message).toContain('loses 16h/week')
    expect(p.commitments.find((c) => c.assignment.id === 'A018')?.kind).toBe('released')
  })

  it('Sofia on R04 is over 100% in confirmed work and worse if PRJ-07 is won', () => {
    const p = previewAssignment(ctx, role('R04'), person('P05'), { releaseInternal: false })
    expect(p.peakAfterPct).toBe(150)
    expect(p.peakAfterWithTentativePct).toBe(200)
    expect(p.issues.map((i) => i.code)).toContain('overallocated-if-won')
  })

  it('staffing an If-won role creates tentative, not confirmed, work', () => {
    const p = previewAssignment(ctx, role('R06'), person('P20'), { releaseInternal: false })
    expect(p.proposed.status).toBe('Tentative')
  })

  it('applyPreview adds the assignment and trims the released one without touching the source', () => {
    const p = previewAssignment(ctx, role('R03'), person('P08'), { releaseInternal: true })
    const next = applyPreview(sourceDataset.assignments, p)
    expect(next.find((a) => a.id === 'A018')?.endDate).toBe('2026-11-15')
    expect(next.find((a) => a.id === p.proposed.id)).toBeDefined()
    expect(sourceDataset.assignments.find((a) => a.id === 'A018')?.endDate).toBe('2026-12-31')
  })
})

describe('attention bucket', () => {
  const items = attentionItems(ctx, 'confirmed')

  it('lists Lena Fischer at 130% as a warning', () => {
    expect(items.find((i) => i.kind === 'overallocated')).toMatchObject({
      personId: 'P07',
      severity: 'warning',
      title: 'Lena Fischer is at 130%',
    })
  })

  it('surfaces Hannah on leave while planned, and the missing end date', () => {
    expect(items.some((i) => i.kind === 'absent-while-assigned' && i.personId === 'P09')).toBe(true)
    expect(items.some((i) => i.id === 'noend-A038')).toBe(true)
  })

  it('only shows tentative overallocation in the tentative scenario', () => {
    expect(items.some((i) => i.kind === 'overallocated-if-won')).toBe(false)
    const withTentative = attentionItems(ctx, 'withTentative')
    expect(withTentative.some((i) => i.kind === 'overallocated-if-won' && i.personId === 'P05')).toBe(true)
  })
})

describe('local commits', () => {
  it('replays commits over the source and undo restores it exactly', async () => {
    const { commitFromPreview, replayCommits } = await import('@/features/staffing/useStaffingState')
    const p = previewAssignment(ctx, role('R03'), person('P08'), { releaseInternal: true })
    const commit = commitFromPreview(p, 'Agreed with DS lead')
    const after = replayCommits(sourceDataset.assignments, [commit])
    expect(after).toHaveLength(sourceDataset.assignments.length + 1)
    expect(replayCommits(sourceDataset.assignments, [])).toEqual(sourceDataset.assignments)
    // The committed move is reflected in later calculations: Daniel no longer has room for R07.
    const next = buildPlanContext(sourceDataset, after)
    expect(evaluateCandidate(next, role('R07'), person('P08'), 'confirmed', enrichment).availability).toBe('booked')
  })
})

describe('week-by-week breakdown', () => {
  const week = (roleId: string, personId: string, monday: string, releaseInternal = false) => {
    const p = previewAssignment(ctx, role(roleId), person(personId), { releaseInternal })
    const w = p.weeks.find((x) => x.weekStart === monday)
    if (!w) throw new Error(`no week ${monday}`)
    return w
  }

  it('Grace on R02, week of Nov 16: 2 training days leave 24h, already committed 24h, +24h = 200%', () => {
    const w = week('R02', 'P12', '2026-11-16')
    expect(w).toMatchObject({ availableDays: 3, capacityHours: 24, committedHours: 24, newHours: 24, totalHours: 48, afterPct: 200 })
    expect(w.away.map((d) => d.label)).toEqual(['Training', 'Training'])
  })

  it('Olivia on R02, Thanksgiving week: 3 vacation days + 2 holidays = not available at all', () => {
    const w = week('R02', 'P21', '2026-11-23')
    expect(w.capacityHours).toBe(0)
    expect(w.afterPct).toBeNull()
    expect(w.away.map((d) => d.reason)).toEqual(['time-off', 'time-off', 'time-off', 'holiday', 'holiday'])
  })

  it('pro-rates holidays for a 24h person (Chris on R02, Thanksgiving week = 3 × 4.8h)', () => {
    const w = week('R02', 'P15', '2026-11-23')
    expect(w.capacityHours).toBeCloseTo(14.4)
    expect(w.committedHours).toBeCloseTo(14.4)
    expect(w.newHours).toBeCloseTo(14.4)
  })

  it('shows released internal hours as their own contribution (Daniel on R03)', () => {
    const w = week('R03', 'P08', '2026-11-16', true)
    expect(w).toMatchObject({ committedHours: 20, releasedHours: 16, newHours: 20, totalHours: 40, afterPct: 100 })
    expect(w.contributions.find((c) => c.kind === 'released')).toMatchObject({
      projectName: 'Design System Refresh',
      hours: 16,
      internal: true,
    })
  })

  it('keeps tentative work out of the total but reports it (Sofia on R04, week of Dec 7)', () => {
    const w = week('R04', 'P05', '2026-12-07')
    expect(w).toMatchObject({ committedHours: 40, newHours: 20, tentativeHours: 20, afterPct: 150, afterWithTentativePct: 200 })
    expect(w.contributions.find((c) => c.kind === 'tentative')?.projectName).toBe('Enrollment Redesign')
  })

  it('counts the previewed move even for an If-won role, and says the overload depends on winning', () => {
    const p = previewAssignment(ctx, role('R06'), person('P12'), { releaseInternal: false })
    expect(p.proposed.status).toBe('Tentative')
    expect(p.peakAfterPct).toBe(200)
    expect(p.issues.find((i) => i.code === 'overallocated')?.message).toContain('Only if the project is won')
  })
})

describe('capacity terms', () => {
  const week = (roleId: string, personId: string, monday: string) => {
    const p = previewAssignment(ctx, role(roleId), person(personId), { releaseInternal: false })
    const w = p.weeks.find((x) => x.weekStart === monday)
    if (!w) throw new Error(`no week ${monday}`)
    return w
  }

  it('never shows free hours when over capacity: Grace, week of Nov 16 = 0h free, 24h over', () => {
    expect(week('R02', 'P12', '2026-11-16')).toMatchObject({ capacityHours: 24, totalHours: 48, freeHours: 0, overHours: 24 })
  })

  it('reports free hours when there is room: Hannah after her leave = 20h free', () => {
    expect(week('R03', 'P09', '2027-02-01')).toMatchObject({ capacityHours: 40, totalHours: 20, freeHours: 20, overHours: 0 })
  })

  it('prorates allocations to working days: Claims Dashboard at 100% in a 3-day week is 24h over 3 days', () => {
    const c = week('R02', 'P12', '2026-11-16').contributions.find((x) => x.projectName === 'Claims Dashboard')
    expect(c).toMatchObject({ allocationPct: 100, days: 3, hours: 24 })
  })

  it('reports work planned on days off, excluding company holidays (Olivia, Thanksgiving week)', () => {
    // 3 vacation days × 8h × 100% for the new role; the 2 holidays are not counted.
    const w = week('R02', 'P21', '2026-11-23')
    expect(w).toMatchObject({ capacityHours: 0, afterPct: null, plannedOnDaysOffHours: 24 })
  })

  it('counts existing work planned during a leave (Hannah, week of Nov 16 = 125% × 40h = 50h)', () => {
    expect(week('R03', 'P09', '2026-11-16').plannedOnDaysOffHours).toBe(50)
  })
})
