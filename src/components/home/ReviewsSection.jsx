import { useReviewSummary } from '../../hooks/useReviewSummary'
import { useAsyncData } from '../../hooks/useAsyncData'
import { contentApi } from '../../services/api'
import { NavigationActions } from '../trust/NavigationActions'
import { ReviewsCarousel } from '../trust/ReviewsCarousel'
import { TrustRatingBar } from '../trust/TrustBadges'
import { SectionHeading } from '../ui/Card'
import { AsyncBoundary, EmptyState, Skeleton } from '../ui/StateViews'

/**
 * Social proof block.
 *
 * The aggregates and the review bodies load independently: the rating bar is the
 * part that actually moves conversion, so it appears as soon as it can rather
 * than waiting on six review texts. The navigation links close the section
 * because "these people are good" naturally leads to "so where are they".
 */
export function ReviewsSection() {
  const summary = useReviewSummary()
  const reviews = useAsyncData(({ signal }) => contentApi.getReviews({ signal, limit: 8 }), [])

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          icon="star"
          iconTone="text-primary-container"
          title="מה הלקוחות מספרים"
          description="ביקורות אמיתיות מ-Google ומ-Easy.co.il, כפי שנכתבו שם."
        />
        {summary.data ? <TrustRatingBar summary={summary.data} className="md:justify-end" /> : null}
      </div>

      <AsyncBoundary
        query={reviews}
        loading={
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-64 w-[85vw] shrink-0 sm:w-[22rem] lg:w-[24rem]" />
            ))}
          </div>
        }
        empty={
          <EmptyState
            icon="reviews"
            title="עוד אין ביקורות להצגה"
            description="הביקורת הראשונה יכולה להיות שלכם — נשמח לשמוע אחרי הטיפול הבא."
          />
        }
        errorTitle="לא הצלחנו לטעון ביקורות"
      >
        {(items) => <ReviewsCarousel reviews={items} />}
      </AsyncBoundary>

      <NavigationActions className="border-t border-outline-variant/25 pt-6" />
    </section>
  )
}
