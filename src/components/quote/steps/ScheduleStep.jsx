import { cn } from '../../../lib/cn'
import { formatLongDate } from '../../../lib/format'
import { Icon } from '../../ui/Icon'
import { EmptyState, ErrorState, Skeleton } from '../../ui/StateViews'
import { MiniCalendar } from '../MiniCalendar'

/** Step 3 — date on one side, live slot availability on the other. */
export function ScheduleStep({ schedule, errors, onChange, availability }) {
  const slots = availability.data?.slots ?? []
  const openSlots = slots.filter((slot) => slot.available)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline text-headline-md text-on-surface">מתי נוח לכם?</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          התורים מתעדכנים בזמן אמת מול העמדות הפנויות במוסך.
        </p>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <MiniCalendar value={schedule.date} onChange={(date) => onChange('date', date)} />
          {errors.date && (
            <p role="alert" className="mt-2 flex items-center gap-1 text-label-sm text-error">
              <Icon name="error" size={14} />
              {errors.date}
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-4 text-label-md text-on-surface-variant">
            שעות פנויות · {formatLongDate(schedule.date)}
          </h3>

          {availability.isLoading && !availability.data ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : availability.isError ? (
            <ErrorState
              error={availability.error}
              onRetry={availability.refetch}
              title="לא הצלחנו לטעון שעות"
            />
          ) : availability.data?.closed ? (
            <EmptyState
              icon="event_busy"
              title="המוסך סגור ביום זה"
              description="שבת סגור. בחרו יום אחר ונשמח לארח אתכם."
            />
          ) : openSlots.length === 0 ? (
            <EmptyState
              icon="event_busy"
              title="כל התורים ביום זה תפוסים"
              description="בחרו תאריך אחר, או השאירו פרטים ונחזור אליכם עם חלון קרוב יותר."
            />
          ) : (
            <>
              <div
                role="radiogroup"
                aria-label="בחירת שעה"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2"
              >
                {slots.map((slot) => {
                  const isSelected = schedule.slotId === slot.id

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={!slot.available}
                      onClick={() => onChange('slotId', slot.id)}
                      className={cn(
                        'rounded-lg border py-3 text-body-md transition-all active:scale-[0.98]',
                        isSelected &&
                          'border-primary-container bg-primary-container/10 font-bold text-primary-container shadow-[inset_0_0_8px_rgba(255,107,0,0.2)]',
                        !isSelected &&
                          slot.available &&
                          'border-outline-variant bg-surface-container text-on-surface-variant hover:border-secondary hover:text-secondary',
                        !slot.available &&
                          'cursor-not-allowed border-outline-variant/30 bg-surface-container/40 text-on-surface-variant/25 line-through',
                      )}
                    >
                      {slot.time}
                    </button>
                  )
                })}
              </div>

              {errors.slotId && (
                <p role="alert" className="mt-3 flex items-center gap-1 text-label-sm text-error">
                  <Icon name="error" size={14} />
                  {errors.slotId}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
