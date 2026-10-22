import { useId } from "react";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import {
  DemoDataTag,
  Pill,
  ToneText,
  TONE_ICON,
  TONE_SURFACE,
  type Tone,
} from "@/components/Tone";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ActualsSummary } from "@/domain/actuals";
import type { ResolvedAssignment } from "@/domain/capacity";
import type { CandidateEvaluation, ReasonFactor } from "@/domain/candidates";
import {
  VERDICT_LABEL,
  type IssueSeverity,
  type PreviewIssue,
  type StaffingPreview,
  type Verdict,
} from "@/domain/preview";
import { firstName, formatHours, formatRange, formatShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Pieces shared by the compact preview and the full-breakdown drawer. Both render from the same
 * `StaffingPreview`, so the two views can never disagree.
 */

export const VERDICT_TONE: Record<Verdict, Tone> = {
  safe: "good",
  "needs-decision": "caution",
  blocked: "blocked",
};
const SEVERITY_TONE: Record<IssueSeverity, Tone> = {
  blocker: "blocked",
  decision: "caution",
  "heads-up": "info",
};
const SEVERITY_TITLE: Record<IssueSeverity, string> = {
  blocker: "Blocking",
  decision: "Needs your decision",
  "heads-up": "Worth knowing",
};

export function VerdictBox({ preview }: { preview: StaffingPreview }) {
  const tone = VERDICT_TONE[preview.verdict];
  const Icon = TONE_ICON[tone];
  const name = firstName(preview.person.name);
  const decisions = preview.issues.filter(
    (i) => i.severity === "decision",
  ).length;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg p-3 ring-1 ring-inset",
        TONE_SURFACE[tone],
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">{VERDICT_LABEL[preview.verdict]}</p>
        <p className="text-sm">
          {preview.verdict === "safe" &&
            `${name} has room for this role across all of its dates.`}
          {preview.verdict === "needs-decision" &&
            `${decisions} ${decisions === 1 ? "thing needs" : "things need"} a call before you assign ${name}.`}
          {preview.verdict === "blocked" &&
            `${name} can’t take this role as planned.`}
        </p>
      </div>
    </div>
  );
}

