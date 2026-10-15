import { Link, useLocation } from 'wouter';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useClerk, useUser } from '@clerk/react';
import {
  getGetAdminAccessQueryKey,
  useGetAdminAccess,
} from '@workspace/api-client-react';

const primaryLinks = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/wallets', label: 'Wallets', icon: WalletCards },
  { href: '/transactions', label: 'Activity', icon: ArrowLeftRight },
];

const moneyLinks = [
  { href: '/send', label: 'Send', icon: ArrowUpRight },
  { href: '/receive', label: 'Receive', icon: ArrowDownLeft },
  { href: '/add-money', label: 'Deposit request', icon: CreditCard },
  { href: '/withdraw', label: 'Withdrawal request', icon: ArrowDownLeft },
];

export function BankShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const adminAccess = useGetAdminAccess({
    query: { queryKey: getGetAdminAccessQueryKey(), retry: false },
  });
  const initials = (user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? 'G').toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`bank-sidebar fixed inset-y-0 left-0 z-40 flex w-[min(252px,84vw)] flex-col transition-transform duration-200 lg:translate-x-0 ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[78px] items-center justify-between px-7">
          <Link href="/dashboard" className="bank-brand flex items-center gap-3 text-[20px] font-extrabold text-white">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#c8a75c] text-[15px] font-extrabold text-[#102747]">G</span>
            globus
          </Link>
          <button aria-label="Close navigation" onClick={() => setMobileMenu(false)} className="rounded-lg p-2 text-slate-300 lg:hidden">
            <X size={18} />
          </button>
        </div>
        <div className="mx-6 mb-5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8ed4dc]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7fc9d1]" />
            Internal ledger
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">Globus records only · no outside funds</p>
        </div>
        <nav className="flex-1 space-y-7 overflow-y-auto px-4 pb-5">
          <NavGroup title="Your account" links={primaryLinks} location={location} onNavigate={() => setMobileMenu(false)} />
          <NavGroup title="Move money" links={moneyLinks} location={location} onNavigate={() => setMobileMenu(false)} />
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Manage</p>
            <Link href="/settings" onClick={() => setMobileMenu(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition ${location === '/settings' ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`}>
              <Settings2 size={17} strokeWidth={1.8} />
              Settings
            </Link>
          </div>
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
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#d6eaf0] text-xs font-bold text-[#163753]">
              {user?.imageUrl ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user?.fullName ?? 'Globus member'}</p>
              <p className="truncate text-[10px] text-slate-400">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
            <button aria-label="Sign out" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })} className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {mobileMenu && <button aria-label="Close menu overlay" className="fixed inset-0 z-30 bg-[#071729]/50 lg:hidden" onClick={() => setMobileMenu(false)} />}
      <div className="min-h-screen min-h-[100dvh] min-w-0 w-full lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex min-h-[64px] items-center justify-between gap-2 border-b border-[#e3e9ef] bg-[#f7f9fb]/95 px-3 py-2 backdrop-blur-md sm:h-[72px] sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button aria-label="Open navigation" onClick={() => setMobileMenu(true)} className="shrink-0 rounded-lg p-2 text-[#283c55] hover:bg-[#e9eff4] lg:hidden">
              <Menu size={19} />
            </button>
            <p className="min-w-0 truncate text-[11px] font-medium text-[#738297] sm:text-[12px]"><span className="hidden sm:inline">Globus Bank <span className="px-1.5 text-[#c5ced7]">/</span> </span><span className="text-[#253850]">{pageLabel(location)}</span></p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full border border-[#d6e8e9] bg-[#eff8f8] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#377d83] sm:inline-flex">Internal ledger</span>
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-[#dbe3eb] bg-white text-xs font-bold text-[#27445e]">
              {user?.imageUrl ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" /> : initials}
            </div>
          </div>
        </header>
        <main className="page-enter mx-auto min-w-0 w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-9 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

function NavGroup({ title, links, location, onNavigate }: { title: string; links: typeof primaryLinks; location: string; onNavigate: () => void }) {
  return (
    <div>
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onClick={onNavigate} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition ${location === href ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`}>
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
    '/send': 'Send money',
    '/receive': 'Receive',
    '/add-money': 'Deposit request',
    '/withdraw': 'Withdrawal request',
    '/settings': 'Settings',
    '/admin': 'Operations',
  };
  return path.startsWith('/admin/users/') ? 'Member management' : labels[path] ?? 'Account';
}
