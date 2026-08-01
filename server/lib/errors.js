/**
 * Server-side error taxonomy.
 *
 * Every error that reaches the HTTP layer carries a `status` and a machine
 * `code`, and serializes to exactly the shape `ApiError` on the client already
 * parses — so the frontend never has to special-case this service.
 *
 * `message` is written for the end user in Hebrew and is safe to render.
 * Anything an operator needs but a customer must not see goes in `details`,
 * which is logged and never serialized to the response.
 */
export class ServiceError extends Error {
  constructor(message, { status = 500, code = 'internal_error', fieldErrors, details, cause } = {}) {
    super(message, { cause })
    this.name = 'ServiceError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors ?? null
    this.details = details ?? null
    /** Marks errors we raised deliberately, as opposed to a crash. */
    this.expected = true
  }

  toResponse() {
    return {
      error: {
        message: this.message,
        code: this.code,
        ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
      },
    }
  }
}

export const errors = {
  invalidPlate: (message = 'מספר רישוי חייב להכיל 5–8 ספרות') =>
    new ServiceError(message, {
      status: 422,
      code: 'invalid_plate',
      fieldErrors: { licensePlate: message },
    }),

  plateNotFound: () =>
    new ServiceError('לא מצאנו את הרכב במאגר משרד התחבורה', {
      status: 404,
      code: 'plate_not_found',
    }),

  /**
   * The vehicle exists but neither dataset carries a usable tire size.
   *
   * Deliberately distinct from `plateNotFound`: the plate was right, so the UI
   * should offer a manual lookup rather than telling the customer to re-check
   * their typing.
   */
  tireSpecsUnavailable: () =>
    new ServiceError('מצאנו את הרכב, אך מידות הצמיגים אינן זמינות במאגר', {
      status: 422,
      code: 'tire_specs_unavailable',
    }),

  registryUnavailable: (cause) =>
    new ServiceError('מאגר משרד התחבורה אינו זמין כרגע. נסו שוב בעוד רגע.', {
      status: 503,
      code: 'registry_unavailable',
      cause,
    }),

  /**
   * data.gov.il refused us specifically — an IP block or a WAF rule.
   *
   * Split from a generic outage because the operator response is completely
   * different: an outage resolves itself, a block needs someone to request an
   * allowlist or move the egress IP. Retrying only makes a block worse.
   */
  registryBlocked: (cause) =>
    new ServiceError('הגישה למאגר משרד התחבורה נחסמה. אנחנו מטפלים בזה.', {
      status: 503,
      code: 'registry_blocked',
      cause,
    }),

  /** Throttled. Distinct from a block: this one does clear on its own. */
  registryRateLimited: (cause) =>
    new ServiceError('יותר מדי פניות למאגר משרד התחבורה. נסו שוב בעוד רגע.', {
      status: 503,
      code: 'registry_rate_limited',
      cause,
    }),
}
