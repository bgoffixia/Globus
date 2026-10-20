import { Link, useLocation } from 'wouter';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  Calculator,
  CircleHelp,
  CreditCard,
  House,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useClerk, useUser } from '@clerk/react';
import {
  getGetAdminAccessQueryKey,
  useGetAdminAccess,
} from '@workspace/api-client-react';
import { InstallAppButton } from '@/components/pwa-install-prompt';

const primaryLinks = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
];

const dashboardTools = [
  { href: '/dashboard', label: 'Home', ariaLabel: 'Dashboard overview', icon: LayoutDashboard },
  { href: '/wallets', label: 'Wallets', ariaLabel: 'Manage wallets', icon: WalletCards },
  { href: '/transactions', label: 'Activity', ariaLabel: 'Transaction activity', icon: ArrowLeftRight },
  { href: '/calculator', label: 'Convert', ariaLabel: 'Currency converter', icon: Calculator },
  { href: '/profile', label: 'Profile', ariaLabel: 'Your profile', icon: UserRound },
];

const moneyLinks = [
  { href: '/transfer', label: 'Transfer', icon: ArrowLeftRight },
  { href: '/add-money', label: 'Deposit request', icon: CreditCard },
  { href: '/withdraw', label: 'Withdrawal request', icon: ArrowDownLeft },
];

