import { REVIEW_SOURCES, REVIEW_SOURCE_META } from '../../lib/constants'
import { formatNumber } from '../../lib/format'
import { Icon } from '../ui/Icon'

/**
 * Trust signals sized for three different moments.
 *
 * `MicroTrustBadge` rides alongside a CTA, `TrustRatingBar` heads a section, and
 * `SecurePaymentBadge` speaks to a completely different fear — the person with a
 * card in hand is worried about the form, not about the workmanship, so it says
 * nothing about stars.
 *
 * All of them render nothing when they have no data. A badge is reassurance
 * layered on a button that already works; it must never gate one or push layout
 * around while it loads.
 */

/* -------------------------------- Brand marks ----------------------------- */

/** Official Google "G". */
function GoogleMark({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

/**
 * Easy.co.il wordmark stand-in.
 *
 * Replace with the licensed asset before launch — this is a typographic
 * placeholder, not their real logo, and shipping an approximation of another
 * company's mark is a legal question rather than a design one.
 */
function EasyMark({ size }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-md bg-[#0f7ec4] font-sans font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.55, lineHeight: 1 }}
    >
      e
    </span>
  )
}

/** @param {{ source: 'google'|'easy', size?: number }} props */
export function SourceLogo({ source, size = 18 }) {
  const Mark = source === REVIEW_SOURCES.GOOGLE ? GoogleMark : EasyMark
  return (
    <span className="inline-flex shrink-0 items-center">
      <Mark size={size} />
    </span>
  )
}

/* --------------------------------- Stars ---------------------------------- */

/**
 * Five stars with a fractional fill, because rounding 4.8 up to five solid stars
 * reads as fake and rounding it down understates the rating.
 *
 * Forced to LTR: stars fill left-to-right on every review platform, so mirroring
 * them inside this RTL layout would put the partial star on the wrong end.
 */
export function StarRow({ rating, size = 16, className = '' }) {
  const clamped = Math.max(0, Math.min(5, Number(rating) || 0))
  const stars = Array.from({ length: 5 }, (_, index) => index)

  return (
    <span
      dir="ltr"
      role="img"
      aria-label={`דירוג ${clamped} מתוך 5`}
      className={`relative inline-flex shrink-0 ${className}`}
    >
      <span className="flex text-outline-variant/50">
        {stars.map((index) => (
          <Icon key={index} name="star" size={size} filled />
        ))}
      </span>
      <span
        className="absolute inset-y-0 start-0 overflow-hidden text-[#fbbc05]"
        style={{ width: `${(clamped / 5) * 100}%` }}
      >
        <span className="flex">
          {stars.map((index) => (
            <Icon key={index} name="star" size={size} filled />
          ))}
        </span>
      </span>
    </span>
  )
}

/* ------------------------------ Micro badges ------------------------------ */

function formatRating(rating) {
  return Number(rating).toFixed(1)
}

/**
 * One platform's rating, compact enough to sit inline with a button.
 *
 * @param {{ source: 'google'|'easy', rating: number, reviewCount?: number,
 *   profileUrl?: string, size?: 'sm'|'md' }} props
 */
export function SourceRatingBadge({ source, rating, reviewCount, profileUrl, size = 'sm' }) {
  const meta = REVIEW_SOURCE_META[source]
  if (!meta || !rating) return null

  const isSmall = size === 'sm'
  const content = (
    <>
      <SourceLogo source={source} size={isSmall ? 15 : 18} />
      <span className={isSmall ? 'text-label-sm' : 'text-label-md'}>
        <span className="font-semibold text-on-surface">{formatRating(rating)}</span>
        <span className="text-on-surface-variant"> · {meta.label}</span>
      </span>
      <StarRow rating={rating} size={isSmall ? 13 : 15} />
      {reviewCount ? (
        <span className="text-label-sm text-on-surface-variant/80">
          ({formatNumber(reviewCount)})
        </span>
      ) : null}
    </>
  )

  const shell = `inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-high/70 ${
    isSmall ? 'px-2.5 py-1' : 'px-3 py-1.5'
  }`

  if (!profileUrl) {
    return <span className={shell}>{content}</span>
  }

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`${shell} transition-colors hover:border-primary/50 hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      title={`צפו בביקורות ב-${meta.fullLabel}`}
    >
      {content}
      <Icon name="open_in_new" size={13} className="text-on-surface-variant/60" />
    </a>
  )
}

/**
 * The badge for high-friction CTAs: plate lookup, quote submit, booking.
 *
 * Both platforms in a single line rather than two separate pills — two
 * independent sources agreeing is the actual argument, and one line keeps it
 * from competing with the button it is supporting.
 *
 * @param {{ summary: object|null, className?: string }} props
 */
export function MicroTrustBadge({ summary, className = '' }) {
  if (!summary?.sources?.length) return null

  const rated = summary.sources.filter((entry) => entry.rating > 0)
  if (!rated.length) return null

  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm text-on-surface-variant ${className}`}
    >
      <StarRow rating={summary.averageRating} size={14} />
      <span className="text-on-surface">
        {formatRating(summary.averageRating)} מתוך 5
      </span>
      <span aria-hidden="true" className="text-outline-variant">
        ·
      </span>
      <span className="flex items-center gap-1.5">
        {rated.map((entry) => (
          <span key={entry.source} className="flex items-center gap-1">
            <SourceLogo source={entry.source} size={14} />
            <span>{REVIEW_SOURCE_META[entry.source]?.label}</span>
          </span>
        ))}
      </span>
      {summary.totalReviewCount ? (
        <span className="text-on-surface-variant/80">
          ({formatNumber(summary.totalReviewCount)} ביקורות)
        </span>
      ) : null}
    </p>
  )
}

/**
 * Section-level version: each platform gets its own card with a link out.
 *
 * @param {{ summary: object|null, className?: string }} props
 */
export function TrustRatingBar({ summary, className = '' }) {
  if (!summary?.sources?.length) return null

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {summary.sources.map((entry) => (
        <SourceRatingBadge
          key={entry.source}
          source={entry.source}
          rating={entry.rating}
          reviewCount={entry.reviewCount}
          profileUrl={entry.profileUrl}
          size="md"
        />
      ))}
      {summary.returningShare ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-high/70 px-3 py-1.5 text-label-md text-on-surface-variant">
          <Icon name="autorenew" size={16} className="text-secondary" />
          {Math.round(summary.returningShare * 100)}% מהלקוחות חוזרים
        </span>
      ) : null}
    </div>
  )
}

/**
 * The payment-step signal.
 *
 * Stars are the wrong reassurance here. Someone typing a card number wants to
 * know where the digits go, so this states the gateway posture and what is never
 * persisted, in plain language.
 */
export function SecurePaymentBadge({ className = '' }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-lg border border-secondary-container/30 bg-secondary-container/8 px-4 py-3 text-label-sm text-on-surface-variant ${className}`}
    >
      <Icon name="shield_lock" size={16} className="mt-0.5 shrink-0 text-secondary-container" />
      <span>
        פרטי הכרטיס נשלחים מוצפנים ישירות לשער הסליקה המאובטח (PCI-DSS Level 1). במערכת שלנו
        נשמרים רק ארבע הספרות האחרונות והתוקף — מספר הכרטיס וה-CVV אינם נשמרים ואינם עוברים
        בשרתי המוסך.
      </span>
    </p>
  )
}
