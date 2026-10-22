import { ChevronDown, ChevronRight, Users } from 'lucide-react'
import { useState, type RefObject } from 'react'
import { DemoDataTag, Pill, ToneText, type Tone } from '@/components/Tone'
import { enrichment } from '@/data/enrichment'
import { TIER_LABEL, type CandidateEvaluation, type ReasonTone, type Tier } from '@/domain/candidates'
import type { OpenRole, Project } from '@/domain/types'
import { formatRange, plural, relativeToToday } from '@/lib/format'
import { useRovingFocus } from '@/lib/useRovingFocus'
import { cn } from '@/lib/utils'
import type { CommitRecord } from './useStaffingState'
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
  onSelect: (personId: string) => void
}

export function CandidatePanel(props: CandidatePanelProps) {
  const { role, project, candidates, headingRef } = props
  if (!role) {
    return (
      <section aria-labelledby="candidates-empty" className="flex items-center justify-center rounded-xl border border-dashed border-slate-400 bg-white/70 p-10 text-center">
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
    <section aria-labelledby="role-heading" className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <RoleBrief role={role} project={project} headingRef={headingRef} commit={props.commit} candidates={candidates} />
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
}: {
  role: OpenRole
  project: Project | undefined
  headingRef: RefObject<HTMLHeadingElement | null>
  commit: CommitRecord | undefined
  candidates: CandidateEvaluation[]
}) {
  const profile = enrichment.clientProfiles.find((c) => c.client === project?.client)
  const ready = candidates.filter((c) => c.tier === 'ready').length
  const filledBy = commit ? candidates.find((c) => c.person.id === commit.personId)?.person.name : undefined
  return (
    <header className="border-b border-slate-300 bg-white px-5 pt-4 pb-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {role.id} · {project?.name} · {project?.client}
      </p>
      <h2 id="role-heading" ref={headingRef} tabIndex={-1} className="mt-0.5 text-lg font-semibold text-slate-900 outline-none rounded focus-visible:ring-3 focus-visible:ring-ring/50">
        {role.level} {role.roleNeeded}, {role.allocationPct}%
      </h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Needs</dt>
        <dd className="text-slate-900">{role.skillsRequired.join(', ')}</dd>
        <dt className="text-slate-500">Dates</dt>
        <dd className="text-slate-900">
          {formatRange(role.startDate, role.endDate)}{' '}
          <span className="text-slate-500">(starts {relativeToToday(role.startDate)})</span>
        </dd>
        <dt className="text-slate-500">Project</dt>
        <dd className="text-slate-900">
          {project?.status}, {project?.priority} priority
          {project?.winProbabilityPct != null && (
            <>
              {' '}
              · <strong className="font-medium">{project.winProbabilityPct}% win chance</strong>, so any assignment
              stays tentative
            </>
          )}
          {project?.notes && <span className="text-slate-500"> · “{project.notes}”</span>}
        </dd>
        {profile && (
          <>
            <dt className="text-slate-500">Client fit</dt>
            <dd className="flex flex-wrap items-center gap-1.5 text-slate-900">
              {profile.industry} · {profile.styleNote} <DemoDataTag />
            </dd>
          </>
        )}
      </dl>
      <p className="mt-3 text-sm" aria-live="polite">
        {commit ? (
          <ToneText tone="good">
            Filled in this session by <strong>{filledBy}</strong>. A Delivery Manager would see this role as covered.
          </ToneText>
        ) : ready > 0 ? (
          <ToneText tone="good">{plural(ready, 'person is', 'people are')} ready to propose.</ToneText>
        ) : (
          <ToneText tone="caution">Nobody is a clean fit. Every option below needs a tradeoff or a decision.</ToneText>
        )}
      </p>
    </header>
  )
}

function CandidateList({ role, candidates, selectedPersonId, onSelect, includeTentative }: CandidatePanelProps & { role: OpenRole }) {
  const onKeyDown = useRovingFocus()
  const [showUnlikely, setShowUnlikely] = useState(false)
  const tabStopId = selectedPersonId ?? candidates[0]?.person.id
  const unlikely = candidates.filter((c) => c.tier === 'unlikely')
  const strongBooked = unlikely.filter((c) => c.skills.notListed.length === 0 && !c.skills.profileEmpty)
  // Keep the selected person visible even if their group is collapsed.
  const selectedIsUnlikely = unlikely.some((c) => c.person.id === selectedPersonId)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 pt-3 pb-5">
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
          const open = !collapsible || showUnlikely || selectedIsUnlikely
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
                      tabStop={c.person.id === tabStopId}
                      onSelect={onSelect}
                    />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

const MAX_REASONS = 4

function CandidateRow({
  candidate: c,
  selected,
  tabStop,
  onSelect,
}: {
  candidate: CandidateEvaluation
  selected: boolean
  tabStop: boolean
  onSelect: (personId: string) => void
}) {
  // Most decision-relevant reasons first: problems, then unknowns, then positives.
  const order: ReasonTone[] = ['bad', 'caution', 'unknown', 'good']
  const reasons = [...c.reasons].sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone))
  const shown = reasons.slice(0, MAX_REASONS)
  const hidden = reasons.length - shown.length
  const p = c.person
  const freePct = Math.max(0, Math.round(c.avgFreePct))

  return (
    <li>
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
        className={cn(
          'block w-full rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
          selected
            ? 'border-slate-900 bg-indigo-50/60 shadow-md ring-1 ring-slate-900'
            : 'border-slate-300 bg-white shadow-xs hover:border-slate-400',
        )}
      >
        <span className="grid grid-cols-[minmax(0,1.4fr)_auto_auto_minmax(120px,1fr)] items-center gap-x-4">
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
            <span className="mb-1 block text-[11px] text-slate-500">{c.headline}</span>
            <WeekStrip weeks={c.weeks} />
          </span>
        </span>
        <span id={`reasons-${p.id}`} className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700">
          <span className="sr-only">
            Skills {c.skills.matched.length} of {c.skills.required.length}, {freePct}% of capacity free on average before this role.{' '}
            {summarizeWeeks(c.weeks)}.{' '}
          </span>
          {shown.map((r) => (
            <span key={r.text} className="inline-flex items-center gap-1">
              <ToneText tone={REASON_TONE[r.tone]}>{r.text}</ToneText>
              {r.synthetic && <DemoDataTag />}
            </span>
          ))}
          {hidden > 0 && <span className="text-slate-500">+{hidden} more in preview</span>}
        </span>
      </button>
    </li>
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

