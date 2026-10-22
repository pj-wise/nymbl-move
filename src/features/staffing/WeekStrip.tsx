import type { RoleWeek, WeekFit } from '@/domain/candidates'
import { formatShort } from '@/lib/format'
import { cn } from '@/lib/utils'

const FIT_CLASS: Record<WeekFit, string> = {
  fits: 'bg-emerald-500',
  short: 'bg-rose-500 bg-[repeating-linear-gradient(135deg,transparent_0_2px,rgb(255_255_255/0.45)_2px_4px)]',
  away: 'bg-slate-300',
  'not-employed': 'bg-transparent ring-1 ring-inset ring-slate-300',
}

const FIT_LABEL: Record<WeekFit, string> = {
  fits: 'has room',
  short: 'not enough room',
  away: 'away',
  'not-employed': 'not employed',
}

/**
 * One cell per week of the role. Purely visual; the accompanying text summary
 * (`summarizeWeeks`) carries the same information for screen readers.
 */
export function WeekStrip({ weeks, released = false }: { weeks: RoleWeek[]; released?: boolean }) {
  return (
    <span aria-hidden className="flex h-2.5 gap-px" title="Each cell is one week of the role">
      {weeks.map((w) => {
        const fit = released ? w.fitIfReleased : w.fit
        return (
          <span
            key={w.load.weekStart}
            title={`Week of ${formatShort(w.load.weekStart)}: ${FIT_LABEL[fit]}`}
            className={cn('min-w-[3px] flex-1 rounded-[1px]', FIT_CLASS[fit])}
          />
        )
      })}
    </span>
  )
}

export function WeekStripLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
      {(Object.keys(FIT_LABEL) as WeekFit[]).map((fit) => (
        <li key={fit} className="inline-flex items-center gap-1">
          <span aria-hidden className={cn('inline-block h-2.5 w-2.5 rounded-[1px]', FIT_CLASS[fit])} />
          {FIT_LABEL[fit]}
        </li>
      ))}
    </ul>
  )
}

export function summarizeWeeks(weeks: RoleWeek[]): string {
  const count = (fit: WeekFit) => weeks.filter((w) => w.fit === fit).length
  const parts = [`${count('fits')} of ${weeks.length} weeks have room`]
  if (count('short')) parts.push(`${count('short')} short`)
  if (count('away')) parts.push(`${count('away')} away`)
  if (count('not-employed')) parts.push(`${count('not-employed')} not employed`)
  return parts.join(', ')
}
