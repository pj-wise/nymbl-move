import { CalendarClock, ChevronDown, CircleDashed, Search } from 'lucide-react'
import { Tabs } from 'radix-ui'
import { useMemo, useState } from 'react'
import { ProjectStatusBadge } from '@/components/ProjectStatusBadge'
import { Pill, type Tone } from '@/components/Tone'
import { enrichment } from '@/data/enrichment'
import type { PlanContext } from '@/domain/capacity'
import { candidatesForRole } from '@/domain/candidates'
import type { OpenRole, Project, ProjectStatus, RolePriority, Scenario } from '@/domain/types'
import { formatShort, plural, relativeToToday } from '@/lib/format'
import { useRovingFocus } from '@/lib/useRovingFocus'
import { cn } from '@/lib/utils'
import type { CommitRecord } from './useStaffingState'

const PRIORITY_TONE: Record<RolePriority, Tone> = {
  'Must fill': 'bad',
  'Nice to fill': 'info',
  'If won': 'unknown',
}
const PRIORITIES: RolePriority[] = ['Must fill', 'Nice to fill', 'If won']
/** Tab order; only statuses of projects that have staffing requests get a tab. */
const STATUS_ORDER: ProjectStatus[] = ['Active', 'Starting soon', 'Wrapping up', 'Proposed', 'Internal']
type StatusTab = ProjectStatus | 'all'

interface RoleQueueProps {
  roles: OpenRole[]
  ctx: PlanContext
  scenario: Scenario
  releaseInternal: boolean
  selectedRoleId: string | null
  commitsByRole: Map<string, CommitRecord>
  onSelect: (roleId: string) => void
}

