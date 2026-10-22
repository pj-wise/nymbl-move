import { describe, expect, it } from 'vitest'
import { NO_ENRICHMENT, enrichment } from '@/data/enrichment'
import { sourceDataset } from '@/data/loadSource'
import { buildPlanContext } from '../capacity'
import { candidatesForRole } from '../candidates'
import { comparisonRows, type ComparedCandidate } from '../comparison'
import { previewAssignment } from '../preview'
import type { Enrichment } from '../types'

const ctx = buildPlanContext(sourceDataset)
const r01 = sourceDataset.openRoles.find((r) => r.id === 'R01')!

/** Built exactly the way the store builds it: evaluation from the list, preview from previewAssignment. */
function compared(personId: string, e: Enrichment = enrichment): ComparedCandidate {
  const evaluation = candidatesForRole(ctx, r01, 'confirmed', e).find((c) => c.person.id === personId)!
  return { evaluation, preview: previewAssignment(ctx, r01, evaluation.person, { releaseInternal: false }) }
}
const row = (rows: ReturnType<typeof comparisonRows>, key: string) => rows.find((r) => r.key === key)!

describe('comparing Omar and Aisha on R01', () => {
  const omar = compared('P13')
  const aisha = compared('P16')
  const rows = comparisonRows([omar, aisha])

  it('marks Omar best on skills and coverage', () => {
    expect(row(rows, 'skills')).toMatchObject({ best: [0] })
    expect(row(rows, 'skills').cells.map((c) => c.primary)).toEqual(['3/3 required skills', '1/3 required skills'])
    expect(row(rows, 'coverage').best).toEqual([0])
  })

  it('uses exactly the preview and evaluation numbers', () => {
    expect(row(rows, 'workload').cells[0]!.primary).toBe(`Peak ${omar.preview.peakBeforePct}% → ${omar.preview.peakAfterPct}%`)
    expect(row(rows, 'coverage').cells[1]!.primary).toBe(
      `${aisha.evaluation.counts.fits} of ${aisha.evaluation.counts.total} weeks have room`,
    )
  })

  it('shows Omar’s requested vacation in the time-off row, marked as not yet approved', () => {
    expect(row(rows, 'time-off').cells[0]!.details).toContain('Vacation Nov 30–Dec 4 (requested, not yet approved)')
  })

  it('never marks a best on seniority, time off, commitments, timing or demo data', () => {
    for (const key of ['seniority', 'time-off', 'commitments', 'timing', 'client-fit']) {
      expect(rows.find((r) => r.key === key)?.best ?? []).toEqual([])
    }
  })

  it('tags the client-fit row as demo data, and drops it when demo data is off', () => {
    expect(row(rows, 'client-fit').synthetic).toBe(true)
    const plain = comparisonRows([compared('P13', NO_ENRICHMENT), compared('P16', NO_ENRICHMENT)])
    expect(plain.some((r) => r.key === 'client-fit')).toBe(false)
  })
})

describe('more than two candidates', () => {
  const people = ['P13', 'P16', 'P20', 'P14'].map((id) => compared(id))
  const rows = comparisonRows(people)

  it('has one cell per candidate on every row', () => {
    expect(rows.every((r) => r.cells.length === 4)).toBe(true)
  })

  it('marks every candidate tied for the best value', () => {
    const fits = people.map((p) => p.evaluation.counts.fits)
    const top = Math.max(...fits)
    const expected = fits.flatMap((f, i) => (f === top ? [i] : []))
    expect(row(rows, 'coverage').best).toEqual(fits.every((f) => f === top) ? [] : expected)
  })
})

describe('ties', () => {
  it('mark nothing as best when everyone is the same', () => {
    const omar = compared('P13')
    expect(comparisonRows([omar, omar, omar]).every((r) => r.best.length === 0 && r.bestNote === undefined)).toBe(true)
  })
})
