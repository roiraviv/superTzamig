import { useState } from 'react'
import { TextInput } from '../ui/Field'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { SecurePaymentBadge } from '../trust/TrustBadges'
import { formatCurrency } from '../../lib/format'
import {
  cardPaymentSchema,
  detectCardBrand,
  formatCardNumber,
  sanitizeDigits,
  validateSchema,
} from '../../lib/validation'

/**
 * Card entry, deliberately the only component in the app that holds a PAN.
 *
 * Security posture:
 *  - The card lives in this component's state and nowhere else. It is handed to
 *    `onSubmit` once and this component clears itself immediately after, so the
 *    number never reaches a store, a context, a URL, or `localStorage`.
 *  - `onSubmit` tokenizes against the gateway's own origin. Our API and our
 *    MongoDB only ever receive `{ token, brand, last4, expMonth, expYear }`.
 *  - `autoComplete` uses the standard card tokens so a password manager can fill
 *    the form, but nothing here is ever persisted by us.
 *
 * In production this component is replaced by the gateway's hosted fields
 * (Stripe Elements / Tranzila iframe): the inputs then live in a cross-origin
 * frame that our JavaScript cannot read, which takes the browser out of PCI-DSS
 * scope entirely. The shape of `onSubmit` is unchanged by that swap — which is
 * the point of keeping tokenization behind the service layer.
 */

const BRAND_ICONS = {
  visa: 'credit_card',
  mastercard: 'credit_card',
  amex: 'credit_card',
  diners: 'credit_card',
  discover: 'credit_card',
}

const EMPTY_CARD = { holderName: '', cardNumber: '', expiry: '', cvv: '' }

/** Digits with an auto-inserted slash, so the operator types 4 characters. */
function formatExpiry(value) {
  const digits = sanitizeDigits(value, 4)
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function CardPaymentForm({ amount, onSubmit, isSubmitting, error, disabled }) {
  const [card, setCard] = useState(EMPTY_CARD)
  const [errors, setErrors] = useState({})

  const brand = detectCardBrand(card.cardNumber)
  const cvvLength = brand?.cvvLength ?? 3

  const setValue = (field, value) => {
    setCard((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const { valid, errors: validationErrors } = validateSchema(card, cardPaymentSchema)
    setErrors(validationErrors)
    if (!valid) return

    // Hand over a copy, then wipe local state on the next tick regardless of
    // outcome: a declined card should not be left sitting in memory either.
    const payload = { ...card }
    try {
      await onSubmit(payload)
    } finally {
      setCard(EMPTY_CARD)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
      <TextInput
        label="שם בעל הכרטיס"
        dir="ltr"
        placeholder="ISRAEL ISRAELI"
        autoComplete="cc-name"
        required
        disabled={disabled || isSubmitting}
        value={card.holderName}
        error={errors.holderName}
        onChange={(event) => setValue('holderName', event.target.value.toUpperCase())}
      />

      <div className="relative">
        <TextInput
          label="מספר כרטיס"
          dir="ltr"
          inputMode="numeric"
          placeholder="4580 1234 5678 9012"
          autoComplete="cc-number"
          required
          disabled={disabled || isSubmitting}
          value={formatCardNumber(card.cardNumber)}
          error={errors.cardNumber}
          onChange={(event) => setValue('cardNumber', sanitizeDigits(event.target.value, 19))}
          className="pe-12 font-mono tracking-wider"
        />
        {brand && (
          <span className="pointer-events-none absolute end-3 top-11 flex items-center gap-1 text-secondary-container">
            <Icon name={BRAND_ICONS[brand.id] ?? 'credit_card'} size={20} />
            <span className="text-label-sm">{brand.label}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextInput
          label="תוקף"
          dir="ltr"
          inputMode="numeric"
          placeholder="MM/YY"
          autoComplete="cc-exp"
          required
          disabled={disabled || isSubmitting}
          value={formatExpiry(card.expiry)}
          error={errors.expiry}
          onChange={(event) => setValue('expiry', event.target.value)}
          className="text-center font-mono"
        />

        <TextInput
          label={`CVV (${cvvLength} ספרות)`}
          dir="ltr"
          inputMode="numeric"
          type="password"
          placeholder={'•'.repeat(cvvLength)}
          autoComplete="cc-csc"
          required
          disabled={disabled || isSubmitting}
          value={card.cvv}
          error={errors.cvv}
          onChange={(event) => setValue('cvv', sanitizeDigits(event.target.value, 4))}
          className="text-center font-mono"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/15 px-4 py-3 text-body-md text-error"
        >
          <Icon name="error" size={18} />
          {error.userMessage}
        </p>
      )}

      {/*
        The same wording is read aloud to the customer at the counter and shown in
        the future POS flow, so it lives in one place rather than being restated
        per surface.
      */}
      <SecurePaymentBadge />

      <Button
        type="submit"
        fullWidth
        size="lg"
        icon="lock"
        loading={isSubmitting}
        disabled={disabled}
      >
        חיוב מאובטח · {formatCurrency(amount, { precise: true })}
      </Button>
    </form>
  )
}
