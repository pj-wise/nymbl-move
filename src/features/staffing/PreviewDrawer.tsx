import { X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { Pill, ToneText } from '@/components/Tone'
import { Button } from '@/components/ui/button'
import { SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import type { ActualsSummary } from '@/domain/actuals'
import type { ResolvedAssignment } from '@/domain/capacity'
import type { CandidateEvaluation } from '@/domain/candidates'
import { VERDICT_LABEL, type StaffingPreview } from '@/domain/preview'
import type { WeekGroup, WeekSummary } from '@/domain/weekGroups'
import { firstName, formatHours, formatRange } from '@/lib/format'
import { CommitDialog } from './CommitDialog'
import { LoadChart } from './LoadChart'
import { CommitmentsTable, FitList, IssueList, PeakSummary, ReleasedNote, VERDICT_TONE } from './PreviewParts'
import { WeekBreakdown } from './WeekBreakdown'

interface PreviewDrawerProps {
  preview: StaffingPreview
  evaluation: CandidateEvaluation | undefined
  actuals: ActualsSummary | null
  internal: ResolvedAssignment[]
  projectName: (id: string) => string
  releaseInternal: boolean
  onReleaseInternalChange: (value: boolean) => void
  chartShowsTentative: boolean
  groups: WeekGroup[]
  summary: WeekSummary
  selectedWeek: string | null
  selectedWeeks: Set<string>
  onSelectWeek: (weekStart: string | null) => void
  /** Chart bar click: expand that week's period and move focus to it. */
  onChartWeek: (weekStart: string) => void
  /** Focuses a week row a chart click asked for; returns false when there's none pending. */
  focusPendingWeek: () => boolean
  onCommit: (note: string) => void
  onCloseAutoFocus: (event: Event) => void
}

/**
 * The full breakdown of a staffing preview, in a wide drawer. Same `StaffingPreview` as the compact
 * panel, laid out in two columns: workload on the left, commitments and checks on the right.
 * Header and footer stay put; only the body scrolls.
 */
export function PreviewDrawer(props: PreviewDrawerProps) {
  const { preview, evaluation, actuals, chartShowsTentative } = props
  const { person, role, project } = preview
  const name = firstName(person.name)
  const titleRef = useRef<HTMLHeadingElement>(null)

  return (
    <SheetContent
      aria-describedby="preview-drawer-description"
      className="w-[min(74vw,1200px)] max-w-full max-lg:w-full"
      onOpenAutoFocus={(event) => {
        // Land on the title so the reader starts at the top, unless a chart click is about to focus a week.
        event.preventDefault()
        if (!props.focusPendingWeek()) titleRef.current?.focus()
      }}
      onCloseAutoFocus={props.onCloseAutoFocus}
    >
      <header className="flex shrink-0 items-start justify-between gap-6 border-b border-slate-200 px-6 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Full breakdown · not saved</p>
          <SheetTitle
            ref={titleRef}
            tabIndex={-1}
            className="rounded text-xl font-semibold text-slate-900 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {person.name} → {project?.name}
          </SheetTitle>
          <SheetDescription id="preview-drawer-description" className="text-sm text-slate-600">
            {role.level} {role.roleNeeded}, {role.allocationPct}% (
            {formatHours((role.allocationPct / 100) * person.weeklyCapacityHours)}/wk of their {person.weeklyCapacityHours}h) ·{' '}
            {formatRange(role.startDate, role.endDate)}
          </SheetDescription>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Pill tone={VERDICT_TONE[preview.verdict]}>{VERDICT_LABEL[preview.verdict]}</Pill>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close full breakdown">
              <X aria-hidden />
            </Button>
          </SheetClose>
        </div>
      </header>

      <div
        data-preview-scroll
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] content-start gap-x-10 gap-y-8 overflow-y-auto px-6 py-6 max-lg:grid-cols-1"
      >
        {/* Left: workload */}
        <div className="space-y-6">
          <Section title="Weekly utilization during the role">
            <PeakSummary preview={preview} />
            <div className="mt-4">
              <LoadChart
                weeks={preview.weeks}
                showTentative={chartShowsTentative}
                selectedWeeks={props.selectedWeeks}
                onSelectWeek={props.onChartWeek}
                size="full"
              />
            </div>
            {preview.peakAfterWithTentativePct > preview.peakAfterPct && (
              <p className="mt-3 text-xs text-slate-600">
                <ToneText tone="info">
                  Confirmed work only. If the proposed project is won, peak rises to {preview.peakAfterWithTentativePct}% (amber
                  bars).
                </ToneText>
              </p>
            )}
          </Section>
          <WeekBreakdown
            groups={props.groups}
            summary={props.summary}
            person={person}
            open
            onOpenChange={() => {}}
            alwaysOpen
            selectedWeek={props.selectedWeek}
            onSelectWeek={props.onSelectWeek}
            showTentative={chartShowsTentative}
          />
        </div>

        {/* Right: what this move touches and what to check */}
        <div className="space-y-6">
          {preview.issues.length > 0 && (
            <Section title="Things to check">
              <div className="space-y-4">
                <IssueList issues={preview.issues} headingLevel="h4" />
              </div>
            </Section>
          )}
          <ReleasedNote preview={preview} />
          <Section title="Commitments during the role">
            <CommitmentsTable preview={preview} />
          </Section>
          {evaluation && (
            <Section title={`Why ${name} is on the list`}>
              <FitList preview={preview} evaluation={evaluation} actuals={actuals} />
            </Section>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-3">
        <p className="text-xs text-slate-500">Esc closes this view. Changes stay in this browser tab only.</p>
        <div className="flex items-center gap-2">
          <SheetClose asChild>
            <Button variant="outline" size="lg">
              Close
            </Button>
          </SheetClose>
          <div className="w-80">
            <CommitDialog
              preview={preview}
              onConfirm={props.onCommit}
              release={{
                internal: props.internal,
                projectName: props.projectName,
                checked: props.releaseInternal,
                onCheckedChange: props.onReleaseInternalChange,
              }}
            />
          </div>
        </div>
      </footer>
    </SheetContent>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  )
}
