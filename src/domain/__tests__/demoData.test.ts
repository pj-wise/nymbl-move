import { describe, expect, it } from 'vitest'
import { NO_ENRICHMENT, enrichment } from '@/data/enrichment'
import { sourceDataset } from '@/data/loadSource'
import { buildPlanContext } from '../capacity'
import { candidatesForRole } from '../candidates'

const ctx = buildPlanContext(sourceDataset)

describe('switching demo fit data off', () => {
  for (const role of sourceDataset.openRoles) {
    it(`${role.id}: keeps every tier and the order, and drops only synthetic reasons`, () => {
      const on = candidatesForRole(ctx, role, 'confirmed', enrichment)
      const off = candidatesForRole(ctx, role, 'confirmed', NO_ENRICHMENT)
      expect(off.map((c) => `${c.tier}:${c.person.id}`)).toEqual(on.map((c) => `${c.tier}:${c.person.id}`))
      expect(off.flatMap((c) => c.reasons).some((r) => r.synthetic)).toBe(false)
      off.forEach((c, i) => expect(c.reasons).toEqual(on[i]?.reasons.filter((r) => !r.synthetic)))
    })
  }

  it('removes the Northstar seniority expectation from R04 candidates', () => {
    const r04 = sourceDataset.openRoles.find((r) => r.id === 'R04')!
    const text = (e: typeof enrichment) =>
      candidatesForRole(ctx, r04, 'confirmed', e).flatMap((c) => c.reasons.map((r) => r.text))
    expect(text(enrichment)).toContain('Northstar Energy usually needs Senior+ people')
    expect(text(NO_ENRICHMENT)).not.toContain('Northstar Energy usually needs Senior+ people')
  })
})
