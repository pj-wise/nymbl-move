import { ArrowRight, ChevronRight, Maximize2, MousePointerClick, RotateCcw } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ToneText } from "@/components/Tone";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import type { ActualsSummary } from "@/domain/actuals";
import type { CandidateEvaluation } from "@/domain/candidates";
import type { StaffingPreview } from "@/domain/preview";
import type { OpenRole, Person } from "@/domain/types";
import { groupWeeks, summarizeWeeks } from "@/domain/weekGroups";
import { formatRange } from "@/lib/format";
import { CommitDialog } from "./CommitDialog";
import { LoadChart } from "./LoadChart";
import { PreviewDrawer } from "./PreviewDrawer";
import { IssueList, PeakSummary, ReleasedNote, VerdictBox } from "./PreviewParts";
import { findWeekButton } from "./WeekBreakdown";
import type { CommitRecord } from "./useStaffingState";

interface PreviewPanelProps {
  role: OpenRole | null;
  preview: StaffingPreview | null;
  evaluation: CandidateEvaluation | undefined;
  actuals: ActualsSummary | null;
  commit: CommitRecord | undefined;
  committedPerson: Person | undefined;
  releaseInternal: boolean;
  showTentative: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onReleaseInternalChange: (value: boolean) => void;
  onClear: () => void;
  onCommit: (note: string) => void;
  onUndo: () => void;
  onNextRole: (() => void) | null;
}

