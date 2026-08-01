/**
 * Dependency-free validation primitives.
 *
 * Client-side validation here exists for UX only. Every rule in this file is
 * mirrored on the Node.js side before anything reaches MongoDB — the browser is
 * never the enforcement point.
 */

// Matching control characters is the whole point here: they are stripped from
// every string before it can reach a log line, a header, or the database.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g

/** Trim, strip control characters, and clamp length before anything else. */
export function sanitizeText(value, maxLength = 500) {
  if (value == null) return ''
  return String(value).replace(CONTROL_CHARS, '').trim().slice(0, maxLength)
}

export function sanitizeDigits(value, maxLength = 20) {
  if (value == null) return ''
  return String(value).replace(/\D/g, '').slice(0, maxLength)
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/
/** Israeli mobile (05x) and landline (02/03/04/08/09) and 07x VoIP ranges. */
const PHONE_PATTERN = /^0(5\d{8}|7\d{8}|[23489]\d{7})$/
const PLATE_PATTERN = /^\d{5,8}$/
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i

export const validators = {
  required(message = 'שדה חובה') {
    return (value) => {
      const empty =
        value == null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      return empty ? message : null
    }
  },

  minLength(min, message) {
    return (value) =>
      String(value ?? '').trim().length < min ? (message ?? `לפחות ${min} תווים`) : null
  },

  maxLength(max, message) {
    return (value) =>
      String(value ?? '').length > max ? (message ?? `עד ${max} תווים`) : null
  },

  email(message = 'כתובת אימייל לא תקינה') {
    return (value) => (!value || EMAIL_PATTERN.test(String(value).trim()) ? null : message)
  },

  phone(message = 'מספר טלפון ישראלי לא תקין') {
    return (value) => (!value || PHONE_PATTERN.test(sanitizeDigits(value)) ? null : message)
  },

  licensePlate(message = 'מספר רישוי חייב להכיל 5–8 ספרות') {
    return (value) => (!value || PLATE_PATTERN.test(sanitizeDigits(value)) ? null : message)
  },

  oneOf(allowed, message = 'ערך לא חוקי') {
    const set = new Set(allowed)
    return (value) => (value == null || set.has(value) ? null : message)
  },

  integerBetween(min, max, message) {
    return (value) => {
      if (value === '' || value == null) return null
      const num = Number(value)
      return Number.isInteger(num) && num >= min && num <= max
        ? null
        : (message ?? `יש להזין מספר שלם בין ${min} ל־${max}`)
    }
  },

  positiveNumber(message = 'יש להזין מספר חיובי') {
    return (value) => {
      if (value === '' || value == null) return null
      const num = Number(value)
      return Number.isFinite(num) && num > 0 ? null : message
    }
  },

  futureDate(message = 'יש לבחור תאריך עתידי') {
    return (value) => {
      if (!value) return null
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return 'תאריך לא תקין'
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      return date >= startOfToday ? null : message
    }
  },
}

/**
 * Runs a `{ field: [rule, ...] }` schema against an object.
 * Returns `{ valid, errors }` where `errors` holds the first failure per field.
 */
export function validateSchema(values, schema) {
  const errors = {}

  for (const [field, rules] of Object.entries(schema)) {
    for (const rule of rules) {
      const error = rule(values?.[field], values)
      if (error) {
        errors[field] = error
        break
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export function isValidObjectId(value) {
  return OBJECT_ID_PATTERN.test(String(value ?? ''))
}

/* ---------------------------------------------------------------------------
 * Card helpers.
 *
 * These exist so the operator gets instant feedback and so an obviously bad
 * number never becomes a billable gateway request. They are NOT a security
 * control: the card number is tokenized by the PCI-DSS compliant gateway and
 * never reaches our own API or database.
 * ------------------------------------------------------------------------- */

/** Issuer identification ranges, longest prefix first. */
const CARD_BRANDS = [
  { id: 'amex', label: 'American Express', pattern: /^3[47]/, lengths: [15], cvvLength: 4 },
  { id: 'diners', label: 'Diners Club', pattern: /^3(0[0-5]|[68])/, lengths: [14], cvvLength: 3 },
  { id: 'visa', label: 'Visa', pattern: /^4/, lengths: [13, 16, 19], cvvLength: 3 },
  {
    id: 'mastercard',
    label: 'Mastercard',
    pattern: /^(5[1-5]|2[2-7])/,
    lengths: [16],
    cvvLength: 3,
  },
  { id: 'discover', label: 'Discover', pattern: /^6(011|5)/, lengths: [16, 19], cvvLength: 3 },
]

export function detectCardBrand(cardNumber) {
  const digits = sanitizeDigits(cardNumber, 19)
  return CARD_BRANDS.find((brand) => brand.pattern.test(digits)) ?? null
}

/** Mod-10 checksum. Catches transposed and mistyped digits, nothing more. */
export function luhnCheck(cardNumber) {
  const digits = sanitizeDigits(cardNumber, 19)
  if (digits.length < 12) return false

  let sum = 0
  let double = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

/** Groups for display only — 4-6-5 for Amex, 4-4-4-4 for everyone else. */
export function formatCardNumber(cardNumber) {
  const digits = sanitizeDigits(cardNumber, 19)
  const brand = detectCardBrand(digits)
  const groups = brand?.id === 'amex' ? [4, 6, 5] : [4, 4, 4, 4, 3]

  const parts = []
  let cursor = 0
  for (const size of groups) {
    if (cursor >= digits.length) break
    parts.push(digits.slice(cursor, cursor + size))
    cursor += size
  }
  return parts.join(' ')
}

/** Accepts MM/YY or MM/YYYY and rejects anything already expired. */
export function parseCardExpiry(value) {
  const digits = sanitizeDigits(value, 6)
  if (digits.length < 4) return null

  const month = Number(digits.slice(0, 2))
  const yearPart = digits.slice(2)
  const year = yearPart.length === 4 ? Number(yearPart) : 2000 + Number(yearPart.slice(0, 2))
  if (!Number.isInteger(month) || month < 1 || month > 12) return null

  const now = new Date()
  // A card stays valid through the last day of its printed month.
  const expired =
    year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)

  return { month, year, expired }
}

export const cardValidators = {
  number(message = 'מספר כרטיס לא תקין') {
    return (value) => {
      const digits = sanitizeDigits(value, 19)
      if (!digits) return 'יש להזין מספר כרטיס'
      const brand = detectCardBrand(digits)
      if (brand && !brand.lengths.includes(digits.length)) {
        return `מספר כרטיס ${brand.label} צריך להכיל ${brand.lengths.join(' או ')} ספרות`
      }
      return luhnCheck(digits) ? null : message
    }
  },

  expiry() {
    return (value) => {
      const parsed = parseCardExpiry(value)
      if (!parsed) return 'תוקף לא תקין (MM/YY)'
      return parsed.expired ? 'הכרטיס פג תוקף' : null
    }
  },

  cvv() {
    return (value, values) => {
      const digits = sanitizeDigits(value, 4)
      const expected = detectCardBrand(values?.cardNumber)?.cvvLength ?? 3
      if (digits.length !== expected) return `קוד אבטחה בן ${expected} ספרות`
      return null
    }
  },

  holderName() {
    return (value) => {
      const name = sanitizeText(value, 60)
      if (name.length < 2) return 'יש להזין שם בעל הכרטיס'
      // Latin only: this is what the gateway forwards to the issuer.
      return /^[A-Za-z\s'.-]+$/.test(name) ? null : 'יש להזין את השם באותיות לטיניות'
    }
  },
}

/* ---------------------------------------------------------------------------
 * Feature schemas — one per wizard step so a step can be validated in isolation.
 * ------------------------------------------------------------------------- */

export const serviceStepSchema = {
  serviceIds: [validators.required('יש לבחור לפחות שירות אחד')],
}

export const vehicleStepSchema = {
  licensePlate: [validators.required('יש להזין מספר רישוי'), validators.licensePlate()],
  make: [validators.required('יש להזין יצרן'), validators.maxLength(40)],
  model: [validators.required('יש להזין דגם'), validators.maxLength(40)],
  year: [
    validators.required('יש להזין שנת ייצור'),
    validators.integerBetween(1970, new Date().getFullYear() + 1),
  ],
}

export const scheduleStepSchema = {
  date: [validators.required('יש לבחור תאריך'), validators.futureDate()],
  slotId: [validators.required('יש לבחור שעה')],
}

export const contactStepSchema = {
  fullName: [
    validators.required('יש להזין שם מלא'),
    validators.minLength(2),
    validators.maxLength(60),
  ],
  phone: [validators.required('יש להזין טלפון'), validators.phone()],
  email: [validators.email()],
  notes: [validators.maxLength(500)],
  consent: [
    (value) => (value === true ? null : 'יש לאשר את תנאי השימוש כדי להמשיך'),
  ],
}

export const inventoryItemSchema = {
  name: [validators.required(), validators.maxLength(80)],
  brand: [validators.required(), validators.maxLength(40)],
  sku: [validators.required(), validators.maxLength(40)],
  price: [validators.required(), validators.positiveNumber()],
  stock: [validators.required(), validators.integerBetween(0, 100000)],
}

export const adminLoginSchema = {
  email: [validators.required('יש להזין אימייל'), validators.email()],
  password: [validators.required('יש להזין סיסמה'), validators.minLength(8, 'לפחות 8 תווים')],
}

/** Sole field of the smart tire selector — keep the barrier to entry at one input. */
export const plateLookupSchema = {
  licensePlate: [validators.required('יש להזין מספר רישוי'), validators.licensePlate()],
}

export const invoiceCustomerSchema = {
  name: [
    validators.required('יש להזין שם לקוח'),
    validators.minLength(2),
    validators.maxLength(80),
  ],
  phone: [validators.required('יש להזין טלפון'), validators.phone()],
  email: [validators.email()],
  // Israeli company/ID number, optional but validated when present.
  taxId: [
    (value) =>
      !value || /^\d{9}$/.test(sanitizeDigits(value, 9)) ? null : 'ח.פ / ת.ז חייב להכיל 9 ספרות',
  ],
}

export const cardPaymentSchema = {
  holderName: [cardValidators.holderName()],
  cardNumber: [cardValidators.number()],
  expiry: [cardValidators.expiry()],
  cvv: [cardValidators.cvv()],
}
