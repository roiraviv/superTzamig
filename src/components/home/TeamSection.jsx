import { contentApi } from '../../services/api'
import { useAsyncData } from '../../hooks/useAsyncData'
import { GlassCard, SectionHeading } from '../ui/Card'
import { Icon } from '../ui/Icon'
import { AsyncBoundary, EmptyState, Skeleton } from '../ui/StateViews'

/**
 * "The human behind the machine" — named, photographed technicians. This is the
 * single strongest trust signal on the page, so it sits above the reviews.
 */

function TeamCardSkeleton() {
  return (
    <div className="w-72 shrink-0 space-y-3">
      <Skeleton className="h-52 w-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

function TeamCard({ member }) {
  return (
    <GlassCard
      as="article"
      glow
      className="w-72 shrink-0 snap-start overflow-hidden transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="relative h-52 bg-surface-container">
        <img
          src={member.imageUrl}
          alt={`${member.name}, ${member.role}`}
          loading="lazy"
          className="size-full object-cover"
        />
        <span className="absolute bottom-2 end-2 rounded-full bg-background/80 px-2 py-1 text-label-sm text-secondary-container backdrop-blur-sm">
          {member.yearsOfExperience} שנות ניסיון
        </span>
      </div>

      <div className="space-y-2 p-4">
        <h3 className="text-label-md text-on-surface">{member.name}</h3>
        <p className="text-label-sm text-secondary-container">{member.role}</p>
        <p className="text-label-sm text-on-surface-variant/80">{member.specialty}</p>
        <blockquote className="border-t border-outline-variant/30 pt-3 text-body-md text-on-surface-variant italic">
          “{member.quote}”
        </blockquote>
      </div>
    </GlassCard>
  )
}

export function TeamSection() {
  const team = useAsyncData(({ signal }) => contentApi.getTeam({ signal }), [])

  return (
    <section className="space-y-6">
      <SectionHeading icon="engineering" title="האנשים שמאחורי המפתח" />
      <p className="max-w-2xl text-body-md text-on-surface-variant">
        אצלנו לא תדברו עם “נציג”. תכירו בשם את הטכנאי שמטפל ברכב שלכם, ותקבלו ממנו
        הסבר ישיר על כל עבודה.
      </p>

      <AsyncBoundary
        query={team}
        loading={
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 3 }, (_, index) => (
              <TeamCardSkeleton key={index} />
            ))}
          </div>
        }
        empty={
          <EmptyState
            icon="groups"
            title="פרטי הצוות בעדכון"
            description="אנחנו מרעננים את התמונות. בינתיים אפשר להתקשר ולדבר איתנו ישירות."
          />
        }
        errorTitle="לא הצלחנו לטעון את הצוות"
      >
        {(members) => (
          <div className="hide-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {members.map((member) => (
              <TeamCard key={member.id} member={member} />
            ))}

            <GlassCard className="flex w-72 shrink-0 snap-start flex-col items-center justify-center gap-2 p-6 text-center">
              <Icon name="workspace_premium" size={32} className="text-primary-container" />
              <p className="text-label-md text-on-surface">כל טכנאי מוסמך ומבוטח</p>
              <p className="text-label-sm text-on-surface-variant">
                הכשרה שנתית מחודשת אצל היבואנים
              </p>
            </GlassCard>
          </div>
        )}
      </AsyncBoundary>
    </section>
  )
}
