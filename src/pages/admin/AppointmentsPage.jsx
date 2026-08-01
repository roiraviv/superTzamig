import { useMemo, useState } from 'react'
import { AppointmentStatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { GlassPanel } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { AsyncBoundary, EmptyState } from '../../components/ui/StateViews'
import { useAsyncAction, useAsyncData } from '../../hooks/useAsyncData'
import { adminAppointmentsApi } from '../../services/api'
import { APPOINTMENT_STATUS, SERVICE_TYPES } from '../../lib/constants'
import { formatLicensePlate, formatLongDate, formatTime, toDateKey } from '../../lib/format'

const DAY_MS = 24 * 60 * 60 * 1000

function serviceLabels(serviceIds) {
  return serviceIds
    .map((id) => SERVICE_TYPES.find((service) => service.id === id)?.label ?? id)
    .join(' · ')
}

/** Day strip: the garage plans by day, so paging by day beats a month grid. */
function DayPicker({ today, offset, onChange }) {
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => ({
        offset: index - 1,
        date: new Date(today + (index - 1) * DAY_MS),
      })),
    [today],
  )

  return (
    <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
      {days.map((day) => {
        const isActive = day.offset === offset
        return (
          <button
            key={day.offset}
            type="button"
            onClick={() => onChange(day.offset)}
            aria-pressed={isActive}
            className={`flex min-w-24 shrink-0 flex-col items-center rounded-md border px-4 py-2 transition-colors ${
              isActive
                ? 'border-primary-container bg-primary-container/15 text-primary-container'
                : 'border-outline-variant/40 bg-surface-container text-on-surface-variant hover:border-secondary/50'
            }`}
          >
            <span className="text-label-sm">
              {day.offset === 0 ? 'היום' : day.offset === 1 ? 'מחר' : ''}
            </span>
            <span className="text-label-md">
              {new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' }).format(
                day.date,
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const NEXT_STATUS = {
  [APPOINTMENT_STATUS.SCHEDULED]: {
    status: APPOINTMENT_STATUS.IN_PROGRESS,
    label: 'התחלת טיפול',
    icon: 'play_arrow',
  },
  [APPOINTMENT_STATUS.IN_PROGRESS]: {
    status: APPOINTMENT_STATUS.COMPLETED,
    label: 'סיום טיפול',
    icon: 'check',
  },
}

export function AppointmentsPage() {
  const [offset, setOffset] = useState(0)
  // Pinned once on mount so the day strip can't shift under the user mid-shift.
  const [today] = useState(() => Date.now())
  const selectedDate = new Date(today + offset * DAY_MS)
  const dateKey = toDateKey(selectedDate)

  const appointments = useAsyncData(
    ({ signal }) =>
      adminAppointmentsApi.list(
        { from: `${dateKey}T00:00:00.000Z`, to: `${dateKey}T23:59:59.999Z` },
        { signal },
      ),
    [dateKey],
    { keepPreviousData: true },
  )

  const { refetch } = appointments
  const statusChange = useAsyncAction(async (id, status) => {
    const result = await adminAppointmentsApi.updateStatus(id, status)
    refetch()
    return result
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline text-headline-lg text-on-surface md:text-headline-xl">
          יומן תורים
        </h1>
        <p className="mt-1 text-on-surface-variant">{formatLongDate(selectedDate)}</p>
      </header>

      <DayPicker today={today} offset={offset} onChange={setOffset} />

      {statusChange.isError && (
        <p role="alert" className="rounded-lg border border-error/40 bg-error-container/15 px-4 py-3 text-body-md text-error">
          {statusChange.error.userMessage}
        </p>
      )}

      <AsyncBoundary
        query={appointments}
        skeletonRows={4}
        empty={
          <EmptyState
            icon="event_available"
            title="אין תורים ליום זה"
            description="היומן פנוי. זה זמן טוב לטפל בהזמנות מלאי או בהצעות ממתינות."
          />
        }
      >
        {(items) => (
          <ul className="space-y-3">
            {items.map((appointment) => {
              const nextAction = NEXT_STATUS[appointment.status]

              return (
                <GlassPanel as="li" key={appointment.id} className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex min-w-16 flex-col items-center rounded-md border border-outline-variant/40 bg-surface-container-highest px-3 py-2">
                        <span className="font-headline text-headline-md text-primary-container">
                          {formatTime(appointment.startsAt)}
                        </span>
                        <span className="text-label-sm text-on-surface-variant">
                          {appointment.durationMinutes} דק׳
                        </span>
                      </div>

                      <div>
                        <p className="text-label-md text-on-surface">
                          {appointment.customerName}
                          <span className="text-on-surface-variant"> · עמדה {appointment.bay}</span>
                        </p>
                        <p className="text-body-md text-on-surface-variant">
                          {appointment.vehicle.make} {appointment.vehicle.model} ·{' '}
                          <span dir="ltr">
                            {formatLicensePlate(appointment.vehicle.licensePlate)}
                          </span>
                        </p>
                        <p className="mt-1 text-label-sm text-secondary">
                          {serviceLabels(appointment.serviceIds)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 md:flex-col md:items-end">
                      <AppointmentStatusBadge status={appointment.status} />

                      <div className="flex gap-2">
                        <a
                          href={`tel:${appointment.phone}`}
                          aria-label={`התקשרות ל${appointment.customerName}`}
                          className="flex size-9 items-center justify-center rounded-md border border-outline-variant/50 text-on-surface-variant transition-colors hover:border-secondary hover:text-secondary"
                        >
                          <Icon name="call" size={18} />
                        </a>

                        {nextAction && (
                          <Button
                            variant={
                              appointment.status === APPOINTMENT_STATUS.IN_PROGRESS
                                ? 'primary'
                                : 'secondary'
                            }
                            size="sm"
                            icon={nextAction.icon}
                            loading={statusChange.isSubmitting}
                            onClick={() => statusChange.run(appointment.id, nextAction.status)}
                          >
                            {nextAction.label}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassPanel>
              )
            })}
          </ul>
        )}
      </AsyncBoundary>
    </div>
  )
}
