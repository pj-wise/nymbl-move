import type { CandidateEvaluation, ReasonTone } from './candidates'
import { formatShort } from './dates'
import { VERDICT_LABEL, type StaffingPreview, type Verdict } from './preview'

/**
 * Side-by-side comparison of up to MAX_COMPARE candidates for one role, as aligned rows.
 *
 * Every number comes from the candidate's existing evaluation and from `previewAssignment` (the same
 * call the preview panel makes), so the comparison can never disagree with the preview.
 * `best` marks the strongest candidates on a row only where "better" is unambiguous; nothing picks an
 * overall winner.
 */

export interface ComparedCandidate {
  evaluation: CandidateEvaluation
  preview: StaffingPreview
}

/** Most people we compare at once; beyond this the columns get too narrow to read. */
export const MAX_COMPARE = 4

export interface ComparisonCell {
  primary: string
  details: string[]
  tone?: ReasonTone
}

export type RowKey =
  | 'skills'
  | 'seniority'
  | 'coverage'
  | 'free'
  | 'workload'
  | 'verdict'
  | 'time-off'
  | 'commitments'
  | 'timing'
  | 'client-fit'

export interface ComparisonRow {
  key: RowKey
  label: string
  /** One cell per candidate, in the order they were passed in. */
  cells: ComparisonCell[]
  /** Indexes of the candidates with the best value on this row. Empty when they're all equal or "better" isn't clear-cut. */
  best: number[]
  /** Short reason shown on the best cells, e.g. "most weeks covered". */
  bestNote?: string
  /** Built from our synthetic demo data, not the supplied dataset. */
  synthetic?: boolean
}

const VERDICT_RANK: Record<Verdict, number> = { safe: 0, 'needs-decision': 1, blocked: 2 }

/**
 * Indexes holding the best score (higher wins), compared lexicographically so a second score
 * breaks ties in the first. Empty when every candidate scores the same.
 */
function bestOf(scores: number[][]): number[] {
  const cmp = (x: number[], y: number[]) => {
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0)
    return 0
  }
  if (scores.every((s) => cmp(s, scores[0]!) === 0)) return []
  const top = scores.reduce((best, s) => (cmp(s, best) > 0 ? s : best))
  return scores.flatMap((s, i) => (cmp(s, top) === 0 ? [i] : []))
}

const range = (start: string, end: string) => `${formatShort(start)}–${formatShort(end)}`

function skills({ evaluation: e }: ComparedCandidate): ComparisonCell {
  const s = e.skills
  if (s.profileEmpty) return { primary: `?/${s.required.length} skills`, details: ['No skills recorded'], tone: 'unknown' }
  return {
    primary: `${s.matched.length}/${s.required.length} required skills`,
    details: [
      ...(s.matched.length ? [`Has ${s.matched.join(', ')}`] : []),
      ...(s.notListed.length ? [`Not listed: ${s.notListed.join(', ')}`] : []),
    ],
    tone: s.notListed.length === 0 ? 'good' : s.matched.length === 0 ? 'bad' : 'caution',
  }
}

function seniority({ evaluation: e }: ComparedCandidate): ComparisonCell {
  const ask = e.role.level
  return {
    primary: e.person.level,
    details: [e.levelDelta > 0 ? `Above the ${ask} ask` : e.levelDelta === 0 ? 'As requested' : `Below the ${ask} ask`],
    tone: e.levelDelta < 0 ? 'caution' : 'good',
  }
}

function coverage({ evaluation: e }: ComparedCandidate): ComparisonCell {
  const c = e.counts
  return {
    primary: `${c.fits} of ${c.total} weeks have room`,
    details: [
      ...(c.short ? [`${c.short} short`] : []),
      ...(c.away ? [`${c.away} away`] : []),
      ...(c.notEmployed ? [`${c.notEmployed} not employed`] : []),
    ],
    tone: c.fits === c.total ? 'good' : c.fits >= c.total / 2 ? 'caution' : 'bad',
  }
}

function free({ evaluation: e }: ComparedCandidate): ComparisonCell {
  const pct = Math.round(e.avgFreePct)
  return { primary: `${Math.max(0, pct)}% free on average`, details: ['Before this assignment, across the role’s dates'] }
}

function workload({ preview: p }: ComparedCandidate): ComparisonCell {
  const over = p.weeks.filter((w) => (w.afterPct ?? 0) > 100).length
  return {
    primary: `Peak ${p.peakBeforePct}% → ${p.peakAfterPct}%`,
    details: [
      over > 0 ? `Over 100% in ${over} of ${p.weeks.length} weeks` : 'Never over 100%',
      ...(p.peakAfterWithTentativePct > p.peakAfterPct ? [`${p.peakAfterWithTentativePct}% if tentative work is won`] : []),
    ],
    tone: over > 0 ? 'bad' : 'good',
  }
}

