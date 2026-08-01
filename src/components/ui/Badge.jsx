import { cn } from '../../lib/cn'
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_LABELS,
  QUOTE_STATUS,
  QUOTE_STATUS_LABELS,
} from '../../lib/constants'

const TONES = {
  primary: 'bg-primary-container/15 text-primary-container border-primary-container/30',
  secondary: 'bg-secondary-container/15 text-secondary-container border-secondary-container/30',
  success: 'bg-success/15 text-success border-success/30',
  error: 'bg-error-container/25 text-error border-error/40',
  neutral: 'bg-surface-container-high text-on-surface-variant border-outline-variant/40',
}

export function Badge({ tone = 'neutral', pulse = false, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-label-sm whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {pulse && (
        <span className="relative flex size-2">
          <span
            className="absolute inline-flex size-full rounded-full bg-current opacity-75"
            style={{ animation: 'pulse-ring 2s cubic-bezier(0.215,0.61,0.355,1) infinite' }}
          />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}

const APPOINTMENT_TONES = {
  [APPOINTMENT_STATUS.SCHEDULED]: 'secondary',
  [APPOINTMENT_STATUS.IN_PROGRESS]: 'primary',
  [APPOINTMENT_STATUS.COMPLETED]: 'success',
  [APPOINTMENT_STATUS.CANCELLED]: 'error',
}

export function AppointmentStatusBadge({ status }) {
  return (
    <Badge
      tone={APPOINTMENT_TONES[status] ?? 'neutral'}
      pulse={status === APPOINTMENT_STATUS.IN_PROGRESS}
    >
      {APPOINTMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

const QUOTE_TONES = {
  [QUOTE_STATUS.PENDING]: 'primary',
  [QUOTE_STATUS.APPROVED]: 'success',
  [QUOTE_STATUS.REJECTED]: 'error',
  [QUOTE_STATUS.EXPIRED]: 'neutral',
  [QUOTE_STATUS.DRAFT]: 'neutral',
}

export function QuoteStatusBadge({ status }) {
  return (
    <Badge tone={QUOTE_TONES[status] ?? 'neutral'} pulse={status === QUOTE_STATUS.PENDING}>
      {QUOTE_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
