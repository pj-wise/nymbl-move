import type { ISODate } from './types'

/**
 * The app's "today". The brief fixes this; never read the system clock for planning maths.
 */
export const TODAY: ISODate = '2026-11-02'

const DAY_MS = 86_400_000

export function toDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function toISO(date: Date): ISODate {
  return date.toISOString().slice(0, 10)
}

export function addDays(iso: ISODate, days: number): ISODate {
  return toISO(new Date(toDate(iso).getTime() + days * DAY_MS))
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS)
}

/** Mon–Fri. Weekends are never working days in this dataset. */
export function isWeekday(iso: ISODate): boolean {
  const day = toDate(iso).getUTCDay()
  return day >= 1 && day <= 5
}

/** Monday of the week containing `iso`. */
export function weekStartOf(iso: ISODate): ISODate {
  const day = toDate(iso).getUTCDay() // 0 = Sun
  const offset = day === 0 ? -6 : 1 - day
  return addDays(iso, offset)
}

export const minDate = (a: ISODate, b: ISODate): ISODate => (a < b ? a : b)
export const maxDate = (a: ISODate, b: ISODate): ISODate => (a > b ? a : b)

/** Inclusive on both ends — an assignment ending Nov 6 still covers Nov 6. */
export function inRange(iso: ISODate, start: ISODate, end: ISODate): boolean {
  return iso >= start && iso <= end
}

export function rangesOverlap(aStart: ISODate, aEnd: ISODate, bStart: ISODate, bEnd: ISODate): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

/** Every weekday in [start, end], inclusive. */
export function weekdaysIn(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (isWeekday(d)) out.push(d)
  }
  return out
}

/** Mondays of every week touched by [start, end]. */
export function weeksIn(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let w = weekStartOf(start); w <= end; w = addDays(w, 7)) out.push(w)
  return out
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Nov 16", or "Jan 29, 2027" when outside the current year. */
export function formatShort(iso: ISODate): string {
  const [y, m, d] = iso.split('-')
  const label = `${MONTHS[Number(m) - 1]} ${Number(d)}`
  return y === TODAY.slice(0, 4) ? label : `${label}, ${y}`
}
