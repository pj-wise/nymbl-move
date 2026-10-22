import { ArrowRight, CircleCheck, X } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { DemoDataTag, Pill, ToneText, type Tone } from '@/components/Tone'
import { Button } from '@/components/ui/button'
import { SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { TIER_LABEL, type Tier } from '@/domain/candidates'
import { comparisonRows, type ComparedCandidate, type ComparisonRow } from '@/domain/comparison'
import type { OpenRole } from '@/domain/types'
import { firstName, formatRange } from '@/lib/format'
import { cn } from '@/lib/utils'
import { WeekStrip, WeekStripLegend, summarizeWeeks } from './WeekStrip'

const TIER_TONE: Record<Tier, Tone> = { ready: 'good', tradeoff: 'caution', unlikely: 'unknown' }

/** The drawer widens with each person so every column keeps a comfortable reading width. */
const DRAWER_WIDTH: Record<number, string> = {
  2: 'w-[min(74vw,1200px)]',
  3: 'w-[min(88vw,1500px)]',
  4: 'w-[min(96vw,1800px)]',
}

interface CompareDrawerProps {
  role: OpenRole
  candidates: ComparedCandidate[]
  /** Continue into the regular preview for this person (closes the drawer first). */
  onPreview: (personId: string) => void
  onRemove: (personId: string) => void
}

/**
 * Candidates side by side in aligned rows. Data comes from the same evaluation and
 * `previewAssignment` as the preview panel. Rows mark the strongest only where that's
 * unambiguous; there is no overall winner. The Resource Manager makes the call.
 */
export function CompareDrawer({ role, candidates, onPreview, onRemove }: CompareDrawerProps) {
  const rows = useMemo(() => comparisonRows(candidates), [candidates])
  const titleRef = useRef<HTMLHeadingElement>(null)
  // Set when "Preview X" is chosen: focus goes to the preview heading, not back to Compare.
  const continuing = useRef(false)
  const names = candidates.map((c) => firstName(c.evaluation.person.name))

  return (
    <SheetContent
      aria-describedby="compare-description"
      className={cn(DRAWER_WIDTH[candidates.length] ?? DRAWER_WIDTH[4], 'max-w-full max-lg:w-full')}
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        titleRef.current?.focus()
      }}
      onCloseAutoFocus={(event) => {
        if (continuing.current) event.preventDefault()
        continuing.current = false
      }}
    >
      <header className="flex shrink-0 items-start justify-between gap-6 border-b border-slate-200 px-6 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Compare {candidates.length} candidates</p>
          <SheetTitle
            ref={titleRef}
            tabIndex={-1}
            className="rounded text-xl font-semibold text-slate-900 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`}
          </SheetTitle>
          <SheetDescription id="compare-description" className="text-sm text-slate-600">
            {role.id} · {role.level} {role.roleNeeded}, {role.allocationPct}% · {formatRange(role.startDate, role.endDate)}.
            Measured across the role’s full dates, with current commitments (internal work not released).
          </SheetDescription>
        </div>
        <SheetClose asChild>
          <Button variant="ghost" size="icon" aria-label="Close comparison">
            <X aria-hidden />
          </Button>
        </SheetClose>
      </header>

      {/* One scroll area; it also scrolls sideways if the window is too narrow for every column. */}
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-sm"
          style={{ minWidth: `${11 + candidates.length * 17}rem` }}
        >
          <colgroup>
            <col className="w-44" />
            {candidates.map((c) => (
              <col key={c.evaluation.person.id} />
            ))}
          </colgroup>
          {/* Names and actions stay in view while scrolling the rows. */}
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <td className="border-b border-slate-300 pt-5 pb-3 align-bottom">
                <WeekStripLegend />
              </td>
              {candidates.map(({ evaluation: e }) => (
                <th key={e.person.id} scope="col" className="border-b border-slate-300 px-4 pt-5 pb-3 text-left align-top font-normal">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold text-slate-900">{e.person.name}</span>
                      <span className="block text-xs text-slate-500">
                        {e.person.level} · {e.person.weeklyCapacityHours}h/wk
                        {e.person.employmentType !== 'Full-time' && ` · ${e.person.employmentType}`}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="shrink-0 text-slate-500"
                      onClick={() => {
                        // Removing down to one closes the drawer; the list moves focus itself (the Compare button is gone).
                        if (candidates.length <= 2) continuing.current = true
                        onRemove(e.person.id)
                      }}
                      aria-label={`Remove ${e.person.name} from the comparison`}
                    >
                      Remove
                    </Button>
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Pill tone={TIER_TONE[e.tier]}>{TIER_LABEL[e.tier]}</Pill>
                    <span className="text-xs text-slate-600">{e.headline}</span>
                  </span>
                  <Button
                    size="sm"
                    className="mt-2.5"
                    onClick={() => {
                      continuing.current = true
                      onPreview(e.person.id)
                    }}
                  >
                    Preview {firstName(e.person.name)} <ArrowRight aria-hidden />
                  </Button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="border-b border-slate-200 py-4 pr-4 text-left align-top font-medium text-slate-600">
                  {row.label}
                  {row.synthetic && <DemoDataTag className="mt-1 flex w-fit" />}
                </th>
                {candidates.map((c, i) => (
                  <Cell key={c.evaluation.person.id} row={row} index={i} candidate={c} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-3">
        <p className="text-xs text-slate-500">You make the call. Nothing changes until you assign from the preview.</p>
        <SheetClose asChild>
          <Button variant="outline" size="lg">
            Close
          </Button>
        </SheetClose>
      </footer>
    </SheetContent>
  )
}

function Cell({ row, index, candidate }: { row: ComparisonRow; index: number; candidate: ComparedCandidate }) {
  const cell = row.cells[index]!
  const best = row.best.includes(index)
  return (
    <td className="border-b border-slate-200 px-4 py-4 align-top">
      <p className="font-medium text-slate-900">
        {cell.tone ? <ToneText tone={cell.tone}>{cell.primary}</ToneText> : cell.primary}
      </p>
      {row.key === 'coverage' && (
        <div className="mt-2">
          <WeekStrip weeks={candidate.evaluation.weeks} />
          <span className="sr-only">{summarizeWeeks(candidate.evaluation.weeks)}</span>
        </div>
      )}
      {cell.details.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
          {cell.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
      {best && row.bestNote && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
          <CircleCheck aria-hidden className="size-3.5" />
          {row.best.length > 1 ? 'Tied best' : 'Best here'}: {row.bestNote}
        </p>
      )}
    </td>
  )
}
