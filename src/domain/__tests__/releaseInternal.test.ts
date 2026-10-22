import { describe, expect, it } from 'vitest'
import { NO_ENRICHMENT } from '@/data/enrichment'
import { sourceDataset } from '@/data/loadSource'
import { buildPlanContext, releaseInternalForRole } from '../capacity'
import { candidatesForRole } from '../candidates'
import { previewAssignment } from '../preview'

const ctx = buildPlanContext(sourceDataset)
const r03 = sourceDataset.openRoles.find((r) => r.id === 'R03')!
const daniel = (release: boolean) =>
  candidatesForRole(ctx, r03, 'confirmed', NO_ENRICHMENT, { releaseInternal: release }).find((c) => c.person.id === 'P08')!

describe('Release internal allocations (role card)', () => {
  it('is off by default: Daniel only fits if released', () => {
    expect(daniel(false).availability).toBe('free-if-released')
  })

  it('evaluates Daniel as if Design System Refresh were released, and says so', () => {
    const d = daniel(true)
    expect(d.availability).toBe('free')
    expect(d.reasons.map((r) => r.text)).toContain(
      'Counts Design System Refresh hours as released; the internal project loses them',
    )
    expect(d.internalAssignments.map((a) => a.id)).toEqual(['A018'])
  })

  it('uses the same release rule as the preview: internal work ends the day before the role', () => {
    const released = releaseInternalForRole(ctx, r03).assignments.find((a) => a.id === 'A018')
    expect(released?.effectiveEnd).toBe('2026-11-15')
    const preview = previewAssignment(ctx, r03, ctx.people.get('P08')!, { releaseInternal: true })
    expect(preview.released[0]?.replacement?.endDate).toBe('2026-11-15')
  })

  it('leaves people without internal work untouched', () => {
    const plain = candidatesForRole(ctx, r03, 'confirmed', NO_ENRICHMENT)
    const released = candidatesForRole(ctx, r03, 'confirmed', NO_ENRICHMENT, { releaseInternal: true })
    const lena = (list: typeof plain) => list.find((c) => c.person.id === 'P07')
    expect(lena(released)).toEqual(lena(plain))
  })
})

describe('released internal work is not shown as a roll-off', () => {
  it('drops the "Rolls off Design System Refresh" reason that only exists because of the release', () => {
    const texts = daniel(true).reasons.map((r) => r.text)
    expect(texts.some((t) => t.startsWith('Rolls off Design System Refresh'))).toBe(false)
  })
})
