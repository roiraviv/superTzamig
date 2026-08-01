import { Link } from 'react-router-dom'
import { HeroSection } from '../../components/home/HeroSection'
import { ReviewsSection } from '../../components/home/ReviewsSection'
import { ServiceShortcuts } from '../../components/home/ServiceShortcuts'
import { TeamSection } from '../../components/home/TeamSection'
import { Button } from '../../components/ui/Button'
import { GlassCard } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { CONTACT } from '../../lib/navigation'

const GUARANTEES = [
  {
    icon: 'shield',
    title: 'אחריות 24 חודשים',
    body: 'על כל עבודה ועל כל צמיג שמותקן אצלנו, בכתב ובלי אותיות קטנות.',
  },
  {
    icon: 'price_check',
    title: 'מחיר סופי מראש',
    body: 'ההצעה שאתם מאשרים היא הסכום שתשלמו. תוספת מחייבת אישור שלכם.',
  },
  {
    icon: 'schedule',
    title: 'בלי להמתין',
    body: 'תור מדויק לשעה. רוב הטיפולים מסתיימים תוך פחות משעה.',
  },
]

export function HomePage() {
  return (
    <div className="mx-auto max-w-(--container-page) space-y-16 px-4 md:px-10">
      <HeroSection />

      {/* Placed directly under the hero: entering a plate is the lowest-friction
          first step on the site, so it precedes the service shortcuts. */}
      <section className="glass-panel flex flex-col items-start gap-6 rounded-xl p-6 md:flex-row md:items-center md:justify-between md:p-10">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-container/15 text-primary-container">
            <Icon name="directions_car" size={26} />
          </span>
          <div>
            <h2 className="font-headline text-headline-md text-on-surface">
              לא יודעים איזו מידה הרכב שלכם לוקח?
            </h2>
            <p className="mt-1 max-w-xl text-body-md text-on-surface-variant">
              הזינו מספר רישוי ונציג רק צמיגים שמאושרים חוקית לרכב שלכם — כולל מחיר
              סופי עם התקנה ואיזון.
            </p>
          </div>
        </div>

        <Button as={Link} to="/tire-finder" size="lg" icon="search" className="shrink-0">
          איתור לפי מספר רישוי
        </Button>
      </section>

      <ServiceShortcuts />

      <section className="grid gap-4 md:grid-cols-3">
        {GUARANTEES.map((item) => (
          <GlassCard key={item.title} className="flex gap-4 p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary-container/15 text-secondary-container">
              <Icon name={item.icon} />
            </span>
            <div>
              <h3 className="font-headline text-headline-md text-on-surface">{item.title}</h3>
              <p className="mt-1 text-body-md text-on-surface-variant">{item.body}</p>
            </div>
          </GlassCard>
        ))}
      </section>

      <TeamSection />
      <ReviewsSection />

      <section className="glass-panel flex flex-col items-center gap-6 rounded-xl p-10 text-center">
        <h2 className="font-headline text-headline-lg text-on-surface">
          מוכנים להחליף צמיגים?
        </h2>
        <p className="max-w-xl text-body-lg text-on-surface-variant">
          בחרו צמיגים מהקטלוג וקבלו הצעת מחיר מלאה עם התקנה, איזון וסילוק ישן — בלי
          לצאת מהבית.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button as={Link} to="/catalog" size="lg" icon="tire_repair">
            לקטלוג הצמיגים
          </Button>
          <Button
            as="a"
            href={CONTACT.whatsappHref}
            target="_blank"
            rel="noreferrer noopener"
            variant="secondary"
            size="lg"
            icon="chat"
          >
            שיחה בוואטסאפ
          </Button>
        </div>
      </section>
    </div>
  )
}