export function PreviewPanel(props: PreviewPanelProps) {
  const { role, preview, commit, headingRef } = props;

  if (role && commit)
    return <CommittedState {...props} role={role} commit={commit} />;

  if (!preview) {
    return (
      <Shell>
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <MousePointerClick
            aria-hidden
            className="mb-3 size-7 text-slate-400"
          />
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-sm font-semibold text-slate-900 outline-none"
          >
            {role
              ? "Select a candidate to preview the move"
              : "Preview appears here"}
          </h2>
          <p className="mt-1 max-w-xs text-sm text-slate-600">
            You’ll see their load before and after, every commitment it touches,
            and anything that needs a decision. Nothing changes until you
            confirm.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <ActivePreview
      key={`${preview.role.id}-${preview.person.id}`}
      {...props}
      preview={preview}
    />
  );
}

function Shell({
  children,
  onKeyDown,
}: {
  children: ReactNode;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  return (
    <aside
      aria-labelledby="preview-heading"
      onKeyDown={onKeyDown}
      className="sticky top-4 h-[calc(100dvh-var(--app-header-h)-2rem)] flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
    >
      {children}
    </aside>
  );
}

function ActivePreview({
  preview,
  evaluation,
  actuals,
  releaseInternal,
  showTentative,
  headingRef,
  onReleaseInternalChange,
  onClear,
  onCommit,
}: PreviewPanelProps & { preview: StaffingPreview }) {
  const { person, role, project } = preview;
  const internal = evaluation?.internalAssignments ?? [];
  const headsUp = preview.issues.filter((i) => i.severity === "heads-up").length;

  // Drawer and week selection live here, so closing the drawer or switching views never
  // loses the selected candidate or any preview state.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  // Whatever opened the drawer gets focus back when it closes (the expand button for chart clicks).
  const openerRef = useRef<HTMLElement | null>(null);
  // Set when a chart bar is clicked, so the matching week row takes focus once it's rendered.
  const focusWeek = useRef<string | null>(null);
  /** Focuses the pending week row if it's in the DOM yet; returns whether it did. */
  function focusPendingWeek(): boolean {
    if (!focusWeek.current) return false;
    const button = findWeekButton(focusWeek.current);
    if (!button) return false;
    focusWeek.current = null;
    button.focus({ preventScroll: true });
    // Scroll only the drawer body; scrollIntoView would also move the page behind it.
    const scroller = button.closest<HTMLElement>("[data-preview-scroll]");
    if (scroller) {
      const offset = button.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTo({ top: scroller.scrollTop + offset - scroller.clientHeight / 3, behavior: "smooth" });
    }
    return true;
  }
  // Chart clicks while the drawer is already open: focus after the expanded row renders.
  useEffect(() => {
    focusPendingWeek();
  });

  const chartShowsTentative =
    showTentative || preview.peakAfterWithTentativePct > preview.peakAfterPct;
  const groups = useMemo(
    () => groupWeeks(preview.weeks, chartShowsTentative),
    [preview.weeks, chartShowsTentative],
  );
  const summary = useMemo(
    () => summarizeWeeks(preview.weeks, chartShowsTentative),
    [preview.weeks, chartShowsTentative],
  );
  // The chart highlights every week of the expanded period.
  const selectedWeeks = useMemo(
    () =>
      new Set(
        groups
          .find((g) => g.weeks.some((w) => w.weekStart === selectedWeek))
          ?.weeks.map((w) => w.weekStart),
      ),
    [groups, selectedWeek],
  );
  const projectName = (id: string) =>
    preview.commitments.find((c) => c.assignment.projectId === id)?.project?.name ?? id;

  // A chart bar opens the drawer (if needed) on that week.
  function showWeek(weekStart: string) {
    setSelectedWeek(weekStart);
    focusWeek.current = weekStart;
    if (!drawerOpen) openerRef.current = expandRef.current;
    setDrawerOpen(true);
  }

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <Shell
        onKeyDown={(e) => {
          // Escape backs out of the preview. React bubbles events out of portals, so ignore keys
          // from the drawer and the commit dialog (portaled outside this DOM node); they handle their own Escape.
          if (e.key === "Escape" && e.currentTarget.contains(e.target as Node)) {
            e.preventDefault();
            onClear();
          }
        }}
      >
        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-4 pb-5"
        >
          <header>
            <div className="flex items-start justify-between gap-2">
              <p className="pt-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
                Preview · not saved
              </p>
              <SheetTrigger asChild>
                <Button
                  ref={expandRef}
                  variant="outline"
                  size="sm"
                  onClick={(e) => (openerRef.current = e.currentTarget)}
                  aria-label={`Open full breakdown for ${person.name}`}>
                  <Maximize2 aria-hidden /> Full breakdown
                </Button>
              </SheetTrigger>
            </div>
            <h2
              id="preview-heading"
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 rounded text-lg font-semibold text-slate-900 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {person.name} → {project?.name}
            </h2>
            <p className="text-sm text-slate-600">
              {role.level} {role.roleNeeded}, {role.allocationPct}% · {formatRange(role.startDate, role.endDate)}
            </p>
          </header>

          <VerdictBox preview={preview} />
          {/* Warnings that affect the decision stay visible here; the rest are in the full breakdown. */}
          <div className="space-y-3">
            <IssueList issues={preview.issues} severities={["blocker", "decision"]} />
          </div>

          <ReleasedNote preview={preview} />

          <section aria-labelledby="load-heading" className="space-y-3 border-t border-slate-200 pt-4">
            <h3 id="load-heading" className="text-sm font-semibold text-slate-900">
              Weekly utilization
            </h3>
            <PeakSummary preview={preview} />
            <LoadChart
              weeks={preview.weeks}
              showTentative={chartShowsTentative}
              selectedWeeks={selectedWeeks}
              onSelectWeek={showWeek}
              size="compact"
            />
          </section>

          <SheetTrigger asChild>
            <button
              type="button"
              onClick={(e) => (openerRef.current = e.currentTarget)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm outline-none hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-ring/60"
            >
              <span>
                <span className="block font-medium text-slate-900">Week by week, commitments and fit</span>
                <span className="block text-xs text-slate-600">
                  {preview.weeks.length} weeks · {preview.commitments.length} commitments
                  {headsUp > 0 && ` · ${headsUp} more ${headsUp === 1 ? "thing" : "things"} worth knowing`}
                </span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-slate-500" />
            </button>
          </SheetTrigger>
        </div>

        <footer className="space-y-2 border-t border-slate-300 bg-slate-50 px-5 py-3">
          <CommitDialog
            preview={preview}
            onConfirm={onCommit}
            release={{ internal, projectName, checked: releaseInternal, onCheckedChange: onReleaseInternalChange }}
          />
          <p className="text-center text-xs text-slate-500">
            Esc closes the preview. Changes stay in this browser tab only.
          </p>
        </footer>
      </Shell>

      <PreviewDrawer
        preview={preview}
        evaluation={evaluation}
        actuals={actuals}
        internal={internal}
        projectName={projectName}
        releaseInternal={releaseInternal}
        onReleaseInternalChange={onReleaseInternalChange}
        chartShowsTentative={chartShowsTentative}
        groups={groups}
        summary={summary}
        selectedWeek={selectedWeek}
        selectedWeeks={selectedWeeks}
        onSelectWeek={setSelectedWeek}
        onChartWeek={showWeek}
        focusPendingWeek={focusPendingWeek}
        onCommit={onCommit}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          (openerRef.current ?? expandRef.current)?.focus();
        }}
      />
    </Sheet>
  );
}

