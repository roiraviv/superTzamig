/** Domain constants shared by the public site and the admin dashboard. */

export const SERVICE_TYPES = [
  {
    id: 'tire-change',
    label: 'החלפת צמיגים',
    icon: 'tire_repair',
    durationMinutes: 60,
    basePrice: 120,
    description: 'פירוק, הרכבה ואיזון ממוחשב',
  },
  {
    id: 'alignment',
    label: 'כיוון פרונט',
    icon: 'architecture',
    durationMinutes: 45,
    basePrice: 280,
    description: 'כיוון תלת־ממדי בארבעה גלגלים',
  },
  {
    id: 'brakes',
    label: 'בדיקת בלמים',
    icon: 'minor_crash',
    durationMinutes: 40,
    basePrice: 190,
    description: 'מדידת רפידות, דיסקים ונוזל',
  },
  {
    id: 'oil',
    label: 'החלפת שמן',
    icon: 'oil_barrel',
    durationMinutes: 30,
    basePrice: 240,
    description: 'שמן סינתטי מלא + מסנן',
  },
  {
    id: 'diagnostics',
    label: 'אבחון תקלה',
    icon: 'monitor_heart',
    durationMinutes: 60,
    basePrice: 150,
    description: 'סריקת מחשב ובדיקה ויזואלית',
  },
  {
    id: 'ac',
    label: 'טיפול מזגן',
    icon: 'ac_unit',
    durationMinutes: 50,
    basePrice: 320,
    description: 'מילוי גז, ניקוי ואיטום',
  },
]

export const SEASONS = [
  { id: 'summer', label: 'קיץ' },
  { id: 'all-season', label: 'כל העונות' },
  { id: 'winter', label: 'חורף' },
  { id: 'touring', label: 'טוריניג' },
]

export const VEHICLE_CLASSES = [
  { id: 'passenger', label: 'רכב פרטי' },
  { id: 'suv', label: 'רכב שטח / SUV' },
  { id: 'commercial', label: 'מסחרי' },
  { id: 'performance', label: 'ספורט / ביצועים' },
]

export const INVENTORY_CATEGORIES = [
  { id: 'tires', label: 'צמיגים' },
  { id: 'brakes', label: 'בלמים' },
  { id: 'fluids', label: 'נוזלים' },
  { id: 'filters', label: 'מסננים' },
  { id: 'accessories', label: 'אביזרים' },
]

export const QUOTE_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
}

export const QUOTE_STATUS_LABELS = {
  [QUOTE_STATUS.DRAFT]: 'טיוטה',
  [QUOTE_STATUS.PENDING]: 'ממתין לאישור',
  [QUOTE_STATUS.APPROVED]: 'אושר',
  [QUOTE_STATUS.REJECTED]: 'נדחה',
  [QUOTE_STATUS.EXPIRED]: 'פג תוקף',
}

export const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

export const APPOINTMENT_STATUS_LABELS = {
  [APPOINTMENT_STATUS.SCHEDULED]: 'מתוזמן',
  [APPOINTMENT_STATUS.IN_PROGRESS]: 'בטיפול',
  [APPOINTMENT_STATUS.COMPLETED]: 'הושלם',
  [APPOINTMENT_STATUS.CANCELLED]: 'בוטל',
}

export const VAT_RATE = 0.17

export const LOW_STOCK_THRESHOLD = 8

/* ---------------------------- Social proof ------------------------------- */

/**
 * Where a review came from. Two independent platforms is the point: one perfect
 * rating reads as curated, two agreeing ones read as true, so the source is
 * always shown next to the stars rather than averaged away.
 */
export const REVIEW_SOURCES = {
  GOOGLE: 'google',
  EASY: 'easy',
}

export const REVIEW_SOURCE_META = {
  [REVIEW_SOURCES.GOOGLE]: {
    id: REVIEW_SOURCES.GOOGLE,
    label: 'Google',
    fullLabel: 'Google Business',
    profileUrl: 'https://www.google.com/maps/search/?api=1&query=%D7%A1%D7%95%D7%A4%D7%A8+%D7%A6%D7%9E%D7%99%D7%92',
  },
  [REVIEW_SOURCES.EASY]: {
    id: REVIEW_SOURCES.EASY,
    label: 'Easy',
    fullLabel: 'Easy.co.il',
    profileUrl: 'https://www.easy.co.il/',
  },
}

/* ------------------------------ Tire fitment ----------------------------- */

