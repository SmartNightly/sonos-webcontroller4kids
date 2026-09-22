import { useEffect, useEffectEvent, useRef } from 'react'
import type { ReactNode } from 'react'
import './admin.css'

/** Modal focus stays inside the dialog; closing returns to the invoking control. */
export function Dialog({
  title,
  onClose,
  busy = false,
  children,
}: {
  title: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useEffectEvent(() => {
    if (!busy) onClose()
  })
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    const target = dialog.querySelector<HTMLElement>(
      ':is(input, select, textarea, button):not(:disabled)',
    )
    ;(target ?? dialog).focus()
    const siblings: { element: HTMLElement; inert: boolean }[] = []
    let ancestor: HTMLElement | null = dialog.parentElement
    while (ancestor && ancestor !== document.body) {
      for (const sibling of ancestor.parentElement?.children ?? []) {
        if (sibling !== ancestor && sibling instanceof HTMLElement) {
          siblings.push({ element: sibling, inert: sibling.inert })
          sibling.inert = true
        }
      }
      ancestor = ancestor.parentElement
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const elements = [
        ...dialog.querySelectorAll<HTMLElement>(
          ':is(button, input, select, textarea, a[href], [tabindex="0"]):not(:disabled)',
        ),
      ]
      const first = elements[0],
        last = elements.at(-1)
      if (!first) {
        event.preventDefault()
        dialog.focus()
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', keydown)
    return () => {
      dialog.removeEventListener('keydown', keydown)
      siblings.forEach(({ element, inert }) => {
        element.inert = inert
      })
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return (
    <div className="ui-modal-overlay">
      <div
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={busy}
        ref={ref}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  )
}