function verdict({ preview: p }: ComparedCandidate): ComparisonCell {
  const urgent = p.issues.filter((i) => i.severity !== 'heads-up')
  const headsUp = p.issues.length - urgent.length
  return {
    primary: VERDICT_LABEL[p.verdict],
    details: [...urgent.map((i) => i.message), ...(headsUp ? [`${headsUp} more worth knowing`] : [])],
    tone: p.verdict === 'safe' ? 'good' : p.verdict === 'blocked' ? 'bad' : 'caution',
  }
}

function timeOff({ evaluation: e }: ComparedCandidate): ComparisonCell {
  if (e.timeOffInWindow.length === 0) return { primary: 'None during the role', details: [] }
  return {
    primary: `${e.timeOffInWindow.length} ${e.timeOffInWindow.length === 1 ? 'period' : 'periods'} during the role`,
    details: e.timeOffInWindow.map(
      (t) => `${t.type} ${range(t.startDate, t.endDate)}${t.status === 'Requested' ? ' (requested, not yet approved)' : ''}`,
    ),
    tone: 'caution',
  }
}

function commitments({ preview: p }: ComparedCandidate): ComparisonCell {
  const existing = p.commitments.filter((c) => c.kind !== 'new')
  if (existing.length === 0) return { primary: 'No other work during the role', details: [] }
  return {
    primary: `${existing.length} ${existing.length === 1 ? 'project' : 'projects'} during the role`,
    details: existing.map(
      (c) =>
        `${c.project?.name ?? c.assignment.projectId} ${c.assignment.allocationPct}% until ${formatShort(c.assignment.effectiveEnd)}${
          c.status === 'Tentative' ? ' (tentative)' : ''
        }${c.assignment.endAssumed ? ' (end date assumed)' : ''}`,
    ),
  }
}

function timing({ evaluation: e }: ComparedCandidate): ComparisonCell {
  const reasons = e.reasons.filter((r) => r.factor === 'timing')
  if (reasons.length === 0) return { primary: 'No date constraints', details: [] }
  const worst = reasons.some((r) => r.tone === 'bad') ? 'bad' : reasons.some((r) => r.tone === 'caution') ? 'caution' : 'good'
  return { primary: reasons[0]!.text, details: reasons.slice(1).map((r) => r.text), tone: worst }
}

function clientFit({ evaluation: e }: ComparedCandidate): ComparisonCell {
  const reasons = e.reasons.filter((r) => r.synthetic)
  if (reasons.length === 0) return { primary: 'Nothing recorded', details: [] }
  const worst = reasons.some((r) => r.tone === 'caution' || r.tone === 'bad') ? 'caution' : reasons.some((r) => r.tone === 'unknown') ? 'unknown' : 'good'
  return { primary: reasons[0]!.text, details: reasons.slice(1).map((r) => r.text), tone: worst }
}

export function comparisonRows(candidates: ComparedCandidate[]): ComparisonRow[] {
  const cs = candidates
  const over = (c: ComparedCandidate) => c.preview.weeks.filter((w) => (w.afterPct ?? 0) > 100).length
  const urgent = (c: ComparedCandidate) => c.preview.issues.filter((i) => i.severity !== 'heads-up').length
  // Scores are "higher is better"; lower-is-better values are negated.
  const row = (
    key: RowKey,
    label: string,
    cell: (c: ComparedCandidate) => ComparisonCell,
    score?: (c: ComparedCandidate) => number[],
    bestNote?: string,
  ): ComparisonRow => {
    const best = score ? bestOf(cs.map(score)) : []
    return { key, label, cells: cs.map(cell), best, bestNote: best.length ? bestNote : undefined }
  }

  const rows: ComparisonRow[] = [
    row('skills', 'Skills match', skills, (c) => [c.evaluation.skills.matched.length], 'most required skills listed'),
    // Seniority has no "best": more senior isn't automatically better for the role.
    row('seniority', 'Seniority', seniority),
    row('coverage', 'Coverage of the role’s dates', coverage, (c) => [c.evaluation.counts.fits], 'most weeks covered'),
    row('free', 'Free capacity', free, (c) => [Math.round(c.evaluation.avgFreePct)], 'most free capacity'),
    row('workload', 'Workload after assigning', workload, (c) => [-c.preview.peakAfterPct, -over(c)], 'lightest workload'),
    row(
      'verdict',
      'Verdict and warnings',
      verdict,
      (c) => [-VERDICT_RANK[c.preview.verdict], -urgent(c)],
      'fewest things to decide',
    ),
    row('time-off', 'Time off during the role', timeOff),
    row('commitments', 'Current commitments', commitments),
    row('timing', 'Start, roll-off and contract', timing),
  ]

  // Only when the (optional) demo data has something to say about at least one of them.
  if (cs.some((c) => c.evaluation.reasons.some((r) => r.synthetic))) {
    rows.push({ ...row('client-fit', 'Client fit', clientFit), synthetic: true })
  }
  return rows
}