/** Which axle an approved size belongs to. Staggered setups differ front/rear. */
export const TIRE_POSITIONS = {
  ALL: 'all',
  FRONT: 'front',
  REAR: 'rear',
}

export const TIRE_POSITION_LABELS = {
  [TIRE_POSITIONS.ALL]: 'ארבעת הגלגלים',
  [TIRE_POSITIONS.FRONT]: 'קדמי',
  [TIRE_POSITIONS.REAR]: 'אחורי',
}

/* -------------------------------- Billing -------------------------------- */

export const INVOICE_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PAID: 'paid',
  REFUNDED: 'refunded',
  VOID: 'void',
}

export const INVOICE_STATUS_LABELS = {
  [INVOICE_STATUS.DRAFT]: 'טיוטה',
  [INVOICE_STATUS.ISSUED]: 'הונפקה',
  [INVOICE_STATUS.PAID]: 'שולמה',
  [INVOICE_STATUS.REFUNDED]: 'הוחזרה',
  [INVOICE_STATUS.VOID]: 'בוטלה',
}

/**
 * Payment lifecycle. `intent` and `capture` are separate states on purpose:
 * authorizing reserves the funds, capturing settles them, and the two can
 * happen through different channels (web gateway today, counter-top card
 * reader later) against the same intent.
 */
export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  REQUIRES_METHOD: 'requires_payment_method',
  REQUIRES_TERMINAL: 'requires_terminal',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  FAILED: 'failed',
  REFUNDED: 'refunded',
}

export const PAYMENT_STATUS_LABELS = {
  [PAYMENT_STATUS.UNPAID]: 'לא שולם',
  [PAYMENT_STATUS.REQUIRES_METHOD]: 'ממתין לאמצעי תשלום',
  [PAYMENT_STATUS.REQUIRES_TERMINAL]: 'ממתין למסוף',
  [PAYMENT_STATUS.AUTHORIZED]: 'מאושר · ממתין לחיוב',
  [PAYMENT_STATUS.CAPTURED]: 'חויב',
  [PAYMENT_STATUS.FAILED]: 'נכשל',
  [PAYMENT_STATUS.REFUNDED]: 'הוחזר',
}

/**
 * A channel is *how* an intent gets authorized, not a separate payment model.
 * Adding the physical reader later means adding a channel here and a dispatch
 * route on the backend — no change to the invoice or the intent lifecycle.
 */
export const PAYMENT_CHANNELS = {
  CARD_ONLINE: 'card_online',
  CARD_TERMINAL: 'card_terminal',
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
}

export const PAYMENT_CHANNEL_OPTIONS = [
  {
    id: PAYMENT_CHANNELS.CARD_ONLINE,
    label: 'אשראי מקוון',
    icon: 'credit_card',
    hint: 'סליקה דרך שער מאובטח',
    available: true,
  },
  {
    id: PAYMENT_CHANNELS.CARD_TERMINAL,
    label: 'מסוף פיזי',
    icon: 'point_of_sale',
    hint: 'העברת כרטיס בקורא שבדלפק',
    available: true,
  },
  {
    id: PAYMENT_CHANNELS.CASH,
    label: 'מזומן',
    icon: 'payments',
    hint: 'תיעוד בלבד · ללא סליקה',
    available: true,
  },
  {
    id: PAYMENT_CHANNELS.BANK_TRANSFER,
    label: 'העברה בנקאית',
    icon: 'account_balance',
    hint: 'סימון כשולם לאחר קליטת ההעברה',
    available: false,
  },
]

/** Line kinds an invoice accepts. Anything else is rejected server-side. */
export const INVOICE_LINE_KINDS = {
  TIRE: 'tire',
  SERVICE: 'service',
  PART: 'part',
  LABOR: 'labor',
  CUSTOM: 'custom',
}

export const INVOICE_LINE_KIND_LABELS = {
  [INVOICE_LINE_KINDS.TIRE]: 'צמיג',
  [INVOICE_LINE_KINDS.SERVICE]: 'שירות',
  [INVOICE_LINE_KINDS.PART]: 'חלף',
  [INVOICE_LINE_KINDS.LABOR]: 'עבודה',
  [INVOICE_LINE_KINDS.CUSTOM]: 'אחר',
}

export const MAX_INVOICE_LINES = 40
export const MAX_LINE_QUANTITY = 999

/** Hard ceiling so a malicious client can never request an unbounded page. */
export const MAX_PAGE_SIZE = 100
