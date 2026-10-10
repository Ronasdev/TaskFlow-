import {
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { Avatar } from '@/components/ui/display';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth, useCurrentUser } from '@/features/auth/auth-context';
import { THEME_OPTIONS, useTheme } from '../theme-context';
import { Logo } from './Logo';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tâches', icon: ListTodo },
  { to: '/projects', label: 'Projets', icon: FolderKanban },
  { to: '/profile', label: 'Profil', icon: UserRound },
];

/**
 * Mise en page adaptative (docs/FRONTEND.md §6) :
 * < 768 px : barre de navigation inférieure ; 768–1279 px : sidebar d'icônes ; ≥ 1280 px : sidebar complète.
 */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Aller au contenu
      </a>

      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface md:flex',
          collapsed ? 'w-18' : 'w-18 xl:w-64',
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link to="/" aria-label="TaskFlow, accueil">
            <Logo compact className={cn(!collapsed && 'xl:hidden')} />
            <Logo className={cn('hidden', !collapsed && 'xl:inline-flex')} />
          </Link>
        </div>
        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1 px-3 py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted hover:bg-surface-muted hover:text-foreground',
                )
              }
            >
              <item.icon className="size-5 shrink-0" aria-hidden />
              <span className={cn('hidden', !collapsed && 'xl:inline')}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="m-3 hidden h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-surface-muted xl:flex"
          aria-label={collapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
        >
          {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6 lg:px-8">
          <Link to="/" className="md:hidden" aria-label="TaskFlow, accueil">
            <Logo />
          </Link>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 sm:px-6 md:pb-10 lg:px-8"
        >
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium',
                isActive ? 'text-primary' : 'text-muted',
              )
            }
          >
            <item.icon className="size-5" aria-hidden />
            {item.label === 'Tableau de bord' ? 'Accueil' : item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function UserMenu() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex cursor-pointer items-center gap-2 rounded-full p-1 pr-3 transition-colors hover:bg-surface-muted"
        aria-label="Menu utilisateur"
      >
        <Avatar name={user.name} className="size-8" />
        <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Thème</DropdownMenuLabel>
        {THEME_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            icon={<option.icon className="size-4" />}
            onSelect={() => setTheme(option.value)}
            className={cn(theme === option.value && 'text-primary')}
            aria-checked={theme === option.value}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut className="size-4" />} onSelect={() => void logout()}>
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
