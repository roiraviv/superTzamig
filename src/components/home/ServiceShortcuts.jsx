import { Link } from 'react-router-dom'
import { SERVICE_TYPES } from '../../lib/constants'
import { formatCurrency } from '../../lib/format'
import { SectionHeading } from '../ui/Card'
import { Icon } from '../ui/Icon'

/**
 * Large touch targets that jump straight into the wizard with the service
 * pre-selected, so the visitor lands on step 2 instead of step 1.
 */
export function ServiceShortcuts() {
  return (
    <section className="space-y-6">
      <SectionHeading icon="build" title="הזמנה מהירה לפי שירות" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {SERVICE_TYPES.map((service) => (
          <Link
            key={service.id}
            to={`/book?service=${service.id}`}
            className="glass-card group flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg p-4 text-center transition-all duration-200 hover:border-secondary-container/50 hover:-translate-y-1"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-colors group-hover:bg-primary-container/20 group-hover:text-primary-container">
              <Icon name={service.icon} />
            </span>
            <span className="text-label-md text-on-surface">{service.label}</span>
            <span className="text-label-sm text-on-surface-variant">
              החל מ־{formatCurrency(service.basePrice)} · {service.durationMinutes} דק׳
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
