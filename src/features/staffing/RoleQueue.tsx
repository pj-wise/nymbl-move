import { CalendarClock, CircleCheck, CircleDashed } from 'lucide-react'
import { useMemo } from 'react'
import { Pill, type Tone } from '@/components/Tone'
import { enrichment } from '@/data/enrichment'
import type { PlanContext } from '@/domain/capacity'
import { candidatesForRole } from '@/domain/candidates'
import type { OpenRole, Project, RolePriority, Scenario } from '@/domain/types'
import { formatShort, plural, relativeToToday } from '@/lib/format'
import { useRovingFocus } from '@/lib/useRovingFocus'
import { cn } from '@/lib/utils'
import type { CommitRecord } from './useStaffingState'

const PRIORITY_TONE: Record<RolePriority, Tone> = {
  'Must fill': 'bad',
  'Nice to fill': 'info',
  'If won': 'unknown',
}

interface RoleQueueProps {
  roles: OpenRole[]
  ctx: PlanContext
  scenario: Scenario
  selectedRoleId: string | null
  commitsByRole: Map<string, CommitRecord>
  onSelect: (roleId: string) => void
}

export function RoleQueue({ roles, ctx, scenario, selectedRoleId, commitsByRole, onSelect }: RoleQueueProps) {
  const onKeyDown = useRovingFocus()

  const groups = useMemo(() => {
    const byProject = new Map<string, { project: Project | undefined; roles: OpenRole[] }>()
    for (const role of roles) {
      const group = byProject.get(role.projectId) ?? { project: ctx.projects.get(role.projectId), roles: [] }
      group.roles.push(role)
      byProject.set(role.projectId, group)
    }
    return [...byProject.values()]
  }, [roles, ctx])

  const readyCounts = useMemo(
    () =>
      new Map(
        roles.map((r) => [
          r.id,
          candidatesForRole(ctx, r, scenario, enrichment).filter((c) => c.tier === 'ready').length,
        ]),
      ),
    [roles, ctx, scenario],
  )

  // First role is the tab stop when nothing is selected yet.
  const tabStopId = selectedRoleId ?? roles[0]?.id

  return (
    <nav aria-labelledby="roles-heading" className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-slate-50 shadow-sm">
      <div className="border-b border-slate-300 bg-white px-4 py-3">
        <h2 id="roles-heading" className="text-sm font-semibold text-slate-900">
          Open roles
        </h2>
        <p className="text-xs text-slate-500">Use ↑ ↓ to move, Enter to open.</p>
      </div>
      <div id="roles" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pt-3 pb-4" onKeyDown={onKeyDown}>
        {groups.map(({ project, roles: projectRoles }) => {
          const filled = projectRoles.filter((r) => commitsByRole.has(r.id)).length
          return (
            <section key={project?.id} aria-label={project?.name}>
              <div className="mb-2 border-b border-slate-200 px-1 pb-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-[13px] font-semibold text-slate-800">{project?.name}</h3>
                  <span className="text-[11px] whitespace-nowrap text-slate-500">
                    {filled}/{projectRoles.length} filled
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {project?.client} · {project?.status}
                  {project?.winProbabilityPct != null && ` · ${project.winProbabilityPct}% win chance`}
                </p>
              </div>
              <ul className="space-y-2">
                {projectRoles.map((role) => {
                  const commit = commitsByRole.get(role.id)
                  const person = commit ? ctx.people.get(commit.personId) : undefined
                  const selected = role.id === selectedRoleId
                  const ready = readyCounts.get(role.id) ?? 0
                  return (
                    <li key={role.id}>
                      <button
                        type="button"
                        data-roving-item
                        tabIndex={role.id === tabStopId ? 0 : -1}
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => onSelect(role.id)}
                        className={cn(
                          'relative w-full overflow-hidden rounded-lg border bg-white px-3 py-2 text-left shadow-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
                          // Accent bar + border mark the open role; not colour alone (aria-current too).
                          'before:absolute before:inset-y-0 before:left-0 before:w-1',
                          selected
                            ? 'border-slate-900 bg-indigo-50/60 shadow-md ring-1 ring-slate-900 before:bg-indigo-600'
                            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50',
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {role.level} {role.roleNeeded}
                          </span>
                          <span className="text-[11px] text-slate-500 tabular-nums">{role.allocationPct}%</span>
                        </span>
                        <span className="block mt-0.5 truncate text-xs text-slate-500">{role.skillsRequired.join(' · ')}</span>
                        <span className="block mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Pill tone={PRIORITY_TONE[role.priority]}>{role.priority}</Pill>
                          {commit ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
                              <CircleCheck aria-hidden className="size-3.5" />
                              {person?.name ?? commit.personId}
                              <span className="font-normal text-slate-500">(local)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                              <CircleDashed aria-hidden className="size-3.5" />
                              Open · {ready > 0 ? `${ready} ready` : 'none ready'}
                            </span>
                          )}
                        </span>
                        <span className="block mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                          <CalendarClock aria-hidden className="size-3" />
                          Starts {formatShort(role.startDate)}, {relativeToToday(role.startDate)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
      <p className="sr-only">{plural(roles.length - commitsByRole.size, 'role')} still open.</p>
    </nav>
  )
}