/** Issues grouped by severity. `severities` limits which groups show (the compact view shows the urgent ones). */
export function IssueList({
  issues,
  severities = ["blocker", "decision", "heads-up"],
  headingLevel = "h3",
}: {
  issues: PreviewIssue[];
  severities?: IssueSeverity[];
  headingLevel?: "h3" | "h4";
}) {
  const Heading = headingLevel;
  const idBase = useId();
  return (
    <>
      {severities.map((severity) => {
        const list = issues.filter((i) => i.severity === severity);
        if (list.length === 0) return null;
        return (
          <section key={severity} aria-labelledby={`${idBase}-${severity}`}>
            <Heading
              id={`${idBase}-${severity}`}
              className="mb-1.5 text-sm font-semibold text-slate-900"
            >
              {SEVERITY_TITLE[severity]} ({list.length})
            </Heading>
            <ul className="space-y-1.5 text-sm text-slate-800">
              {list.map((issue) => (
                <li key={issue.message}>
                  <ToneText tone={SEVERITY_TONE[severity]}>
                    {issue.message}
                  </ToneText>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export function ReleaseInternalToggle({
  internal,
  projectName,
  checked,
  onCheckedChange,
}: {
  internal: ResolvedAssignment[];
  projectName: (id: string) => string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  // Rendered in both views at once (drawer over the panel), so ids must be unique per instance.
  const id = useId();
  if (internal.length === 0) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          Release internal allocation
        </Label>
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-slate-600">
          {internal
            .map(
              (a) =>
                `${a.allocationPct}% on ${projectName(a.projectId)} until ${formatShort(a.effectiveEnd)}`,
            )
            .join("; ")}
          . The internal project loses those hours.
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby={`${id}-hint`}
      />
    </div>
  );
}

/** "Peak utilization 90% → 140%" plus the over-capacity count. */
export function PeakSummary({ preview }: { preview: StaffingPreview }) {
  const overWeeks = preview.weeks.filter((w) => (w.afterPct ?? 0) > 100).length;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-slate-700 tabular-nums">
        Peak utilization{" "}
        <span className="font-medium">{preview.peakBeforePct}%</span> →{" "}
        <span
          className={cn(
            "font-semibold",
            preview.peakAfterPct > 100 ? "text-rose-700" : "text-slate-900",
          )}
        >
          {preview.peakAfterPct}%
        </span>
      </p>
      {overWeeks > 0 && (
        <Pill tone="bad">
          Over capacity in {overWeeks} of {preview.weeks.length} weeks
        </Pill>
      )}
    </div>
  );
}

export function CommitmentsTable({ preview }: { preview: StaffingPreview }) {
  // Three fixed columns so it fits a narrow column without overflowing; the status sits under the dates.
  return (
    <table className="w-full table-fixed text-sm">
      <colgroup>
        <col />
        <col className="w-20" />
        <col className="w-[44%]" />
      </colgroup>
      <thead className="text-left text-[11px] tracking-wide text-slate-500 uppercase">
        <tr>
          <th scope="col" className="pb-1 font-medium">
            Project
          </th>
          <th scope="col" className="pb-1 text-right font-medium">
            Allocation
          </th>
          <th scope="col" className="pb-1 pl-4 font-medium">
            Dates and status
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 align-top">
        {preview.commitments.map((c) => (
          <tr
            key={c.assignment.id}
            className={cn(c.kind === "released" && "text-slate-400")}
          >
            <td className="py-2 pr-2">
              <span
                className={cn(
                  "font-medium break-words",
                  c.kind === "released" ? "line-through" : "text-slate-900",
                )}
              >
                {c.project?.name ?? c.assignment.projectId}
              </span>
              {c.project && (
                <ProjectStatusBadge
                  project={c.project}
                  size="xs"
                  className="mt-1 flex w-fit"
                />
              )}
            </td>
            <td className="py-2 text-right tabular-nums">
              {c.assignment.allocationPct}%
              <span className="block text-[11px] text-slate-500">
                {formatHours(c.hoursPerWeek)}/wk
              </span>
            </td>
            <td className="py-2 pl-4 text-xs text-slate-600">
              {formatRange(c.assignment.startDate, c.assignment.effectiveEnd)}
              {c.assignment.endAssumed && (
                <span className="block text-amber-700">end date assumed</span>
              )}
              <span className="mt-1 block">
                {c.kind === "new" ? (
                  <Pill tone="info">
                    New{c.status === "Tentative" ? ", tentative" : ""}
                  </Pill>
                ) : c.kind === "released" ? (
                  <Pill tone="caution" className="whitespace-normal">
                    Released from {formatShort(preview.role.startDate)}
                  </Pill>
                ) : c.status === "Tentative" ? (
                  <Pill tone="unknown">Tentative</Pill>
                ) : (
                  <span className="text-slate-600">Confirmed</span>
                )}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Reason factors already explained by a preview issue, so the fit list doesn't say them twice. */
function coveredFactors(issues: PreviewIssue[]): Set<ReasonFactor> {
  const covered = new Set<ReasonFactor>();
  for (const i of issues) {
    if (i.code === "time-off" || i.code === "long-absence")
      covered.add("time-off");
    if (i.code === "skills-not-listed") covered.add("skills");
    if (i.code === "level-below") covered.add("level");
    if (i.code === "contract-ends" || i.code === "starts-late")
      covered.add("timing");
    if (i.code === "overallocated" || i.code === "not-employed")
      covered.add("capacity");
  }
  return covered;
}

/**
 * Why the person is on the list: strengths, plus any concerns the issues above don't already cover.
 * The full list (concerns included) is also on their candidate card.
 */
export function FitList({
  preview,
  evaluation,
  actuals,
}: {
  preview: StaffingPreview;
  evaluation: CandidateEvaluation;
  actuals: ActualsSummary | null;
}) {
  const covered = coveredFactors(preview.issues);
  const strengths = evaluation.reasons.filter((r) => r.tone === "good");
  const other = evaluation.reasons.filter(
    (r) => r.tone !== "good" && !covered.has(r.factor),
  );
  const row = (r: (typeof evaluation.reasons)[number]) => (
    <li key={r.text} className="flex flex-wrap items-center gap-1.5">
      <ToneText tone={r.tone}>{r.text}</ToneText>
      {r.synthetic && <DemoDataTag />}
    </li>
  );
  return (
    <div className="space-y-3 text-sm text-slate-800">
      {strengths.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Strengths
          </p>
          <ul className="space-y-1">{strengths.map(row)}</ul>
        </div>
      )}
      {(other.length > 0 || actuals) && (
        <div>
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Also consider
          </p>
          <ul className="space-y-1">
            {other.map(row)}
            {actuals && (
              <li>
                <ToneText
                  tone={Math.abs(actuals.gapHours) >= 4 ? "caution" : "info"}
                >
                  Logged {formatHours(actuals.avgLoggedHours)}/wk vs{" "}
                  {formatHours(actuals.avgPlannedHours)} planned over the last{" "}
                  {actuals.weeksLogged} weeks
                  {actuals.weeksLogged < actuals.weeksInPeriod &&
                    ` (${actuals.weeksInPeriod - actuals.weeksLogged} week missing)`}
                  . Actuals are context; the plan is unchanged.
                </ToneText>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Shown in the previews when their numbers assume internal work is released. */
export function ReleasedNote({ preview }: { preview: StaffingPreview }) {
  if (preview.released.length === 0) return null;
  const names = [...new Set(preview.released.map((r) => preview.commitments.find((c) => c.assignment.id === r.original.id)?.project?.name ?? r.original.projectId))];
  return (
    <p className="text-xs text-slate-600">
      <ToneText tone="info">
        Assumes {names.join(", ")} is released from {formatShort(preview.role.startDate)}. You can change this when you assign.
      </ToneText>
    </p>
  );
}