function CommittedState({
  role,
  commit,
  committedPerson,
  headingRef,
  onUndo,
  onNextRole,
}: PreviewPanelProps & { role: OpenRole; commit: CommitRecord }) {
  return (
    <Shell>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-4 pb-5 [&>section]:border-t [&>section]:border-slate-200 [&>section]:pt-4">
        <div className="rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-200 ring-inset">
          <p className="text-xs font-medium tracking-wide text-emerald-800 uppercase">
            Assigned in this session
          </p>
          <h2
            id="preview-heading"
            ref={headingRef}
            tabIndex={-1}
            className="mt-0.5 text-lg font-semibold text-emerald-950 outline-none rounded focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {committedPerson?.name} → {role.level} {role.roleNeeded}
          </h2>
          <p className="mt-1 text-sm text-emerald-900">
            {commit.proposed.status === "Tentative" ? "Tentative" : "Confirmed"}{" "}
            at {commit.proposed.allocationPct}%,{" "}
            {formatRange(
              commit.proposed.startDate,
              commit.proposed.endDate ?? role.endDate,
            )}
            . Every list and warning on this page now includes it.
          </p>
          <p className="mt-2 text-xs text-emerald-900">
            Not saved to a server and not sent to anyone. Reload or “Reset demo”
            to discard.
          </p>
        </div>

        <section aria-labelledby="changes-heading">
          <h3
            id="changes-heading"
            className="mb-1.5 text-sm font-semibold text-slate-900"
          >
            What changed
          </h3>
          <ul className="space-y-1 text-sm">
            {commit.changes.map((m) => (
              <li key={m}>
                <ToneText tone="info">{m}</ToneText>
              </li>
            ))}
          </ul>
        </section>

        {commit.acknowledged.length > 0 && (
          <section aria-labelledby="ack-heading">
            <h3
              id="ack-heading"
              className="mb-1.5 text-sm font-semibold text-slate-900"
            >
              Decisions you accepted
            </h3>
            <ul className="space-y-1 text-sm">
              {commit.acknowledged.map((m) => (
                <li key={m}>
                  <ToneText tone="caution">{m}</ToneText>
                </li>
              ))}
            </ul>
          </section>
        )}
        {commit.note && (
          <section aria-labelledby="note-heading">
            <h3
              id="note-heading"
              className="mb-1 text-sm font-semibold text-slate-900"
            >
              Note
            </h3>
            <p className="rounded-md bg-slate-50 p-2 text-sm text-slate-800">
              {commit.note}
            </p>
          </section>
        )}
      </div>
      <footer className="flex gap-2 border-t border-slate-300 bg-slate-50 px-5 py-3">
        <Button variant="outline" onClick={onUndo}>
          <RotateCcw aria-hidden /> Undo
        </Button>
        {onNextRole && (
          <Button className="flex-1" onClick={onNextRole}>
            Next open Must fill role <ArrowRight aria-hidden />
          </Button>
        )}
      </footer>
    </Shell>
  );
}
