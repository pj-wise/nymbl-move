import { CalendarOff, ChevronDown, ChevronRight, Palmtree } from "lucide-react";
import { Pill, ToneText, type Tone } from "@/components/Tone";
import type { AwayDay } from "@/domain/capacity";
import type {
  ContributionKind,
  PreviewWeek,
  WeekContribution,
} from "@/domain/preview";
import type { Person } from "@/domain/types";
import type { WeekGroup, WeekStatus, WeekSummary } from "@/domain/weekGroups";
import { describeAway, formatHours, formatShort, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<ContributionKind, string> = {
  existing: "Committed",
  new: "Proposed",
  released: "Released by this move",
  tentative: "Tentative, only if won",
};
const KIND_TONE: Record<ContributionKind, Tone> = {
  existing: "unknown",
  new: "info",
  released: "caution",
  tentative: "caution",
};

/**
 * Green = within capacity, amber = availability changed or worth a look (incl. away with work planned),
 * red = over capacity. Every status also has a text label and a stripe, never colour alone.
 */
const STATUS: Record<
  WeekStatus,
  { tone: Tone; stripe: string; committed: string; added: string; text: string }
> = {
  over: {
    tone: "bad",
    stripe: "before:bg-rose-500",
    committed: "bg-rose-600",
    added: "bg-rose-400",
    text: "text-rose-700",
  },
  conflict: {
    tone: "caution",
    stripe: "before:bg-amber-500",
    committed: "",
    added: "",
    text: "text-amber-800",
  },
  away: {
    tone: "unknown",
    stripe: "before:bg-slate-300",
    committed: "",
    added: "",
    text: "text-slate-600",
  },
  reduced: {
    tone: "caution",
    stripe: "before:bg-amber-400",
    committed: "bg-amber-500",
    added: "bg-amber-300",
    text: "text-amber-800",
  },
  "at-risk": {
    tone: "caution",
    stripe: "before:bg-amber-400",
    committed: "bg-amber-500",
    added: "bg-amber-300",
    text: "text-amber-800",
  },
  full: {
    tone: "good",
    stripe: "before:bg-emerald-500",
    committed: "bg-emerald-600",
    added: "bg-emerald-400",
    text: "text-slate-900",
  },
  room: {
    tone: "good",
    stripe: "before:bg-emerald-500",
    committed: "bg-emerald-600",
    added: "bg-emerald-400",
    text: "text-slate-900",
  },
};

function statusLabel(status: WeekStatus, w: PreviewWeek): string {
  switch (status) {
    case "over":
      return `${formatHours(w.overHours)} over capacity`;
    case "conflict":
      return `Conflict: ${formatHours(w.plannedOnDaysOffHours)} planned while away`;
    case "away":
      return "Away, nothing planned";
    case "reduced":
      return "Reduced capacity";
    case "at-risk":
      return "Over capacity if proposed project is won";
    case "full":
      return "Fully booked";
    case "room":
      return "Has free hours";
  }
}

const isAwayStatus = (s: WeekStatus) => s === "away" || s === "conflict";

/** Finds the period button that contains a given week (used when a chart bar is clicked). */
export function findWeekButton(weekStart: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-weeks~="${weekStart}"]`);
}

interface WeekBreakdownProps {
  groups: WeekGroup[];
  summary: WeekSummary;
  person: Person;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Any week inside the expanded period, or null. */
  selectedWeek: string | null;
  onSelectWeek: (weekStart: string | null) => void;
  showTentative: boolean;
  /** Render without the show/hide toggle (used in the full-breakdown drawer). */
  alwaysOpen?: boolean;
}

/**
 * Weeks grouped into periods that are identical in every respect (see domain/weekGroups.ts), each with
 * a capacity bar coloured by status. Holiday and time-off weeks always stand alone and carry chips.
 * Any period expands to show the exact hours, projects and days off.
 */
export function WeekBreakdown({
  groups,
  summary,
  person,
  open,
  onOpenChange,
  selectedWeek,
  onSelectWeek,
  showTentative,
  alwaysOpen = false,
}: WeekBreakdownProps) {
  const isOpen = alwaysOpen || open;
  const totalWeeks = groups.reduce((n, g) => n + g.weeks.length, 0);
  const scaleMax = Math.max(
    100,
    ...groups.flatMap((g) =>
      g.weeks.map((w) =>
        showTentative ? (w.afterWithTentativePct ?? 0) : (w.afterPct ?? 0),
      ),
    ),
  );

  return (
    <div className={cn(!alwaysOpen && "rounded-lg border border-slate-300")}>
      {alwaysOpen ? (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Week by week</h3>
          <span className="text-xs text-slate-600">
            {plural(totalWeeks, "week")} in {plural(groups.length, "period")}
          </span>
        </div>
      ) : (
      <button
        type="button"
        aria-expanded={open}
        aria-controls="week-breakdown"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left outline-none hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900">
          {open ? (
            <ChevronDown aria-hidden className="size-4" />
          ) : (
            <ChevronRight aria-hidden className="size-4" />
          )}
          {open ? "Hide" : "Show"} week by week
        </span>
        <span className="sr-only">, </span>
        <span className="text-xs text-slate-600">
          {plural(totalWeeks, "week")} in {plural(groups.length, "period")}
        </span>
      </button>
      )}

      {isOpen && (
        <div
          id="week-breakdown"
          className={cn("space-y-3", !alwaysOpen && "border-t border-slate-300 p-3")}
        >
          <SummaryChips summary={summary} />
          <TermsLegend />

          <ol
            className="space-y-2"
            aria-label={`${person.name}, week by week during this role`}
          >
            {groups.map((g) => (
              <PeriodRow
                key={g.key}
                group={g}
                person={person}
                scaleMax={scaleMax}
                showTentative={showTentative}
                expanded={
                  selectedWeek !== null &&
                  g.weeks.some((w) => w.weekStart === selectedWeek)
                }
                onToggle={(expand) => onSelectWeek(expand ? g.key : null)}
              />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** One line defining the terms, so "capacity" is never read as "free time". */
function TermsLegend() {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-md bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600 ring-1 ring-slate-200 ring-inset">
      <dt className="font-semibold text-slate-800">Capacity</dt>
      <dd>hours they can work that week, after holidays and time off</dd>
      <dt className="font-semibold text-slate-800">Committed</dt>
      <dd>hours already assigned to existing projects</dd>
      <dt className="font-semibold text-slate-800">Proposed</dt>
      <dd>hours this role would add</dd>
      <dt className="font-semibold text-slate-800">Free</dt>
      <dd>
        capacity left after committed + proposed (never below 0; the excess is
        shown as “over capacity”)
      </dd>
      <dt className="font-semibold text-slate-800">Utilization</dt>
      <dd>(committed + proposed) ÷ capacity</dd>
    </dl>
  );
}

function SummaryChips({ summary }: { summary: WeekSummary }) {
  const items: { tone: Tone; label: string; n: number }[] = [
    { tone: "bad", label: "over capacity", n: summary.over },
    { tone: "caution", label: "away with work planned", n: summary.conflict },
    { tone: "caution", label: "reduced capacity", n: summary.reduced },
    {
      tone: "caution",
      label: "over if proposed project is won",
      n: summary.atRisk,
    },
    { tone: "unknown", label: "away, nothing planned", n: summary.away },
    { tone: "good", label: "fully booked", n: summary.full },
    { tone: "good", label: "with free hours", n: summary.room },
  ];
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Summary">
      {items
        .filter((i) => i.n > 0)
        .map((i) => (
          <li key={i.label}>
            <Pill tone={i.tone}>
              <span className="font-semibold tabular-nums">{i.n}</span>{" "}
              {i.n === 1 ? "week" : "weeks"} {i.label}
            </Pill>
          </li>
        ))}
    </ul>
  );
}

function PeriodRow({
  group: g,
  person,
  scaleMax,
  showTentative,
  expanded,
  onToggle,
}: {
  group: WeekGroup;
  person: Person;
  scaleMax: number;
  showTentative: boolean;
  expanded: boolean;
  onToggle: (expand: boolean) => void;
}) {
  const w = g.weeks[0] as PreviewWeek;
  const style = STATUS[g.status];
  const n = g.weeks.length;
  const range =
    g.start === g.end
      ? formatShort(g.start)
      : `${formatShort(g.start)} – ${formatShort(g.end)}`;
  const away = g.weeks.flatMap((x) => x.away);
  const detailId = `period-${g.key}-detail`;
  const each = n > 1 ? " each week" : "";
  const spoken = [
    `${range}, ${plural(n, "week")}`,
    isAwayStatus(g.status) ? "Away" : `${w.afterPct}% utilization`,
    statusLabel(g.status, w),
    isAwayStatus(g.status)
      ? ""
      : `Capacity ${formatHours(w.capacityHours)}, committed ${formatHours(w.committedHours)}, proposed ${formatHours(w.newHours)}, free ${formatHours(w.freeHours)}${each}`,
    away.length > 0 ? describeAway(away).join(", ") : "",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-md border bg-white before:absolute before:inset-y-0 before:left-0 before:w-1",
        style.stripe,
        expanded
          ? "border-slate-900 ring-1 ring-slate-900"
          : "border-slate-200",
      )}
    >
      <button
        type="button"
        id={`period-${g.key}`}
        data-weeks={g.weeks.map((x) => x.weekStart).join(" ")}
        aria-label={spoken}
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => onToggle(!expanded)}
        className="block w-full py-2 pr-3 pl-4 text-left outline-none hover:bg-slate-50 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-inset"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-sm">
            {expanded ? (
              <ChevronDown aria-hidden className="size-3.5 shrink-0 text-slate-500" />
            ) : (
              <ChevronRight aria-hidden className="size-3.5 shrink-0 text-slate-500" />
            )}
            <span className="font-medium whitespace-nowrap text-slate-900">{range}</span>
            <span className="text-xs whitespace-nowrap text-slate-500">· {plural(n, "week")}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-3">
            <ToneText tone={style.tone} className="text-xs font-medium whitespace-nowrap">
              {statusLabel(g.status, w)}
            </ToneText>
            <span className={cn("w-12 text-right text-sm font-semibold tabular-nums", style.text)}>
              {isAwayStatus(g.status) ? "Away" : `${w.afterPct}%`}
            </span>
          </span>
        </span>

        <CapacityBar
          week={w}
          status={g.status}
          scaleMax={scaleMax}
          showTentative={showTentative}
        />

        {isAwayStatus(g.status) ? (
          <span className="mt-2 block text-xs text-slate-600">No working capacity{each}</span>
        ) : (
          <HoursGrid week={w} each={n > 1} />
        )}

        {away.length > 0 && <AwayChips away={away} />}
      </button>

      {expanded && (
        <div
          id={detailId}
          className="border-t border-slate-200 bg-slate-50 px-4 py-3"
        >
          <PeriodDetail group={g} person={person} />
        </div>
      )}
    </li>
  );
}

/** Capacity · Committed · Proposed · Free as four aligned columns; free is clamped at 0. */
function HoursGrid({ week: w, each }: { week: PreviewWeek; each: boolean }) {
  const cell = (label: string, value: string, className?: string) => (
    <span className="block">
      <span className="block text-[10px] tracking-wide text-slate-500 uppercase">{label}</span>
      <span className={cn("block text-sm font-medium text-slate-900", className)}>{value}</span>
    </span>
  );
  return (
    <span className="mt-2 grid grid-cols-4 gap-2 tabular-nums">
      {cell("Capacity", formatHours(w.capacityHours))}
      {cell("Committed", formatHours(w.committedHours))}
      {cell("Proposed", `+${formatHours(w.newHours)}`, "text-indigo-700")}
      {cell(
        "Free" + (each ? " / wk" : ""),
        formatHours(w.freeHours),
        w.freeHours === 0 ? "text-slate-500" : "text-emerald-700",
      )}
    </span>
  );
}

/** Horizontal bar: committed + proposed (+ tentative if shown), with the 100% mark and overflow. */
function CapacityBar({
  week: w,
  status,
  scaleMax,
  showTentative,
}: {
  week: PreviewWeek;
  status: WeekStatus;
  scaleMax: number;
  showTentative: boolean;
}) {
  const style = STATUS[status];
  const at = (pct: number) => `${(Math.min(pct, scaleMax) / scaleMax) * 100}%`;
  const pctOf = (h: number) =>
    w.capacityHours > 0 ? (h / w.capacityHours) * 100 : 0;
  const committed = pctOf(w.committedHours);
  const total = committed + pctOf(w.newHours);
  const tentative = showTentative ? pctOf(w.tentativeHours) : 0;

  return (
    <span
      aria-hidden
      className="relative mt-1.5 block h-2.5 overflow-hidden rounded-full bg-slate-100"
    >
      {isAwayStatus(status) ? (
        <span
          className={cn(
            "absolute inset-0",
            status === "conflict"
              ? "bg-[repeating-linear-gradient(135deg,var(--color-amber-400)_0_3px,transparent_3px_6px)]"
              : "bg-[repeating-linear-gradient(135deg,var(--color-slate-300)_0_3px,transparent_3px_6px)]",
          )}
        />
      ) : (
        <>
          <span
            className={cn("absolute inset-y-0 left-0", style.committed)}
            style={{ width: at(committed) }}
          />
          <span
            className={cn("absolute inset-y-0", style.added)}
            style={{
              left: at(committed),
              width: `calc(${at(total)} - ${at(committed)})`,
            }}
          />
          {tentative > 0 && (
            <span
              className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,var(--color-amber-500)_0_2px,transparent_2px_4px)]"
              style={{
                left: at(total),
                width: `calc(${at(total + tentative)} - ${at(total)})`,
              }}
            />
          )}
        </>
      )}
      {/* 100% of working capacity */}
      <span
        className="absolute inset-y-0 w-0.5 bg-slate-900"
        style={{ left: `calc(${at(100)} - 1px)` }}
      />
    </span>
  );
}

/** Holidays and time off stand out: they're what actually changes someone's capacity. */
function AwayChips({ away }: { away: AwayDay[] }) {
  const holidays = away.filter((d) => d.reason === "holiday");
  const other = away.filter((d) => d.reason !== "holiday");
  const chip =
    "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-300 ring-inset";
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {other.length > 0 && (
        <span className={chip}>
          <Palmtree aria-hidden className="size-3" />
          {describeAway(other).join(" · ")}
        </span>
      )}
      {holidays.length > 0 && (
        <span className={chip}>
          <CalendarOff aria-hidden className="size-3" />
          {describeAway(holidays).join(" · ")}
        </span>
      )}
    </span>
  );
}

function ContributionRow({ c, daily }: { c: WeekContribution; daily: number }) {
  const released = c.kind === "released";
  return (
    <tr className={cn(released && "text-slate-500")}>
      <th scope="row" className="pl-2 text-left font-normal">
        <span className={cn(released ? "line-through" : "text-slate-900")}>{c.projectName}</span>
        {c.internal && <span className="text-slate-500"> (internal)</span>}
      </th>
      {/* Show the proration so 100% in a short week visibly means fewer hours. */}
      <td className="text-slate-500">
        {c.allocationPct}% × {plural(c.days, "day")} × {formatHours(daily)}
      </td>
      <td className="text-right">
        <Pill tone={KIND_TONE[c.kind]}>{KIND_LABEL[c.kind]}</Pill>
      </td>
      <td className={cn("text-right", !released && "font-medium text-slate-900")}>
        {released ? "−" : ""}
        {formatHours(c.hours)}
      </td>
    </tr>
  );
}

function PeriodDetail({
  group: g,
  person,
}: {
  group: WeekGroup;
  person: Person;
}) {
  const w = g.weeks[0] as PreviewWeek;
  const n = g.weeks.length;
  const daily = person.weeklyCapacityHours / 5;
  const counted = w.contributions.filter((c) => c.kind !== "released");
  const released = w.contributions.filter((c) => c.kind === "released");
  const weekList = g.weeks.map((x) => formatShort(x.weekStart)).join(", ");
  const awayText = describeAway(g.weeks.flatMap((x) => x.away)).join(" · ");

  if (isAwayStatus(g.status)) {
    return (
      <div className="space-y-1.5 text-xs text-slate-700">
        <p>
          <span className="font-semibold text-slate-900">
            Away: no working capacity
          </span>{" "}
          in {n === 1 ? "this week" : `these ${n} weeks`} (weeks of {weekList}).
          Utilization isn’t shown because there are no working hours to measure
          against.
        </p>
        <p>{awayText}</p>
        {g.status === "conflict" ? (
          <p className="font-medium text-amber-800">
            <ToneText tone="caution">
              Conflict: the plan still has{" "}
              {formatHours(w.plannedOnDaysOffHours)} of committed and proposed
              work on these days off{n > 1 ? ", each week" : ""}. Someone needs
              to cover it, or the project plan should expect the gap.
            </ToneText>
          </p>
        ) : (
          <p>No work is planned on these days.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      {n > 1 && (
        <p className="text-slate-600">
          {n} identical weeks ({weekList}).{" "}
          <span className="font-medium text-slate-900">Each week:</span>
        </p>
      )}
      <table className="w-full text-xs tabular-nums">
        <tbody className="[&_td]:py-1 [&_th]:py-1">
          <tr>
            <th scope="row" className="text-left font-semibold text-slate-900">
              Capacity
            </th>
            <td className="text-slate-500">
              {plural(w.availableDays, "working day")} × {formatHours(daily)}
              {w.away.length > 0 && <> ({describeAway(w.away).join("; ")})</>}
            </td>
            <td className="w-24" />
            <td className="w-14 text-right font-semibold text-slate-900">{formatHours(w.capacityHours)}</td>
          </tr>
          {[...counted, ...released].map((c) => (
            <ContributionRow key={`${c.assignmentId}-${c.kind}`} c={c} daily={daily} />
          ))}
          {counted.length === 0 && released.length === 0 && (
            <tr>
              <td colSpan={4} className="text-slate-500">
                No project hours fall on working days.
              </td>
            </tr>
          )}
          <tr className="border-t border-slate-300">
            <th scope="row" className="text-left font-medium text-slate-700">
              Committed + proposed
            </th>
            <td className="text-slate-500">
              {formatHours(w.committedHours)} + {formatHours(w.newHours)}
            </td>
            <td />
            <td className="text-right font-medium text-slate-900">{formatHours(w.totalHours)}</td>
          </tr>
          <tr>
            <th scope="row" className="text-left font-medium text-slate-700">
              Free
            </th>
            <td />
            <td />
            <td className="text-right font-medium text-slate-900">{formatHours(w.freeHours)}</td>
          </tr>
          {w.overHours > 0 && (
            <tr>
              <th scope="row" className="text-left font-medium text-rose-700">
                Over capacity
              </th>
              <td />
              <td />
              <td className="text-right font-semibold text-rose-700">{formatHours(w.overHours)}</td>
            </tr>
          )}
          <tr>
            <th scope="row" className="text-left font-medium text-slate-700">
              Utilization
            </th>
            <td className="text-slate-500">
              {formatHours(w.totalHours)} ÷ {formatHours(w.capacityHours)}
            </td>
            <td />
            <td className={cn("text-right font-semibold", w.overHours > 0 ? "text-rose-700" : "text-slate-900")}>
              {w.afterPct}%
            </td>
          </tr>
        </tbody>
      </table>

      {w.plannedOnDaysOffHours > 0 && (
        <p className="text-slate-600">
          Days off this week: {formatHours(w.plannedOnDaysOffHours)} of planned
          work falls on those days and isn’t counted above.
        </p>
      )}
      {w.tentativeHours > 0 && (
        <p className="text-amber-700">
          Plus {formatHours(w.tentativeHours)} tentative if won (
          {w.afterWithTentativePct}% utilization). Not counted above.
        </p>
      )}
    </div>
  );
}
