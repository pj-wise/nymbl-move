import { AlertTriangle, Ban, CheckCircle2, CircleHelp, Info, Sparkles, XCircle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared semantic tones. Every tone pairs a colour with an icon and text,
 * so status is never communicated by colour alone.
 */
export type Tone = 'good' | 'caution' | 'bad' | 'unknown' | 'info' | 'blocked'

export const TONE_ICON: Record<Tone, LucideIcon> = {
  good: CheckCircle2,
  caution: AlertTriangle,
  bad: XCircle,
  unknown: CircleHelp,
  info: Info,
  blocked: Ban,
}

export const TONE_TEXT: Record<Tone, string> = {
  good: 'text-emerald-700',
  caution: 'text-amber-700',
  bad: 'text-rose-700',
  unknown: 'text-slate-500',
  info: 'text-sky-700',
  blocked: 'text-rose-700',
}

export const TONE_SURFACE: Record<Tone, string> = {
  good: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  caution: 'bg-amber-50 text-amber-950 ring-amber-200',
  bad: 'bg-rose-50 text-rose-900 ring-rose-200',
  unknown: 'bg-slate-50 text-slate-700 ring-slate-200',
  info: 'bg-sky-50 text-sky-900 ring-sky-200',
  blocked: 'bg-rose-50 text-rose-900 ring-rose-200',
}

/** Screen-reader prefix so the meaning of the icon is announced. */
export const TONE_SR: Record<Tone, string> = {
  good: 'Positive:',
  caution: 'Caution:',
  bad: 'Problem:',
  unknown: 'Unknown:',
  info: 'Note:',
  blocked: 'Blocked:',
}

export function ToneText({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  const Icon = TONE_ICON[tone]
  return (
    <span className={cn('inline-flex items-start gap-1.5', className)}>
      <Icon aria-hidden className={cn('mt-0.5 size-3.5 shrink-0', TONE_TEXT[tone])} />
      <span>
        <span className="sr-only">{TONE_SR[tone]} </span>
        {children}
      </span>
    </span>
  )
}

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  const Icon = TONE_ICON[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONE_SURFACE[tone],
        className,
      )}
    >
      <Icon aria-hidden className="size-3" />
      {children}
    </span>
  )
}

/** Marks anything derived from our synthetic enrichment. */
export function DemoDataTag({ className }: { className?: string }) {
  return (
    <span
      title="Synthetic demo data we added; not in the supplied dataset"
      className={cn(
        'inline-flex items-center gap-0.5 rounded border border-dashed border-violet-300 bg-violet-50 px-1 text-[10px] font-medium tracking-wide text-violet-800 uppercase',
        className,
      )}
    >
      <Sparkles aria-hidden className="size-2.5" />
      demo data
    </span>
  )
}
