import { cn } from '../../lib/cn'
import { Icon } from '../ui/Icon'

/**
 * Step indicator. Completed steps are clickable so a visitor can correct an
 * earlier answer without losing the rest of the form.
 */
export function WizardProgress({ steps, stepIndex, furthestStep, onStepSelect }) {
  const progressPercent = (stepIndex / (steps.length - 1)) * 100

  return (
    <nav aria-label="שלבי ההזמנה">
      <ol className="relative flex items-start justify-between">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-4 -z-0 h-1 rounded-full bg-surface-container-highest"
        />
        <div
          aria-hidden="true"
          className="absolute top-4 -z-0 h-1 rounded-full bg-primary-container transition-all duration-300 ltr:left-0 rtl:right-0"
          style={{ width: `${progressPercent}%` }}
        />

        {steps.map((step, index) => {
          const isComplete = index < stepIndex
          const isCurrent = index === stepIndex
          const isReachable = index <= furthestStep

          return (
            <li key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => isReachable && onStepSelect(index)}
                disabled={!isReachable}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full border text-label-md transition-all',
                  isCurrent &&
                    'border-transparent bg-primary-container text-on-primary-container shadow-[0_0_10px_rgba(255,107,0,0.45)]',
                  isComplete &&
                    'border-primary-container/50 bg-primary-container/20 text-primary-container',
                  !isCurrent &&
                    !isComplete &&
                    'border-outline-variant/50 bg-surface-container-highest text-on-surface-variant',
                  isReachable ? 'cursor-pointer' : 'cursor-not-allowed',
                )}
              >
                {isComplete ? <Icon name="check" size={18} /> : index + 1}
                <span className="sr-only">
                  שלב {index + 1}: {step.label}
                </span>
              </button>

              <span
                className={cn(
                  'hidden text-label-sm md:block',
                  isCurrent ? 'text-primary-container' : 'text-on-surface-variant',
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
