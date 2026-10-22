import { describe, expect, it } from 'vitest'
import { sourceDataset } from '@/data/loadSource'
import { ISSUE_CATEGORY, attentionItems, issueTarget, type AttentionItem } from '../attention'
import { buildPlanContext } from '../capacity'
import { proposedAssignmentFor } from '../preview'

const ctx = buildPlanContext(sourceDataset)
const openRoles = sourceDataset.openRoles
const items = attentionItems(ctx, 'confirmed')
const issueFor = (personId: string, list: AttentionItem[] = items) => {
  const item = list.find((i) => i.personId === personId)
  if (!item) throw new Error(`no issue for ${personId}`)
  return item
}
const target = (item: AttentionItem, selectedRoleId: string | null = null, filledRoles = new Map<string, string>(), c = ctx) =>
  issueTarget(item, { ctx: c, openRoles, filledRoles, selectedRoleId })?.roleId ?? null

describe('issue categories', () => {
  it('splits issues into staffing conflicts and data issues', () => {
    const counts = { conflict: 0, data: 0 }
    for (const i of items) counts[ISSUE_CATEGORY[i.kind]]++
    expect(counts).toEqual({ conflict: 2, data: 2 }) // Lena, Hannah | Mei, Fatima
  })
})

describe('issue links go to a relevant open role', () => {
  it('sends a Product Designer to the Must fill design role first', () => {
    expect(target(issueFor('P07'))).toBe('R03') // Lena
    expect(target(issueFor('P09'))).toBe('R03') // Hannah
  })

  it('stays on the selected role when it fits the person', () => {
    expect(target(issueFor('P09'), 'R07')).toBe('R07')
    expect(target(issueFor('P09'), 'R01')).toBe('R03') // R01 is an engineering role
  })

  it('prefers Must fill, then the soonest start', () => {
    expect(target(issueFor('P18'))).toBe('R01') // Mei: R01 and R02 are Must fill, Nov 16
  })

  it('has no link when no open role fits the discipline', () => {
    expect(target(issueFor('P23'))).toBeNull() // Fatima, Data Engineer
  })

  it('links the if-won issue for Sofia to the Delivery Manager role', () => {
    const withTentative = attentionItems(ctx, 'withTentative')
    const sofia = withTentative.find((i) => i.kind === 'overallocated-if-won' && i.personId === 'P05')!
    expect(target(sofia)).toBe('R04')
  })

  it('moves on once a role is filled by someone else', () => {
    expect(target(issueFor('P07'), null, new Map([['R03', 'P08']]))).toBe('R07')
  })

  it('goes to the role a person was just assigned to, so it can be undone', () => {
    const jakeOnR05 = proposedAssignmentFor(
      sourceDataset.openRoles.find((r) => r.id === 'R05')!,
      ctx.people.get('P24')!,
      ctx.projects.get('PRJ-06'),
    )
    const after = buildPlanContext(sourceDataset, [...sourceDataset.assignments, jakeOnR05])
    const outside = attentionItems(after, 'confirmed').find((i) => i.kind === 'outside-employment')!
    expect(target(outside, null, new Map([['R05', 'P24']]), after)).toBe('R05')
  })
})
