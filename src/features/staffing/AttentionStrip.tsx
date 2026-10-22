import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { ToneText } from '@/components/Tone'
import type { AttentionItem, AttentionKind } from '@/domain/attention'
import { plural } from '@/lib/format'

const KIND_LABEL: Record<AttentionKind, string> = {
  overallocated: 'Over 100%',
  'overallocated-if-won': 'Over 100% if won',
  'absent-while-assigned': 'Coverage gap',
  'missing-data': 'Missing data',
  'contract-ending': 'Contract ending',
  'requested-pto': 'PTO not yet approved',
  'ignored-record': 'Ignored record',
}

/**
 * Compact "needs attention" bucket above the staffing flow. Over-100% people always appear here as
 * warnings, by name, with the projects causing it. Lower-severity notices sit behind a disclosure.
 */
export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  const [showNotices, setShowNotices] = useState(false)
  const warnings = items.filter((i) => i.severity === 'warning')
  const notices = items.filter((i) => i.severity === 'notice')
  const over = warnings.filter((i) => i.kind === 'overallocated').length

  return (
    <section aria-labelledby="attention-heading" className="border-b border-slate-300 bg-slate-50 px-6 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="attention-heading" className="text-sm font-semibold text-slate-900">
          Needs attention
        </h2>
        <p className="text-xs text-slate-600">
          {plural(warnings.length, 'warning')}, {over > 0 ? `${plural(over, 'person', 'people')} over 100%` : 'nobody over 100%'}
          {' · '}from confirmed work through the next 12 weeks
        </p>
      </div>

      {warnings.length === 0 ? (
        <p className="mt-2 text-sm">
          <ToneText tone="good">Nothing needs attention in the next 12 weeks.</ToneText>
        </p>
      ) : (
        <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
          {warnings.map((item) => (
            <li
              key={item.id}
              className={
                item.kind === 'overallocated'
                  ? 'rounded-lg bg-rose-50 px-2.5 py-2 ring-1 ring-rose-200 ring-inset'
                  : 'rounded-lg bg-amber-50 px-2.5 py-2 ring-1 ring-amber-200 ring-inset'
              }
            >
              <p className="text-[10px] font-semibold tracking-wide text-slate-600 uppercase">{KIND_LABEL[item.kind]}</p>
              <p className="text-[13px] leading-snug font-medium text-slate-900">
                <ToneText tone={item.kind === 'overallocated' ? 'bad' : 'caution'}>{item.title}</ToneText>
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-700" title={item.detail}>
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      )}

      {notices.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            aria-expanded={showNotices}
            aria-controls="attention-notices"
            onClick={() => setShowNotices((v) => !v)}
            className="inline-flex items-center gap-1 rounded text-xs text-slate-600 outline-none hover:text-slate-900 focus-visible:ring-3 focus-visible:ring-ring/60"
          >
            {showNotices ? <ChevronDown aria-hidden className="size-3.5" /> : <ChevronRight aria-hidden className="size-3.5" />}
            {showNotices ? 'Hide' : 'Show'} {plural(notices.length, 'data note')} (PTO, contracts, tentative risk, ignored records)
          </button>
          {showNotices && (
            <ul id="attention-notices" className="mt-1.5 space-y-1 text-xs text-slate-700">
              {notices.map((item) => (
                <li key={item.id}>
                  <ToneText tone="info">
                    <span className="font-medium">{KIND_LABEL[item.kind]}:</span> {item.title}. {item.detail}
                  </ToneText>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
