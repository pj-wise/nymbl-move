import { FolderOpen } from 'lucide-react'
import { useMemo } from 'react'
import type { AppUser } from '@/auth/permissions'
import { TODAY } from '@/domain/dates'
import { deliveryProjectsFor, projectStaffingSummary, staffingRequestsFor } from '@/domain/projectStaffing'
import type { StaffingStore } from '@/features/staffing/useStaffingState'
import { plural } from '@/lib/format'
import { ProjectStaffingCard } from './ProjectStaffingCard'

/** Delivery Manager workspace: the viewer's own projects and how staffed each one is. */
export function DeliveryWorkspace({ store, user }: { store: StaffingStore; user: AppUser }) {
  const { ctx, dataset, filledBy } = store

  const projects = useMemo(() => {
    const mine = user.personId ? deliveryProjectsFor(ctx, user.personId, TODAY) : []
    return mine
      .map((d) => {
        const requests = staffingRequestsFor(d.project.id, dataset.openRoles, filledBy)
        return { ...d, requests, summary: projectStaffingSummary(requests) }
      })
      .sort(
        (a, b) =>
          Number(a.summary.fullyStaffed) - Number(b.summary.fullyStaffed) ||
          a.project.startDate.localeCompare(b.project.startDate),
      )
  }, [ctx, dataset, filledBy, user.personId])

  const needPeople = projects.filter((p) => !p.summary.fullyStaffed).length

  return (
    <main id="workspace" tabIndex={-1} className="flex-1 px-6 py-5 outline-none">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h2
            id="delivery-heading"
            tabIndex={-1}
            className="w-fit rounded text-lg font-semibold text-slate-900 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Your projects
          </h2>
          <p className="text-sm text-slate-600">
            Projects where you're assigned as Delivery Manager
            {projects.length > 0 && (
              <>
                {' · '}
                {plural(projects.length, 'project')}
                {', '}
                {needPeople === 0 ? 'all fully staffed' : `${needPeople} still ${needPeople === 1 ? 'needs' : 'need'} people`}
              </>
            )}
          </p>
        </div>

        {projects.length === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-400 bg-white/70 p-10 text-center">
            <FolderOpen aria-hidden className="mx-auto mb-3 size-8 text-slate-400" />
            <h3 className="text-base font-semibold text-slate-900">You're not on any projects as Delivery Manager yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
              Projects appear here once a Resource Manager assigns you to a Delivery Manager role.
            </p>
          </section>
        ) : (
          projects.map((p) => (
            <ProjectStaffingCard
              key={p.project.id}
              ctx={ctx}
              project={p.project}
              myAssignment={p.assignment}
              requests={p.requests}
              summary={p.summary}
            />
          ))
        )}
      </div>
    </main>
  )
}
