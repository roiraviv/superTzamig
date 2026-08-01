import { Link } from 'react-router-dom'
import { SmartTireSelector } from '../../components/catalog/SmartTireSelector'
import { Button } from '../../components/ui/Button'

export function TireFinderPage() {
  return (
    <div className="mx-auto max-w-(--container-page) space-y-6 px-4 py-6 md:px-10">
      <header className="space-y-2">
        <h1 className="font-headline text-headline-lg text-on-surface md:text-headline-xl">
          איתור צמיגים לפי רכב
        </h1>
        <p className="max-w-2xl text-body-lg text-on-surface-variant">
          מספר רישוי אחד, ואנחנו מסננים את הקטלוג לצמיגים שמאושרים חוקית לרכב שלכם.
          ללא מידות, ללא ניחושים ובלי לצאת מהבית.
        </p>
      </header>

      <SmartTireSelector />

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant/25 pt-6">
        <p className="text-body-md text-on-surface-variant">
          מעדיפים לחפש לפי מידה או יצרן?
        </p>
        <Button as={Link} to="/catalog" variant="tertiary" icon="tire_repair">
          לקטלוג המלא
        </Button>
      </footer>
    </div>
  )
}
