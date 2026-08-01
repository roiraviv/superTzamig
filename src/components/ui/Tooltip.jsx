import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from './Icon'

/**
 * Small explanatory popover attached to an icon button.
 *
 * Hover alone is not enough. Roughly half this site's traffic is a phone in a
 * driveway, where there is no hover state at all, so the trigger is a real
 * button that toggles on tap, responds to Enter and Space for free, and closes
 * on Escape or an outside tap. The content is wired through `aria-describedby`
 * rather than a `title` attribute, which screen readers announce inconsistently
 * and touch users never see.
 */
export function InfoTooltip({ text, label = 'מידע נוסף', className, side = 'top' }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const tooltipId = useId()

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        close()
        // Escape should leave focus on the trigger, not lose it to the body.
        containerRef.current?.querySelector('button')?.focus()
      }
    }

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) close()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, close])

  return (
    <span ref={containerRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex size-5 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container"
      >
        <Icon name="help" size={16} />
      </button>

      <span
        id={tooltipId}
        role="tooltip"
        // Kept mounted so `aria-describedby` always resolves; hidden from the
        // tree and from pointer events while collapsed.
        aria-hidden={!open}
        className={cn(
          'pointer-events-none absolute left-1/2 z-30 w-60 -translate-x-1/2 rounded-lg border border-outline-variant/60 bg-surface-container-highest px-3 py-2 text-start text-label-sm leading-relaxed text-on-surface shadow-lg transition-opacity duration-150',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          open ? 'opacity-100' : 'invisible opacity-0',
        )}
      >
        {text}
      </span>
    </span>
  )
}
