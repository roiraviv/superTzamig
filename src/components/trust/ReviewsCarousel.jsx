import { useCallback, useEffect, useRef, useState } from 'react'
import { REVIEW_SOURCE_META } from '../../lib/constants'
import { formatNumber, formatRelativeTime, initialsOf } from '../../lib/format'
import { Icon } from '../ui/Icon'
import { SourceLogo, StarRow } from './TrustBadges'

/**
 * Review cards laid out the way Google and Easy lay them out — avatar, name,
 * reviewer history, stars, relative date, owner reply.
 *
 * The borrowed layout is the point: a review that looks like it was designed by
 * us reads as marketing copy, while one that looks like the platform it came from
 * reads as someone else's opinion. Each card keeps its source badge for the same
 * reason.
 */

/** Deterministic avatar tint, so a given reviewer always looks the same. */
const AVATAR_TINTS = [
  'bg-primary/20 text-primary-container',
  'bg-secondary/20 text-secondary',
  'bg-tertiary/20 text-tertiary',
  'bg-[#0f7ec4]/20 text-[#7cc4ee]',
]

function tintFor(name) {
  const seed = String(name ?? '')
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0)
  return AVATAR_TINTS[seed % AVATAR_TINTS.length]
}

function ReviewCard({ review }) {
  const meta = REVIEW_SOURCE_META[review.source]

  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex size-11 shrink-0 items-center justify-center rounded-full text-label-lg font-semibold ${tintFor(review.author)}`}
        >
          {initialsOf(review.author)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-label-lg text-on-surface">{review.author}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-label-sm text-on-surface-variant/80">
            {review.isLocalGuide ? (
              <>
                <span className="flex items-center gap-1">
                  <Icon name="verified" size={13} filled className="text-[#4285f4]" />
                  Local Guide
                </span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            {review.reviewCount ? <span>{formatNumber(review.reviewCount)} ביקורות</span> : null}
          </p>
        </div>

        {meta ? (
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container-high/70 px-2 py-1"
            title={`ביקורת מ-${meta.fullLabel}`}
          >
            <SourceLogo source={review.source} size={14} />
            <span className="text-label-sm text-on-surface-variant">{meta.label}</span>
          </span>
        ) : null}
      </header>

      <div className="flex items-center gap-2">
        <StarRow rating={review.rating} size={15} />
        <span className="text-label-sm text-on-surface-variant/80">
          {formatRelativeTime(review.createdAt)}
        </span>
      </div>

      <blockquote className="flex-1 text-body-md leading-relaxed text-on-surface-variant">
        {review.body}
      </blockquote>

      {review.service ? (
        <p className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
          <Icon name="build" size={14} className="text-secondary" />
          {review.service}
        </p>
      ) : null}

      {review.ownerReply ? (
        <div className="rounded-xl border-s-2 border-primary/50 bg-surface-container-high/50 p-3">
          <p className="flex items-center gap-1.5 text-label-sm text-on-surface">
            <Icon name="storefront" size={14} className="text-primary" />
            תשובת סופר צמיג
          </p>
          <p className="mt-1 text-label-md leading-relaxed text-on-surface-variant">
            {review.ownerReply}
          </p>
        </div>
      ) : null}
    </article>
  )
}

/**
 * Horizontal scroller.
 *
 * Built on native scroll-snap rather than a JS-driven transform so that touch
 * momentum, trackpad scrolling and keyboard paging all behave the way the OS
 * already does them. The arrows just nudge `scrollLeft`; they are a convenience
 * on top of scrolling, never the only way through.
 *
 * @param {{ reviews: Array<object> }} props
 */
export function ReviewsCarousel({ reviews }) {
  const scrollerRef = useRef(null)
  const [edges, setEdges] = useState({ atStart: true, atEnd: false })

  const syncEdges = useCallback(() => {
    const node = scrollerRef.current
    if (!node) return

    /**
     * `scrollLeft` runs negative in RTL, and the exact convention differs
     * between engines. Normalising to a distance travelled keeps the arrow
     * disabling correct in both directions.
     */
    const travelled = Math.abs(node.scrollLeft)
    const maxTravel = node.scrollWidth - node.clientWidth
    setEdges({
      atStart: travelled <= 4,
      atEnd: travelled >= maxTravel - 4,
    })
  }, [])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return undefined

    syncEdges()
    node.addEventListener('scroll', syncEdges, { passive: true })

    const observer = new ResizeObserver(syncEdges)
    observer.observe(node)

    return () => {
      node.removeEventListener('scroll', syncEdges)
      observer.disconnect()
    }
  }, [syncEdges, reviews])

  /** @param {1|-1} direction 1 advances toward later cards, in reading order. */
  const page = (direction) => {
    const node = scrollerRef.current
    if (!node) return

    const step = Math.max(240, node.clientWidth * 0.8)
    /** RTL flips the sign of scroll movement relative to reading order. */
    const isRtl = getComputedStyle(node).direction === 'rtl'
    node.scrollBy({ left: step * direction * (isRtl ? -1 : 1), behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <ul
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        tabIndex={0}
        aria-label="ביקורות לקוחות"
      >
        {reviews.map((review) => (
          <li
            key={review.id ?? review._id}
            className="w-[85vw] shrink-0 snap-start sm:w-[22rem] lg:w-[24rem]"
          >
            <ReviewCard review={review} />
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-end gap-2">
        <CarouselButton
          icon="chevron_right"
          label="הביקורות הקודמות"
          disabled={edges.atStart}
          onClick={() => page(-1)}
        />
        <CarouselButton
          icon="chevron_left"
          label="הביקורות הבאות"
          disabled={edges.atEnd}
          onClick={() => page(1)}
        />
      </div>
    </div>
  )
}

function CarouselButton({ icon, label, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high text-on-surface transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-outline-variant/40 disabled:hover:text-on-surface"
    >
      <Icon name={icon} size={22} />
    </button>
  )
}
