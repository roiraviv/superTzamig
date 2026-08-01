import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { ADMIN_NAV } from '../../lib/navigation'
import { Icon } from '../ui/Icon'

function NavItem({ item, onNavigate }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-4 py-3 pe-6 ps-6 text-label-md transition-all duration-200 active:-translate-x-1 rtl:active:translate-x-1',
          'me-4 rounded-e-full',
          isActive
            ? 'bg-secondary-container text-on-secondary-container shadow-md'
            : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} filled={isActive} />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

export function AdminSidebar({ user, onLogout, onNavigate, className }) {
  return (
    <div className={cn('flex h-full flex-col bg-surface-container-low py-10', className)}>
      <div className="mb-8 px-6">
        <p className="font-headline text-headline-lg font-bold tracking-tighter text-primary-container">
          סופר צמיג
        </p>
        <p className="text-label-sm text-on-surface-variant">מערכת ניהול מוסך</p>
      </div>

      <div className="mb-8 flex items-center gap-4 px-6">
        <img
          src={user?.avatarUrl}
          alt=""
          className="size-12 rounded-full border-2 border-secondary-container object-cover"
        />
        <div>
          <p className="text-label-md text-on-surface">{user?.name}</p>
          <p className="text-label-sm text-on-surface-variant">{user?.station}</p>
          <p className="mt-1 flex items-center gap-1.5 text-label-sm text-secondary-container">
            <span className="size-2 rounded-full bg-secondary-container" />
            מחובר
          </p>
        </div>
      </div>

      <nav aria-label="ניווט ניהול" className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-2">
          {ADMIN_NAV.map((item) => (
            <li key={item.to}>
              <NavItem item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto space-y-1 px-6 pt-6">
        <NavLink
          to="/"
          className="flex items-center gap-3 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="open_in_new" size={20} />
          לאתר הציבורי
        </NavLink>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 py-2 text-label-md text-on-surface-variant transition-colors hover:text-error"
        >
          <Icon name="logout" size={20} />
          התנתקות
        </button>
      </div>
    </div>
  )
}