export function BankShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const isDashboard = location === '/dashboard';
  const isProfile = location === '/profile' || location === '/settings';
  const isSingleViewportPage = location === '/add-money' || location === '/calculator';
  const adminAccess = useGetAdminAccess({
    query: { queryKey: getGetAdminAccessQueryKey(), retry: false },
  });
  const initials = (user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? 'G').toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`bank-sidebar fixed inset-y-0 left-0 z-40 flex w-[min(252px,84vw)] flex-col transition-transform duration-200 lg:translate-x-0 ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[78px] items-center justify-between gap-2 px-4 sm:px-7">
          <Link href="/dashboard" aria-label="Globus Bank dashboard" className="bank-brand flex min-w-0 items-center gap-2 text-white sm:gap-3">
            <img src={`${import.meta.env.BASE_URL}globus-mark-transparent.png`} alt="" className="h-10 w-12 shrink-0 object-contain" />
            <span className="flex min-w-0 flex-col leading-none">
              <span className="text-[16px] font-extrabold tracking-tight">GLOBUS</span>
              <span className="mt-1 text-[8px] font-bold tracking-[0.3em] text-[#d1b05f]">BANK</span>
            </span>
          </Link>
          <button aria-label="Close navigation" onClick={() => setMobileMenu(false)} className="rounded-lg p-2 text-slate-300 lg:hidden">
            <X size={18} />
          </button>
        </div>
        <nav className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-4 pb-5">
          <NavGroup title="Your account" links={primaryLinks} location={location} onNavigate={() => setMobileMenu(false)} />
          <NavGroup title="Move money" links={moneyLinks} location={location} onNavigate={() => setMobileMenu(false)} />
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Resources</p>
            <Link href="/help" onClick={() => setMobileMenu(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-slate-300 transition hover:bg-white/[0.07] hover:text-white">
              <CircleHelp size={17} strokeWidth={1.8} />
              Help centre
            </Link>
            {adminAccess.data?.allowed && (
              <Link href="/admin" onClick={() => setMobileMenu(false)} className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-slate-300 transition hover:bg-white/[0.07] hover:text-white">
                <ShieldCheck size={17} strokeWidth={1.8} />
                Operations
              </Link>
            )}
          </div>
        </nav>
        <div className="border-t border-white/10 p-4">
          <InstallAppButton className="mb-3 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[.06] px-3 py-2.5 text-left text-[11px] font-semibold text-slate-200 transition hover:bg-white/10" />
          <div className="flex items-center gap-2 rounded-xl px-2 py-2">
            <Link href="/profile" aria-label="Open your profile" data-testid="link-sidebar-profile" onClick={() => setMobileMenu(false)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg">
              <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#d6eaf0] text-xs font-bold text-[#163753]">
                {user?.imageUrl ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" /> : initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{user?.fullName ?? 'Globus member'}</p>
                <p className="truncate text-[10px] text-slate-400">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
            </Link>
            <button aria-label="Sign out" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })} className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {mobileMenu && <button aria-label="Close menu overlay" className="fixed inset-0 z-30 bg-[#071729]/50 lg:hidden" onClick={() => setMobileMenu(false)} />}
      <div className="bank-main-column min-w-0 w-full lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex min-h-[64px] items-center justify-between gap-2 border-b border-[#e3e9ef] bg-[#f7f9fb]/95 px-3 py-2 backdrop-blur-md sm:h-[72px] sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button aria-label="Open navigation" onClick={() => setMobileMenu(true)} className="shrink-0 rounded-lg p-2 text-[#283c55] hover:bg-[#e9eff4] lg:hidden">
              <Menu size={19} />
            </button>
            <p className="min-w-0 truncate text-[11px] font-medium text-[#738297] sm:text-[12px]"><span className="hidden sm:inline">Globus Bank <span className="px-1.5 text-[#c5ced7]">/</span> </span><span className="text-[#253850]">{pageLabel(location)}</span></p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Link href="/home" aria-label="Return to Globus home" data-testid="link-app-home" className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#d6e8e9] bg-white px-2 text-[9px] font-bold text-[#377d83] hover:bg-[#eff8f8] sm:px-3 sm:text-[10px]">
              <House size={14} />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <InstallAppButton className="hidden items-center gap-1.5 rounded-lg border border-[#d6e8e9] bg-white px-2.5 py-2 text-[10px] font-bold text-[#377d83] hover:bg-[#eff8f8] sm:inline-flex" />
            <Link href="/profile" aria-label="Open your profile" data-testid="link-header-profile" className={`grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-[#dbe3eb] bg-white text-xs font-bold text-[#27445e] ${isProfile ? 'ring-2 ring-[#68a3a6] ring-offset-2' : ''}`}>
              {user?.imageUrl ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" /> : initials}
            </Link>
          </div>
        </header>
        <main className={`page-enter mx-auto min-w-0 w-full max-w-[1440px] px-4 lg:px-10 ${isSingleViewportPage ? 'h-[calc(100dvh-64px)] overflow-y-auto overscroll-contain py-3 sm:h-[calc(100dvh-72px)] sm:px-8 sm:py-4' : isDashboard ? 'pb-24 pt-3 sm:px-8 sm:pb-24 sm:pt-4' : 'py-4 sm:px-8 sm:py-6'} ${isProfile ? 'profile-content-scroll' : ''}`}>{children}</main>
      </div>
      {isDashboard && (
        <nav aria-label="Dashboard tools" data-testid="dashboard-bottom-toolbar" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[#dfe7ed] bg-white/95 px-1 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+.35rem)] shadow-[0_-8px_20px_rgba(20,47,81,.06)] backdrop-blur-md lg:left-[252px] lg:px-4">
          {dashboardTools.map(({ href, label, ariaLabel, icon: Icon }) => {
            const active = location === href || (href === '/transactions' && location.startsWith('/transactions'));
            return (
              <Link key={href} href={href} aria-label={ariaLabel} data-testid={`dashboard-tool-${href.slice(1)}`} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-center text-[8px] font-bold transition sm:text-[9px] ${active ? 'text-[#277a80]' : 'text-[#718297] hover:bg-[#f2f7f8] hover:text-[#315d6c]'}`}>
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function NavGroup({ title, links, location, onNavigate }: { title: string; links: typeof primaryLinks; location: string; onNavigate: () => void }) {
  return (
    <div>
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onClick={onNavigate} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition ${(location === href || (href === '/transfer' && location === '/international-transfer')) ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`}>
          <Icon size={17} strokeWidth={1.8} />
          {label}
        </Link>
      ))}
    </div>
  );
}

function pageLabel(path: string) {
  const labels: Record<string, string> = {
    '/dashboard': 'Overview',
    '/wallets': 'Wallets',
    '/transactions': 'Activity',
    '/calculator': 'Currency converter',
    '/international-transfer': 'Transfer',
    '/transfer': 'Transfer',
    '/add-money': 'Deposit request',
    '/withdraw': 'Withdrawal request',
    '/profile': 'Profile',
    '/settings': 'Profile',
    '/admin': 'Operations',
  };
  if (path.startsWith('/admin/users/')) return 'Member management';
  if (path.startsWith('/wallets/')) return 'Wallet details';
  return labels[path] ?? 'Account';
}
