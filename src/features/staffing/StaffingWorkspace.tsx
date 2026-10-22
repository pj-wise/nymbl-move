import { useMemo, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { recentActuals } from "@/domain/actuals";
import { useDeferredFocus } from "@/lib/useDeferredFocus";
import { CandidatePanel } from "./CandidatePanel";
import { PreviewPanel } from "./PreviewPanel";
import { RoleQueue } from "./RoleQueue";
import { commitFromPreview, type StaffingStore } from "./useStaffingState";

/** Resource Manager workspace: role queue → candidates → preview → commit. */
export function StaffingWorkspace({ store }: { store: StaffingStore }) {
  const {
    state,
    dispatch,
    dataset,
    ctx,
    selectedRole,
    selectedPerson,
    candidates,
    preview,
    commitsByRole,
  } = store;

  const roleHeadingRef = useRef<HTMLHeadingElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusLater = useDeferredFocus();

  const project = selectedRole
    ? ctx.projects.get(selectedRole.projectId)
    : undefined;
  const commit = selectedRole ? commitsByRole.get(selectedRole.id) : undefined;
  const evaluation = candidates.find(
    (c) => c.person.id === state.selectedPersonId,
  );
  const actuals = useMemo(
    () =>
      selectedPerson
        ? recentActuals(ctx, selectedPerson, dataset.hoursLogged)
        : null,
    [ctx, selectedPerson, dataset],
  );
  const nextMustFill = dataset.openRoles.find(
    (r) =>
      r.priority === "Must fill" &&
      !commitsByRole.has(r.id) &&
      r.id !== selectedRole?.id,
  );
  const includeTentative = state.scenario === "withTentative";

  function selectRole(roleId: string) {
    dispatch({ type: "selectRole", roleId });
    focusLater(roleHeadingRef);
  }

  function selectPerson(personId: string) {
    dispatch({ type: "selectPerson", personId });
    focusLater(previewHeadingRef);
  }

  function clearPerson() {
    const personId = state.selectedPersonId;
    dispatch({ type: "selectPerson", personId: null });
    // Return focus to the candidate the user came from.
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-person-id="${personId}"]`)
        ?.focus();
    });
  }

  return (
    <>
      {/* Candidates get the most room; the queue and preview stick beside them while the list scrolls. */}
      <main
        id="workspace"
        className="grid flex-1 grid-cols-[minmax(250px,1fr)_minmax(0,2fr)_minmax(370px,1.2fr)] items-start gap-4 px-6 py-4"
      >
        <RoleQueue
          roles={dataset.openRoles}
          ctx={ctx}
          scenario={state.scenario}
          releaseInternal={state.releaseInternalAll}
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
          reveal={state.reveal}
          scenarioControl={
            <div className="grid gap-1.5 pt-0.5">
              <TentativeToggle store={store} />
              <InternalReleaseToggle store={store} />
            </div>
          }
          enrichment={store.enrichment}
          compareIds={state.compareIds}
          comparison={store.comparison}
          onToggleCompare={(personId) =>
            dispatch({ type: "toggleCompare", personId })
          }
          onClearCompare={() => dispatch({ type: "clearCompare" })}
          onPreviewFromCompare={selectPerson}
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
          onReleaseInternalChange={(value) =>
            dispatch({ type: "setReleaseInternal", value })
          }
          onClear={clearPerson}
          onCommit={(note) => {
            if (!preview) return;
            dispatch({
              type: "commit",
              record: commitFromPreview(preview, note),
              personName: preview.person.name,
            });
            focusLater(previewHeadingRef);
          }}
          onUndo={() => {
            if (!selectedRole) return;
            dispatch({ type: "undo", roleId: selectedRole.id });
            focusLater(previewHeadingRef);
          }}
          onNextRole={nextMustFill ? () => selectRole(nextMustFill.id) : null}
        />
      </main>
    </>
  );
}

/** Header control for the staffing workspace only: whether tentative work counts as load. */
export function TentativeToggle({ store }: { store: StaffingStore }) {
  const { state, dispatch } = store;
  const includeTentative = state.scenario === "withTentative";
  return (
    // Compact: it sits beside the role title. The hint stays as the switch's description and a tooltip.
    <div
      title="Enrollment Redesign, 60% win chance, decision Nov 20"
      className="flex items-center justify-end gap-2"
    >
      <Switch
        id="include-tentative"
        size="sm"
        checked={includeTentative}
        onCheckedChange={(checked) => {
          dispatch({
            type: "setScenario",
            scenario: checked ? "withTentative" : "confirmed",
          });
          dispatch({
            type: "announce",
            message: checked
              ? "Now counting tentative work from proposed projects as load."
              : "Now counting confirmed work only.",
          });
        }}
        aria-describedby="include-tentative-hint"
      />
      <Label htmlFor="include-tentative" className="text-xs whitespace-nowrap text-slate-700">
        Factor Proposed Projects
      </Label>
      <p id="include-tentative-hint" className="sr-only">
        Enrollment Redesign, 60% win chance, decision Nov 20
      </p>
    </div>
  );
}

/** Role-card control, like "Factor Proposed Projects": match everyone as if internal work were released. */
export function InternalReleaseToggle({ store }: { store: StaffingStore }) {
  const { state, dispatch } = store;
  return (
    <div
      title="Internal work (e.g. Design System Refresh) can give way to client work"
      className="flex items-center justify-end gap-2"
    >
      <Switch
        id="release-internal-all"
        size="sm"
        checked={state.releaseInternalAll}
        onCheckedChange={(value) =>
          dispatch({ type: "setReleaseInternalAll", value })
        }
        aria-describedby="release-internal-all-hint"
      />
      <Label htmlFor="release-internal-all" className="text-xs whitespace-nowrap text-slate-700">
        Remove Internal Allocations
      </Label>
      <p id="release-internal-all-hint" className="sr-only">
        Counts internal project hours as free for this role. You can still
        change it for each assignment when you confirm.
      </p>
    </div>
  );
}
