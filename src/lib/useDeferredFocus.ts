import { useCallback, useEffect, useRef, type RefObject } from 'react'

/**
 * Ask for focus to move to an element after the next render — used when an action
 * (selecting a role, committing) replaces the content the user was on.
 */
export function useDeferredFocus() {
  const pending = useRef<RefObject<HTMLElement | null> | null>(null)
  useEffect(() => {
    const el = pending.current?.current
    if (el) {
      // preventScroll: focusing a heading must not move the window. Columns scroll internally.
      el.focus({ preventScroll: true })
      pending.current = null
    }
  })
  return useCallback((ref: RefObject<HTMLElement | null>) => {
    pending.current = ref
  }, [])
}
