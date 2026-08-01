import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuoteCart } from '../../context/quoteCartContext'
import { useBookingWizard } from '../../hooks/useBookingWizard'
import { useReviewSummary } from '../../hooks/useReviewSummary'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { MicroTrustBadge } from '../trust/TrustBadges'
import { QuoteSummary } from './QuoteSummary'
import { WizardProgress } from './WizardProgress'
import { WizardSuccess } from './WizardSuccess'
import { ConfirmStep } from './steps/ConfirmStep'
import { ScheduleStep } from './steps/ScheduleStep'
import { ServiceStep } from './steps/ServiceStep'
import { VehicleStep } from './steps/VehicleStep'

/**
 * Multi-step booking / quoting wizard.
 *
 * All state lives in `useBookingWizard`; this component only maps state to the
 * right step view and renders navigation. Keeping the split that way is what
 * lets the same flow serve both the "book an appointment" and "request a
 * quote" intents with no branching inside the steps themselves.
 *
 * @param {{ intent: 'appointment' | 'quote', preselectedServiceId?: string }} props
 */
export function QuoteWizard({ intent = 'appointment', preselectedServiceId }) {
  const cart = useQuoteCart()
  const summary = useReviewSummary()
  const [completion, setCompletion] = useState(null)

  const lineItems = useMemo(
    () => cart.items.map((item) => ({ tireId: item.tireId, quantity: item.quantity })),
    [cart.items],
  )

  const wizard = useBookingWizard({
    lineItems,
    onComplete: (result, completedIntent) => {
      cart.clear()
      setCompletion({ result, intent: completedIntent })
    },
  })

  const { toggleService, values } = wizard

  // Deep links like /book?service=alignment land the visitor one step in.
  const appliedPreselection = useRef(false)
  useEffect(() => {
    if (appliedPreselection.current || !preselectedServiceId) return
    appliedPreselection.current = true
    if (!values.serviceIds.includes(preselectedServiceId)) {
      toggleService(preselectedServiceId)
    }
  }, [preselectedServiceId, toggleService, values.serviceIds])

  // Move focus to the new step heading so keyboard and screen-reader users
  // aren't left at the bottom of the previous step.
  const stepRef = useRef(null)
  useEffect(() => {
    stepRef.current?.focus()
  }, [wizard.stepIndex])

  if (completion) {
    return (
      <WizardSuccess
        result={completion.result}
        intent={completion.intent}
        onStartOver={() => {
          setCompletion(null)
          wizard.reset()
        }}
      />
    )
  }

  const stepViews = [
    <ServiceStep
      key="service"
      selectedIds={wizard.values.serviceIds}
      lineItems={wizard.values.lineItems}
      error={wizard.errors.serviceIds}
      onToggle={wizard.toggleService}
    />,
    <VehicleStep
      key="vehicle"
      vehicle={wizard.values.vehicle}
      errors={wizard.errors}
      onChange={(field, value) => wizard.setField('vehicle', field, value)}
      lookup={wizard.vehicleLookup}
    />,
    <ScheduleStep
      key="schedule"
      schedule={wizard.values.schedule}
      errors={wizard.errors}
      onChange={(field, value) => wizard.setField('schedule', field, value)}
      availability={wizard.availability}
    />,
    <ConfirmStep
      key="confirm"
      values={wizard.values}
      errors={wizard.errors}
      onChange={(field, value) => wizard.setField('contact', field, value)}
      onEditStep={wizard.goToStep}
    />,
  ]

  const submitLabel = intent === 'quote' ? 'שליחת בקשה להצעת מחיר' : 'אישור וקביעת התור'

  return (
    <div className="space-y-10">
      <WizardProgress
        steps={wizard.steps}
        stepIndex={wizard.stepIndex}
        furthestStep={wizard.furthestStep}
        onStepSelect={wizard.goToStep}
      />

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div
            ref={stepRef}
            tabIndex={-1}
            role="group"
            aria-label={`שלב ${wizard.stepIndex + 1} מתוך ${wizard.steps.length}: ${wizard.step.label}`}
            className="outline-none"
          >
            {stepViews[wizard.stepIndex]}
          </div>

          {wizard.submission.isError && !wizard.submission.fieldErrors && (
            <p
              role="alert"
              className="mt-6 flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/15 px-4 py-3 text-body-md text-error"
            >
              <Icon name="error" size={18} />
              {wizard.submission.error.userMessage}
            </p>
          )}

          <div className="mt-10 flex items-center justify-between gap-4 border-t border-outline-variant/25 pt-6">
            <Button
              variant="tertiary"
              icon="chevron_right"
              onClick={wizard.back}
              disabled={wizard.isFirstStep || wizard.submission.isSubmitting}
            >
              חזרה
            </Button>

            {wizard.isLastStep ? (
              <Button
                size="lg"
                icon="check_circle"
                loading={wizard.submission.isSubmitting}
                onClick={() => wizard.submission.run(intent)}
                className="hidden lg:inline-flex"
              >
                {submitLabel}
              </Button>
            ) : (
              <Button size="lg" trailingIcon="chevron_left" onClick={wizard.next}>
                המשך
              </Button>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <QuoteSummary
            pricing={wizard.pricing}
            cartItems={cart.items}
            onRemoveItem={cart.removeItem}
            footer={
              wizard.isLastStep ? (
                // Only the final step gets the badge. Repeating it on every step
                // would train the eye to skip it exactly where it matters.
                <div className="space-y-3">
                  <Button
                    fullWidth
                    size="lg"
                    icon="check_circle"
                    loading={wizard.submission.isSubmitting}
                    onClick={() => wizard.submission.run(intent)}
                  >
                    {submitLabel}
                  </Button>
                  <MicroTrustBadge summary={summary.data} className="justify-center" />
                </div>
              ) : (
                <Button fullWidth size="lg" trailingIcon="chevron_left" onClick={wizard.next}>
                  המשך לשלב {wizard.stepIndex + 2}
                </Button>
              )
            }
          />
        </div>
      </div>
    </div>
  )
}
