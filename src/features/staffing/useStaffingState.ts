import { useMemo, useReducer } from "react";
import { NO_ENRICHMENT, enrichment } from "@/data/enrichment";
import { sourceDataset } from "@/data/loadSource";
import { attentionItems } from "@/domain/attention";
import { MAX_COMPARE } from "@/domain/comparison";
import { buildPlanContext } from "@/domain/capacity";
import { formatShort } from "@/domain/dates";
import { candidatesForRole } from "@/domain/candidates";
import {
  previewAssignment,
  type StaffingPreview,
  type Verdict,
} from "@/domain/preview";
import type { Assignment, Scenario } from "@/domain/types";

/**
 * All staffing state lives here. Commits are stored as a list of changes and replayed over the
 * untouched source data, so undo/reset are trivial and the source is never mutated.
 */

export interface CommitRecord {
  roleId: string;
  personId: string;
  proposed: Assignment;
  released: { originalId: string; replacement: Assignment | null }[];
  verdict: Verdict;
  /** Issue messages the user acknowledged at commit time. */
  acknowledged: string[];
  /** Plain-language record of what the commit changed, shown in the success state. */
  changes: string[];
  note: string;
}

interface State {
  selectedRoleId: string | null;
  selectedPersonId: string | null;
  scenario: Scenario;
  /** Show our synthetic client-fit data (seniority expectations, industry). Display preference; survives reset. */
  showDemoData: boolean;
  releaseInternal: boolean;
  /**
   * "Release internal allocations" (role card): match and compare everyone as if their internal work
   * were released, and start each preview with it released. The confirm dialog can still change it per assignment.
   */
  releaseInternalAll: boolean;
  commits: CommitRecord[];
  announcement: string;
  /** A candidate to scroll to, expand and focus (from the issues menu). `n` re-triggers the same person. */
  reveal: { personId: string; n: number } | null;
  /** Up to MAX_COMPARE candidates picked for side-by-side comparison on the selected role. */
  compareIds: string[];
}

type Action =
  | { type: "selectRole"; roleId: string }
  | { type: "selectPerson"; personId: string | null }
  | { type: "setScenario"; scenario: Scenario }
  | { type: "setShowDemoData"; value: boolean }
  | { type: "setReleaseInternal"; value: boolean }
  | { type: "setReleaseInternalAll"; value: boolean }
  | { type: "commit"; record: CommitRecord; personName: string }
  | { type: "undo"; roleId: string }
  | { type: "reset" }
  | { type: "announce"; message: string }
  | {
      type: "revealCandidate";
      roleId: string;
      personId: string;
      message: string;
    }
  | { type: "toggleCompare"; personId: string }
  | { type: "clearCompare" };

const initialState: State = {
  selectedRoleId: null,
  selectedPersonId: null,
  scenario: "confirmed",
  showDemoData: false,
  releaseInternal: false,
  releaseInternalAll: false,
  commits: [],
  announcement: "",
  reveal: null,
  compareIds: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "selectRole":
      if (action.roleId === state.selectedRoleId) return state;
      // A different role means different requirements, so any comparison is cleared.
      return {
        ...state,
        selectedRoleId: action.roleId,
        selectedPersonId: null,
        releaseInternal: state.releaseInternalAll,
        reveal: null,
        compareIds: [],
      };
    case "selectPerson":
      return {
        ...state,
        selectedPersonId: action.personId,
        releaseInternal: state.releaseInternalAll,
        reveal: null,
      };
    case "revealCandidate":
      return {
        ...state,
        selectedRoleId: action.roleId,
        selectedPersonId: null,
        releaseInternal: state.releaseInternalAll,
        reveal: { personId: action.personId, n: (state.reveal?.n ?? 0) + 1 },
        compareIds:
          action.roleId === state.selectedRoleId ? state.compareIds : [],
        announcement: action.message,
      };
    case "setScenario":
      return { ...state, scenario: action.scenario };
    case "toggleCompare": {
      const has = state.compareIds.includes(action.personId);
      if (!has && state.compareIds.length >= MAX_COMPARE) return state;
      return {
        ...state,
        compareIds: has
          ? state.compareIds.filter((id) => id !== action.personId)
          : [...state.compareIds, action.personId],
      };
    }
    case "clearCompare":
      return { ...state, compareIds: [] };
    case "setShowDemoData":
      return {
        ...state,
        showDemoData: action.value,
        announcement: action.value
          ? "Showing demo fit data."
          : "Hiding demo fit data. Showing supplied data only.",
      };
    case "setReleaseInternal":
      return { ...state, releaseInternal: action.value };
    case "setReleaseInternalAll":
      return {
        ...state,
        releaseInternalAll: action.value,
        releaseInternal: action.value,
        announcement: action.value
          ? "Now counting internal allocations as released."
          : "Now counting internal allocations as committed work.",
      };
    case "commit":
      return {
        ...state,
        commits: [
          ...state.commits.filter((c) => c.roleId !== action.record.roleId),
          action.record,
        ],
        announcement: `${action.personName} assigned to ${action.record.roleId} in this session.`,
      };
    case "undo":
      return {
        ...state,
        commits: state.commits.filter((c) => c.roleId !== action.roleId),
        announcement: `Assignment for ${action.roleId} undone.`,
      };
    case "reset":
      return {
        ...initialState,
        showDemoData: state.showDemoData,
        announcement: "All local changes cleared. Showing the supplied data.",
      };
    case "announce":
      return { ...state, announcement: action.message };
  }
}

