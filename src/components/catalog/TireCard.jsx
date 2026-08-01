import { useState } from 'react'
import { cn } from '../../lib/cn'
import { formatCurrency } from '../../lib/format'
import { LOW_STOCK_THRESHOLD } from '../../lib/constants'
import { Button } from '../ui/Button'
import { GlassCard } from '../ui/Card'
import { Icon } from '../ui/Icon'

/** Treadwear/traction bars — the "tire spec visualizer" from the design system. */
function SpecMeter({ label, value, percent, tone }) {
  return (
    <div className="flex-1">
      <div className="mb-1 flex justify-between text-label-sm text-on-surface-variant">
        <span>{label}</span>
        <span className={tone === 'primary' ? 'text-primary-container' : 'text-secondary'}>
          {value}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-container-highest">
        <div
          className={cn(
            'h-full rounded-full',
            tone === 'primary' ? 'bg-primary-container' : 'bg-secondary',
          )}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  )
}

const TRACTION_PERCENT = { AA: 100, A: 80, B: 60, C: 40 }

function StockLine({ stock }) {
  if (stock === 0) {
    return (
      <span className="flex items-center gap-1.5 text-label-sm text-error">
        <span className="size-2 rounded-full bg-error" />
        אזל מהמלאי · ניתן להזמין
      </span>
    )
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return (
      <span className="flex items-center gap-1.5 text-label-sm text-primary-container">
        <span className="size-2 rounded-full bg-primary-container" />
        נותרו {stock} יחידות בלבד
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-label-sm text-success">
      <span className="size-2 rounded-full bg-success" />
      במלאי · התקנה מיידית
    </span>
  )
}

export function TireCard({ tire, inQuote, onAddToQuote }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <GlassCard
      as="article"
      glow
      className="group flex flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="relative flex h-48 items-center justify-center bg-surface-container-lowest p-6">
        {imageFailed ? (
          <Icon name="tire_repair" size={64} className="text-outline-variant" />
        ) : (
          <img
            src={tire.imageUrl}
            alt={`צמיג ${tire.brand} ${tire.model} במידה ${tire.size}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="size-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
          />
        )}

        {tire.badge && (
          <span className="absolute top-4 start-4 rounded-sm bg-primary-container px-2 py-1 text-label-sm text-on-primary-container">
            {tire.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <p className="mb-1 text-label-sm tracking-wider text-on-surface-variant uppercase">
            {tire.brand}
          </p>
          <h3 className="mb-2 font-headline text-headline-md text-on-surface">{tire.model}</h3>

          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-sm border border-outline-variant/50 bg-surface-container-high px-2 py-1 text-label-sm text-tertiary">
              {tire.size}
            </span>
            <span className="rounded-sm border border-outline-variant/50 bg-surface-container-high px-2 py-1 text-label-sm text-tertiary">
              {tire.highlight}
            </span>
          </div>

          <StockLine stock={tire.stock} />
        </div>

        <div className="mt-auto flex gap-4">
          <SpecMeter
            label="עמידות"
            value={tire.treadwear}
            percent={(tire.treadwear / 520) * 100}
            tone="secondary"
          />
          <SpecMeter
            label="אחיזה"
            value={tire.traction}
            percent={TRACTION_PERCENT[tire.traction] ?? 50}
            tone="primary"
          />
        </div>

        <div className="flex items-end justify-between gap-3 border-t border-outline-variant/25 pt-4">
          <p className="font-headline text-headline-md text-on-surface">
            {formatCurrency(tire.price)}
            <span className="text-body-md font-normal text-on-surface-variant"> ליחידה</span>
          </p>

          <Button
            variant={inQuote ? 'secondary' : 'primary'}
            size="sm"
            icon={inQuote ? 'check' : 'add'}
            onClick={() => onAddToQuote(tire)}
            aria-label={
              inQuote
                ? `${tire.brand} ${tire.model} כבר בהצעה, הוספת סט נוסף`
                : `הוספת ${tire.brand} ${tire.model} להצעת מחיר`
            }
          >
            {inQuote ? 'בהצעה' : 'להצעה'}
          </Button>
        </div>
      </div>
    </GlassCard>
  )
}