export function RoleQueue({ roles, ctx, scenario, releaseInternal, selectedRoleId, commitsByRole, onSelect }: RoleQueueProps) {
  const onKeyDown = useRovingFocus()
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState<RolePriority | 'any'>('any')
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const statusOf = (r: OpenRole) => ctx.projects.get(r.projectId)?.status

  const isFilled = (r: OpenRole) => commitsByRole.has(r.id) || r.status !== 'Open'
  // Only open staffing requests belong here; filled roles live on in shared state and the DM view.
  const openRoles = useMemo(
    () => roles.filter((r) => !commitsByRole.has(r.id) && r.status === 'Open'),
    [roles, commitsByRole],
  )
  const filtering = query.trim() !== '' || priority !== 'any'

  // Tabs come from every request (filled included) so they don't vanish as roles get filled.
  const statusTabs = STATUS_ORDER.filter((st) => roles.some((r) => statusOf(r) === st))
  const tabCount = (t: StatusTab) => (t === 'all' ? openRoles.length : openRoles.filter((r) => statusOf(r) === t).length)

  // Project status tab, then priority, then free text across role, skills, project and client.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return openRoles.filter((r) => {
      if (statusTab !== 'all' && ctx.projects.get(r.projectId)?.status !== statusTab) return false
      if (priority !== 'any' && r.priority !== priority) return false
      if (!q) return true
      const project = ctx.projects.get(r.projectId)
      const haystack = [r.id, r.level, r.roleNeeded, ...r.skillsRequired, project?.name, project?.client].join(' ').toLowerCase()
      return q.split(/\s+/).every((word) => haystack.includes(word))
    })
  }, [openRoles, statusTab, priority, query, ctx])

  const groups = useMemo(() => {
    const byProject = new Map<string, { project: Project | undefined; roles: OpenRole[] }>()
    for (const role of visible) {
      const group = byProject.get(role.projectId) ?? { project: ctx.projects.get(role.projectId), roles: [] }
      group.roles.push(role)
      byProject.set(role.projectId, group)
    }
    return [...byProject.values()]
  }, [visible, ctx])

  const readyCounts = useMemo(
    () =>
      new Map(
        roles.map((r) => [
          r.id,
          candidatesForRole(ctx, r, scenario, enrichment, { releaseInternal }).filter((c) => c.tier === 'ready').length,
        ]),
      ),
    [roles, ctx, scenario, releaseInternal],
  )

  // The selected role is the tab stop when it's in view; otherwise the first visible role.
  const tabStopId = visible.some((r) => r.id === selectedRoleId) ? selectedRoleId : visible[0]?.id

  return (
    <nav aria-labelledby="roles-heading" className="sticky top-4 h-[calc(100dvh-var(--app-header-h)-2rem)] flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-slate-50 shadow-sm">
      <Tabs.Root value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2.5 border-b border-slate-300 bg-white px-4 py-3">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="roles-heading" tabIndex={-1} className="rounded text-sm font-semibold text-slate-900 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              Open roles
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {filtering ? `${visible.length} of ${openRoles.length}` : `${openRoles.length} open`}
            </span>
          </div>
          <p className="text-xs text-slate-500">Use ↑ ↓ to move, Enter to open.</p>
        </div>
        <Tabs.List aria-label="Project status" className="flex rounded-lg bg-slate-100 p-0.5">
          {(['all', ...statusTabs] as StatusTab[]).map((t) => (
            <Tabs.Trigger
              key={t}
              value={t}
              className="flex-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-600 outline-none hover:text-slate-900 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
            >
              {t === 'all' ? 'All' : t} ({tabCount(t)})
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search roles</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Role, skill or project"
              className="h-8 w-full rounded-md border border-slate-300 bg-white pr-2 pl-7 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <label className="relative shrink-0">
            <span className="sr-only">Priority</span>
            {/* Native select for accessibility; our own caret so it lines up with the search box padding. */}
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as RolePriority | 'any')}
              className="h-8 w-[7.5rem] appearance-none rounded-md border border-slate-300 bg-white pr-7 pl-2 text-xs text-slate-900 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="any">Any priority</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-slate-500" />
          </label>
        </div>
      </div>
      <Tabs.Content value={statusTab} className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-4 outline-none" onKeyDown={onKeyDown}>
        {/* Skip-link target; Radix owns the panel's own id. */}
        <div id="roles" className="space-y-5">
        {groups.length === 0 && (
          <div className="px-2 py-8 text-center text-sm text-slate-600">
            {filtering ? (
              <>
                <p>No roles match your filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setPriority('any')
                  }}
                  className="mt-2 rounded text-xs font-medium text-slate-900 underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
                >
                  Clear filters
                </button>
              </>
            ) : statusTab !== 'all' ? (
              <p>No open roles on {statusTab.toLowerCase()} projects.</p>
            ) : (
              <p>No open roles. Every staffing request is filled.</p>
            )}
          </div>
        )}
        {groups.map(({ project, roles: projectRoles }) => {
          // Project totals, including roles already filled, so progress stays visible.
          const allProjectRoles = roles.filter((r) => r.projectId === project?.id)
          const filled = allProjectRoles.filter(isFilled).length
          const proposed = project?.status === 'Proposed'
          return (
            <section key={project?.id} aria-label={project?.name}>
              <div className="mb-2 border-b border-slate-200 px-1 pb-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-[13px] font-semibold text-slate-800">{project?.name}</h3>
                  <span className="text-[11px] whitespace-nowrap text-slate-500">
                    {filled}/{allProjectRoles.length} filled
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  {project && <ProjectStatusBadge project={project} size="xs" />}
                  <span className="truncate">{project?.client}</span>
                </p>
                {proposed && (
                  <p className="mt-1 text-[11px] text-amber-900">Not won yet. Anyone assigned here stays tentative.</p>
                )}
              </div>
              <ul className="space-y-2">
                {projectRoles.map((role) => {
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
                            : proposed
                              ? 'border-dashed border-amber-400 hover:border-amber-500 hover:bg-amber-50/40'
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
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <CircleDashed aria-hidden className="size-3.5" />
                            {ready > 0 ? `${ready} ready` : 'none ready'}
                          </span>
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
      </Tabs.Content>
      </Tabs.Root>
      <p className="sr-only">{plural(openRoles.length, 'role')} still open.</p>
    </nav>
  )
}
