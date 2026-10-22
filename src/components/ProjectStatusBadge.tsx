import { CalendarCheck, CircleDashed, Hourglass, PlayCircle, Wrench, type LucideIcon } from 'lucide-react'
import type { Project, ProjectStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

/**
 * Project status as its own visual vocabulary, separate from the good/caution/bad tones.
 * Signed work is a solid badge; Proposed is dashed amber, matching the "if won" bars in the chart,
 * so unconfirmed projects read differently at a glance (and by text, not colour alone).
 */
const STATUS_STYLE: Record<ProjectStatus, { icon: LucideIcon; className: string }> = {
  'Starting soon': { icon: CalendarCheck, className: 'bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-300' },
  Active: { icon: PlayCircle, className: 'bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-300' },
  'Wrapping up': { icon: Hourglass, className: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-300' },
  Proposed: { icon: CircleDashed, className: 'border border-dashed border-amber-500 bg-amber-50 text-amber-950' },
  Internal: { icon: Wrench, className: 'bg-white text-slate-600 ring-1 ring-inset ring-slate-300' },
}

/** One-line meaning, used as the badge's accessible description. */
export const PROJECT_STATUS_MEANING: Record<ProjectStatus, string> = {
  'Starting soon': 'Signed, not started yet',
  Active: 'Signed, in progress',
  'Wrapping up': 'Signed, ending soon',
  Proposed: 'Not won yet; assignments stay tentative',
  Internal: 'Internal work; people can be pulled off',
}

export function ProjectStatusBadge({
  project,
  size = 'sm',
  className,
}: {
  project: Pick<Project, 'status' | 'winProbabilityPct'>
  size?: 'xs' | 'sm'
  className?: string
}) {
  const { icon: Icon, className: style } = STATUS_STYLE[project.status]
  const proposed = project.status === 'Proposed'
  return (
    <span
      title={PROJECT_STATUS_MEANING[project.status]}
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-semibold whitespace-nowrap',
        size === 'xs' ? 'px-1.5 py-px text-[11px]' : 'px-2 py-0.5 text-xs',
        style,
        className,
      )}
    >
      <Icon aria-hidden className={size === 'xs' ? 'size-3' : 'size-3.5'} />
      <span className="sr-only">Project status: </span>
      {project.status}
      {proposed && (
        <span className="font-normal">
          {project.winProbabilityPct != null ? ` · ${project.winProbabilityPct}% win chance` : ' · not won yet'}
        </span>
      )}
      {!proposed && project.status !== 'Internal' && <span className="sr-only">, signed</span>}
    </span>
  )
}
