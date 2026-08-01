import { Link } from 'react-router-dom'
import { StatCard } from '../../components/admin/StatCard'
import { GlassPanel } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { AsyncBoundary, EmptyState, Skeleton } from '../../components/ui/StateViews'
import { useAsyncData } from '../../hooks/useAsyncData'
import { adminDashboardApi } from '../../services/api'
import { formatCurrency, formatRelativeTime } from '../../lib/format'

const ACTIVITY_TONES = {
  primary: 'bg-primary-container/20 text-primary-container border-primary-container/30',
  secondary: 'bg-secondary-container/20 text-secondary-container border-secondary-container/30',
  error: 'bg-error-container/20 text-error border-error/30',
  neutral: 'bg-surface-bright text-on-surface border-outline-variant/30',
}

export function DashboardPage() {
  const stats = useAsyncData(({ signal }) => adminDashboardApi.getStats({ signal }), [])
  const activity = useAsyncData(
    ({ signal }) => adminDashboardApi.getActivity({ signal, limit: 8 }),
    [],
  )

  const data = stats.data

  return (
    <div className="space-y-10">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-headline text-headline-lg tracking-tight text-on-surface md:text-headline-xl">
            שליטה על המוסך
          </h1>
          <p className="mt-1 text-body-lg text-on-surface-variant">
            סקירת מערכת ומדדים בזמן אמת
          </p>
        </div>

        <span className="flex items-center gap-2 text-label-md text-secondary">
          <Icon name="settings" className="animate-spin [animation-duration:3s]" />
          המערכת תקינה
        </span>
      </header>

      {stats.isError ? (
        <AsyncBoundary query={stats}>{() => null}</AsyncBoundary>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon="build_circle"
            tone="secondary"
            label="תורים פעילים היום"
            loading={stats.isLoading}
            value={data?.activeAppointments.value}
            trend={data?.activeAppointments.trend}
          />
          <StatCard
            icon="payments"
            tone="primary"
            label="הכנסות היום"
            loading={stats.isLoading}
            value={formatCurrency(data?.revenueToday.value)}
            trend={data?.revenueToday.trend}
          />
          <StatCard
            icon="warning"
            tone="error"
            pulse={(data?.lowStock.value ?? 0) > 0}
            label="התראות מלאי נמוך"
            loading={stats.isLoading}
            value={data?.lowStock.value}
            note={data?.lowStock.criticalLabel ? `${data.lowStock.criticalLabel} (קריטי)` : null}
          />
          <StatCard
            icon="request_quote"
            tone="neutral"
            label="הצעות ממתינות"
            loading={stats.isLoading}
            value={data?.pendingQuotes.value}
          />
        </div>
      )}

      <GlassPanel className="overflow-hidden border border-outline-variant/30">
        <div className="flex items-center justify-between border-b border-outline-variant/30 bg-surface-container/50 p-6">
          <h2 className="flex items-center gap-2 font-headline text-headline-md text-on-surface">
            <Icon name="history" className="text-secondary" />
            פעילות אחרונה
          </h2>
          <Link
            to="/admin/appointments"
            className="text-label-md text-secondary transition-colors hover:text-secondary-container"
          >
            לכל התורים
          </Link>
        </div>

        <AsyncBoundary
          query={activity}
          loading={
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          }
          empty={
            <EmptyState
              icon="history_toggle_off"
              title="אין פעילות להצגה"
              description="פעולות של הצוות והזמנות של לקוחות יופיעו כאן."
              className="m-6"
            />
          }
        >
          {(items) => (
            <ul className="flex flex-col">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="group flex items-center justify-between gap-4 border-b border-outline-variant/10 p-3 transition-colors last:border-b-0 hover:bg-surface-container-high/50 md:p-6"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full border transition-transform group-hover:scale-110 ${
                        ACTIVITY_TONES[item.tone] ?? ACTIVITY_TONES.neutral
                      }`}
                    >
                      <Icon name={item.icon} size={20} />
                    </span>
                    <div>
                      <p className="text-body-md text-on-surface">{item.title}</p>
                      <p className="mt-0.5 text-label-sm text-on-surface-variant">
                        {item.detail}
                      </p>
                    </div>
                  </div>

                  <span className="hidden text-label-sm whitespace-nowrap text-tertiary md:block">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AsyncBoundary>
      </GlassPanel>
    </div>
  )
}
