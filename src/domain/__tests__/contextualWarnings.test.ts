import { describe, expect, it } from 'vitest'
import { enrichment } from '@/data/enrichment'
import { sourceDataset } from '@/data/loadSource'
import { attentionItems } from '../attention'
import { buildPlanContext } from '../capacity'
import { evaluateCandidate } from '../candidates'
import { previewAssignment, proposedAssignmentFor } from '../preview'
import type { OpenRole } from '../types'

const ctx = buildPlanContext(sourceDataset)
const role = (id: string) => sourceDataset.openRoles.find((r) => r.id === id)!
const person = (id: string) => ctx.people.get(id)!
/** A copy of a supplied role with different dates, to test that warnings follow the dates. */
const withDates = (id: string, startDate: string, endDate: string): OpenRole => ({ ...role(id), startDate, endDate })
const reasonTexts = (r: OpenRole, personId: string) =>
  evaluateCandidate(ctx, r, person(personId), 'confirmed', enrichment).reasons.map((x) => x.text)
const issueCodes = (r: OpenRole, personId: string) =>
  previewAssignment(ctx, r, person(personId), { releaseInternal: false }).issues.map((i) => i.code)

describe('needs attention only lists actionable problems', () => {
  const items = attentionItems(ctx, 'confirmed')

  it('no longer lists general data notes (requested PTO, contract dates, 0% records)', () => {
    expect(items.some((i) => i.id.startsWith('pto-') || i.id.startsWith('contract-') || i.id.startsWith('zero-'))).toBe(false)
  })

  it('keeps the missing end date, without the record id in the text', () => {
    const a038 = items.find((i) => i.id === 'noend-A038')
    expect(a038?.detail).not.toContain('A038')
  })

  it('flags work planned past a contract end, checked against the assignment dates', () => {
    expect(items.some((i) => i.kind === 'outside-employment')).toBe(false)
    const jakeOnR05 = proposedAssignmentFor(role('R05'), person('P24'), ctx.projects.get('PRJ-06'))
    const after = buildPlanContext(sourceDataset, [...sourceDataset.assignments, jakeOnR05])
    expect(attentionItems(after, 'confirmed').find((i) => i.kind === 'outside-employment')).toMatchObject({
      personId: 'P24',
      detail: expect.stringContaining('contract ends Dec 18'),
    })
  })

  it('does not flag an assignment that ends before the contract does', () => {
    const short = proposedAssignmentFor(withDates('R05', '2026-12-07', '2026-12-11'), person('P24'), ctx.projects.get('PRJ-06'))
    const after = buildPlanContext(sourceDataset, [...sourceDataset.assignments, short])
    expect(attentionItems(after, 'confirmed').some((i) => i.kind === 'outside-employment')).toBe(false)
  })
})

describe('employee warnings depend on the role dates', () => {
  it('warns about Jake’s contract only when the role runs past it', () => {
    expect(reasonTexts(role('R05'), 'P24').some((t) => t.startsWith('Contract ends Dec 18'))).toBe(true)
    expect(issueCodes(role('R05'), 'P24')).toContain('contract-ends')

    const endsFirst = withDates('R05', '2026-12-07', '2026-12-11')
    expect(reasonTexts(endsFirst, 'P24').some((t) => t.startsWith('Contract ends'))).toBe(false)
    expect(issueCodes(endsFirst, 'P24')).not.toContain('contract-ends')
  })

  it('shows Omar’s requested PTO, marked as counted, only when it overlaps the role', () => {
    expect(reasonTexts(role('R01'), 'P13')).toContain('Vacation Nov 30–Dec 4 (requested, not yet approved)')
    const preview = previewAssignment(ctx, role('R01'), person('P13'), { releaseInternal: false })
    expect(preview.issues.find((i) => i.code === 'time-off')?.message).toContain('Requested, not yet approved.')

    const before = withDates('R01', '2026-11-16', '2026-11-27')
    expect(reasonTexts(before, 'P13').some((t) => t.startsWith('Vacation'))).toBe(false)
    expect(issueCodes(before, 'P13')).not.toContain('time-off')
  })
})

describe('missing end dates stay visible where they affect a decision', () => {
  it('flags the inferred end in the preview without exposing the record id', () => {
    // Fatima Noor (P23) on Inventory Sync (A038) has no end date; a role overlapping it must say so.
    const overlapping = withDates('R01', '2026-11-09', '2026-11-20')
    const issue = previewAssignment(ctx, overlapping, person('P23'), { releaseInternal: false }).issues.find(
      (i) => i.code === 'end-assumed',
    )
    expect(issue?.message).toContain('Inventory Sync has no end date')
    expect(issue?.message).not.toContain('A038')
  })
})
