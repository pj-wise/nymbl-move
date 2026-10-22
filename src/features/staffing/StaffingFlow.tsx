import { CalendarDays, FlaskConical, RotateCcw } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { recentActuals } from '@/domain/actuals'
import { TODAY } from '@/domain/dates'
import { formatShort } from '@/lib/format'
import { useDeferredFocus } from '@/lib/useDeferredFocus'
import { AttentionStrip } from './AttentionStrip'
import { CandidatePanel } from './CandidatePanel'
import { PreviewPanel } from './PreviewPanel'
import { RoleQueue } from './RoleQueue'
import { commitFromPreview, useStaffingState } from './useStaffingState'

export function StaffingFlow() {
  const store = useStaffingState()
  const { state, dispatch, dataset, ctx, selectedRole, selectedPerson, candidates, preview, attention, commitsByRole } =
    store

  const roleHeadingRef = useRef<HTMLHeadingElement>(null)
  const previewHeadingRef = useRef<HTMLHeadingElement>(null)
  // Reset disables its own button, so focus moves to the page title instead.
  const titleRef = useRef<HTMLHeadingElement>(null)
  const focusLater = useDeferredFocus()

  const project = selectedRole ? ctx.projects.get(selectedRole.projectId) : undefined
  const commit = selectedRole ? commitsByRole.get(selectedRole.id) : undefined
  const evaluation = candidates.find((c) => c.person.id === state.selectedPersonId)
  const actuals = useMemo(
    () => (selectedPerson ? recentActuals(ctx, selectedPerson, dataset.hoursLogged) : null),
    [ctx, selectedPerson, dataset],
  )
  const nextMustFill = dataset.openRoles.find(
    (r) => r.priority === 'Must fill' && !commitsByRole.has(r.id) && r.id !== selectedRole?.id,
  )
  const includeTentative = state.scenario === 'withTentative'
  const hasLocalChanges = state.commits.length > 0

  function selectRole(roleId: string) {
    dispatch({ type: 'selectRole', roleId })
    focusLater(roleHeadingRef)
  }

  function selectPerson(personId: string) {
    dispatch({ type: 'selectPerson', personId })
    focusLater(previewHeadingRef)
  }

  function clearPerson() {
    const personId = state.selectedPersonId
    dispatch({ type: 'selectPerson', personId: null })
    // Return focus to the candidate the user came from.
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-person-id="${personId}"]`)?.focus()
    })
  }

  return (
    <div className="flex h-screen min-w-[1200px] flex-col overflow-hidden bg-slate-200/70 text-slate-900">
      <a
        href="#roles"
        className="sr-only z-50 rounded bg-white px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to open roles
      </a>

      <header className="relative z-10 flex items-center justify-between gap-6 border-b border-slate-300 bg-white px-6 py-3 shadow-sm">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{dataset.company}</p>
          <h1 ref={titleRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            Staffing
          </h1>
        </div>
        <div className="flex items-center gap-5">
          <p className="inline-flex items-center gap-1.5 text-sm text-slate-700">
            <CalendarDays aria-hidden className="size-4 text-slate-500" />
            Today is Mon {formatShort(TODAY)}, 2026 <span className="text-xs text-slate-500">(demo date)</span>
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
            <Switch
              id="include-tentative"
              checked={includeTentative}
              onCheckedChange={(checked) => {
                dispatch({ type: 'setScenario', scenario: checked ? 'withTentative' : 'confirmed' })
                dispatch({
                  type: 'announce',
                  message: checked
                    ? 'Now counting tentative work from proposed projects as load.'
                    : 'Now counting confirmed work only.',
                })
              }}
              aria-describedby="include-tentative-hint"
            />
            <div>
              <Label htmlFor="include-tentative" className="text-sm">
                Count tentative work
              </Label>
              <p id="include-tentative-hint" className="text-[11px] text-slate-500">
                Enrollment Redesign, 60% win chance, decision Nov 20
              </p>
            </div>
          </div>
          <p className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-xs text-violet-900 ring-1 ring-violet-200 ring-inset">
            <FlaskConical aria-hidden className="size-3.5" />
            Prototype: changes stay in this tab
          </p>
          <Button
            variant="outline"
            disabled={!hasLocalChanges}
            onClick={() => {
              dispatch({ type: 'reset' })
              focusLater(titleRef)
            }}
          >
            <RotateCcw aria-hidden /> Reset demo
          </Button>
        </div>
      </header>

      <AttentionStrip items={attention} />

      <main className="grid min-h-0 flex-1 grid-cols-[290px_minmax(0,1fr)_minmax(400px,0.8fr)] gap-4 px-6 py-4">
        <RoleQueue
          roles={dataset.openRoles}
          ctx={ctx}
          scenario={state.scenario}
          selectedRoleId={state.selectedRoleId}
          commitsByRole={commitsByRole}
          onSelect={selectRole}
        />
        <CandidatePanel
          role={selectedRole}
          project={project}
          candidates={candidates}
          selectedPersonId={state.selectedPersonId}
          commit={commit}
          headingRef={roleHeadingRef}
          includeTentative={includeTentative}
          onSelect={selectPerson}
        />
        <PreviewPanel
          role={selectedRole}
          preview={preview}
          evaluation={evaluation}
          actuals={actuals}
          commit={commit}
          committedPerson={commit ? ctx.people.get(commit.personId) : undefined}
          releaseInternal={state.releaseInternal}
          showTentative={includeTentative}
          headingRef={previewHeadingRef}
          onReleaseInternalChange={(value) => dispatch({ type: 'setReleaseInternal', value })}
          onClear={clearPerson}
          onCommit={(note) => {
            if (!preview) return
            dispatch({ type: 'commit', record: commitFromPreview(preview, note), personName: preview.person.name })
            focusLater(previewHeadingRef)
          }}
          onUndo={() => {
            if (!selectedRole) return
            dispatch({ type: 'undo', roleId: selectedRole.id })
            focusLater(previewHeadingRef)
          }}
          onNextRole={nextMustFill ? () => selectRole(nextMustFill.id) : null}
        />
      </main>

      <div aria-live="polite" role="status" className="sr-only">
        {state.announcement}
      </div>
    </div>
  )
}
