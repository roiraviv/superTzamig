/**
 * `shortLabel` is what the mobile bottom bar renders: five thumb targets have to
 * share a 360px viewport, so the full label only appears in the top nav.
 */
export const PUBLIC_NAV = [
  { to: '/', label: 'בית', shortLabel: 'בית', icon: 'home', end: true },
  {
    to: '/tire-finder',
    label: 'איתור לפי רכב',
    shortLabel: 'לפי רכב',
    icon: 'directions_car',
  },
  { to: '/catalog', label: 'קטלוג צמיגים', shortLabel: 'קטלוג', icon: 'tire_repair' },
  { to: '/book', label: 'קביעת תור', shortLabel: 'תור', icon: 'calendar_today' },
  { to: '/quote', label: 'הצעת מחיר', shortLabel: 'הצעה', icon: 'request_quote' },
]

export const ADMIN_NAV = [
  { to: '/admin', label: 'לוח בקרה', icon: 'dashboard', end: true },
  { to: '/admin/appointments', label: 'תורים', icon: 'event_note' },
  { to: '/admin/inventory', label: 'מלאי', icon: 'inventory_2' },
  { to: '/admin/quotes', label: 'הצעות מחיר', icon: 'request_quote' },
  { to: '/admin/billing', label: 'חשבוניות', icon: 'receipt_long' },
]

const LATITUDE = 32.0524
const LONGITUDE = 34.7889

export const CONTACT = {
  phone: '03-555-0100',
  phoneHref: 'tel:+97235550100',
  whatsappHref: 'https://wa.me/97235550100',
  address: 'האומן 12, אזור התעשייה, תל אביב',
  hours: 'א׳–ה׳ 08:00–18:00 · ו׳ 08:00–13:00',
  latitude: LATITUDE,
  longitude: LONGITUDE,
}

/**
 * Turn-by-turn links.
 *
 * Coordinates rather than a text address: a mistyped street name sends someone
 * to the wrong industrial park, and "I couldn't find it" is a lost job. Waze
 * comes first because it is what most Israeli drivers actually have open.
 */
export const NAVIGATION_LINKS = [
  {
    id: 'waze',
    label: 'ניווט ב-Waze',
    icon: 'navigation',
    href: `https://waze.com/ul?ll=${LATITUDE},${LONGITUDE}&navigate=yes`,
  },
  {
    id: 'google-maps',
    label: 'ניווט ב-Google Maps',
    icon: 'map',
    href: `https://www.google.com/maps/dir/?api=1&destination=${LATITUDE},${LONGITUDE}`,
  },
]
