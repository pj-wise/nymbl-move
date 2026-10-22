import { TODAY, daysBetween, formatShort } from '@/domain/dates'
import type { AwayDay } from '@/domain/capacity'
import type { ISODate } from '@/domain/types'

export { formatShort }

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}h`
}

export function formatRange(start: ISODate, end: ISODate): string {
  return `${formatShort(start)} – ${formatShort(end)}`
}

/** "in 14 days", "today", "3 days ago" relative to the demo date. */
export function relativeToToday(iso: ISODate): string {
  const days = daysBetween(TODAY, iso)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 0) return `in ${days} days`
  return `${-days} days ago`
}

export function firstName(name: string): string {
  return name.split(' ')[0] ?? name
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`
}

/**
 * "2 days Training · Thanksgiving, Day after Thanksgiving (holidays)". Groups the reasons a person
 * can't work in a week, keeping requested time off visibly marked.
 */
export function describeAway(away: AwayDay[]): string[] {
  const parts: string[] = []
  const holidays = away.filter((d) => d.reason === 'holiday').map((d) => d.label)
  const timeOff = new Map<string, number>()
  for (const d of away) {
    if (d.reason !== 'time-off' || !d.timeOff) continue
    const key = `${d.label}${d.timeOff.status === 'Requested' ? ' (requested, counted as approved)' : ''}`
    timeOff.set(key, (timeOff.get(key) ?? 0) + 1)
  }
  for (const [label, n] of timeOff) parts.push(`${plural(n, 'day')} ${label}`)
  if (holidays.length) parts.push(`${holidays.join(', ')} (${holidays.length === 1 ? 'holiday' : 'holidays'})`)
  const notStarted = away.filter((d) => d.reason === 'not-started').length
  if (notStarted) parts.push(`${plural(notStarted, 'day')} before start date`)
  const ended = away.filter((d) => d.reason === 'contract-ended').length
  if (ended) parts.push(`${plural(ended, 'day')} after contract end`)
  return parts
}
