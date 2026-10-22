import type { PreviewWeek } from '@/domain/preview'
import { formatShort } from '@/lib/format'
import { cn } from '@/lib/utils'

const HEIGHT = 112
const OVER_STRIPES = 'bg-[repeating-linear-gradient(135deg,rgb(225_29_72/0.75)_0_3px,transparent_3px_6px)]'
const IF_WON_FILL = 'bg-amber-200 bg-[repeating-linear-gradient(135deg,rgb(217_119_6/0.45)_0_2px,transparent_2px_5px)]'
const AWAY_FILL = 'bg-[repeating-linear-gradient(135deg,var(--color-slate-300)_0_3px,transparent_3px_6px)]'

/** Scale with headroom above the peak so 200% visibly reads as "double", not "full". */
function chartScaleMax(weeks: PreviewWeek[], includeTentative: boolean): number {
  const peak = Math.max(
    100,
    ...weeks.map((w) => (includeTentative ? (w.afterWithTentativePct ?? 0) : (w.afterPct ?? 0))),
  )
  return Math.max(150, Math.ceil((peak + 25) / 50) * 50)
}

interface LoadChartProps {
  weeks: PreviewWeek[]
  showTentative: boolean
  selectedWeek: string | null
  /** Mouse shortcut into the week-by-week table; the table itself is the keyboard path. */
  onSelectWeek: (weekStart: string) => void
}

/**
 * Stacked weekly load as a share of the hours the person is actually available that week.
 * Visual only (aria-hidden); the week-by-week table carries the same numbers for everyone.
 */
export function LoadChart({ weeks, showTentative, selectedWeek, onSelectWeek }: LoadChartProps) {
  const max = chartScaleMax(weeks, showTentative)
  const y = (pct: number) => (Math.min(pct, max) / max) * HEIGHT
  const months = new Set(
    weeks
      .filter((w, i) => i === 0 || w.weekStart.slice(5, 7) !== weeks[i - 1]?.weekStart.slice(5, 7))
      .map((w) => w.weekStart),
  )

  return (
    <figure className="space-y-2">
      <div aria-hidden className="flex gap-1.5">
        {/* Y axis */}
        <div className="relative w-9 shrink-0 text-right text-[10px] text-slate-500 tabular-nums" style={{ height: HEIGHT }}>
          <span className="absolute right-0 -translate-y-1/2" style={{ top: 0 }}>
            {max}%
          </span>
          <span className="absolute right-0 translate-y-1/2 font-semibold text-rose-700" style={{ bottom: y(100) }}>
            100%
          </span>
          <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
        </div>

        <div className="relative flex-1 border-b border-slate-300" style={{ height: HEIGHT }}>
          {/* Over-capacity zone */}
          <div className="absolute inset-x-0 top-0 bg-rose-50" style={{ bottom: y(100) }} />

          <div className="absolute inset-0 flex items-end gap-px">
            {weeks.map((w) => {
              const cap = w.capacityHours
              const away = w.workdays > 0 && cap === 0
              const pct = (hours: number) => (cap > 0 ? (hours / cap) * 100 : 0)
              const committed = pct(w.committedHours)
              const added = pct(w.newHours)
              const total = committed + added
              const tentative = showTentative ? pct(w.tentativeHours) : 0
              const before = w.beforePct ?? 0
              const selected = w.weekStart === selectedWeek
              return (
                <div
                  key={w.weekStart}
                  onClick={() => onSelectWeek(w.weekStart)}
                  title={
                    away
                      ? `Week of ${formatShort(w.weekStart)}: not available. Click for details.`
                      : `Week of ${formatShort(w.weekStart)}: ${w.afterPct}% of available hours. Click for details.`
                  }
                  className={cn(
                    'relative h-full min-w-[4px] flex-1 cursor-pointer rounded-t-[2px] hover:bg-slate-900/5',
                    selected && 'bg-slate-900/10 outline-2 outline-offset-1 outline-slate-900',
                  )}
                >
                  {away ? (
                    <div className={cn('absolute inset-x-0 bottom-0 rounded-t-[1px]', AWAY_FILL)} style={{ height: y(100) }} />
                  ) : (
                    <>
                      <div className="absolute inset-x-0 bottom-0 bg-slate-400" style={{ height: y(committed) }} />
                      <div
                        className="absolute inset-x-0 bg-indigo-600"
                        style={{ bottom: y(committed), height: y(total) - y(committed) }}
                      />
                      {tentative > 0 && (
                        <div
                          className={cn('absolute inset-x-0 border border-b-0 border-amber-600', IF_WON_FILL)}
                          style={{ bottom: y(total), height: y(total + tentative) - y(total) }}
                        />
                      )}
                      {total > 100 && (
                        <div className={cn('absolute inset-x-0', OVER_STRIPES)} style={{ bottom: y(100), height: y(total) - y(100) }} />
                      )}
                      {before > 0 && (
                        <div className="absolute inset-x-0 border-t-2 border-slate-900" style={{ bottom: y(before) - 1 }} />
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Capacity line sits above the bars so it stays visible where people are overloaded. */}
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-rose-600" style={{ bottom: y(100) - 1 }} />
        </div>
      </div>

      {/* Over-capacity markers + month labels */}
      <div aria-hidden className="flex gap-1.5">
        <div className="w-9 shrink-0" />
        <div className="flex-1 space-y-0.5">
          <div className="flex gap-px">
            {weeks.map((w) => (
              <span
                key={w.weekStart}
                className={cn('h-1 min-w-[4px] flex-1 rounded-full', (w.afterPct ?? 0) > 100 ? 'bg-rose-600' : 'bg-transparent')}
              />
            ))}
          </div>
          <div className="flex gap-px text-[10px] text-slate-500">
            {weeks.map((w) => (
              <span key={w.weekStart} className="min-w-[4px] flex-1 overflow-visible whitespace-nowrap">
                {months.has(w.weekStart) ? formatShort(w.weekStart).split(' ')[0] : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      <figcaption className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
        <Legend swatch="h-2.5 w-2.5 bg-slate-400" label="Already committed" />
        <Legend swatch="h-2.5 w-2.5 bg-indigo-600" label="This role" />
        <Legend swatch={cn('h-2.5 w-2.5 bg-rose-50 ring-1 ring-rose-300', OVER_STRIPES)} label="Over 100% of available hours" />
        {showTentative && <Legend swatch={cn('h-2.5 w-2.5 border border-amber-600', IF_WON_FILL)} label="Tentative, if won" />}
        <Legend swatch={cn('h-2.5 w-2.5', AWAY_FILL)} label="Away all week" />
        <Legend swatch="h-0.5 w-3 bg-slate-900" label="Load today" />
      </figcaption>
    </figure>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className={cn('inline-block rounded-[1px]', swatch)} />
      {label}
    </span>
  )
}
