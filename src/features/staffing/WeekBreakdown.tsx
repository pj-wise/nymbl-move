import { Calculator, ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { Pill, ToneText, type Tone } from '@/components/Tone'
import type { ContributionKind, PreviewWeek } from '@/domain/preview'
import type { Person } from '@/domain/types'
import { describeAway, formatHours, formatShort, plural } from '@/lib/format'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<ContributionKind, string> = {
  existing: 'Confirmed',
  new: 'This role',
  released: 'Released by this move',
  tentative: 'Tentative, only if won',
}
const KIND_TONE: Record<ContributionKind, Tone> = {
  existing: 'unknown',
  new: 'info',
  released: 'caution',
  tentative: 'caution',
}

interface WeekBreakdownProps {
  weeks: PreviewWeek[]
  person: Person
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedWeek: string | null
  onSelectWeek: (weekStart: string | null) => void
  showTentative: boolean
}

export const weekButtonId = (weekStart: string) => `week-${weekStart}`

/**
 * Collapsed by default so the preview stays scannable. When open, one row per week of the role:
 * what the person has available, what's already committed, what this role adds and the total.
 * Each week expands to show which projects make up that load and why days are missing.
 */
export function WeekBreakdown({
  weeks,
  person,
  open,
  onOpenChange,
  selectedWeek,
  onSelectWeek,
  showTentative,
}: WeekBreakdownProps) {
  const over = weeks.filter((w) => (w.afterPct ?? 0) > 100).length
  const away = weeks.filter((w) => w.workdays > 0 && w.capacityHours === 0).length
  const daily = formatHours(person.weeklyCapacityHours / 5)

  return (
    <div className="rounded-lg border border-slate-300">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="week-breakdown"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left outline-none hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900">
          {open ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
          {open ? 'Hide' : 'Show'} week-by-week hours
        </span>
        <span className="sr-only">, </span>
        <span className="text-xs text-slate-600">
          {plural(weeks.length, 'week')}
          {over > 0 && <span className="font-medium text-rose-700"> · {over} over capacity</span>}
          {away > 0 && ` · ${away} away`}
        </span>
      </button>

      {open && (
        <div id="week-breakdown" className="space-y-3 border-t border-slate-300 px-3 pt-3 pb-3">
          <p className="flex items-start gap-2 rounded-md bg-slate-50 p-2 text-xs text-slate-700 ring-1 ring-slate-200 ring-inset">
            <Calculator aria-hidden className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
            <span>
              <span className="font-semibold">Calculated, not supplied.</span> From the dataset’s assignment dates,
              allocation %, holidays and time off. Each working day counts {daily} ({person.weeklyCapacityHours}h ÷ 5;
              the data has no daily schedule, so we assume an even week). Days off remove hours from both
              availability and commitments. Requested PTO is counted as approved. Select a week to see the projects
              behind it.
            </span>
          </p>

          <table className="w-full text-xs tabular-nums">
            <caption className="sr-only">
              Hours per week for {person.name} during this role. Select a week to see its projects.
            </caption>
            <thead className="text-left text-[10px] tracking-wide text-slate-500 uppercase">
              <tr className="border-b border-slate-200">
                <th scope="col" className="py-1 pr-2 font-medium">Week of</th>
                <th scope="col" className="py-1 pl-2 text-right font-medium">Available</th>
                <th scope="col" className="py-1 pl-2 text-right font-medium">Committed</th>
                <th scope="col" className="py-1 pl-2 text-right font-medium whitespace-nowrap">This role</th>
                <th scope="col" className="py-1 pl-2 text-right font-medium">Total</th>
                <th scope="col" className="py-1 pl-2 text-right font-medium">Load</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => {
                const isAway = w.workdays > 0 && w.capacityHours === 0
                const overBy = w.totalHours - w.capacityHours
                const isOver = !isAway && (w.afterPct ?? 0) > 100
                const expanded = w.weekStart === selectedWeek
                const notes = describeAway(w.away)
                return (
                  <Fragment key={w.weekStart}>
                    <tr
                      className={cn(
                        'border-b border-slate-100 align-top',
                        isOver && 'bg-rose-50',
                        expanded && 'bg-indigo-50/60',
                      )}
                    >
                      <th scope="row" className="py-1 pr-2 text-left font-normal">
                        <button
                          id={weekButtonId(w.weekStart)}
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={`${weekButtonId(w.weekStart)}-detail`}
                          onClick={() => onSelectWeek(expanded ? null : w.weekStart)}
                          className="inline-flex items-center gap-1 rounded font-medium text-slate-900 underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60"
                        >
                          {expanded ? <ChevronDown aria-hidden className="size-3" /> : <ChevronRight aria-hidden className="size-3" />}
                          {formatShort(w.weekStart)}
                        </button>
                        {notes.length > 0 && <span className="block pl-4 text-[11px] text-slate-500">{notes.join(' · ')}</span>}
                      </th>
                      <td className="py-1 pl-2 text-right">{formatHours(w.capacityHours)}</td>
                      <td className="py-1 pl-2 text-right">
                        {formatHours(w.committedHours)}
                        {w.releasedHours > 0 && (
                          <span className="block text-[11px] text-amber-700">−{formatHours(w.releasedHours)} released</span>
                        )}
                      </td>
                      <td className="py-1 pl-2 text-right text-indigo-700">+{formatHours(w.newHours)}</td>
                      <td className="py-1 pl-2 text-right font-medium">
                        {formatHours(w.totalHours)}
                        {showTentative && w.tentativeHours > 0 && (
                          <span className="block text-[11px] font-normal text-amber-700">
                            +{formatHours(w.tentativeHours)} if won
                          </span>
                        )}
                      </td>
                      <td className="py-1 pl-2 text-right">
                        {isAway ? (
                          <span className="text-slate-500">Away</span>
                        ) : isOver ? (
                          <span className="font-semibold text-rose-700">
                            <ToneText tone="bad">{w.afterPct}%</ToneText>
                            <span className="block text-[11px] font-normal">{formatHours(overBy)} over</span>
                          </span>
                        ) : (
                          <span className="text-slate-900">{w.afterPct}%</span>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr id={`${weekButtonId(w.weekStart)}-detail`} className="border-b border-slate-200 bg-indigo-50/60">
                        <td colSpan={6} className="px-2 pt-1 pb-3">
                          <WeekDetail week={w} person={person} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function WeekDetail({ week: w, person }: { week: PreviewWeek; person: Person }) {
  const daily = person.weeklyCapacityHours / 5
  const counted = w.contributions.filter((c) => c.kind !== 'released')
  const released = w.contributions.filter((c) => c.kind === 'released')
  const range = w.start === w.end ? formatShort(w.start) : `${formatShort(w.start)}–${formatShort(w.end)}`

  return (
    <div className="space-y-2 rounded-md bg-white p-2.5 text-xs ring-1 ring-slate-200">
      <p className="text-slate-700">
        <span className="font-semibold text-slate-900">{range}:</span> {plural(w.availableDays, 'working day')} available
        × {formatHours(daily)} = <span className="font-medium">{formatHours(w.capacityHours)}</span>
        {w.away.length > 0 && <> ({describeAway(w.away).join('; ')})</>}
      </p>

      {counted.length === 0 && released.length === 0 ? (
        <p className="text-slate-500">No project hours fall on available days this week.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {counted.map((c) => (
            <li key={`${c.assignmentId}-${c.kind}`} className="flex items-center justify-between gap-2 py-1">
              <span className="min-w-0">
                <span className="font-medium text-slate-900">{c.projectName}</span>
                {c.internal && <span className="text-slate-500"> (internal)</span>}
                <span className="text-slate-500"> · {c.allocationPct}%</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Pill tone={KIND_TONE[c.kind]}>{KIND_LABEL[c.kind]}</Pill>
                <span className="w-12 text-right font-medium tabular-nums">{formatHours(c.hours)}</span>
              </span>
            </li>
          ))}
          {released.map((c) => (
            <li key={`${c.assignmentId}-released`} className="flex items-center justify-between gap-2 py-1 text-slate-500">
              <span className="min-w-0 line-through">
                {c.projectName}
                {c.internal && ' (internal)'} · {c.allocationPct}%
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Pill tone={KIND_TONE[c.kind]}>{KIND_LABEL[c.kind]}</Pill>
                <span className="w-12 text-right tabular-nums">−{formatHours(c.hours)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className={cn('border-t border-slate-200 pt-1.5 font-medium', (w.afterPct ?? 0) > 100 ? 'text-rose-700' : 'text-slate-900')}>
        {w.capacityHours === 0
          ? 'Not available any day this week, so no hours are counted for it.'
          : `Total ${formatHours(w.totalHours)} of ${formatHours(w.capacityHours)} available = ${w.afterPct}%${
              w.totalHours > w.capacityHours ? `, ${formatHours(w.totalHours - w.capacityHours)} more than they have` : ''
            }`}
        {w.tentativeHours > 0 && (
          <span className="block font-normal text-amber-700">
            Plus {formatHours(w.tentativeHours)} tentative if won ({w.afterWithTentativePct}%). Not counted in the total.
          </span>
        )}
      </p>
    </div>
  )
}