export function replayCommits(
  source: Assignment[],
  commits: CommitRecord[],
): Assignment[] {
  let list = source;
  for (const c of commits) {
    const releases = new Map(
      c.released.map((r) => [r.originalId, r.replacement]),
    );
    list = list.flatMap((a) => {
      if (!releases.has(a.id)) return [a];
      const replacement = releases.get(a.id);
      return replacement ? [replacement] : [];
    });
    list = [...list, c.proposed];
  }
  return list;
}

export function commitFromPreview(
  preview: StaffingPreview,
  note: string,
): CommitRecord {
  return {
    roleId: preview.role.id,
    personId: preview.person.id,
    proposed: preview.proposed,
    released: preview.released.map((r) => ({
      originalId: r.original.id,
      replacement: r.replacement,
    })),
    verdict: preview.verdict,
    acknowledged: preview.issues
      .filter((i) => i.severity !== "heads-up")
      .map((i) => i.message),
    changes: [
      `${preview.person.name}: peak load during the role ${preview.peakBeforePct}% → ${preview.peakAfterPct}%`,
      ...preview.released.map((r) => {
        const name = preview.commitments.find(
          (c) => c.assignment.id === r.original.id,
        )?.project?.name;
        return `${name ?? r.original.projectId} (internal) loses ${Math.round(r.hoursPerWeekFreed)}h/week from ${formatShort(r.from)}`;
      }),
      `${preview.role.id} now shows as filled for the Delivery Manager`,
    ],
    note,
  };
}

export function useStaffingState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const dataset = sourceDataset;

  const assignments = useMemo(
    () => replayCommits(dataset.assignments, state.commits),
    [dataset, state.commits],
  );
  const ctx = useMemo(
    () => buildPlanContext(dataset, assignments),
    [dataset, assignments],
  );

  const selectedRole =
    dataset.openRoles.find((r) => r.id === state.selectedRoleId) ?? null;
  const commitsByRole = useMemo(
    () => new Map(state.commits.map((c) => [c.roleId, c])),
    [state.commits],
  );
  /** roleId → the assignment that filled it. Shared with the Delivery Manager workspace. */
  const filledBy = useMemo(
    () => new Map(state.commits.map((c) => [c.roleId, c.proposed])),
    [state.commits],
  );

  // Candidates are evaluated against the plan *without* this role's own local commit,
  // so the list still makes sense after (and while undoing) an assignment.
  const candidateCtx = useMemo(() => {
    if (!selectedRole || !commitsByRole.has(selectedRole.id)) return ctx;
    const others = state.commits.filter((c) => c.roleId !== selectedRole.id);
    return buildPlanContext(
      dataset,
      replayCommits(dataset.assignments, others),
    );
  }, [ctx, dataset, selectedRole, commitsByRole, state.commits]);

  const activeEnrichment = state.showDemoData ? enrichment : NO_ENRICHMENT;
  const candidates = useMemo(
    () =>
      selectedRole
        ? candidatesForRole(
            candidateCtx,
            selectedRole,
            state.scenario,
            activeEnrichment,
            {
              releaseInternal: state.releaseInternalAll,
            },
          )
        : [],
    [
      candidateCtx,
      selectedRole,
      state.scenario,
      activeEnrichment,
      state.releaseInternalAll,
    ],
  );

  const selectedPerson = state.selectedPersonId
    ? (candidateCtx.people.get(state.selectedPersonId) ?? null)
    : null;
  const preview = useMemo(
    () =>
      selectedRole && selectedPerson
        ? previewAssignment(candidateCtx, selectedRole, selectedPerson, {
            releaseInternal: state.releaseInternal,
          })
        : null,
    [candidateCtx, selectedRole, selectedPerson, state.releaseInternal],
  );

  // Side-by-side comparison: the same evaluations and the same preview function and context as the
  // preview panel, so both views always agree. Internal work follows the role card's release toggle.
  const comparison = useMemo(
    () =>
      selectedRole
        ? state.compareIds.flatMap((id) => {
            const evaluation = candidates.find((c) => c.person.id === id);
            return evaluation
              ? [
                  {
                    evaluation,
                    preview: previewAssignment(
                      candidateCtx,
                      selectedRole,
                      evaluation.person,
                      {
                        releaseInternal: state.releaseInternalAll,
                      },
                    ),
                  },
                ]
              : [];
          })
        : [],
    [
      selectedRole,
      state.compareIds,
      candidates,
      candidateCtx,
      state.releaseInternalAll,
    ],
  );

  const attention = useMemo(
    () => attentionItems(ctx, state.scenario),
    [ctx, state.scenario],
  );

  return {
    state,
    dispatch,
    dataset,
    ctx,
    selectedRole,
    selectedPerson,
    candidates,
    preview,
    attention,
    commitsByRole,
    filledBy,
    enrichment: activeEnrichment,
    comparison,
  };
}

export type StaffingStore = ReturnType<typeof useStaffingState>;
