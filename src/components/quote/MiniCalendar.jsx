import { useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { toDateKey } from '../../lib/format'
import { Icon } from '../ui/Icon'

const WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
const MONTH_FORMATTER = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' })
const MAX_DAYS_AHEAD = 60

function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/**
 * Month picker for the scheduling step. Saturdays and past dates are disabled
 * here for immediate feedback; the server re-checks the same rules on submit.
 */
export function MiniCalendar({ value, onChange }) {
  const today = startOfDay(new Date())
  const selected = value ? new Date(`${value}T00:00:00`) : today
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  )

  const lastBookable = useMemo(() => {
    const limit = new Date(today)
    limit.setDate(limit.getDate() + MAX_DAYS_AHEAD)
    return limit
  }, [today])

  const days = useMemo(() => {
    const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const daysInMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0,
    ).getDate()

    return [
      ...Array.from({ length: firstOfMonth.getDay() }, () => null),
      ...Array.from(
        { length: daysInMonth },
        (_, index) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1),
      ),
    ]
  }, [visibleMonth])

  const shiftMonth = (offset) =>
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    )

  const canGoBack =
    visibleMonth > new Date(today.getFullYear(), today.getMonth(), 1)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={!canGoBack}
          aria-label="חודש קודם"
          className="rounded-full p-1 text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-30"
        >
          <Icon name="chevron_right" />
        </button>

        <span className="text-label-md text-on-surface">{MONTH_FORMATTER.format(visibleMonth)}</span>

        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="חודש הבא"
          className="rounded-full p-1 text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="chevron_left" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-label-sm text-on-surface-variant">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((day, index) => {
          if (!day) return <span key={`pad-${index}`} />

          const dateKey = toDateKey(day)
          const isSelected = dateKey === value
          const isClosed = day.getDay() === 6
          const isDisabled = isClosed || day < today || day > lastBookable

          return (
            <button
              key={dateKey}
              type="button"
              disabled={isDisabled}
              aria-pressed={isSelected}
              onClick={() => onChange(dateKey)}
              className={cn(
                'aspect-square rounded-full text-body-md transition-colors',
                isSelected &&
                  'bg-primary-container font-bold text-on-primary-container shadow-[0_0_10px_rgba(255,107,0,0.4)]',
                !isSelected && !isDisabled && 'text-on-surface hover:bg-surface-container-high',
                isDisabled && 'cursor-not-allowed text-on-surface-variant/25',
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-label-sm text-on-surface-variant/70">
        שבת סגור · ניתן לקבוע עד {MAX_DAYS_AHEAD} ימים קדימה
      </p>
    </div>
  )
}
