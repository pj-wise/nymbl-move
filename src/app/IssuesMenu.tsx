import { ArrowRight, Bell } from 'lucide-react'
import { ToggleGroup } from 'radix-ui'
import { useMemo, useRef, useState } from 'react'
import { ToneText, type Tone } from '@/components/Tone'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  ISSUE_CATEGORY,
  issueTarget,
  type AttentionItem,
  type AttentionKind,
  type IssueCategory,
  type IssueTarget,
} from '@/domain/attention'
import type { StaffingStore } from '@/features/staffing/useStaffingState'
import { plural } from '@/lib/format'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<AttentionKind, string> = {
  overallocated: 'Over 100%',
  'overallocated-if-won': 'Over 100% if won',
  'absent-while-assigned': 'Coverage gap',
  'missing-data': 'Missing data',
  'outside-employment': 'Outside employment dates',
}

const KIND_TONE: Record<AttentionKind, Tone> = {
  overallocated: 'bad',
  'overallocated-if-won': 'caution',
  'absent-while-assigned': 'caution',
  'missing-data': 'caution',
  'outside-employment': 'bad',
}

const CARD_STYLE: Partial<Record<Tone, string>> = {
  bad: 'bg-rose-50 ring-rose-200',
  caution: 'bg-amber-50 ring-amber-200',
}

type Filter = 'all' | IssueCategory

const FILTERS: { id: Filter; label: string; empty: string }[] = [
  { id: 'all', label: 'All', empty: 'Nothing needs attention in the next 12 weeks.' },
  { id: 'conflict', label: 'Staffing conflicts', empty: 'No staffing conflicts.' },
  { id: 'data', label: 'Data issues', empty: 'No data issues.' },
]

/**
 * Staffing issues in the header. Not notifications: the list is derived from the plan on every
 * render, so an issue stays until the problem itself is fixed. Opening the panel changes nothing.
 */
export function IssuesMenu({ store }: { store: StaffingStore }) {
  const { attention, ctx, dataset, commitsByRole, state, dispatch } = store
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  // Set when an issue is chosen, so closing the popover doesn't pull focus back to the bell.
  const navigating = useRef(false)

  const entries = useMemo(() => {
    const filledRoles = new Map([...commitsByRole].map(([roleId, c]) => [roleId, c.personId]))
    return attention.map((item) => ({
      item,
      target: issueTarget(item, { ctx, openRoles: dataset.openRoles, filledRoles, selectedRoleId: state.selectedRoleId }),
    }))
  }, [attention, ctx, dataset, commitsByRole, state.selectedRoleId])

  const count = (f: Filter) => (f === 'all' ? entries.length : entries.filter((e) => ISSUE_CATEGORY[e.item.kind] === f).length)
  const shown = filter === 'all' ? entries : entries.filter((e) => ISSUE_CATEGORY[e.item.kind] === filter)
  const total = entries.length

  function go(item: AttentionItem, target: IssueTarget) {
    const role = dataset.openRoles.find((r) => r.id === target.roleId)
    const name = ctx.people.get(target.personId)?.name ?? target.personId
    navigating.current = true
    setOpen(false)
    dispatch({
      type: 'revealCandidate',
      roleId: target.roleId,
      personId: target.personId,
      message: `Showing ${name} under ${role ? `${role.level} ${role.roleNeeded}` : target.roleId}. ${item.title}.`,
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Staffing issues, ${total === 0 ? 'no issues' : `${total} need${total === 1 ? 's' : ''} attention`}`}
        className="relative inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-slate-50"
      >
        <Bell aria-hidden className="size-5" />
        {total > 0 && (
          <span
            aria-hidden
            className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white tabular-nums ring-2 ring-white"
          >
            {total}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[70vh] w-[400px] flex-col p-0"
        aria-label="Staffing issues"
        onCloseAutoFocus={(event) => {
          if (navigating.current) event.preventDefault()
          navigating.current = false
        }}
      >
        <div className="border-b border-slate-200 px-4 pt-3 pb-3">
          <p className="text-sm font-semibold text-slate-900">Staffing issues</p>
          <p className="text-xs text-slate-500">
            {plural(total, 'issue')} in the next 12 weeks · listed until resolved
          </p>
          <ToggleGroup.Root
            type="single"
            value={filter}
            onValueChange={(v) => v && setFilter(v as Filter)}
            aria-label="Filter issues"
            className="mt-2.5 inline-flex rounded-lg bg-slate-100 p-0.5"
          >
            {FILTERS.map((f) => (
              <ToggleGroup.Item
                key={f.id}
                value={f.id}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 outline-none hover:text-slate-900 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=on]:bg-white data-[state=on]:text-slate-900 data-[state=on]:shadow-xs"
              >
                {f.label} ({count(f.id)})
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>

        {shown.length === 0 ? (
          <p className="px-4 py-6 text-sm">
            <ToneText tone="good">{FILTERS.find((f) => f.id === filter)?.empty}</ToneText>
          </p>
        ) : (
          <ul className="min-h-0 space-y-2 overflow-y-auto p-3">
            {shown.map(({ item, target }) => {
              const tone = KIND_TONE[item.kind]
              const role = target ? dataset.openRoles.find((r) => r.id === target.roleId) : undefined
              const body = (
                <>
                  <span className="block text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
                    {KIND_LABEL[item.kind]}
                  </span>
                  <span className="block text-[13px] leading-snug font-medium text-slate-900">
                    <ToneText tone={tone}>{item.title}</ToneText>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-700">{item.detail}</span>
                  {role ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-slate-900 group-hover:underline">
                      View on {role.level} {role.roleNeeded} ({role.id})
                      <ArrowRight aria-hidden className="size-3.5" />
                    </span>
                  ) : (
                    <span className="mt-1.5 block text-xs text-slate-500">No open role for this person to review.</span>
                  )}
                </>
              )
              const card = cn(
                'block w-full rounded-lg px-3 py-2 text-left ring-1 ring-inset',
                CARD_STYLE[tone],
                // Only-if-won issues are dashed, like tentative work elsewhere; the label says so too.
                item.severity === 'notice' && 'border border-dashed border-amber-400 ring-0',
              )
              return (
                <li key={item.id}>
                  {target ? (
                    <button
                      type="button"
                      onClick={() => go(item, target)}
                      className={cn(card, 'group outline-none hover:brightness-[0.98] focus-visible:ring-3 focus-visible:ring-ring/60')}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className={card}>{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
