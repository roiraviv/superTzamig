import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/StateViews'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <EmptyState
        icon="wrong_location"
        title="הדף לא נמצא"
        description="הכתובת שביקשתם לא קיימת. אולי הגלגל התגלגל רחוק מדי."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button as={Link} to="/" icon="home">
              לדף הבית
            </Button>
            <Button as={Link} to="/catalog" variant="secondary" icon="tire_repair">
              לקטלוג הצמיגים
            </Button>
          </div>
        }
      />
    </div>
  )
}
