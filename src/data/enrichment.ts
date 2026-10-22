import type { ClientProfile, Enrichment } from '@/domain/types'

/**
 * SYNTHETIC DEMO DATA — not part of the supplied dataset.
 *
 * In the discovery call the CEO said real staffing calls also weigh seniority, client working style,
 * industry experience and tech stack. The sample data has no client-style or industry fields, so we
 * invented a small, plausible set purely to demonstrate how the UI would show them. Every value here
 * is our assumption, is labelled "demo data" in the UI, and never overrides a supplied field.
 *
 * The working-style labels are our own wording; the client did not name these categories.
 */

export const ENRICHMENT_LABEL = 'Demo data (our assumption, not supplied)'

export const clientProfiles: ClientProfile[] = [
  {
    client: 'Northstar Energy',
    industry: 'Energy & utilities',
    workingStyle: 'senior-led',
    styleNote: 'Demanding stakeholders, expects senior people in client-facing seats.',
    suggestedMinLevel: 'Senior',
  },
  {
    client: 'Cedar Health Network',
    industry: 'Healthcare',
    workingStyle: 'senior-led',
    styleNote: 'Strict accessibility and compliance reviews.',
    suggestedMinLevel: 'Senior',
  },
  {
    client: 'Pinecrest Schools',
    industry: 'Education',
    workingStyle: 'coaching-friendly',
    styleNote: 'Easygoing team, comfortable with a junior paired with a lead.',
    suggestedMinLevel: null,
  },
  {
    client: 'Brightwater Logistics',
    industry: 'Logistics',
    workingStyle: 'standard',
    styleNote: 'Regular demo cadence, no special constraints.',
    suggestedMinLevel: null,
  },
  {
    client: 'Summit Credit Union',
    industry: 'Financial services',
    workingStyle: 'standard',
    styleNote: 'No special constraints recorded.',
    suggestedMinLevel: null,
  },
  {
    client: 'Ironline Manufacturing',
    industry: 'Manufacturing',
    workingStyle: 'standard',
    styleNote: 'No special constraints recorded.',
    suggestedMinLevel: null,
  },
  {
    client: 'Lakeshore Realty',
    industry: 'Real estate',
    workingStyle: 'standard',
    styleNote: 'No special constraints recorded.',
    suggestedMinLevel: null,
  },
]

/**
 * Industry experience for a handful of people. Anyone not listed is "not recorded" —
 * the UI must say unknown, never "no experience".
 */
export const personIndustryExperience: Record<string, string[]> = {
  P07: ['Healthcare'],
  P08: ['Real estate', 'Energy & utilities'],
  P09: ['Education'],
  P12: ['Healthcare', 'Energy & utilities'],
  P13: ['Energy & utilities', 'Manufacturing'],
  P17: ['Education', 'Logistics'],
  P20: ['Real estate'],
  P21: ['Manufacturing', 'Healthcare'],
}

export const enrichment: Enrichment = { clientProfiles, personIndustryExperience }
