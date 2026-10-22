import { ChevronDown, ChevronRight, Columns2, Users } from 'lucide-react'
import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { PROJECT_STATUS_MEANING, ProjectStatusBadge } from '@/components/ProjectStatusBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetTrigger } from '@/components/ui/sheet'
import { MAX_COMPARE, type ComparedCandidate } from '@/domain/comparison'
import { DemoDataTag, Pill, ToneText, type Tone } from '@/components/Tone'
import { TIER_LABEL, type CandidateEvaluation, type ReasonTone, type Tier } from '@/domain/candidates'
import type { Enrichment, OpenRole, Project } from '@/domain/types'
import { formatRange, plural, relativeToToday } from '@/lib/format'
import { useRovingFocus } from '@/lib/useRovingFocus'
import { cn } from '@/lib/utils'
import type { CommitRecord } from './useStaffingState'
import { CompareDrawer } from './CompareDrawer'
import { WeekStrip, WeekStripLegend, summarizeWeeks } from './WeekStrip'

const REASON_TONE: Record<ReasonTone, Tone> = { good: 'good', caution: 'caution', bad: 'bad', unknown: 'unknown' }
const TIER_TONE: Record<Tier, Tone> = { ready: 'good', tradeoff: 'caution', unlikely: 'unknown' }
const TIERS: Tier[] = ['ready', 'tradeoff', 'unlikely']

interface CandidatePanelProps {
  role: OpenRole | null
  project: Project | undefined
  candidates: CandidateEvaluation[]
  selectedPersonId: string | null
  commit: CommitRecord | undefined
  headingRef: RefObject<HTMLHeadingElement | null>
  includeTentative: boolean
  /** Synthetic client-fit data, or an empty set when demo data is switched off. */
  enrichment: Enrichment
  /** The "Count tentative work" control, shown in the role card. */
  scenarioControl: ReactNode
  /** Up to MAX_COMPARE people picked for comparison, and their evaluation + preview (same as the preview panel's). */
  compareIds: string[]
  comparison: ComparedCandidate[]
  onToggleCompare: (personId: string) => void
  onClearCompare: () => void
  /** Continue from the comparison into the regular preview for this person. */
  onPreviewFromCompare: (personId: string) => void
  /** Set when an issue asks to show a particular candidate. */
  reveal: { personId: string; n: number } | null
  onSelect: (personId: string) => void
}

export function CandidatePanel(props: CandidatePanelProps) {
  const { role, project, candidates, headingRef } = props
  if (!role) {
    return (
      <section aria-labelledby="candidates-empty" className="flex h-[calc(100dvh-var(--app-header-h)-2rem)] items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-400 bg-white/70 p-10 text-center">
        <div className="max-w-sm">
          <Users aria-hidden className="mx-auto mb-3 size-8 text-slate-400" />
          <h2 id="candidates-empty" ref={headingRef} tabIndex={-1} className="text-base font-semibold text-slate-900 outline-none">
            Pick an open role to see who could fill it
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Field Ops Platform starts Nov 16 with four Must fill roles still open. Start there.
          </p>
        </div>
      </section>
    )
  }
  return (
    <section aria-labelledby="role-heading" className="sticky top-4 flex h-[calc(100dvh-var(--app-header-h)-2rem)] flex-col overflow-clip rounded-xl border border-slate-300 bg-white shadow-sm">
      <RoleBrief role={role} project={project} headingRef={headingRef} commit={props.commit} candidates={candidates} scenarioControl={props.scenarioControl} enrichment={props.enrichment} />
      <CandidateList key={role.id} {...props} role={role} />
    </section>
  )
}

