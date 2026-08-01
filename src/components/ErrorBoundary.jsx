import { Component } from 'react'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'

/**
 * Last line of defence against a render-time crash taking down the whole app.
 * Error boundaries have no hook equivalent, so this stays a class component.
 */
export class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // In production this is where the monitoring client (Sentry et al.) goes.
    // The raw error is never rendered — it can contain internal details.
    console.error('Unhandled UI error', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-error-container/25 text-error">
          <Icon name="error" size={32} />
        </span>
        <h1 className="font-headline text-headline-lg text-on-surface">משהו נשבר אצלנו</h1>
        <p className="max-w-md text-body-lg text-on-surface-variant">
          נתקלנו בתקלה בלתי צפויה. רענון הדף בדרך כלל פותר את זה — ואם לא, אנחנו כאן
          בטלפון.
        </p>
        <Button icon="refresh" onClick={() => window.location.reload()}>
          רענון הדף
        </Button>
      </div>
    )
  }
}
