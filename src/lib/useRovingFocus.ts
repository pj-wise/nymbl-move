import { useCallback, type KeyboardEvent } from 'react'

/**
 * Roving focus for a vertical list: one Tab stop, Arrow/Home/End move between items.
 * Items are marked with `data-roving-item`; the caller decides which one has tabIndex 0.
 */
export function useRovingFocus() {
  return useCallback((event: KeyboardEvent<HTMLElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-roving-item]'))
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLElement)
    let next = index
    if (event.key === 'ArrowDown') next = Math.min(items.length - 1, index + 1)
    if (event.key === 'ArrowUp') next = Math.max(0, index - 1)
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = items.length - 1
    event.preventDefault()
    items.forEach((item, i) => (item.tabIndex = i === next ? 0 : -1))
    items[next]?.focus()
  }, [])
}