function RoleBrief({
  role,
  project,
  headingRef,
  commit,
  candidates,
  scenarioControl,
  enrichment,
}: {
  role: OpenRole
  project: Project | undefined
  headingRef: RefObject<HTMLHeadingElement | null>
  commit: CommitRecord | undefined
  candidates: CandidateEvaluation[]
  scenarioControl: ReactNode
  enrichment: Enrichment
}) {
  const profile = enrichment.clientProfiles.find((c) => c.client === project?.client)
  const ready = candidates.filter((c) => c.tier === 'ready').length
  const filledBy = commit ? candidates.find((c) => c.person.id === commit.personId)?.person.name : undefined
  return (
    <header className="shrink-0 border-b border-slate-300 bg-white px-5 pt-3.5 pb-3">
      {/* Role identity on the left; the scenario toggle sits top right so it doesn't add a row. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {role.id} · {project?.name} · {project?.client}
          </p>
          <h2 id="role-heading" ref={headingRef} tabIndex={-1} className="mt-0.5 text-lg font-semibold text-slate-900 outline-none rounded focus-visible:ring-3 focus-visible:ring-ring/50">
            {role.level} {role.roleNeeded}, {role.allocationPct}%
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" aria-live="polite">
            {project && <ProjectStatusBadge project={project} />}
            {commit ? (
              <ToneText tone="good">
                Filled by <strong>{filledBy}</strong> in this session
              </ToneText>
            ) : ready > 0 ? (
              <ToneText tone="good">{plural(ready, 'person is', 'people are')} ready to propose</ToneText>
            ) : (
              <ToneText tone="caution">Nobody is a clean fit</ToneText>
            )}
          </div>
        </div>
        <div className="shrink-0">{scenarioControl}</div>
      </div>
      <dl className="mt-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px] leading-snug">
        <dt className="text-slate-500">Needs</dt>
        <dd className="text-slate-900">{role.skillsRequired.join(', ')}</dd>
        <dt className="text-slate-500">Dates</dt>
        <dd className="text-slate-900">
          <span className="whitespace-nowrap">{formatRange(role.startDate, role.endDate)}</span>{' '}
          <span className="whitespace-nowrap text-slate-500">· {relativeToToday(role.startDate)}</span>
        </dd>
        <dt className="text-slate-500">Project</dt>
        <dd className="text-slate-900">
          {project?.priority} priority · {project && PROJECT_STATUS_MEANING[project.status]}
        </dd>
        {project?.notes && (
          <>
            <dt className="text-slate-500">Notes</dt>
            <dd className="text-slate-900">{project.notes}</dd>
          </>
        )}
        {profile && (
          <>
            {/* Longer text: always its own full-width row. */}
            <dt className="col-start-1 text-slate-500">Client fit</dt>
            <dd className="col-span-3 flex flex-wrap items-center gap-1.5 text-slate-900">
              {profile.industry} · {profile.styleNote} <DemoDataTag />
            </dd>
          </>
        )}
      </dl>
    </header>
  )
}

