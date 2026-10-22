import { ArrowRight, MousePointerClick, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { DemoDataTag, Pill, ToneText, TONE_ICON, TONE_SURFACE, type Tone } from '@/components/Tone'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { ActualsSummary } from '@/domain/actuals'
import type { CandidateEvaluation } from '@/domain/candidates'
import { VERDICT_LABEL, type IssueSeverity, type StaffingPreview, type Verdict } from '@/domain/preview'
import type { OpenRole, Person } from '@/domain/types'
import { firstName, formatHours, formatRange, formatShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CommitDialog } from './CommitDialog'
import { LoadChart } from './LoadChart'
import { WeekBreakdown, weekButtonId } from './WeekBreakdown'
import type { CommitRecord } from './useStaffingState'

const VERDICT_TONE: Record<Verdict, Tone> = { safe: 'good', 'needs-decision': 'caution', blocked: 'blocked' }
const SEVERITY_TONE: Record<IssueSeverity, Tone> = { blocker: 'blocked', decision: 'caution', 'heads-up': 'info' }
const SEVERITY_TITLE: Record<IssueSeverity, string> = {
  blocker: 'Blocking',
  decision: 'Needs your decision',
  'heads-up': 'Worth knowing',
}

interface PreviewPanelProps {
  role: OpenRole | null
  preview: StaffingPreview | null
  evaluation: CandidateEvaluation | undefined
  actuals: ActualsSummary | null
  commit: CommitRecord | undefined
  committedPerson: Person | undefined
  releaseInternal: boolean
  showTentative: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
  onReleaseInternalChange: (value: boolean) => void
  onClear: () => void
  onCommit: (note: string) => void
  onUndo: () => void
  onNextRole: (() => void) | null
}

export function PreviewPanel(props: PreviewPanelProps) {
  const { role, preview, commit, headingRef } = props

  if (role && commit) return <CommittedState {...props} role={role} commit={commit} />

  if (!preview) {
    return (
      <Shell>
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <MousePointerClick aria-hidden className="mb-3 size-7 text-slate-400" />
          <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-slate-900 outline-none">
            {role ? 'Select a candidate to preview the move' : 'Preview appears here'}
          </h2>
          <p className="mt-1 max-w-xs text-sm text-slate-600">
            You’ll see their load before and after, every commitment it touches, and anything that needs a decision.
            Nothing changes until you confirm.
          </p>
        </div>
      </Shell>
    )
  }

  return <ActivePreview key={`${preview.role.id}-${preview.person.id}`} {...props} preview={preview} />
}

function Shell({ children, onKeyDown }: { children: ReactNode; onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void }) {
  return (
    <aside
      aria-labelledby="preview-heading"
      onKeyDown={onKeyDown}
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
    >
      {children}
    </aside>
  )
}

function ActivePreview({
  preview,
  evaluation,
  actuals,
  releaseInternal,
  showTentative,
  headingRef,
  onReleaseInternalChange,
  onClear,
  onCommit,
}: PreviewPanelProps & { preview: StaffingPreview }) {
  const { person, role, project } = preview
  const name = firstName(person.name)
  const internal = evaluation?.internalAssignments ?? []
  const tone = VERDICT_TONE[preview.verdict]
  const VerdictIcon = TONE_ICON[tone]
  const bySeverity = (s: IssueSeverity) => preview.issues.filter((i) => i.severity === s)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null)
  // Set when a chart bar is clicked, so the matching table row takes focus after it renders.
  const focusWeek = useRef<string | null>(null)
  useEffect(() => {
    if (!focusWeek.current) return
    const button = document.getElementById(weekButtonId(focusWeek.current))
    focusWeek.current = null
    button?.focus({ preventScroll: true })
    // Scroll only the preview column; scrollIntoView would also move the page itself.
    const scroller = button?.closest<HTMLElement>('[data-preview-scroll]')
    if (button && scroller) {
      const offset = button.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      scroller.scrollTo({ top: scroller.scrollTop + offset - scroller.clientHeight / 3, behavior: 'smooth' })
    }
  })
  const overWeeks = preview.weeks.filter((w) => (w.afterPct ?? 0) > 100).length
  const chartShowsTentative = showTentative || preview.peakAfterWithTentativePct > preview.peakAfterPct
  const projectName = (id: string) => preview.commitments.find((c) => c.assignment.projectId === id)?.project?.name ?? id

  return (
    <Shell
      onKeyDown={(e) => {
        // Escape backs out of the preview. React bubbles events out of portals, so ignore keys
        // from the commit dialog (portaled outside this DOM node); it handles its own Escape.
        if (e.key === 'Escape' && e.currentTarget.contains(e.target as Node)) {
          e.preventDefault()
          onClear()
        }
      }}
    >
      {/* Hairline dividers between sections so the stacked evidence stays scannable. */}
      <div data-preview-scroll className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-4 pb-5 [&>section]:border-t [&>section]:border-slate-200 [&>section]:pt-4">
        <header>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Preview · not saved</p>
          <h2 id="preview-heading" ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-slate-900 outline-none rounded focus-visible:ring-3 focus-visible:ring-ring/50">
            {person.name} → {project?.name}
          </h2>
          <p className="text-sm text-slate-600">
            {role.level} {role.roleNeeded}, {role.allocationPct}% ({formatHours((role.allocationPct / 100) * person.weeklyCapacityHours)}
            /wk of their {person.weeklyCapacityHours}h) · {formatRange(role.startDate, role.endDate)}
          </p>
        </header>

        <div role="status" className={cn('flex items-start gap-3 rounded-lg p-3 ring-1 ring-inset', TONE_SURFACE[tone])}>
          <VerdictIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">{VERDICT_LABEL[preview.verdict]}</p>
            <p className="text-sm">
              {preview.verdict === 'safe' && `${name} has room for this role across all of its dates.`}
              {preview.verdict === 'needs-decision' &&
                `${bySeverity('decision').length} ${bySeverity('decision').length === 1 ? 'thing needs' : 'things need'} a call before you assign ${name}.`}
              {preview.verdict === 'blocked' && `${name} can’t take this role as planned.`}
            </p>
          </div>
        </div>

        {internal.length > 0 && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
            <div>
              <Label htmlFor="release-internal" className="text-sm font-medium">
                Move {name} off internal work
              </Label>
              <p id="release-internal-hint" className="mt-0.5 text-xs text-slate-600">
                {internal
                  .map((a) => `${a.allocationPct}% on ${projectName(a.projectId)} until ${formatShort(a.effectiveEnd)}`)
                  .join('; ')}
                . Internal work can give way to client work, but the internal project loses those hours.
              </p>
            </div>
            <Switch
              id="release-internal"
              checked={releaseInternal}
              onCheckedChange={onReleaseInternalChange}
              aria-describedby="release-internal-hint"
            />
          </div>
        )}

        <section aria-labelledby="load-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 id="load-heading" className="text-sm font-semibold text-slate-900">
              Weekly load during the role
            </h3>
            <p className="text-sm text-slate-700 tabular-nums">
              Peak <span className="font-medium">{preview.peakBeforePct}%</span> →{' '}
              <span className={cn('font-semibold', preview.peakAfterPct > 100 ? 'text-rose-700' : 'text-slate-900')}>
                {preview.peakAfterPct}%
              </span>
            </p>
          </div>
          {overWeeks > 0 && (
            <p className="text-sm">
              <Pill tone="bad">
                Over capacity in {overWeeks} of {preview.weeks.length} weeks
              </Pill>
            </p>
          )}
          <LoadChart
            weeks={preview.weeks}
            showTentative={chartShowsTentative}
            selectedWeek={selectedWeek}
            onSelectWeek={(weekStart) => {
              setBreakdownOpen(true)
              setSelectedWeek(weekStart)
              focusWeek.current = weekStart
            }}
          />
          {preview.peakAfterWithTentativePct > preview.peakAfterPct && (
            <p className="text-xs text-slate-600">
              <ToneText tone="info">
                Confirmed work only. If tentative work is won, peak rises to {preview.peakAfterWithTentativePct}% (amber
                bars). Tentative work isn’t counted as load until it’s won.
              </ToneText>
            </p>
          )}
          <WeekBreakdown
            weeks={preview.weeks}
            person={person}
            open={breakdownOpen}
            onOpenChange={(open) => {
              setBreakdownOpen(open)
              if (!open) setSelectedWeek(null)
            }}
            selectedWeek={selectedWeek}
            onSelectWeek={setSelectedWeek}
            showTentative={chartShowsTentative}
          />
        </section>

        {(['blocker', 'decision', 'heads-up'] as const).map((severity) => {
          const issues = bySeverity(severity)
          if (issues.length === 0) return null
          return (
            <section key={severity} aria-labelledby={`issues-${severity}`}>
              <h3 id={`issues-${severity}`} className="mb-1.5 text-sm font-semibold text-slate-900">
                {SEVERITY_TITLE[severity]} ({issues.length})
              </h3>
              <ul className="space-y-1.5 text-sm text-slate-800">
                {issues.map((issue) => (
                  <li key={issue.message}>
                    <ToneText tone={SEVERITY_TONE[severity]}>{issue.message}</ToneText>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}

        <section aria-labelledby="commitments-heading">
          <h3 id="commitments-heading" className="mb-1.5 text-sm font-semibold text-slate-900">
            Commitments during the role
          </h3>
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] tracking-wide text-slate-500 uppercase">
              <tr>
                <th scope="col" className="pb-1 font-medium">Project</th>
                <th scope="col" className="pb-1 text-right font-medium">Load</th>
                <th scope="col" className="pb-1 pl-3 font-medium">Dates</th>
                <th scope="col" className="pb-1 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.commitments.map((c) => (
                <tr key={c.assignment.id} className={cn(c.kind === 'released' && 'text-slate-400')}>
                  <td className="py-1.5">
                    <span className={cn(c.kind === 'released' && 'line-through')}>{c.project?.name ?? c.assignment.projectId}</span>
                    {c.project?.status === 'Internal' && <span className="ml-1 text-xs text-slate-500">(internal)</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {c.assignment.allocationPct}%
                    <span className="block text-[11px] text-slate-500">{formatHours(c.hoursPerWeek)}/wk</span>
                  </td>
                  <td className="py-1.5 pl-3 text-xs text-slate-600">
                    {formatRange(c.assignment.startDate, c.assignment.effectiveEnd)}
                    {c.assignment.endAssumed && <span className="block text-amber-700">end date assumed</span>}
                  </td>
                  <td className="py-1.5 text-right">
                    {c.kind === 'new' ? (
                      <Pill tone="info">New{c.status === 'Tentative' ? ', tentative' : ''}</Pill>
                    ) : c.kind === 'released' ? (
                      <Pill tone="caution">Released from {formatShort(role.startDate)}</Pill>
                    ) : c.status === 'Tentative' ? (
                      <Pill tone="unknown">Tentative</Pill>
                    ) : (
                      <span className="text-xs text-slate-600">Confirmed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {evaluation && (
          <section aria-labelledby="fit-heading">
            <h3 id="fit-heading" className="mb-1.5 text-sm font-semibold text-slate-900">
              Why {name} is on the list
            </h3>
            <ul className="space-y-1 text-sm text-slate-800">
              {evaluation.reasons.map((r) => (
                <li key={r.text} className="flex items-center gap-1.5">
                  <ToneText tone={r.tone}>{r.text}</ToneText>
                  {r.synthetic && <DemoDataTag />}
                </li>
              ))}
              {actuals && (
                <li>
                  <ToneText tone={Math.abs(actuals.gapHours) >= 4 ? 'caution' : 'info'}>
                    Logged {formatHours(actuals.avgLoggedHours)}/wk vs {formatHours(actuals.avgPlannedHours)} planned over
                    the last {actuals.weeksLogged} weeks
                    {actuals.weeksLogged < actuals.weeksInPeriod && ` (${actuals.weeksInPeriod - actuals.weeksLogged} week missing)`}.
                    Actuals are context; the plan above is unchanged.
                  </ToneText>
                </li>
              )}
            </ul>
          </section>
        )}
      </div>

      <footer className="space-y-2 border-t border-slate-300 bg-slate-50 px-5 py-3">
        <CommitDialog preview={preview} onConfirm={onCommit} />
        <p className="text-center text-xs text-slate-500">
          Esc closes the preview. Changes stay in this browser tab only.
        </p>
      </footer>
    </Shell>
  )
}

function CommittedState({
  role,
  commit,
  committedPerson,
  headingRef,
  onUndo,
  onNextRole,
}: PreviewPanelProps & { role: OpenRole; commit: CommitRecord }) {
  return (
    <Shell>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-4 pb-5 [&>section]:border-t [&>section]:border-slate-200 [&>section]:pt-4">
        <div className="rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-200 ring-inset">
          <p className="text-xs font-medium tracking-wide text-emerald-800 uppercase">Assigned in this session</p>
          <h2 id="preview-heading" ref={headingRef} tabIndex={-1} className="mt-0.5 text-lg font-semibold text-emerald-950 outline-none rounded focus-visible:ring-3 focus-visible:ring-ring/50">
            {committedPerson?.name} → {role.level} {role.roleNeeded}
          </h2>
          <p className="mt-1 text-sm text-emerald-900">
            {commit.proposed.status === 'Tentative' ? 'Tentative' : 'Confirmed'} at {commit.proposed.allocationPct}%,{' '}
            {formatRange(commit.proposed.startDate, commit.proposed.endDate ?? role.endDate)}. Every list and warning on this
            page now includes it.
          </p>
          <p className="mt-2 text-xs text-emerald-900">
            Not saved to a server and not sent to anyone. Reload or “Reset demo” to discard.
          </p>
        </div>

        <section aria-labelledby="changes-heading">
          <h3 id="changes-heading" className="mb-1.5 text-sm font-semibold text-slate-900">
            What changed
          </h3>
          <ul className="space-y-1 text-sm">
            {commit.changes.map((m) => (
              <li key={m}>
                <ToneText tone="info">{m}</ToneText>
              </li>
            ))}
          </ul>
        </section>

        {commit.acknowledged.length > 0 && (
          <section aria-labelledby="ack-heading">
            <h3 id="ack-heading" className="mb-1.5 text-sm font-semibold text-slate-900">
              Decisions you accepted
            </h3>
            <ul className="space-y-1 text-sm">
              {commit.acknowledged.map((m) => (
                <li key={m}>
                  <ToneText tone="caution">{m}</ToneText>
                </li>
              ))}
            </ul>
          </section>
        )}
        {commit.note && (
          <section aria-labelledby="note-heading">
            <h3 id="note-heading" className="mb-1 text-sm font-semibold text-slate-900">
              Note
            </h3>
            <p className="rounded-md bg-slate-50 p-2 text-sm text-slate-800">{commit.note}</p>
          </section>
        )}
      </div>
      <footer className="flex gap-2 border-t border-slate-300 bg-slate-50 px-5 py-3">
        <Button variant="outline" onClick={onUndo}>
          <RotateCcw aria-hidden /> Undo
        </Button>
        {onNextRole && (
          <Button className="flex-1" onClick={onNextRole}>
            Next open Must fill role <ArrowRight aria-hidden />
          </Button>
        )}
      </footer>
    </Shell>
  )
}
