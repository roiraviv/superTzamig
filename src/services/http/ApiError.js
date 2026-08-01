/**
 * Normalized transport error. Every rejection out of the service layer is an
 * ApiError, so UI code never has to branch on network vs. HTTP vs. parse noise.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'unknown_error', fieldErrors = null, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.code = code
    /** `{ fieldName: 'message' }` from the backend validator, or null. */
    this.fieldErrors = fieldErrors
  }

  get isNetwork() {
    return this.status === 0
  }

  get isUnauthorized() {
    return this.status === 401 || this.status === 403
  }

  get isValidation() {
    return this.status === 422 || this.fieldErrors != null
  }

  /** Safe to render: never leaks a stack trace or backend internals. */
  get userMessage() {
    if (this.isNetwork) return 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.'
    if (this.status === 401) return 'ההתחברות פגה. יש להתחבר מחדש.'
    if (this.status === 403) return 'אין לכם הרשאה לבצע פעולה זו.'
    if (this.status === 404) return 'הפריט המבוקש לא נמצא.'
    if (this.status === 409) return this.message || 'הפעולה מתנגשת עם נתונים קיימים.'
    if (this.status === 429) return 'יותר מדי בקשות. נסו שוב בעוד רגע.'
    if (this.isValidation) return this.message || 'חלק מהפרטים אינם תקינים.'
    if (this.status >= 500) return 'אירעה תקלה בשרת. הצוות שלנו כבר בדרך לתקן.'
    return this.message || 'אירעה שגיאה בלתי צפויה.'
  }
}

export function toApiError(error) {
  if (error instanceof ApiError) return error
  if (error?.name === 'AbortError') {
    return new ApiError('הבקשה בוטלה', { status: 0, code: 'aborted', cause: error })
  }
  return new ApiError('אירעה שגיאה בלתי צפויה', {
    status: 0,
    code: 'network_error',
    cause: error,
  })
}