function CandidateList({
  role,
  candidates,
  selectedPersonId,
  reveal,
  onSelect,
  includeTentative,
  commit,
  compareIds,
  comparison,
  onToggleCompare,
  onClearCompare,
  onPreviewFromCompare,
}: CandidatePanelProps & { role: OpenRole }) {
  const [compareOpen, setCompareOpen] = useState(false)
  // Comparing only makes sense while the role is still open.
  const canCompare = !commit
  const compareFull = compareIds.length >= MAX_COMPARE
  const onKeyDown = useRovingFocus()
  const [showUnlikely, setShowUnlikely] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const tabStopId = selectedPersonId ?? candidates[0]?.person.id
  // The card that currently holds focus; only its expand button is a Tab stop.
  const [activeId, setActiveId] = useState(tabStopId)
  const revealedId = reveal?.personId ?? null
  const unlikely = candidates.filter((c) => c.tier === 'unlikely')
  const strongBooked = unlikely.filter((c) => c.skills.notListed.length === 0 && !c.skills.profileEmpty)
  // Keep the selected or revealed person visible even if their group is collapsed.
  const pinnedUnlikely = unlikely.some((c) => c.person.id === selectedPersonId || c.person.id === revealedId)

  // Revealed from the issues menu: expand the card (state adjusted during render, once per reveal)…
  const [handledReveal, setHandledReveal] = useState(0)
  if (reveal && reveal.n !== handledReveal) {
    setHandledReveal(reveal.n)
    setExpanded((prev) => new Set(prev).add(reveal.personId))
    setActiveId(reveal.personId)
  }
  // …then bring it into view and focus it once it's rendered.
  useEffect(() => {
    if (!reveal) return
    requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-person-id="${reveal.personId}"]`)
      card?.scrollIntoView({ block: 'center' })
      card?.focus({ preventScroll: true })
    })
  }, [reveal])

  function toggle(personId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 pt-3 pb-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {plural(candidates.length, role.roleNeeded)}{' '}
          <span className="font-normal text-slate-500">
            · counting {includeTentative ? 'confirmed + tentative' : 'confirmed'} work
          </span>
        </h3>
        <WeekStripLegend />
      </div>
      <div onKeyDown={onKeyDown} className="space-y-4">
        {TIERS.map((tier) => {
          const group = candidates.filter((c) => c.tier === tier)
          if (group.length === 0) return null
          const collapsible = tier === 'unlikely'
          const open = !collapsible || showUnlikely || pinnedUnlikely
          return (
            <section key={tier} aria-labelledby={`tier-${tier}`} className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
              <div className="mb-2 flex items-center gap-2">
                <h4 id={`tier-${tier}`} className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  <Pill tone={TIER_TONE[tier]}>
                    {TIER_LABEL[tier]} ({group.length})
                  </Pill>
                </h4>
                {collapsible && (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls="tier-unlikely-list"
                    onClick={() => setShowUnlikely((v) => !v)}
                    className="inline-flex items-center gap-1 rounded text-xs text-slate-600 underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60"
                  >
                    {open ? <ChevronDown aria-hidden className="size-3.5" /> : <ChevronRight aria-hidden className="size-3.5" />}
                    {open ? 'Hide' : 'Show'}
                    {!open && strongBooked.length > 0 && (
                      <span>
                        , incl. strong skill match {strongBooked.map((c) => c.person.name).join(', ')}
                      </span>
                    )}
                  </button>
                )}
              </div>
              {open && (
                <ul id={collapsible ? 'tier-unlikely-list' : undefined} className="space-y-1.5">
                  {group.map((c) => (
                    <CandidateRow
                      key={c.person.id}
                      candidate={c}
                      selected={c.person.id === selectedPersonId}
                      revealed={c.person.id === revealedId}
                      tabStop={c.person.id === tabStopId}
                      active={c.person.id === activeId}
                      expanded={expanded.has(c.person.id)}
                      onSelect={onSelect}
                      onToggle={toggle}
                      onFocusCard={setActiveId}
                      compare={
                        canCompare
                          ? {
                              checked: compareIds.includes(c.person.id),
                              disabled: compareFull && !compareIds.includes(c.person.id),
                              onToggle: () => onToggleCompare(c.person.id),
                            }
                          : null
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {canCompare && compareIds.length > 0 && (
        <Sheet open={compareOpen} onOpenChange={setCompareOpen}>
          {/* Sticks to the bottom of the view while scrolling the list. */}
          <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-md">
            <p className="min-w-0 text-sm text-slate-700" aria-live="polite">
              <span className="font-medium text-slate-900">
                {compareIds.map((id) => candidates.find((c) => c.person.id === id)?.person.name ?? id).join(' · ')}
              </span>
              <span className="text-slate-500">
                {compareIds.length === 1
                  ? ' · pick at least one more to compare'
                  : compareIds.length < MAX_COMPARE
                    ? ` · up to ${MAX_COMPARE}`
                    : ''}
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClearCompare}>
                Clear
              </Button>
              {compareIds.length >= 2 && (
                <SheetTrigger asChild>
                  <Button size="sm">
                    <Columns2 aria-hidden /> Compare {compareIds.length}
                  </Button>
                </SheetTrigger>
              )}
            </div>
          </div>
          {comparison.length >= 2 && (
            <CompareDrawer
              role={role}
              candidates={comparison}
              onPreview={(personId) => {
                setCompareOpen(false)
                onPreviewFromCompare(personId)
              }}
              onRemove={(personId) => {
                // Below two there's nothing to compare: close and hand focus to the person still selected.
                if (comparison.length <= 2) {
                  setCompareOpen(false)
                  const remaining = compareIds.find((id) => id !== personId)
                  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-person-id="${remaining}"]`)?.focus())
                }
                onToggleCompare(personId)
              }}
            />
          )}
        </Sheet>
      )}
    </div>
  )
}

// Most decision-relevant reasons first: problems, then unknowns, then positives.
const REASON_ORDER: ReasonTone[] = ['bad', 'caution', 'unknown', 'good']

