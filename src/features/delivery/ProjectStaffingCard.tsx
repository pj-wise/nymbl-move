import { ChevronRight } from 'lucide-react'
import { ProjectStatusBadge } from '@/components/ProjectStatusBadge'
import { Pill } from '@/components/Tone'
import type { PlanContext, ResolvedAssignment } from '@/domain/capacity'
import { TODAY } from '@/domain/dates'
import { projectTeam, type StaffingRequest, type StaffingSummary } from '@/domain/projectStaffing'
import type { Assignment, Project } from '@/domain/types'
import { formatRange, formatShort, relativeToToday } from '@/lib/format'

interface ProjectStaffingCardProps {
  ctx: PlanContext
  project: Project
  myAssignment: ResolvedAssignment
  requests: StaffingRequest[]
  summary: StaffingSummary
}

const statusText = (a: Assignment) => (a.status === 'Tentative' ? 'Tentative, only if won' : 'Confirmed')

export function ProjectStaffingCard({ ctx, project, myAssignment, requests, summary }: ProjectStaffingCardProps) {
  const headingId = `project-${project.id}`
  const team = projectTeam(ctx, project.id, TODAY)

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={headingId} className="text-base font-semibold text-slate-900">
              {project.name}
            </h3>
            <ProjectStatusBadge project={project} />
          </div>
          <p className="mt-0.5 text-sm text-slate-600">
            {project.client} · {formatRange(project.startDate, project.endDate)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            You: {myAssignment.roleOnProject}, {myAssignment.allocationPct}%
            {myAssignment.status === 'Tentative' && ' · tentative, only if won'}
            {myAssignment.origin === 'local' && ' · assigned this session'}
          </p>
        </div>
        <div className="shrink-0 pt-0.5 text-right">
          {summary.fullyStaffed ? (
            <>
              <Pill tone="good">Fully staffed</Pill>
              <span className="mt-1 block text-[11px] text-slate-500">
                {summary.total === 0 ? 'No staffing requests' : `All ${summary.total} requests filled`}
              </span>
            </>
          ) : (
            <Pill tone="caution">
              {summary.open} of {summary.total} requests open
            </Pill>
          )}
        </div>
      </header>

      {requests.length > 0 && (
        <div className="px-5 py-3">
          <h4 className="mb-1.5 text-sm font-semibold text-slate-900">Staffing requests</h4>
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] tracking-wide text-slate-500 uppercase">
              <tr>
                <th scope="col" className="pb-1 font-medium">Role</th>
                <th scope="col" className="pb-1 font-medium">Needed from</th>
                <th scope="col" className="pb-1 font-medium">Status</th>
                <th scope="col" className="pb-1 font-medium">Assigned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map(({ role, state, assignment }) => {
                const person = assignment ? ctx.people.get(assignment.personId) : undefined
                return (
                  <tr key={role.id} className="align-top">
                    <td className="py-2 pr-3">
                      <span className="font-medium text-slate-900">
                        {role.level} {role.roleNeeded}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {role.allocationPct}% · {role.priority} · {role.id}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {formatShort(role.startDate)}
                      <span className="block text-xs text-slate-500">requested</span>
                    </td>
                    <td className="py-2 pr-3">
                      {state === 'filled' ? <Pill tone="good">Filled</Pill> : <Pill tone="caution">Open</Pill>}
                    </td>
                    <td className="py-2">
                      {assignment ? (
                        <>
                          <span className="font-medium text-slate-900">{person?.name ?? assignment.personId}</span>
                          <span className="block text-xs text-slate-600">
                            Starts {formatShort(assignment.startDate)}, {relativeToToday(assignment.startDate)} ·{' '}
                            {statusText(assignment)}
                          </span>
                          {assignment.origin === 'local' && (
                            <span className="block text-[11px] text-slate-500">Assigned this session</span>
                          )}
                        </>
                      ) : state === 'filled' ? (
                        <span className="text-xs text-slate-500">Filled outside this tool</span>
                      ) : (
                        <span className="text-xs text-slate-500">Not assigned yet</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <details className="group border-t border-slate-200">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset">
          <ChevronRight aria-hidden className="size-4 text-slate-500 transition-transform group-open:rotate-90" />
          Team on this project ({team.length})
        </summary>
        <ul className="divide-y divide-slate-100 px-5 pb-3">
          {team.map(({ person, assignment }) => (
            <li key={assignment.id} className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
              <span>
                <span className="text-slate-900">{person?.name ?? assignment.personId}</span>
                <span className="text-slate-500"> · {assignment.roleOnProject}</span>
              </span>
              <span className="text-xs whitespace-nowrap text-slate-600 tabular-nums">
                {assignment.allocationPct}% · {formatRange(assignment.startDate, assignment.effectiveEnd)}
                {assignment.endAssumed && ' (end assumed)'} · {statusText(assignment)}
                {assignment.origin === 'local' && ' · this session'}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
