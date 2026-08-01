import { Link } from 'react-router-dom'
import { contentApi } from '../../services/api'
import { useAsyncData } from '../../hooks/useAsyncData'
import { formatNumber } from '../../lib/format'
import { HERO_IMAGE } from '../../lib/media'
import { CONTACT } from '../../lib/navigation'
import { useReviewSummary } from '../../hooks/useReviewSummary'
import { MicroTrustBadge } from '../trust/TrustBadges'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Skeleton } from '../ui/StateViews'

/**
 * Above-the-fold conversion block.
 *
 * Two competing actions only — book and quote — with the phone number as a
 * third, lower-commitment escape hatch. Trust proof sits directly beneath the
 * buttons because it is what removes hesitation at the click, not later.
 */

function TrustStat({ value, label, loading }) {
  return (
    <div className="flex flex-col">
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <span className="font-headline text-headline-md text-on-surface">{value}</span>
      )}
      <span className="text-label-sm text-on-surface-variant">{label}</span>
    </div>
  )
}

export function HeroSection() {
  const stats = useAsyncData(({ signal }) => contentApi.getTrustStats({ signal }), [])
  const summary = useReviewSummary()
  const data = stats.data

  return (
    <section className="relative mt-6 overflow-hidden rounded-xl">
      <div className="absolute inset-0 z-0">
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden="true"
          loading="eager"
          fetchPriority="high"
          className="size-full object-cover opacity-45"
        />
        {/* Directional scrim keeps the headline readable over any part of the photo. */}
        <div className="absolute inset-0 bg-linear-to-l from-background via-background/85 to-background/30" />
        <div className="absolute inset-0 bg-linear-to-t from-background to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-[34rem] flex-col justify-center gap-6 p-6 md:p-16">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-secondary-container/40 bg-secondary-container/10 px-3 py-1.5 text-label-sm text-secondary-container">
          <Icon name="verified" size={16} filled />
          מוסך מורשה · אחריות 24 חודשים על כל עבודה
        </span>

        <h1 className="max-w-3xl font-headline text-headline-lg text-on-surface md:text-headline-xl">
          סופר צמיג
          <br />
          <span className="text-primary-container">בטיחות וביצועים מעל הכל</span>
        </h1>

        <p className="max-w-xl text-body-lg text-on-surface-variant">
          חוויית שירות ברמה אחרת: צמיגי פרימיום במלאי, איזון ממוחשב תלת־ממדי וצוות
          מומחים שמטפל ברכב שלכם כאילו היה שלו. הצעת מחיר שקופה תוך דקה.
        </p>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          <Button as={Link} to="/book" size="lg" icon="calendar_today">
            קביעת תור מיידית
          </Button>
          <Button as={Link} to="/quote" variant="secondary" size="lg" icon="request_quote">
            קבלת הצעת מחיר
          </Button>
          <Button
            as="a"
            href={CONTACT.phoneHref}
            variant="tertiary"
            size="lg"
            icon="call"
            className="text-on-surface-variant hover:text-on-surface"
          >
            {CONTACT.phone}
          </Button>
        </div>

        {/* First impression of external validation, directly under the primary CTAs. */}
        <MicroTrustBadge summary={summary.data} />

        {stats.isError ? (
          // Proof is a nice-to-have; a failed stats call must never block the CTAs.
          <p className="text-label-sm text-on-surface-variant/60">
            נתוני הביצועים אינם זמינים כרגע.
          </p>
        ) : (
          <dl className="mt-6 grid max-w-2xl grid-cols-2 gap-6 border-t border-outline-variant/30 pt-6 sm:grid-cols-4">
            <TrustStat
              loading={stats.isLoading}
              value={`${formatNumber(data?.vehiclesServiced)}+`}
              label="כלי רכב טופלו"
            />
            <TrustStat
              loading={stats.isLoading}
              value={`${data?.averageRating ?? ''} ★`}
              label="דירוג לקוחות ממוצע"
            />
            <TrustStat
              loading={stats.isLoading}
              value={data?.yearsInBusiness}
              label="שנות ניסיון"
            />
            <TrustStat
              loading={stats.isLoading}
              value={data?.certifiedTechnicians}
              label="טכנאים מוסמכים"
            />
          </dl>
        )}
      </div>
    </section>
  )
}