function CandidateRow({
  candidate: c,
  selected,
  revealed,
  tabStop,
  active,
  expanded,
  onSelect,
  onToggle,
  onFocusCard,
  compare,
}: {
  candidate: CandidateEvaluation
  selected: boolean
  revealed: boolean
  tabStop: boolean
  active: boolean
  expanded: boolean
  onSelect: (personId: string) => void
  onToggle: (personId: string) => void
  onFocusCard: (personId: string) => void
  /** Null hides the compare control (e.g. the role is already filled). */
  compare: { checked: boolean; disabled: boolean; onToggle: () => void } | null
}) {
  const reasons = [...c.reasons].sort((a, b) => REASON_ORDER.indexOf(a.tone) - REASON_ORDER.indexOf(b.tone))
  const concerns = reasons.filter((r) => r.tone !== 'good')
  const strengths = reasons.filter((r) => r.tone === 'good')
  const top = reasons[0]
  const p = c.person
  const freePct = Math.max(0, Math.round(c.avgFreePct))
  const detailsId = `details-${p.id}`

  return (
    <li
      onFocus={() => onFocusCard(p.id)}
      className={cn(
        'rounded-lg border transition-colors',
        selected
          ? 'border-slate-900 bg-indigo-50/60 shadow-md ring-1 ring-slate-900'
          : 'border-slate-300 bg-white shadow-xs hover:border-slate-400',
        revealed && !selected && 'ring-2 ring-sky-500',
      )}
    >
      <div className="flex">
        {/* Phrasing content only inside the button; the name is short and the details are its description. */}
        <button
          type="button"
          data-roving-item
          data-person-id={p.id}
          tabIndex={tabStop ? 0 : -1}
          aria-pressed={selected}
          aria-label={`${p.name}, ${p.level}. ${c.headline}.`}
          aria-describedby={`reasons-${p.id}`}
          onClick={() => onSelect(p.id)}
          className="block min-w-0 flex-1 rounded-l-lg px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <span className="grid grid-cols-[minmax(0,1.3fr)_auto_auto_minmax(150px,1fr)] items-center gap-x-4">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-900">{p.name}</span>
              <span className="block truncate text-xs text-slate-500">
                {p.level} · {p.weeklyCapacityHours}h/wk
                {p.employmentType !== 'Full-time' && ` · ${p.employmentType}`}
              </span>
            </span>
            <Stat label="Skills" value={`${c.skills.matched.length}/${c.skills.required.length}`} muted={c.skills.profileEmpty} />
            <Stat label="Free now" value={`${freePct}%`} title="Average share of working capacity not yet committed during the role, before this assignment" />
            <span className="block">
              <span className="mb-1 block truncate text-[11px] text-slate-500">{c.headline}</span>
              <WeekStrip weeks={c.weeks} />
            </span>
          </span>
          {top && (
            <span aria-hidden className="mt-1.5 flex items-center gap-2 text-xs text-slate-700">
              <span className="inline-flex min-w-0 items-center gap-1">
                <ToneText tone={REASON_TONE[top.tone]} className="min-w-0">
                  {top.text}
                </ToneText>
                {top.synthetic && <DemoDataTag />}
              </span>
              {reasons.length > 1 && <span className="shrink-0 text-slate-500">+{reasons.length - 1} more</span>}
            </span>
          )}
          <span id={`reasons-${p.id}`} className="sr-only">
            Skills {c.skills.matched.length} of {c.skills.required.length}, {freePct}% of capacity free on average before this role.{' '}
            {summarizeWeeks(c.weeks)}. {reasons.map((r) => r.text).join('. ')}.
          </span>
        </button>
        {compare && (
          <label
            title={compare.disabled ? `Compare up to ${MAX_COMPARE}. Deselect one first.` : undefined}
            className={cn(
              'flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 border-l border-slate-200 px-2.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase hover:bg-slate-50',
              compare.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
            )}
          >
            <Checkbox
              checked={compare.checked}
              disabled={compare.disabled}
              onCheckedChange={compare.onToggle}
              tabIndex={active ? 0 : -1}
              aria-label={`Compare ${p.name}`}
              aria-describedby={compare.disabled ? `compare-full-${p.id}` : undefined}
            />
            Compare
            {compare.disabled && (
              <span id={`compare-full-${p.id}`} className="sr-only">
                {`Compare up to ${MAX_COMPARE}. Deselect one first.`}
              </span>
            )}
          </label>
        )}
        <button
          type="button"
          tabIndex={active ? 0 : -1}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? 'Hide' : 'Show'} details for ${p.name}`}
          onClick={() => onToggle(p.id)}
          className="flex w-9 shrink-0 items-center justify-center rounded-r-lg border-l border-slate-200 text-slate-500 outline-none hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          {expanded ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
        </button>
      </div>
      {expanded && (
        <div id={detailsId} className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-slate-200 px-3 py-2 text-xs text-slate-700">
          <ReasonList title="Concerns" reasons={concerns} empty="None found" />
          <ReasonList title="Strengths" reasons={strengths} empty="None listed" />
        </div>
      )}
    </li>
  )
}

function ReasonList({ title, reasons, empty }: { title: string; reasons: CandidateEvaluation['reasons']; empty: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
      {reasons.length === 0 ? (
        <p className="text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-0.5">
          {reasons.map((r) => (
            <li key={r.text} className="flex flex-wrap items-center gap-1">
              <ToneText tone={REASON_TONE[r.tone]}>{r.text}</ToneText>
              {r.synthetic && <DemoDataTag />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value, muted, title }: { label: string; value: string; muted?: boolean; title?: string }) {
  return (
    <span aria-hidden title={title} className="block text-right">
      <span className="block text-[10px] tracking-wide text-slate-500 uppercase">{label}</span>
      <span className={cn('block text-sm font-semibold tabular-nums', muted ? 'text-slate-400' : 'text-slate-900')}>
        {muted ? '?' : value}
      </span>
    </span>
  )
}

