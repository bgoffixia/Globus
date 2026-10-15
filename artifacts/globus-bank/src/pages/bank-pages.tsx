import { Link, useRoute } from 'wouter';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  FileText,
  Globe2,
  History,
  LockKeyhole,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminAccessQueryKey,
  getGetAdminIdentityDocumentContentUrl,
  getGetAdminSummaryQueryKey,
  getGetAdminUserDetailQueryKey,
  getGetBankDashboardQueryKey,
  getGetBankProfileQueryKey,
  getHealthCheckQueryKey,
  getListAdminLedgerQueryKey,
  getListAdminLedgerRequestsQueryKey,
  getListAdminTransactionStatusHistoryQueryKey,
  getListAdminIdentityDocumentsQueryKey,
  getListAdminUsersQueryKey,
  getListMyIdentityDocumentsQueryKey,
  getListBankTransactionsQueryKey,
  getListBankWalletsQueryKey,
  useCreateAdminFunding,
  useCreateIdentityDocumentUploadUrl,
  useCompleteIdentityDocumentUpload,
  useCreateBankTransfer,
  useCreateLedgerRequest,
  useDeleteAdminTransaction,
  useGetAdminAccess,
  useGetAdminSummary,
  useGetAdminUserDetail,
  useGetBankDashboard,
  useGetBankProfile,
  useHealthCheck,
  useListAdminLedger,
  useListAdminLedgerRequests,
  useListAdminTransactionStatusHistory,
  useListAdminIdentityDocuments,
  useListAdminUsers,
  useListMyIdentityDocuments,
  useListBankTransactions,
  useListBankWallets,
  useUpdateAdminUserStatus,
  useUpdateAdminTransactionStatus,
  useUpdateAdminUserVerification,
  useReviewAdminLedgerRequest,
  useResetAdminUserTransactionPin,
  useUpdateTransactionPin,
  useUpdateBankProfile,
  useDeleteMyIdentityDocument,
  useSubmitIdentityDocuments,
} from '@workspace/api-client-react';
import type { AdminLedgerRequest, AdminUser, BankTransaction, IdentityDocument, Wallet } from '@workspace/api-client-react';
import { GlobusLoader } from '@/components/globus-loader';
import { downloadTransactionReceiptPdf } from '@/lib/transaction-receipt-pdf';
const currencies = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD'] as const;
type Currency = typeof currencies[number];
const currencyNames: Record<Currency, string> = {
  USD: 'US dollar',
  EUR: 'Euro',
  GBP: 'Pound sterling',
  NGN: 'Nigerian naira',
  CAD: 'Canadian dollar',
  AUD: 'Australian dollar',
};

export function HomePage() {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false } });
  return (
    <div className="min-h-screen min-h-[100dvh] overflow-x-clip bg-[#f6f8fa] text-[#192e49]">
      <header className="relative z-10 mx-auto flex max-w-[1320px] items-center justify-between gap-2 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-5 sm:gap-3 sm:px-6 sm:py-6 lg:px-12">
        <Link href="/" aria-label="Globus Bank home" className="flex shrink-0 items-center">
          <img src={`${import.meta.env.BASE_URL}globus-wordmark.png`} alt="Globus Bank — Your world. Our priority." className="h-auto w-[108px] sm:w-[156px]" />
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] font-medium text-[#607187] md:flex">
          <Link href="/about" className="hover:text-[#142d4d]">About</Link>
          <Link href="/fees" className="hover:text-[#142d4d]">Fees</Link>
          <Link href="/help" className="hover:text-[#142d4d]">Help</Link>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link href="/sign-in" className="whitespace-nowrap rounded-xl px-2 py-2.5 text-[12px] font-bold text-[#263e5b] hover:bg-[#eaf0f4] sm:px-4 sm:text-[13px]">Sign in</Link>
          <Link href="/sign-up" className="whitespace-nowrap rounded-xl bg-[#142f51] px-3 py-2.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#1b4269] sm:px-5 sm:text-[13px]"><span className="sm:hidden">Open account</span><span className="hidden sm:inline">Open an account</span></Link>
        </div>
      </header>

      <section className="relative mx-auto grid min-w-0 max-w-[1320px] items-center gap-10 px-4 pb-16 pt-7 sm:gap-14 sm:px-6 sm:pb-20 sm:pt-9 lg:grid-cols-[1.04fr_.96fr] lg:px-12 lg:pb-28 lg:pt-16">
        <div className="relative z-10 min-w-0">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dbe7e9] bg-white px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#3b777d]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#55a5a9]" />
            An internal multi-currency ledger
          </div>
          <h1 className="bank-display max-w-full text-[clamp(2.75rem,14vw,6.5rem)] font-semibold leading-[.98] tracking-[-.07em] text-[#142c49] sm:max-w-[700px] sm:text-[clamp(3.2rem,7.3vw,6.5rem)]">
            Your Money.
            <br />
            <span className="text-[#438f98]">Your World.</span>
            <br />
            One Wallet.
          </h1>
          <p className="mt-7 max-w-[510px] text-[16px] leading-7 text-[#64758a] sm:text-[18px] sm:leading-8">
            Bring your currencies together, understand every movement, and record internal member transfers and reviewed ledger requests with clear statuses.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-2 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Link href="/sign-up" className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#152f50] px-5 py-3.5 text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(18,43,75,.16)] transition hover:-translate-y-0.5 hover:bg-[#1b4168] sm:w-auto sm:px-6 sm:py-4">
              Get started <ArrowRight size={16} />
            </Link>
            <Link href="/about" className="rounded-xl px-5 py-3.5 text-center text-[13px] font-bold text-[#36506c] hover:bg-[#eaf0f4] sm:py-4">How Globus works</Link>
          </div>
          <div className="mt-8 flex min-w-0 flex-wrap gap-x-5 gap-y-3 text-[10px] font-medium text-[#68798d] sm:mt-11 sm:gap-x-7 sm:text-[11px]">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[#478b8e]" /> Internal ledger activity clearly identified</span>
            <span className="inline-flex items-center gap-2"><Globe2 size={15} className="text-[#478b8e]" /> Six supported currencies</span>
          </div>
        </div>
        <div className="relative mx-auto w-full min-w-0 max-w-[560px]">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[#dfeef0] blur-3xl sm:-right-12 sm:-top-14 sm:h-72 sm:w-72" />
          <div className="absolute -bottom-8 left-0 h-48 w-48 rounded-full bg-[#eae5d6] blur-3xl sm:-bottom-10 sm:-left-10 sm:h-64 sm:w-64" />
          <div className="relative min-w-0 max-w-full rotate-0 rounded-[24px] border border-white/80 bg-white p-3 shadow-[0_34px_90px_rgba(31,56,83,.17)] sm:rotate-[1.2deg] sm:rounded-[28px] sm:p-6">
            <div className="min-w-0 rounded-[20px] bg-[#f4f7f9] p-4 sm:rounded-[22px] sm:p-7">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#78889a]">Illustrative interface</p>
                  <p className="mt-1 text-[11px] text-[#8492a2]">No account or balance data shown</p>
                </div>
                <span className="rounded-lg border border-[#d5e6e7] bg-[#edf7f7] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#43868b]">Internal ledger</span>
              </div>
              <div className="balance-panel mt-5 overflow-hidden rounded-[19px] px-5 py-6 text-white sm:px-7 sm:py-7">
                <div className="flex items-center justify-between text-[11px] text-[#d4e1eb]">
                  <span>Internal ledger balance</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#e4c876]" /> USD reference</span>
                </div>
                <div className="bank-display mt-3 max-w-full break-words text-[clamp(1.2rem,6vw,1.875rem)] font-semibold tracking-[-.05em] sm:text-[38px]">View after sign-in</div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {currencies.map((code, i) => <span key={code} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold ${i === 0 ? 'bg-white/15 text-white' : 'bg-white/[.07] text-[#cedce6]'}`}>{code}</span>)}
                </div>
              </div>
              <div className="mt-5 grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
                {[
                  ['US dollar', 'Wallet balance after sign-in', 'USD'],
                  ['Euro', 'Wallet balance after sign-in', 'EUR'],
                ].map(([name, value, code]) => (
                  <div key={code} className="min-w-0 rounded-2xl border border-[#e6ebef] bg-white p-3 sm:p-4">
                    <div className="flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#edf5f6] text-[10px] font-bold text-[#43878e]">{code.slice(0, 2)}</span><span className="text-[9px] font-semibold text-[#8b98a7]">{code}</span></div>
                    <p className="mt-4 text-[10px] text-[#8290a0]">{name}</p>
                    <p className="mt-1 break-words text-[12px] font-semibold text-[#1e3653] sm:text-[14px]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex min-w-0 items-center gap-3 rounded-xl bg-white px-3 py-3 sm:px-4">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef5f5] text-[#4b898e]"><ArrowUpRight size={16} /></span>
                <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-[#334b66]">No ledger activity yet</p><p className="mt-0.5 break-words text-[10px] text-[#8b98a7]">Member transfers and approved requests appear here</p></div>
                <p className="text-[12px] font-semibold text-[#2e665f]">—</p>
              </div>
            </div>
            <div className="absolute -left-7 top-[38%] hidden -rotate-[4deg] items-center gap-3 rounded-2xl border border-[#e8edf0] bg-white px-4 py-3 shadow-lg sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f3f4] text-[#4b8f94]"><LockKeyhole size={16} /></span>
              <span><b className="block text-[11px] text-[#30465f]">Clear by design</b><small className="mt-1 block text-[9px] text-[#8391a1]">Ledger activity is clearly identified</small></span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e2e8ed] bg-white">
        <div className="mx-auto grid max-w-[1320px] gap-8 px-6 py-8 sm:grid-cols-3 lg:px-12">
          <TrustNote icon={<Globe2 size={17} />} title="One view, many currencies" copy="Keep USD, EUR, GBP, NGN, CAD and AUD in view." />
          <TrustNote icon={<ShieldCheck size={17} />} title="Internal ledger, clearly scoped" copy="Balances and transfers are recorded in Globus only. No bank or payment network is connected, and no outside funds are held or sent." />
          <TrustNote icon={<BadgeCheck size={17} />} title="No banking claims" copy="Globus is a software platform, not a licensed bank." />
        </div>
      </section>
      <section className="mx-auto grid max-w-[1320px] gap-12 px-6 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-12 lg:py-28">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#528f95]">An internal ledger, clearly scoped</p>
          <h2 className="bank-display mt-4 max-w-[450px] text-[42px] font-semibold leading-[1.08] text-[#17304f] sm:text-[52px]">Know what Globus records.<br />Know what it doesn’t.</h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <FeatureBlock number="01" title="See the whole picture" copy="Review individual currency wallets, pending amounts and recent transactions in one focused workspace." />
          <FeatureBlock number="02" title="Move value between members" copy="Internal transfers update the sender’s and recipient’s Globus wallets together, with a receipt and reference for every completed entry." />
          <FeatureBlock number="03" title="Review deposits and withdrawals" copy="Deposit requests and reserved withdrawals require administrator approval before the internal ledger changes." />
          <FeatureBlock number="04" title="Keep a clean record" copy="Every ledger transaction has a reference, status and timestamp for straightforward review." />
        </div>
      </section>
      <section className="mx-4 mb-16 rounded-[28px] bg-[#132f51] px-5 py-10 text-white sm:mx-10 sm:px-12 sm:py-12 lg:mx-auto lg:max-w-[1240px] lg:px-16 lg:py-16">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#a6d5d8]">Make your next step clearer</p><h2 className="bank-display mt-3 max-w-[640px] text-[34px] font-semibold leading-tight sm:text-[45px]">Your Globus ledger workspace, ready to use.</h2><p className="mt-4 max-w-[520px] text-[14px] leading-6 text-[#cfdae4]">Create an account to manage internal wallets, member transfers and requests reviewed by Globus administrators. No outside funds are received or sent.</p></div>
          <Link href="/sign-up" className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#d5b765] px-6 py-4 text-[13px] font-bold text-[#17304d] hover:bg-[#e0c879]">Create your account <ArrowRight size={15} /></Link>
        </div>
      </section>
      <footer className="border-t border-[#e1e7ec] bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-6 py-8 text-[11px] text-[#76869a] sm:flex-row sm:items-center sm:justify-between lg:px-12">
          <p>© {new Date().getFullYear()} Globus. A multi-currency software platform.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/about">About</Link><Link href="/fees">Fees</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></div>
        </div>
      </footer>
      <div className="sr-only" aria-live="polite">{health.isError ? 'Service status unavailable' : health.data?.status ?? 'Checking service status'}</div>
    </div>
  );
}

export function DashboardPage() {
  const query = useGetBankDashboard({ query: { queryKey: getGetBankDashboardQueryKey() } });
  const adminAccess = useGetAdminAccess({
    query: { queryKey: getGetAdminAccessQueryKey(), retry: false },
  });
  const dash = query.data;
  const referenceBalance = dash ? dash.wallets.find(wallet => wallet.currency === dash.referenceCurrency) : undefined;
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <Failure title="Your overview isn’t available" retry={() => query.refetch()} />;
  return (
    <>
      <PageHeading eyebrow="Your overview" title={`Good to see you${dash?.profile.firstName ? `, ${dash.profile.firstName}` : ''}.`} subtitle="A clear view of your internal wallets and recent ledger activity." />
      <div className="mt-7 grid gap-5 xl:grid-cols-[1.32fr_.68fr]">
        <section className="balance-panel relative overflow-hidden rounded-[22px] p-6 text-white sm:p-8">
          <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border border-white/[.08]" />
          <div className="absolute -right-3 -top-7 h-44 w-44 rounded-full border border-white/[.08]" />
          <div className="relative flex items-start justify-between gap-4">
            <div><p className="text-[11px] font-medium text-[#cad9e4]">{dash?.referenceCurrency} ledger balance</p><div className="bank-display mt-3 text-[40px] font-semibold tracking-[-.06em] sm:text-[54px]">{referenceBalance ? formatMoney(Number(referenceBalance.available), referenceBalance.currency) : '—'}</div><p className="mt-2 text-[11px] text-[#b5c7d4]">Internal Globus ledger · no outside funds held</p></div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/[.08] px-3 py-2 text-[9px] font-bold uppercase tracking-[.13em] text-[#d9e7eb]"><span className="h-1.5 w-1.5 rounded-full bg-[#8fd2cf]" /> Internal ledger</span>
          </div>
          <div className="relative mt-8 flex flex-wrap gap-2">
            {dash?.wallets.slice(0, 6).map(wallet => <span key={wallet.id} className="rounded-lg border border-white/10 bg-white/[.07] px-3 py-2 text-[10px] font-semibold text-[#e0e9ee]">{wallet.currency} <span className="ml-1 text-[#b7cad5]">{formatMoney(Number(wallet.available), wallet.currency)}</span></span>)}
          </div>
        </section>
        <section className="rounded-[22px] border border-[#e2e9ef] bg-white p-6 sm:p-7">
          <div className="flex items-start justify-between">
            <div><p className="text-[11px] font-medium text-[#78889a]">Account standing</p><h2 className="mt-2 text-[21px] font-semibold text-[#203851]">Your details, in order</h2></div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef5f6] text-[#43888e]"><ShieldCheck size={19} /></span>
          </div>
          <div className="mt-6 space-y-4">
            <StatusLine label="Account" value={humanize(dash?.profile.accountStatus)} positive={dash?.profile.accountStatus === 'active'} />
            <StatusLine label="Identity review" value={humanize(dash?.profile.verificationStatus)} positive={dash?.profile.verificationStatus === 'approved'} />
          </div>
          <Link href="/settings" className="mt-6 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#377b82]">Review profile <ChevronRight size={14} /></Link>
        </section>
      </div>
      <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_.7fr]">
        <section className="overflow-hidden rounded-[22px] border border-[#e2e9ef] bg-white">
          <div className="flex items-center justify-between border-b border-[#edf0f3] px-5 py-5 sm:px-7">
            <div><h2 className="text-[16px] font-bold text-[#203851]">Recent activity</h2><p className="mt-1 text-[11px] text-[#8592a1]">Most recent recorded entries</p></div>
            <Link href="/transactions" className="text-[11px] font-bold text-[#397d83]">View all</Link>
          </div>
          {dash?.recentTransactions.length ? <TransactionList transactions={dash.recentTransactions.slice(0, 5)} /> : <EmptyState title="Nothing recorded yet" text="Internal transfers and approved ledger requests will appear here." />}
        </section>
        <section className="rounded-[22px] border border-[#e2e9ef] bg-white p-6 sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#589198]">Available actions</p>
          <h2 className="bank-display mt-2 text-[24px] font-semibold text-[#203851]">Move at your pace.</h2>
          <p className="mt-2 text-[12px] leading-5 text-[#79899b]">Member transfers update Globus wallets. Deposit and withdrawal requests require administrator review; no outside funds move.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <ActionTile href="/send" icon={<ArrowUpRight size={16} />} label="Send" />
            <ActionTile href="/receive" icon={<ArrowDownLeft size={16} />} label="Receive" />
            <ActionTile href="/add-money" icon={<WalletCards size={16} />} label="Deposit request" />
            <ActionTile href="/exchange" icon={<ArrowLeftRight size={16} />} label="Exchange" />
            {adminAccess.data?.allowed && <ActionTile href="/admin" icon={<ShieldCheck size={16} />} label="Admin panel" />}
          </div>
        </section>
      </div>
    </>
  );
}

export function WalletsPage() {
  const query = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <Failure title="Wallets could not be loaded" retry={() => query.refetch()} />;
  return (
    <>
      <PageHeading eyebrow="Currencies" title="Your wallets" subtitle="Available, pending and reserved amounts, shown separately." />
      <div className="mt-7 flex items-center gap-3 rounded-2xl border border-[#dce9ea] bg-[#eef7f7] px-4 py-4 text-[12px] leading-5 text-[#467b80]"><Globe2 size={17} className="shrink-0" /> Balances are internal Globus ledger records, not funds held by a bank. No outside payments are sent or received.</div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(query.data ?? []).map((wallet) => <WalletCard key={wallet.id} wallet={wallet} />)}
      </div>
      {!query.data?.length && <EmptyState title="No currency wallets yet" text="Wallets will appear here when they are provisioned for your account." />}
    </>
  );
}

export function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState('');
  const params = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(currency ? { currency: currency as Currency } : {}),
    limit: 100,
  }), [search, currency]);
  const query = useListBankTransactions(params, { query: { queryKey: getListBankTransactionsQueryKey(params) } });
  return (
    <>
      <PageHeading eyebrow="Ledger view" title="Activity" subtitle="Search your recorded transactions. Each entry is an internal Globus ledger record." />
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8695a5]" /><input aria-label="Search transactions" data-testid="input-transaction-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search description, reference or recipient" className="h-12 w-full rounded-xl border border-[#dfe6ec] bg-white pl-11 pr-4 text-[12px] outline-none transition focus:border-[#6aa6aa]" /></label>
        <select aria-label="Filter by currency" data-testid="select-transaction-currency" value={currency} onChange={event => setCurrency(event.target.value)} className="h-12 rounded-xl border border-[#dfe6ec] bg-white px-4 text-[12px] text-[#435872] outline-none focus:border-[#6aa6aa]"><option value="">All currencies</option>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select>
      </div>
      <section className="mt-5 overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0f3] px-5 py-4 sm:px-7"><p className="text-[13px] font-bold text-[#28405c]">Transaction history</p><span className="text-[10px] font-semibold text-[#8291a1]">{query.data?.length ?? 0} entries</span></div>
        {query.isLoading ? <ListSkeleton /> : query.isError ? <Failure title="Transaction history isn’t available" retry={() => query.refetch()} /> : query.data?.length ? <TransactionList transactions={query.data} /> : <EmptyState title="No matching activity" text="Try a different search or come back after recording an internal ledger entry." />}
      </section>
    </>
  );
}

export function SendPage() {
  const queryClient = useQueryClient();
  const profileQuery = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const walletsQuery = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const memberTransfer = useCreateBankTransfer();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionPin, setTransactionPin] = useState('');
  const [success, setSuccess] = useState<BankTransaction | null>(null);
  const [receipt, setReceipt] = useState<BankTransaction | null>(null);
  const [message, setMessage] = useState('');
  const available = Number(walletsQuery.data?.find(item => item.currency === currency)?.available ?? 0);
  const pending = memberTransfer.isPending;
  const hasError = memberTransfer.isError;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setSuccess(null);
    const onSuccess = (transaction: BankTransaction) => {
      setSuccess(transaction);
      setRecipientEmail('');
      setAmount('');
      setDescription('');
      setTransactionPin('');
      queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() });
    };
    const onError = (error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'The member transfer could not be recorded. Please try again.');
    };
    memberTransfer.mutate({
      data: {
        recipientEmail: recipientEmail.trim(),
        currency,
        amount,
        ...(description.trim() ? { description: description.trim() } : {}),
        transactionPin,
        idempotencyKey: crypto.randomUUID(),
      },
    }, { onSuccess, onError });
  };
  return (
    <>
      <PageHeading eyebrow="Internal ledger" title="Send to a Globus member" subtitle="Transfers update both members’ Globus ledger wallets. No outside account is contacted." />
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} className="rounded-[22px] border border-[#e1e8ee] bg-white p-5 sm:p-8">
          <div className="mb-7 flex gap-3 rounded-xl border border-[#d9e9e9] bg-[#f0f8f8] p-4 text-[11px] leading-5 text-[#497b80]"><ShieldCheck size={17} className="mt-0.5 shrink-0" /><span><b className="text-[#2d646a]">Internal member transfer</b><br />The sender’s and recipient’s Globus ledgers are updated together. This does not send money to a bank or outside account.</span></div>
          <div className="space-y-5">
            <Field label="Recipient email"><input required type="email" value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} placeholder="name@example.com" className={inputClass} /></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Currency"><select value={currency} onChange={event => setCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select></Field>
              <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max={available || undefined} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className={inputClass} /><span className="mt-1.5 block text-[10px] text-[#8391a0]">Available in {currency}: {formatMoney(available, currency)}</span></Field>
            </div>
            <Field label="Note (optional)"><input maxLength={140} value={description} onChange={event => setDescription(event.target.value)} placeholder="What’s this transfer for?" className={inputClass} /></Field>
            <Field label="6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter your PIN" className={inputClass} /></Field>
          </div>
          {profileQuery.data?.transactionPinConfigured === false && <p className="mt-4 rounded-lg border border-[#eadfbe] bg-[#fbf7eb] px-4 py-3 text-[10px] leading-5 text-[#806b3d]">Set up your transaction PIN in <Link href="/settings" className="font-bold underline">Settings</Link> before sending a transfer.</p>}
          {(message || hasError) && <p role="alert" className="mt-5 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{message || 'Please check the transfer details and try again.'}</p>}
          {success && <div role="status" className="mt-5 rounded-xl border border-[#cfe5db] bg-[#f1f8f4] p-4 text-[12px] text-[#417461]"><p className="font-bold">Member transfer recorded</p><p className="mt-1">Reference {success.reference} · {humanize(success.status)}</p><p className="mt-1">The recipient’s Globus wallet was credited. No outside account was involved.</p><button type="button" onClick={() => setReceipt(success)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#bfd8cc] bg-white px-3 py-2 text-[10px] font-bold text-[#3d725d] hover:bg-[#f7fbf8]"><FileText size={14} /> View receipt</button></div>}
          <button disabled={pending || transactionPin.length !== 6 || !recipientEmail.trim() || !amount || Number(amount) <= 0 || Number(amount) > available} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#142f51] text-[12px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Sending…' : 'Send internal transfer'} <ArrowRight size={15} /></button>
        </form>
        <aside className="rounded-[22px] bg-[#eaf0f4] p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#638092]">Ledger transfer</p>
          <h2 className="bank-display mt-3 text-[23px] font-semibold leading-tight text-[#213a55]">Transfer between active Globus member wallets.</h2>
          <ul className="mt-5 space-y-4 text-[11px] leading-5 text-[#60748a]"><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#43888b]" /> Both accounts must be active Globus members.</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#43888b]" /> Transfers are posted to both members’ ledgers in one database transaction.</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#43888b]" /> Globus does not contact banks or move outside funds.</li></ul>
        </aside>
      </div>
      {receipt && <ReceiptDialog transaction={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

export function ProviderRequestPage({ type }: { type: 'deposit' | 'withdrawal' }) {
  const queryClient = useQueryClient();
  const profileQuery = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const walletsQuery = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const mutation = useCreateLedgerRequest();
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionPin, setTransactionPin] = useState('');
  const [result, setResult] = useState<{ reference: string; message: string; status: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const selectedWallet = walletsQuery.data?.find(wallet => wallet.currency === currency);
  const available = Number(selectedWallet?.available ?? 0);
  const heading = type === 'deposit' ? 'Request a ledger deposit' : 'Request a ledger withdrawal';
  const sub = type === 'deposit'
    ? 'Ask an administrator to post an internal credit to your selected currency wallet.'
    : 'Ask an administrator to review an internal debit from your selected currency wallet.';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);
    setErrorMessage('');
    mutation.mutate({ data: { type, currency, amount, ...(description.trim() ? { description: description.trim() } : {}), transactionPin, idempotencyKey: crypto.randomUUID() } }, {
      onSuccess: request => {
        setResult(request);
        setAmount('');
        setDescription('');
        setTransactionPin('');
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() });
      },
      onError: error => setErrorMessage(error instanceof Error ? error.message : 'Request could not be recorded. Please try again.'),
    });
  };
  return (
    <>
      <PageHeading eyebrow="Internal ledger" title={heading} subtitle={sub} />
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} className="rounded-[22px] border border-[#e1e8ee] bg-white p-5 sm:p-8">
          <div className="mb-7 rounded-xl border border-[#eadfbe] bg-[#fbf7eb] p-4">
            <div className="flex gap-3"><Clock3 size={17} className="mt-0.5 shrink-0 text-[#a17e36]" /><div><p className="text-[12px] font-bold text-[#715b2c]">Administrator review required</p><p className="mt-1 text-[11px] leading-5 text-[#89784f]">{type === 'deposit' ? 'Approval posts an internal ledger credit. No outside funds are received.' : 'The requested amount is reserved while pending. Approval posts a ledger debit; no outside payout is made.'}</p></div></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Wallet currency"><select value={currency} onChange={event => setCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select></Field>
            <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max={type === 'withdrawal' ? available : 1000000} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className={inputClass} /><span className="mt-1.5 block text-[10px] text-[#8391a0]">{type === 'withdrawal' ? `Available to withdraw: ${formatMoney(available, currency)}` : 'Maximum request: 1,000,000.00'}</span></Field>
          </div>
          <div className="mt-5"><Field label="Note for the administrator (optional)"><input maxLength={140} value={description} onChange={event => setDescription(event.target.value)} placeholder="Add context for your request" className={inputClass} /></Field></div>
          <div className="mt-5"><Field label="6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter your PIN" className={inputClass} /></Field></div>
          {profileQuery.data?.transactionPinConfigured === false && <p className="mt-4 rounded-lg border border-[#eadfbe] bg-[#fbf7eb] px-4 py-3 text-[10px] leading-5 text-[#806b3d]">Set up your transaction PIN in <Link href="/settings" className="font-bold underline">Settings</Link> before submitting this request.</p>}
          {(errorMessage || mutation.isError) && <p role="alert" className="mt-5 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{errorMessage || 'The request could not be recorded.'}</p>}
          {result && <div role="status" className="mt-5 rounded-xl border border-[#d6e6e5] bg-[#f2f8f7] p-4 text-[12px] text-[#426e70]"><p className="font-bold">Request recorded · {humanize(result.status)}</p><p className="mt-1">{result.message}</p><p className="mt-2 font-mono text-[10px]">Reference {result.reference}</p></div>}
          <button disabled={mutation.isPending || transactionPin.length !== 6 || !amount || Number(amount) <= 0 || (type === 'withdrawal' && Number(amount) > available)} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#142f51] text-[12px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending ? 'Sending for review…' : 'Submit request'} <ArrowRight size={15} /></button>
          <p className="mt-3 text-center text-[10px] text-[#8794a1]">Globus stores the request and review result in its internal ledger database.</p>
        </form>
        <div className="rounded-[22px] border border-[#e1e8ee] bg-white p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#72859b]">Wallet availability</p>
          <div className="mt-4 space-y-3">{walletsQuery.isLoading ? <ListSkeleton /> : walletsQuery.isError ? <InlineError text="Wallet balances are unavailable." retry={() => walletsQuery.refetch()} /> : (walletsQuery.data ?? []).filter(wallet => wallet.currency === currency).map(wallet => <WalletMini key={wallet.id} wallet={wallet} />)}</div>
          <p className="mt-6 text-[10px] leading-5 text-[#7d8b9b]">Balances are internal records in Globus. The service does not receive deposits or send withdrawals to outside accounts.</p>
        </div>
      </div>
    </>
  );
}

export function ReceivePage() {
  const profile = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const walletsQuery = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const [copied, setCopied] = useState(false);
  const identifier = profile.data?.customerId ?? '';
  const copyIdentifier = async () => {
    try {
      await navigator.clipboard.writeText(identifier);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <PageHeading eyebrow="Member access" title="Your Customer ID" subtitle="Use this unique seven-character ID with your password to sign in." />
      {profile.isLoading ? <PageSkeleton /> : profile.isError ? <Failure title="Your wallet identifier isn’t available" retry={() => profile.refetch()} /> : (
        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_.78fr]">
          <section className="balance-panel rounded-[22px] p-6 text-white sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#a5d8d8]"><WalletCards size={22} /></span>
            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[.16em] text-[#bfd0dd]">Globus Customer ID</p>
            <p className="mt-3 break-all font-mono text-[19px] font-semibold tracking-wide sm:text-[24px]">{identifier}</p>
            <button onClick={copyIdentifier} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-[11px] font-bold text-[#17314f] hover:bg-[#ecf3f5]"><Copy size={14} />{copied ? 'Copied' : 'Copy Customer ID'}</button>
            <p className="mt-7 max-w-lg text-[11px] leading-5 text-[#c1d0db]">Keep this ID for sign-in. It identifies your Globus account and is not a bank account or payment address.</p>
          </section>
          <section className="rounded-[22px] border border-[#e1e8ee] bg-white p-6 sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#518c91]">Internal transfers</p>
            <ol className="mt-5 space-y-5">{[['Share your registered email', 'The sender uses the email registered to your Globus profile.'], ['Choose the same currency', 'Both members need an active wallet in that currency.'], ['Review the ledger', 'Completed transfers appear in both members’ activity and wallet balances.']].map(([title, copy], index) => <li key={title} className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#edf5f6] text-[11px] font-bold text-[#42868b]">0{index + 1}</span><span><b className="block text-[12px] text-[#2c425c]">{title}</b><span className="mt-1 block text-[11px] leading-5 text-[#7d8b9b]">{copy}</span></span></li>)}</ol>
            <p className="mt-6 text-[10px] leading-5 text-[#7d8b9b]">Globus does not receive outside deposits or hold funds at a bank.</p>
          </section>
        </div>
      )}
      <section className="mt-8 rounded-[22px] border border-[#e1e8ee] bg-white p-6">
        <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#518c91]">Your wallets</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {walletsQuery.isLoading ? <ListSkeleton /> : walletsQuery.isError ? <InlineError text="Wallet balances are unavailable." retry={() => walletsQuery.refetch()} /> : (walletsQuery.data ?? []).map(wallet => <WalletMini key={wallet.id} wallet={wallet} />)}
        </div>
        <Link href="/add-money" className="mt-6 inline-flex items-center gap-2 text-[11px] font-bold text-[#367b82]">Request a ledger deposit <ArrowRight size={14} /></Link>
      </section>
    </>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const query = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const documentsQuery = useListMyIdentityDocuments({
    query: {
      queryKey: getListMyIdentityDocumentsQueryKey(),
      enabled: !!query.data,
    },
  });
  const update = useUpdateBankProfile();
  const createIdentityUpload = useCreateIdentityDocumentUploadUrl();
  const completeIdentityUpload = useCompleteIdentityDocumentUpload();
  const deleteIdentityDocument = useDeleteMyIdentityDocument();
  const submitIdentityDocuments = useSubmitIdentityDocuments();
  const { user } = useUser();
  const [note, setNote] = useState('');
  const [customerIdCopied, setCustomerIdCopied] = useState(false);
  const [photoMessage, setPhotoMessage] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoPending, setPhotoPending] = useState(false);
  const [identityMessage, setIdentityMessage] = useState('');
  const [identityError, setIdentityError] = useState('');
  const [identityUploadPending, setIdentityUploadPending] = useState(false);
  const [identityConsent, setIdentityConsent] = useState(false);
  const profile = query.data;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [initialised, setInitialised] = useState(false);
  useEffect(() => {
    if (profile && !initialised) {
      setFirstName(profile.firstName ?? '');
      setLastName(profile.lastName ?? '');
      setPhone(profile.phone ?? '');
      setCountry(profile.country ?? '');
      setDateOfBirth(profile.dateOfBirth ?? '');
      setInitialised(true);
    }
  }, [profile, initialised]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNote('');
    update.mutate({ data: { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), country: country.trim(), ...(dateOfBirth ? { dateOfBirth } : {}), acceptedTerms: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBankProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
        setAccepted(false);
        setNote('Profile saved. Account review status is managed separately.');
      },
      onError: error => setNote(error instanceof Error ? error.message : 'Profile could not be saved. Please try again.'),
    });
  };
  const copyCustomerId = async () => {
    if (!profile?.customerId) return;
    try {
      await navigator.clipboard.writeText(profile.customerId);
      setCustomerIdCopied(true);
      window.setTimeout(() => setCustomerIdCopied(false), 1800);
    } catch {
      setCustomerIdCopied(false);
    }
  };
  const updatePin = useUpdateTransactionPin();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const submitPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPinMessage('');
    if (!/^[0-9]{6}$/.test(newPin)) {
      setPinMessage('Enter a new PIN with exactly six digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinMessage('The new PIN entries do not match.');
      return;
    }
    if (profile?.transactionPinConfigured && !/^[0-9]{6}$/.test(currentPin)) {
      setPinMessage('Enter your current six-digit PIN to change it.');
      return;
    }
    try {
      await updatePin.mutateAsync({
        data: {
          pin: newPin,
          ...(profile?.transactionPinConfigured ? { currentPin } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetBankProfileQueryKey() });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setPinMessage('Transaction PIN saved. You will need it for every transaction.');
    } catch (error) {
      setPinMessage(error instanceof Error ? error.message : 'The transaction PIN could not be saved.');
    }
  };
  const uploadProfilePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setPhotoMessage('');
    setPhotoError('');
    if (!user) {
      setPhotoError('Your signed-in profile is unavailable. Refresh and try again.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Choose an image smaller than 5 MB.');
      return;
    }
    setPhotoPending(true);
    try {
      await user.setProfileImage({ file });
      await user.reload();
      setPhotoMessage('Profile photo updated.');
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'The profile photo could not be updated.');
    } finally {
      setPhotoPending(false);
    }
  };
  const uploadIdentityDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length === 0) return;
    setIdentityError('');
    setIdentityMessage('');
    const existingCount = documentsQuery.data?.length ?? 0;
    if (existingCount + files.length > 5) {
      setIdentityError('You can keep up to five identity documents for one review.');
      return;
    }
    const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    const invalidFile = files.find(
      file =>
        !allowedTypes.has(file.type) ||
        file.size < 8 ||
        file.size > 10 * 1024 * 1024,
    );
    if (invalidFile) {
      setIdentityError('Choose PDF, JPG or PNG files between 8 bytes and 10 MB each.');
      return;
    }
    setIdentityUploadPending(true);
    try {
      for (const file of files) {
        const upload = await createIdentityUpload.mutateAsync({
          data: {
            contentType: file.type as IdentityDocument['contentType'],
            sizeBytes: file.size,
          },
        });
        try {
          const response = await fetch(upload.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          });
          if (!response.ok) {
            throw new Error('The file could not be uploaded. Please try again.');
          }
          await completeIdentityUpload.mutateAsync({
            documentId: upload.documentId,
          });
        } catch (error) {
          try {
            await deleteIdentityDocument.mutateAsync({
              documentId: upload.documentId,
            });
          } catch {
            // Keep the original upload error; an incomplete row can be removed from the list.
          }
          throw error;
        }
      }
      setIdentityMessage(`${files.length} document${files.length === 1 ? '' : 's'} uploaded. Submit them when you are ready.`);
      await queryClient.invalidateQueries({ queryKey: getListMyIdentityDocumentsQueryKey() });
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : 'The identity documents could not be uploaded.');
      await queryClient.invalidateQueries({ queryKey: getListMyIdentityDocumentsQueryKey() });
    } finally {
      setIdentityUploadPending(false);
    }
  };
  const removeIdentityDocument = async (documentId: string) => {
    setIdentityError('');
    setIdentityMessage('');
    try {
      await deleteIdentityDocument.mutateAsync({ documentId });
      await queryClient.invalidateQueries({ queryKey: getListMyIdentityDocumentsQueryKey() });
      setIdentityMessage('Identity document removed.');
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : 'The identity document could not be removed.');
    }
  };
  const submitForIdentityReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIdentityError('');
    setIdentityMessage('');
    try {
      await submitIdentityDocuments.mutateAsync({ data: { confirmed: true } });
      setIdentityConsent(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetBankProfileQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListMyIdentityDocumentsQueryKey() }),
      ]);
      setIdentityMessage('Your documents were submitted for review.');
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : 'Your documents could not be submitted for review.');
    }
  };
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <Failure title="Profile settings are unavailable" retry={() => query.refetch()} />;
  return (
    <>
      <PageHeading eyebrow="Account settings" title="Your profile" subtitle="Manage your details, submit identity documents, and review your account status." />
      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-[#e1e8ee] bg-white px-5 py-4 sm:px-6">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#718296]">Your Globus Customer ID</p>
          <p className="mt-1 font-mono text-[20px] font-bold tracking-[.16em] text-[#17314f]">{profile?.customerId}</p>
        </div>
        <button type="button" onClick={copyCustomerId} className="inline-flex items-center gap-2 rounded-lg border border-[#dfe6eb] px-4 py-2.5 text-[10px] font-bold text-[#355570] hover:bg-[#f5f8f9]"><Copy size={14} />{customerIdCopied ? 'Copied' : 'Copy ID'}</button>
      </section>
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={submit} className="rounded-[22px] border border-[#e1e8ee] bg-white p-5 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First name"><input required maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} className={inputClass} /></Field>
            <Field label="Last name"><input maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} className={inputClass} /></Field>
            <Field label="Phone"><input required minLength={3} maxLength={32} value={phone} onChange={event => setPhone(event.target.value)} className={inputClass} /></Field>
            <Field label="Country or region"><input required minLength={2} maxLength={80} value={country} onChange={event => setCountry(event.target.value)} className={inputClass} /></Field>
            <Field label="Date of birth"><input type="date" value={dateOfBirth} onChange={event => setDateOfBirth(event.target.value)} className={inputClass} /></Field>
            <Field label="Email address"><input disabled value={profile?.email ?? ''} className={`${inputClass} bg-[#f4f7f9] text-[#8190a0]`} /></Field>
          </div>
          <label className="mt-6 flex items-start gap-3 text-[11px] leading-5 text-[#728296]"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-1 accent-[#387e84]" /><span>I confirm these profile details are accurate and accept the Globus account terms and privacy notice.</span></label>
          {note && <p role="status" className={`mt-4 rounded-lg px-4 py-3 text-[11px] ${note.startsWith('Profile saved') ? 'bg-[#f0f8f4] text-[#41755f]' : 'bg-[#fff1ef] text-[#a24940]'}`}>{note}</p>}
          <button disabled={!accepted || update.isPending} className="mt-6 h-11 rounded-xl bg-[#142f51] px-5 text-[11px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-45">{update.isPending ? 'Saving profile…' : 'Save profile'}</button>
        </form>
        <section className="rounded-[22px] border border-[#e1e8ee] bg-white p-6">
          <div className="mb-6 border-b border-[#edf0f2] pb-6">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#71869a]">Profile photo</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[#dbe5ea] bg-[#eef5f6] text-lg font-bold text-[#387b82]">
                {user?.imageUrl
                  ? <img src={user.imageUrl} alt="Your profile" className="h-full w-full object-cover" />
                  : (user?.firstName?.[0] ?? profile?.email?.[0] ?? 'G').toUpperCase()}
              </div>
              <div>
                <label htmlFor="profile-photo-upload" className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#dfe7eb] px-3.5 py-2.5 text-[10px] font-bold text-[#3f5c75] hover:bg-[#f5f8f9] ${photoPending ? 'pointer-events-none opacity-50' : ''}`}>
                  <Camera size={14} />
                  {photoPending ? 'Uploading…' : 'Change photo'}
                </label>
                <input id="profile-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadProfilePhoto} disabled={photoPending} />
                <p className="mt-2 text-[9px] text-[#8794a2]">JPG, PNG or WebP · up to 5 MB</p>
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-[#708196]">Your photo is managed with your secure sign-in profile and appears across Globus.</p>
            {photoMessage && <p role="status" className="mt-3 rounded-lg bg-[#f0f8f4] px-3 py-2 text-[10px] text-[#41755f]">{photoMessage}</p>}
            {photoError && <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] px-3 py-2 text-[10px] text-[#a24940]">{photoError}</p>}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#71869a]">Account status</p>
          <div className="mt-5 space-y-4"><StatusLine label="Account" value={humanize(profile?.accountStatus)} positive={profile?.accountStatus === 'active'} /><StatusLine label="Verification" value={humanize(profile?.verificationStatus)} positive={profile?.verificationStatus === 'approved'} /></div>
          <div className="mt-6 border-t border-[#edf0f2] pt-5"><p className="text-[10px] text-[#8995a2]">Member since</p><p className="mt-1 text-[12px] font-semibold text-[#324962]">{formatDate(profile?.createdAt)}</p><p className="mt-4 text-[10px] leading-5 text-[#8895a3]">Globus is software, not a licensed bank. Identity review is an internal account status, not verification by a financial institution or government.</p></div>
        </section>
      </div>
      <section className="mt-6 rounded-[22px] border border-[#e1e8ee] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Transaction security</p>
            <h2 className="mt-1 text-[15px] font-bold text-[#29425c]">{profile?.transactionPinConfigured ? 'Update transaction PIN' : 'Create transaction PIN'}</h2>
            <p className="mt-2 max-w-2xl text-[11px] leading-5 text-[#718296]">Use a six-digit PIN to authorize every transfer, deposit request, and withdrawal request from your account. Your PIN is stored as a secure hash and cannot be viewed by administrators.</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-[9px] font-bold ${profile?.transactionPinConfigured ? 'bg-[#eef7f3] text-[#4b826d]' : 'bg-[#fbf7eb] text-[#92773e]'}`}>{profile?.transactionPinConfigured ? 'PIN active' : 'PIN not set'}</span>
        </div>
        <form onSubmit={submitPin} className="mt-5 grid gap-4 sm:grid-cols-2">
          {profile?.transactionPinConfigured && <Field label="Current PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={currentPin} onChange={event => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>}
          <Field label="New 6-digit PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="new-password" value={newPin} onChange={event => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
          <Field label="Confirm new PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="new-password" value={confirmPin} onChange={event => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
          {pinMessage && <p role={pinMessage.startsWith('Transaction PIN saved') ? 'status' : 'alert'} className={`sm:col-span-2 rounded-lg px-4 py-3 text-[11px] ${pinMessage.startsWith('Transaction PIN saved') ? 'bg-[#f0f8f4] text-[#41755f]' : 'bg-[#fff1ef] text-[#a24940]'}`}>{pinMessage}</p>}
          <button disabled={updatePin.isPending || newPin.length !== 6 || confirmPin.length !== 6} className="h-11 w-fit rounded-xl bg-[#142f51] px-5 text-[11px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{updatePin.isPending ? 'Saving PIN…' : profile?.transactionPinConfigured ? 'Update PIN' : 'Create PIN'}</button>
        </form>
      </section>
      <section className="mt-6 rounded-[22px] border border-[#e1e8ee] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Private identity review</p>
            <h2 className="mt-1 text-[15px] font-bold text-[#29425c]">Submit identity documents</h2>
            <p className="mt-2 max-w-2xl text-[11px] leading-5 text-[#718296]">Upload up to five PDF, JPG or PNG files, 10 MB each. Only you and authorized Globus admins can access them. Files are deleted after approval or rejection; the review status and audit record remain.</p>
          </div>
          <span className="shrink-0 rounded-lg border border-[#d9e8e9] bg-[#f2f8f8] px-3 py-2 text-[10px] font-bold text-[#4e777a]">{humanize(profile?.verificationStatus)}</span>
        </div>
        {profile?.verificationNote && <p className="mt-4 rounded-lg border border-[#e4e9ed] bg-[#f8fafb] px-4 py-3 text-[11px] leading-5 text-[#52677c]"><b>Message from the reviewer:</b> {profile.verificationNote}</p>}
        {identityMessage && <p role="status" className="mt-4 rounded-lg border border-[#cfe5db] bg-[#f1f8f4] px-4 py-3 text-[11px] text-[#417461]">{identityMessage}</p>}
        {identityError && <p role="alert" className="mt-4 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{identityError}</p>}
        <div className="mt-5">
          {documentsQuery.isLoading ? <ListSkeleton /> : documentsQuery.isError ? <InlineError text="Your identity documents are unavailable." retry={() => documentsQuery.refetch()} /> : documentsQuery.data?.length ? (
            <ul className="space-y-2">
              {documentsQuery.data.map((document, index) => (
                <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7edf0] px-4 py-3">
                  <div>
                    <p className="text-[11px] font-semibold text-[#344b64]">Document {index + 1} · {document.contentType === 'application/pdf' ? 'PDF' : document.contentType === 'image/png' ? 'PNG image' : 'JPG image'}</p>
                    <p className="mt-1 text-[10px] text-[#8492a0]">{(document.sizeBytes / 1024 / 1024).toFixed(2)} MB · {humanize(document.status)}{document.uploadedAt ? ` · ${formatDate(document.uploadedAt)}` : ''}</p>
                  </div>
                  {profile?.verificationStatus !== 'pending' && profile?.verificationStatus !== 'approved' && <button type="button" disabled={deleteIdentityDocument.isPending || identityUploadPending} onClick={() => removeIdentityDocument(document.id)} className="rounded-lg border border-[#dfe6eb] px-3 py-2 text-[10px] font-bold text-[#546b80] hover:bg-[#f5f8f9] disabled:opacity-50">Remove</button>}
                </li>
              ))}
            </ul>
          ) : <p className="rounded-xl border border-dashed border-[#dfe6eb] px-4 py-5 text-center text-[11px] text-[#8794a2]">No identity documents uploaded.</p>}
        </div>
        {profile?.verificationStatus !== 'pending' && profile?.verificationStatus !== 'approved' && (
          <>
            <label htmlFor="identity-document-upload" className={`mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#dfe7eb] px-4 py-3 text-[10px] font-bold text-[#3f5c75] hover:bg-[#f5f8f9] ${identityUploadPending ? 'pointer-events-none opacity-50' : ''}`}>
              <FileText size={14} />
              {identityUploadPending ? 'Uploading documents…' : 'Choose PDF, JPG or PNG files'}
            </label>
            <input id="identity-document-upload" type="file" multiple accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={uploadIdentityDocuments} disabled={identityUploadPending} />
            <p className="mt-2 text-[10px] text-[#8794a2]">Do not upload documents for another person. Documents are reviewed internally and are not submitted to a bank or government authority.</p>
            <form onSubmit={submitForIdentityReview} className="mt-5 border-t border-[#edf0f2] pt-5">
              <label className="flex items-start gap-3 text-[11px] leading-5 text-[#65798e]">
                <input type="checkbox" required checked={identityConsent} onChange={event => setIdentityConsent(event.target.checked)} className="mt-1 accent-[#387e84]" />
                <span>I confirm these documents belong to me and allow authorized Globus administrators to review them for internal account verification.</span>
              </label>
              <button disabled={!identityConsent || submitIdentityDocuments.isPending || identityUploadPending || !(documentsQuery.data ?? []).some(document => document.status === 'uploaded') || (documentsQuery.data ?? []).some(document => document.status === 'uploading')} className="mt-4 h-11 rounded-xl bg-[#142f51] px-5 text-[11px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-45">
                {submitIdentityDocuments.isPending ? 'Submitting for review…' : profile?.verificationStatus === 'additional_information_required' ? 'Resubmit for review' : 'Submit for review'}
              </button>
            </form>
          </>
        )}
      </section>
    </>
  );
}

function AdminLedgerRequestQueue() {
  const queryClient = useQueryClient();
  const requests = useListAdminLedgerRequests({
    query: {
      queryKey: getListAdminLedgerRequestsQueryKey(),
      retry: false,
    },
  });
  const review = useReviewAdminLedgerRequest();
  const [error, setError] = useState('');
  const [reviewTarget, setReviewTarget] = useState<{
    request: AdminLedgerRequest;
    decision: 'approve' | 'reject';
    reason: string;
  } | null>(null);
  const [transactionPin, setTransactionPin] = useState('');

  const decide = (request: AdminLedgerRequest, decision: 'approve' | 'reject') => {
    const reason = window.prompt(
      `${decision === 'approve' ? 'Approval' : 'Rejection'} reason for ${request.reference} (at least 5 characters):`,
    );
    if (reason === null) return;
    if (reason.trim().length < 5) {
      setError('Enter an audit reason of at least five characters.');
      return;
    }
    setError('');
    setTransactionPin('');
    setReviewTarget({ request, decision, reason: reason.trim() });
  };

  const submitDecision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewTarget || !/^[0-9]{6}$/.test(transactionPin)) {
      setError('Enter your six-digit transaction PIN.');
      return;
    }
    setError('');
    try {
      await review.mutateAsync({
        requestId: reviewTarget.request.id,
        data: {
          decision: reviewTarget.decision,
          reason: reviewTarget.reason,
          transactionPin,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListAdminLedgerRequestsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListAdminLedgerQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminUserDetailQueryKey(reviewTarget.request.userId) }),
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() }),
      ]);
      setReviewTarget(null);
      setTransactionPin('');
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'The ledger request could not be reviewed.');
    }
  };

  return (
    <>
      <section className="mt-6 overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
        <div className="border-b border-[#edf0f3] px-5 py-4 sm:px-7">
          <h2 className="text-[14px] font-bold text-[#28405c]">Deposit and withdrawal approvals</h2>
          <p className="mt-1 text-[10px] leading-4 text-[#8592a1]">Approval posts an internal ledger credit or debit only. It does not receive an outside deposit or make a payout. Every decision needs an audit reason and administrator PIN.</p>
        </div>
        {error && !reviewTarget && <p role="alert" className="border-b border-[#edf0f3] bg-[#fff1ef] px-5 py-3 text-[11px] text-[#a24940]">{error}</p>}
        {requests.isLoading ? <ListSkeleton /> : requests.isError ? <InlineError text="Ledger requests are unavailable." retry={() => requests.refetch()} /> : requests.data?.length ? (
          <div className="divide-y divide-[#edf0f2]">
            {requests.data.map(request => (
              <article key={request.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#eef6f6] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-[#36777c]">{request.type}</span><span className="font-mono text-[9px] text-[#8291a0]">{request.reference}</span><span className="text-[9px] text-[#8291a0]">{formatDate(request.createdAt)}</span></div>
                  <p className="mt-2 truncate text-[11px] font-semibold text-[#344b64]">{request.memberName} · {request.email}</p>
                  <p className="mt-1 text-[10px] text-[#7e8d9c]">{request.description || `${humanize(request.type)} request`} · {request.status === 'pending_provider_setup' ? 'Awaiting review' : humanize(request.status)}</p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <strong className="text-[13px] text-[#2d435c]">{formatMoney(Number(request.amount), request.currency)}</strong>
                  <button type="button" disabled={review.isPending} onClick={() => decide(request, 'approve')} className="rounded-lg bg-[#eaf5ef] px-3 py-2 text-[10px] font-bold text-[#47795f] hover:bg-[#dff0e6] disabled:opacity-50">Approve</button>
                  <button type="button" disabled={review.isPending} onClick={() => decide(request, 'reject')} className="rounded-lg border border-[#ead8d5] px-3 py-2 text-[10px] font-bold text-[#a24940] hover:bg-[#fff7f5] disabled:opacity-50">Reject</button>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No requests awaiting review" text="New internal deposit and withdrawal requests will appear here." />}
      </section>
      {reviewTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14263e]/55 p-4">
        <form role="dialog" aria-modal="true" aria-labelledby="ledger-review-title" onSubmit={submitDecision} className="w-full max-w-lg rounded-[22px] border border-[#dfe7ec] bg-white p-5 shadow-2xl sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Administrator authorization</p>
          <h2 id="ledger-review-title" className="mt-1 text-[16px] font-bold text-[#29425c]">{reviewTarget.decision === 'approve' ? 'Approve ledger request' : 'Reject ledger request'}</h2>
          <p className="mt-2 text-[11px] leading-5 text-[#718296]">{reviewTarget.request.memberName} · {reviewTarget.request.reference} · {formatMoney(Number(reviewTarget.request.amount), reviewTarget.request.currency)}</p>
          <div className="mt-5">
            <Field label="Your 6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
          </div>
          {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setReviewTarget(null)} className="rounded-xl border border-[#dfe6eb] px-4 py-3 text-[10px] font-bold text-[#546b80] hover:bg-[#f5f8f9]">Cancel</button>
            <button disabled={review.isPending || transactionPin.length !== 6} className="rounded-xl bg-[#142f51] px-4 py-3 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{review.isPending ? 'Saving…' : 'Confirm decision'}</button>
          </div>
        </form>
      </div>}
    </>
  );
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const access = useGetAdminAccess({ query: { queryKey: getGetAdminAccessQueryKey(), retry: false } });
  const summary = useGetAdminSummary({ query: { queryKey: getGetAdminSummaryQueryKey(), enabled: !!access.data?.allowed, retry: false } });
  const [search, setSearch] = useState('');
  const [statusError, setStatusError] = useState('');
  const [fundTarget, setFundTarget] = useState<AdminUser | null>(null);
  const [fundDirection, setFundDirection] = useState<'credit' | 'debit'>('credit');
  const [fundCurrency, setFundCurrency] = useState<Currency>('USD');
  const [fundAmount, setFundAmount] = useState('');
  const [fundSenderName, setFundSenderName] = useState('');
  const [fundDescription, setFundDescription] = useState('');
  const [fundReason, setFundReason] = useState('');
  const [fundTransactionPin, setFundTransactionPin] = useState('');
  const [fundingError, setFundingError] = useState('');
  const [fundingSuccess, setFundingSuccess] = useState<BankTransaction | null>(null);
  const [identityTarget, setIdentityTarget] = useState<AdminUser | null>(null);
  const [reviewDecision, setReviewDecision] = useState<
    'approved' | 'rejected' | 'additional_information_required'
  >('approved');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [statusTarget, setStatusTarget] = useState<BankTransaction | null>(null);
  const params = useMemo(() => ({ ...(search.trim() ? { search: search.trim() } : {}), limit: 100 }), [search]);
  const users = useListAdminUsers(params, { query: { queryKey: getListAdminUsersQueryKey(params), enabled: !!access.data?.allowed } });
  const reviewDocuments = useListAdminIdentityDocuments(identityTarget?.id ?? '', {
    query: {
      queryKey: getListAdminIdentityDocumentsQueryKey(identityTarget?.id ?? ''),
      enabled: !!identityTarget,
    },
  });
  const ledgerParams = { limit: 100 };
  const ledger = useListAdminLedger(ledgerParams, { query: { queryKey: getListAdminLedgerQueryKey(ledgerParams), enabled: !!access.data?.allowed } });
  const update = useUpdateAdminUserStatus();
  const updateVerification = useUpdateAdminUserVerification();
  const funding = useCreateAdminFunding();
  const deletion = useDeleteAdminTransaction();
  const updateTransactionStatus = useUpdateAdminTransactionStatus();
  if (access.isLoading) return <PageSkeleton />;
  if (access.isError || !access.data?.allowed) return <Failure title="Operations access is restricted" text="This area is only available to authorized Globus operations staff." retry={() => access.refetch()} />;
  const setStatus = (userId: string, accountStatus: 'active' | 'suspended') => {
    const reason = window.prompt(`Reason for setting this account to ${accountStatus}?`);
    if (!reason || reason.trim().length < 5) return;
    setStatusError('');
    update.mutate({ userId, data: { accountStatus, reason: reason.trim() } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      },
      onError: error => setStatusError(error instanceof Error ? error.message : 'The account status could not be updated.'),
    });
  };
  const submitFunding = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fundTarget) return;
    setFundingError('');
    setFundingSuccess(null);
    funding.mutate({
      userId: fundTarget.id,
      data: {
        direction: fundDirection,
        currency: fundCurrency,
        amount: fundAmount,
        senderName: fundSenderName.trim(),
        description: fundDescription.trim(),
        reason: fundReason.trim(),
        transactionPin: fundTransactionPin,
        idempotencyKey: crypto.randomUUID(),
      },
    }, {
      onSuccess: transaction => {
        setFundingSuccess(transaction);
        setFundAmount('');
        setFundSenderName('');
        setFundDescription('');
        setFundReason('');
        setFundTransactionPin('');
        queryClient.invalidateQueries({ queryKey: getListAdminLedgerQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
      },
      onError: error => setFundingError(error instanceof Error ? error.message : 'The balance adjustment could not be recorded.'),
    });
  };
  const deleteLedgerTransaction = async (
    transaction: BankTransaction,
    reason: string,
    transactionPin: string,
  ) => {
    await deletion.mutateAsync({
      transactionId: transaction.id,
      data: { reason, transactionPin },
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListAdminLedgerQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() }),
    ]);
  };
  const saveTransactionStatus = async (
    status: BankTransaction['status'],
    reason: string,
    transactionPin: string,
  ) => {
    if (!statusTarget) return;
    await updateTransactionStatus.mutateAsync({
      transactionId: statusTarget.id,
      data: { status, reason, transactionPin },
    });
    setStatusTarget(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListAdminLedgerQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListAdminLedgerRequestsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() }),
    ]);
  };
  const openIdentityReview = (user: AdminUser) => {
    setIdentityTarget(user);
    setReviewDecision('approved');
    setReviewReason('');
    setReviewMessage('');
    setReviewError('');
    setReviewFeedback('');
  };
  const submitIdentityReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identityTarget) return;
    setReviewError('');
    setReviewFeedback('');
    try {
      await updateVerification.mutateAsync({
        userId: identityTarget.id,
        data: {
          verificationStatus: reviewDecision,
          reason: reviewReason.trim(),
          ...(reviewMessage.trim() ? { userMessage: reviewMessage.trim() } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
      setReviewFeedback(`Identity decision saved for ${identityTarget.email}.`);
      setIdentityTarget(null);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'The identity decision could not be saved.');
    }
  };
  return (
    <>
      <PageHeading eyebrow="Restricted operations" title="Operations overview" subtitle="Review customer accounts, ledger requests and recorded balance activity." />
      {summary.isError && <InlineError text="Summary totals are unavailable." retry={() => summary.refetch()} />}
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Registered users" value={summary.data?.registeredUsers} />
        <Metric label="Active wallets" value={summary.data?.activeWallets} />
        <Metric label="Pending ledger requests" value={summary.data?.pendingLedgerRequests} />
        <Metric label="Ledger transactions" value={summary.data?.ledgerTransactions} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#d9e7e8] bg-[#eff7f7] px-4 py-3 text-[11px] text-[#48767b]"><ShieldCheck size={15} /> Internal ledger operations only · no outside funds are held or sent.</div>
      {statusError && <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{statusError}</p>}
      {reviewFeedback && <p role="status" className="mt-3 rounded-lg border border-[#cfe5db] bg-[#f1f8f4] px-4 py-3 text-[11px] text-[#417461]">{reviewFeedback}</p>}
      {fundTarget && <section className="mt-6 rounded-[20px] border border-[#dfe7ec] bg-white p-5 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Admin balance adjustment</p><h2 className="mt-1 text-[15px] font-bold text-[#29425c]">Adjust a user wallet</h2><p className="mt-1 text-[11px] text-[#7e8d9c]">{[fundTarget.firstName, fundTarget.lastName].filter(Boolean).join(' ') || 'Globus member'} · {fundTarget.email}</p></div>
          <button type="button" aria-label="Close funding form" onClick={() => { setFundTarget(null); setFundingError(''); setFundingSuccess(null); setFundSenderName(''); setFundDescription(''); setFundReason(''); setFundTransactionPin(''); }} className="rounded-lg p-2 text-[#6d8092] hover:bg-[#f1f5f7]"><X size={16} /></button>
        </div>
        <p className="mb-5 rounded-lg border border-[#d9e8e9] bg-[#f2f8f8] px-4 py-3 text-[10px] leading-4 text-[#4e777a]">This records a credit or debit in Globus’s internal ledger and writes an audit entry. It does not receive or send outside funds. Maximum per entry: 1,000,000.00.</p>
        <form onSubmit={submitFunding} className="grid gap-4 sm:grid-cols-2">
          <Field label="Adjustment direction"><select value={fundDirection} onChange={event => setFundDirection(event.target.value as typeof fundDirection)} className={inputClass}><option value="credit">Credit wallet</option><option value="debit">Debit wallet</option></select></Field>
          <Field label="Currency"><select value={fundCurrency} onChange={event => setFundCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select></Field>
          <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max="1000000" value={fundAmount} onChange={event => setFundAmount(event.target.value)} placeholder="0.00" className={inputClass} /></Field>
          <Field label="Counterparty / adjustment label"><input required maxLength={120} value={fundSenderName} onChange={event => setFundSenderName(event.target.value)} placeholder="Globus operations" className={inputClass} /></Field>
          <Field label="Transaction description"><input required maxLength={240} value={fundDescription} onChange={event => setFundDescription(event.target.value)} placeholder="Reason shown in transaction activity" className={inputClass} /></Field>
          <div className="sm:col-span-2"><Field label="Reason (recorded in the audit log)"><textarea required minLength={5} maxLength={500} rows={3} value={fundReason} onChange={event => setFundReason(event.target.value)} placeholder="Reason for this balance adjustment" className={`${inputClass} h-auto py-3`} /></Field></div>
          <div className="sm:col-span-2"><Field label="Your 6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={fundTransactionPin} onChange={event => setFundTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field></div>
          {fundingError && <p role="alert" className="sm:col-span-2 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{fundingError}</p>}
          {fundingSuccess && <p role="status" className="sm:col-span-2 rounded-lg border border-[#cfe5db] bg-[#f1f8f4] px-4 py-3 text-[11px] text-[#417461]">Balance adjustment recorded · {fundingSuccess.reference}</p>}
          <div className="sm:col-span-2"><button disabled={funding.isPending || fundTransactionPin.length !== 6 || !fundAmount || !fundSenderName.trim() || !fundDescription.trim() || !fundReason.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#142f51] px-5 text-[11px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{funding.isPending ? 'Recording adjustment…' : 'Save balance adjustment'} <ArrowRight size={14} /></button></div>
        </form>
      </section>}
      <AdminLedgerRequestQueue />
      <section className="mt-7 overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#edf0f3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div><h2 className="text-[14px] font-bold text-[#28405c]">Registered users</h2><p className="mt-1 text-[10px] text-[#8592a1]">Account status changes require a documented reason.</p></div><label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8996a4]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email, or Customer ID" className="h-10 w-full rounded-lg border border-[#e0e7ec] bg-white pl-9 pr-3 text-[11px] outline-none sm:w-[240px]" /></label></div>
        {users.isLoading ? <ListSkeleton /> : users.isError ? <InlineError text="User records are unavailable." retry={() => users.refetch()} /> : users.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left"><thead className="bg-[#f7f9fa] text-[9px] uppercase tracking-[.13em] text-[#8291a0]"><tr><th className="px-6 py-3">Member</th><th className="px-4 py-3">Region</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Wallets</th><th className="px-6 py-3 text-right">Actions</th></tr></thead><tbody>{users.data.map(user => <tr key={user.id} className="border-t border-[#edf0f2] text-[11px] text-[#445a71]"><td className="px-6 py-4"><b className="block text-[#2d435c]">{[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Globus member'}</b><span className="mt-1 block text-[10px] text-[#8a97a5]">{user.email}</span><span className="mt-1 block font-mono text-[10px] font-semibold tracking-[.08em] text-[#52717e]">Customer ID: {user.customerId ?? '—'}</span></td><td className="px-4 py-4">{user.country || '—'}</td><td className="px-4 py-4"><span>{humanize(user.verificationStatus)}</span>{user.verificationNote && <span className="mt-1 block max-w-[220px] truncate text-[9px] text-[#8794a2]" title={user.verificationNote}>{user.verificationNote}</span>}</td><td className="px-4 py-4">{humanize(user.accountStatus)}</td><td className="px-4 py-4">{user.walletCount}</td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><Link href={`/admin/users/${encodeURIComponent(user.id)}`} className="rounded-lg border border-[#dfe6eb] px-3 py-2 text-[10px] font-bold text-[#3f5c75] hover:bg-[#f4f7f8]">Manage</Link>{(user.verificationStatus === 'pending' || user.verificationStatus === 'additional_information_required') && <button onClick={() => openIdentityReview(user)} className="rounded-lg border border-[#d7e6e7] bg-[#f2f8f8] px-3 py-2 text-[10px] font-bold text-[#36777c] hover:bg-[#e5f2f2]">Review ID</button>}<button disabled={user.accountStatus !== 'active'} onClick={() => { setFundTarget(user); setFundingError(''); setFundingSuccess(null); }} className="rounded-lg bg-[#eff7f7] px-3 py-2 text-[10px] font-bold text-[#36777c] hover:bg-[#e2f1f1] disabled:cursor-not-allowed disabled:opacity-40">Fund</button><button disabled={update.isPending} onClick={() => setStatus(user.id, user.accountStatus === 'active' ? 'suspended' : 'active')} className="rounded-lg border border-[#dfe6eb] px-3 py-2 text-[10px] font-bold text-[#3f5c75] hover:bg-[#f4f7f8] disabled:opacity-50">{user.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No users found" text="Try another email, name, or Customer ID." />}
      </section>
      <section className="mt-6 overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
        <div className="border-b border-[#edf0f3] px-5 py-4 sm:px-7"><h2 className="text-[14px] font-bold text-[#28405c]">Ledger review</h2><p className="mt-1 text-[10px] text-[#8592a1]">Review ledger activity and transaction status. Deposit and withdrawal approvals are handled in the queue above. Permanent deletion removes the transaction and its ledger entries; a reason is recorded in the audit log, and deletions that would make available balances negative or consume reserved withdrawals are blocked.</p></div>
        {ledger.isLoading ? <ListSkeleton /> : ledger.isError ? <InlineError text="Ledger records are unavailable." retry={() => ledger.refetch()} /> : ledger.data?.length ? <TransactionList transactions={ledger.data} onDelete={deleteLedgerTransaction} deletePending={deletion.isPending} onStatusOverride={transaction => setStatusTarget(transaction)} statusPending={updateTransactionStatus.isPending} /> : <EmptyState title="Ledger is clear" text="There are no recorded transactions to review." />}
      </section>
      {identityTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14263e]/55 p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="identity-review-title" className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[22px] border border-[#dfe7ec] bg-white p-5 shadow-2xl sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Private admin review</p><h2 id="identity-review-title" className="mt-1 text-[16px] font-bold text-[#29425c]">Review identity documents</h2><p className="mt-1 text-[11px] text-[#7e8d9c]">{identityTarget.email} · {humanize(identityTarget.verificationStatus)}</p></div>
            <button type="button" aria-label="Close identity review" onClick={() => setIdentityTarget(null)} className="rounded-lg p-2 text-[#6d8092] hover:bg-[#f1f5f7]"><X size={16} /></button>
          </div>
          <p className="mt-5 rounded-lg border border-[#d9e8e9] bg-[#f2f8f8] px-4 py-3 text-[10px] leading-4 text-[#4e777a]">Download files only for this review. Approval or rejection permanently deletes the uploaded documents; requesting more information keeps them available.</p>
          <div className="mt-4">
            {reviewDocuments.isLoading ? <ListSkeleton /> : reviewDocuments.isError ? <InlineError text="Identity documents could not be loaded." retry={() => reviewDocuments.refetch()} /> : reviewDocuments.data?.length ? (
              <ul className="space-y-2">
                {reviewDocuments.data.map((document, index) => (
                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7edf0] px-4 py-3">
                    <div><p className="text-[11px] font-semibold text-[#344b64]">Document {index + 1} · {document.contentType === 'application/pdf' ? 'PDF' : document.contentType === 'image/png' ? 'PNG image' : 'JPG image'}</p><p className="mt-1 text-[10px] text-[#8492a0]">{(document.sizeBytes / 1024 / 1024).toFixed(2)} MB · Uploaded {document.uploadedAt ? formatDate(document.uploadedAt) : formatDate(document.createdAt)}</p></div>
                    <button type="button" onClick={() => window.open(getGetAdminIdentityDocumentContentUrl(document.id), '_blank', 'noopener,noreferrer')} className="rounded-lg border border-[#dfe6eb] px-3 py-2 text-[10px] font-bold text-[#3f5c75] hover:bg-[#f5f8f9]">Download securely</button>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No uploaded documents" text="This member has no files available for review." />}
          </div>
          <form onSubmit={submitIdentityReview} className="mt-6 border-t border-[#edf0f2] pt-5">
            <Field label="Decision">
              <select value={reviewDecision} onChange={event => setReviewDecision(event.target.value as typeof reviewDecision)} className={inputClass}>
                <option value="approved">Approve identity</option>
                <option value="rejected">Reject and close review</option>
                <option value="additional_information_required">Request more information</option>
              </select>
            </Field>
            {reviewDecision === 'additional_information_required' && <div className="mt-4"><Field label="Message for the member"><textarea required minLength={5} maxLength={500} rows={3} value={reviewMessage} onChange={event => setReviewMessage(event.target.value)} placeholder="Explain what additional documents or details are needed." className={`${inputClass} h-auto py-3`} /></Field></div>}
            <div className="mt-4"><Field label="Internal audit reason"><textarea required minLength={5} maxLength={500} rows={3} value={reviewReason} onChange={event => setReviewReason(event.target.value)} placeholder="Reason for this identity review decision." className={`${inputClass} h-auto py-3`} /></Field></div>
            {reviewError && <p role="alert" className="mt-4 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{reviewError}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setIdentityTarget(null)} className="rounded-xl border border-[#dfe6eb] px-4 py-3 text-[10px] font-bold text-[#546b80] hover:bg-[#f5f8f9]">Cancel</button><button disabled={updateVerification.isPending || reviewDocuments.isLoading || !reviewDocuments.data?.length} className="rounded-xl bg-[#142f51] px-4 py-3 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{updateVerification.isPending ? 'Saving decision…' : 'Save decision'}</button></div>
          </form>
        </section>
      </div>}
      {statusTarget && <TransactionStatusDialog
        transaction={statusTarget}
        pending={updateTransactionStatus.isPending}
        onClose={() => setStatusTarget(null)}
        onSave={saveTransactionStatus}
      />}
    </>
  );
}

export function AdminUserManagementPage() {
  const [, routeParams] = useRoute('/admin/users/:userId');
  const userId = routeParams?.userId ?? '';
  const queryClient = useQueryClient();
  const access = useGetAdminAccess({
    query: { queryKey: getGetAdminAccessQueryKey(), retry: false },
  });
  const detail = useGetAdminUserDetail(userId, {
    query: {
      queryKey: getGetAdminUserDetailQueryKey(userId),
      enabled: !!userId && !!access.data?.allowed,
    },
  });
  const user = detail.data?.user;
  const canReviewIdentity =
    user?.verificationStatus === 'pending' ||
    user?.verificationStatus === 'additional_information_required';
  const identityDocuments = useListAdminIdentityDocuments(userId, {
    query: {
      queryKey: getListAdminIdentityDocumentsQueryKey(userId),
      enabled: !!userId && !!access.data?.allowed && canReviewIdentity,
    },
  });
  const updateStatus = useUpdateAdminUserStatus();
  const createFunding = useCreateAdminFunding();
  const deleteTransaction = useDeleteAdminTransaction();
  const updateTransactionStatus = useUpdateAdminTransactionStatus();
  const updateVerification = useUpdateAdminUserVerification();
  const resetTransactionPin = useResetAdminUserTransactionPin();

  const [currency, setCurrency] = useState<Currency>('USD');
  const [adjustmentDirection, setAdjustmentDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [senderName, setSenderName] = useState('Globus operations');
  const [fundingDescription, setFundingDescription] = useState('');
  const [fundingReason, setFundingReason] = useState('');
  const [fundingPin, setFundingPin] = useState('');
  const [fundingError, setFundingError] = useState('');
  const [fundingReference, setFundingReference] = useState('');
  const [pageMessage, setPageMessage] = useState('');
  const [pageError, setPageError] = useState('');
  const [statusTarget, setStatusTarget] = useState<BankTransaction | null>(null);
  const [decision, setDecision] = useState<
    'approved' | 'rejected' | 'additional_information_required'
  >('approved');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionMessage, setDecisionMessage] = useState('');
  const [decisionError, setDecisionError] = useState('');

  const refreshUserData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetAdminUserDetailQueryKey(userId),
      }),
      queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListAdminLedgerQueryKey() }),
    ]);
  };

  const changeAccountStatus = async () => {
    if (!user) return;
    const nextStatus = user.accountStatus === 'active' ? 'suspended' : 'active';
    const reason = window.prompt(`Reason for setting this account to ${nextStatus}?`);
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) setPageError('Enter a reason of at least five characters.');
      return;
    }
    setPageError('');
    try {
      await updateStatus.mutateAsync({
        userId,
        data: { accountStatus: nextStatus, reason: reason.trim() },
      });
      await refreshUserData();
      setPageMessage(`Account ${nextStatus === 'active' ? 'reactivated' : 'suspended'}.`);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Account status could not be updated.');
    }
  };

  const submitFunding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setFundingError('');
    setFundingReference('');
    try {
      const transaction = await createFunding.mutateAsync({
        userId,
        data: {
          direction: adjustmentDirection,
          currency,
          amount,
          senderName: senderName.trim(),
          description: fundingDescription.trim(),
          reason: fundingReason.trim(),
          transactionPin: fundingPin,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      setFundingReference(transaction.reference);
      setAmount('');
      setFundingDescription('');
      setFundingReason('');
      setFundingPin('');
      await refreshUserData();
    } catch (error) {
      setFundingError(error instanceof Error ? error.message : 'The balance adjustment could not be recorded.');
    }
  };

  const resetMemberTransactionPin = async () => {
    if (!user) return;
    const reason = window.prompt('Enter an audit reason for resetting this member’s transaction PIN (at least 5 characters).');
    if (reason === null) return;
    if (reason.trim().length < 5) {
      setPageError('Enter a reset reason of at least five characters.');
      return;
    }
    if (!window.confirm('Reset this member’s PIN? They will need to create a new PIN before making another transaction.')) return;
    setPageError('');
    try {
      await resetTransactionPin.mutateAsync({
        userId,
        data: { reason: reason.trim() },
      });
      await refreshUserData();
      setPageMessage('Transaction PIN reset. The member must create a new PIN before their next transaction.');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'The transaction PIN could not be reset.');
    }
  };

  const deleteUserTransaction = async (
    transaction: BankTransaction,
    reason: string,
    transactionPin: string,
  ) => {
    await deleteTransaction.mutateAsync({
      transactionId: transaction.id,
      data: { reason, transactionPin },
    });
    await refreshUserData();
    setPageMessage(`Transaction ${transaction.reference} was permanently deleted.`);
  };

  const saveUserTransactionStatus = async (
    status: BankTransaction['status'],
    reason: string,
    transactionPin: string,
  ) => {
    if (!statusTarget) return;
    await updateTransactionStatus.mutateAsync({
      transactionId: statusTarget.id,
      data: { status, reason, transactionPin },
    });
    setStatusTarget(null);
    await refreshUserData();
    setPageMessage(`Transaction ${statusTarget.reference} status was updated.`);
  };

  const submitIdentityDecision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDecisionError('');
    setPageMessage('');
    try {
      await updateVerification.mutateAsync({
        userId,
        data: {
          verificationStatus: decision,
          reason: decisionReason.trim(),
          ...(decisionMessage.trim()
            ? { userMessage: decisionMessage.trim() }
            : {}),
        },
      });
      await Promise.all([
        refreshUserData(),
        queryClient.invalidateQueries({
          queryKey: getListAdminIdentityDocumentsQueryKey(userId),
        }),
      ]);
      setDecisionReason('');
      setDecisionMessage('');
      setPageMessage('Identity review decision saved.');
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'The identity decision could not be saved.');
    }
  };

  if (access.isLoading) return <PageSkeleton />;
  if (access.isError || !access.data?.allowed) {
    return (
      <Failure
        title="Operations access is restricted"
        text="This area is only available to authorized Globus operations staff."
        retry={() => access.refetch()}
      />
    );
  }
  if (detail.isLoading) return <PageSkeleton />;
  if (detail.isError || !detail.data) {
    return (
      <Failure
        title="Member record is unavailable"
        text="The user may no longer exist or the record could not be loaded."
        retry={() => detail.refetch()}
      />
    );
  }

  const profile = detail.data.user;
  const memberName =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
    'Globus member';

  return (
    <>
      <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-[11px] font-bold text-[#4b687f] hover:text-[#2c7e84]">
        <ArrowLeft size={14} /> All users
      </Link>
      <PageHeading
        eyebrow="Restricted operations · Member management"
        title={memberName}
        subtitle="Review this member’s profile, internal ledger balances, activity, and account status."
      />
      {pageMessage && <p role="status" className="mt-4 rounded-lg border border-[#cfe5db] bg-[#f1f8f4] px-4 py-3 text-[11px] text-[#417461]">{pageMessage}</p>}
      {pageError && <p role="alert" className="mt-4 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{pageError}</p>}

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-[20px] border border-[#e1e8ee] bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#71869a]">Member profile</p>
                <h2 className="mt-2 text-[17px] font-bold text-[#29425c]">{memberName}</h2>
                <p className="mt-1 text-[11px] text-[#687d92]">{profile.email}</p>
              </div>
              <button
                type="button"
                disabled={updateStatus.isPending}
                onClick={changeAccountStatus}
                className={`rounded-lg px-4 py-2.5 text-[10px] font-bold ${profile.accountStatus === 'active' ? 'border border-[#ead8d5] text-[#a24940] hover:bg-[#fff7f5]' : 'bg-[#eff7f7] text-[#36777c] hover:bg-[#e2f1f1]'} disabled:opacity-50`}
              >
                {profile.accountStatus === 'active' ? 'Suspend account' : 'Reactivate account'}
              </button>
            </div>
            <dl className="mt-6 grid gap-4 border-t border-[#edf0f2] pt-5 sm:grid-cols-2">
              <div><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8492a0]">Email</dt><dd className="mt-1 break-all text-[11px] font-semibold text-[#40566e]">{profile.email}</dd></div>
              <div><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8492a0]">Phone</dt><dd className="mt-1 text-[11px] font-semibold text-[#40566e]">{detail.data.phone || 'Not provided'}</dd></div>
              <div><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8492a0]">Country / region</dt><dd className="mt-1 text-[11px] font-semibold text-[#40566e]">{profile.country || 'Not provided'}</dd></div>
              <div><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8492a0]">Date of birth</dt><dd className="mt-1 text-[11px] font-semibold text-[#40566e]">{detail.data.dateOfBirth || 'Not provided'}</dd></div>
              <div><dt className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8492a0]">Member since</dt><dd className="mt-1 text-[11px] font-semibold text-[#40566e]">{formatDate(profile.createdAt)}</dd></div>
            </dl>
            <div className="mt-5 grid gap-3 border-t border-[#edf0f2] pt-5 sm:grid-cols-2">
              <div className="rounded-xl bg-[#f7f9fa] p-4"><StatusLine label="Account" value={humanize(profile.accountStatus)} positive={profile.accountStatus === 'active'} /></div>
              <div className="rounded-xl bg-[#f7f9fa] p-4"><StatusLine label="Identity review" value={humanize(profile.verificationStatus)} positive={profile.verificationStatus === 'approved'} /></div>
            </div>
            {profile.verificationNote && <p className="mt-4 rounded-lg border border-[#e4e9ed] bg-[#f8fafb] px-4 py-3 text-[10px] leading-5 text-[#52677c]"><b>Reviewer message:</b> {profile.verificationNote}</p>}
          </section>

          <section className="rounded-[20px] border border-[#e1e8ee] bg-white p-5 sm:p-7">
            <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#71869a]">Wallets</p><h2 className="mt-1 text-[14px] font-bold text-[#28405c]">Internal balances</h2></div><span className="text-[10px] text-[#8492a0]">{detail.data.wallets.length} wallet{detail.data.wallets.length === 1 ? '' : 's'}</span></div>
            {detail.data.wallets.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{detail.data.wallets.map(wallet => <WalletCard key={wallet.id} wallet={wallet} />)}</div> : <EmptyState title="No wallets yet" text="Wallets are created with the account. Internal transfers and approved adjustments update their balances." />}
          </section>

          <section className="overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
            <div className="border-b border-[#edf0f3] px-5 py-4 sm:px-7"><h2 className="text-[14px] font-bold text-[#28405c]">Recent activity</h2><p className="mt-1 text-[10px] text-[#8592a1]">Latest 50 transactions. Deletion is permanent and requires a reason.</p></div>
            {detail.data.transactions.length ? <TransactionList transactions={detail.data.transactions} onDelete={deleteUserTransaction} deletePending={deleteTransaction.isPending} onStatusOverride={transaction => setStatusTarget(transaction)} statusPending={updateTransactionStatus.isPending} /> : <EmptyState title="No activity yet" text="This member has no recorded transactions." />}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[20px] border border-[#e1e8ee] bg-white p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Internal ledger</p>
            <h2 className="mt-1 text-[14px] font-bold text-[#29425c]">Fund this user</h2>
            <p className="mt-2 text-[10px] leading-4 text-[#7e8d9c]">Records an internal wallet credit or debit with an audit entry. No outside funds are received or sent.</p>
            <form onSubmit={submitFunding} className="mt-4 space-y-3">
              <Field label="Adjustment direction"><select value={adjustmentDirection} onChange={event => setAdjustmentDirection(event.target.value as typeof adjustmentDirection)} className={inputClass}><option value="credit">Credit wallet</option><option value="debit">Debit wallet</option></select></Field>
              <Field label="Currency"><select value={currency} onChange={event => setCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(code => <option key={code} value={code}>{code} · {currencyNames[code]}</option>)}</select></Field>
              <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max="1000000" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className={inputClass} /></Field>
              <Field label="Counterparty / adjustment label"><input required maxLength={120} value={senderName} onChange={event => setSenderName(event.target.value)} className={inputClass} /></Field>
              <Field label="Description"><input required maxLength={240} value={fundingDescription} onChange={event => setFundingDescription(event.target.value)} placeholder="Shown in activity" className={inputClass} /></Field>
              <Field label="Audit reason"><textarea required minLength={5} maxLength={500} rows={3} value={fundingReason} onChange={event => setFundingReason(event.target.value)} className={`${inputClass} h-auto py-3`} /></Field>
              <Field label="Your 6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={fundingPin} onChange={event => setFundingPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
              {fundingError && <p role="alert" className="rounded-lg bg-[#fff1ef] px-3 py-2 text-[10px] text-[#a24940]">{fundingError}</p>}
              {fundingReference && <p role="status" className="rounded-lg bg-[#f1f8f4] px-3 py-2 text-[10px] text-[#417461]">Balance adjustment recorded · {fundingReference}</p>}
              <button disabled={profile.accountStatus !== 'active' || createFunding.isPending || fundingPin.length !== 6 || !amount || !senderName.trim() || !fundingDescription.trim() || !fundingReason.trim()} className="h-10 w-full rounded-xl bg-[#142f51] px-4 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{createFunding.isPending ? 'Recording…' : 'Save balance adjustment'}</button>
              {profile.accountStatus !== 'active' && <p className="text-[9px] text-[#9b8050]">Reactivate the account before adjusting its balance.</p>}
            </form>
          </section>

          <section className="rounded-[20px] border border-[#e1e8ee] bg-white p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#71869a]">Identity management</p>
            <h2 className="mt-1 text-[14px] font-bold text-[#29425c]">Verification status</h2>
              <p className="mt-2 text-[10px] leading-4 text-[#7e8d9c]">This is an internal Globus account review, not bank or government identity verification.</p>
            {canReviewIdentity ? (
              <>
                {identityDocuments.isLoading ? <div className="mt-4"><ListSkeleton /></div> : identityDocuments.isError ? <div className="mt-4"><InlineError text="Identity documents could not be loaded." retry={() => identityDocuments.refetch()} /></div> : identityDocuments.data?.length ? (
                  <ul className="mt-4 space-y-2">
                    {identityDocuments.data.map((document, index) => (
                      <li key={document.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e7edf0] px-3 py-2.5">
                        <span className="text-[9px] font-semibold text-[#536b82]">Document {index + 1} · {(document.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                        <button type="button" onClick={() => window.open(getGetAdminIdentityDocumentContentUrl(document.id), '_blank', 'noopener,noreferrer')} className="text-[9px] font-bold text-[#36777c] hover:underline">Download</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-4 text-[10px] text-[#8794a2]">No uploaded documents are available.</p>}
                <form onSubmit={submitIdentityDecision} className="mt-5 space-y-3 border-t border-[#edf0f2] pt-4">
                  <Field label="Decision"><select value={decision} onChange={event => setDecision(event.target.value as typeof decision)} className={inputClass}><option value="approved">Approve identity</option><option value="rejected">Reject and close review</option><option value="additional_information_required">Request more information</option></select></Field>
                  {decision === 'additional_information_required' && <Field label="Message for member"><textarea required minLength={5} maxLength={500} rows={3} value={decisionMessage} onChange={event => setDecisionMessage(event.target.value)} className={`${inputClass} h-auto py-3`} /></Field>}
                  <Field label="Internal audit reason"><textarea required minLength={5} maxLength={500} rows={3} value={decisionReason} onChange={event => setDecisionReason(event.target.value)} className={`${inputClass} h-auto py-3`} /></Field>
                  {decisionError && <p role="alert" className="rounded-lg bg-[#fff1ef] px-3 py-2 text-[10px] text-[#a24940]">{decisionError}</p>}
                  <button disabled={updateVerification.isPending || identityDocuments.isLoading || !identityDocuments.data?.length} className="h-10 w-full rounded-xl border border-[#d7e6e7] bg-[#f2f8f8] px-4 text-[10px] font-bold text-[#36777c] hover:bg-[#e5f2f2] disabled:cursor-not-allowed disabled:opacity-50">{updateVerification.isPending ? 'Saving…' : 'Save identity decision'}</button>
                </form>
              </>
            ) : (
              <div className="mt-4 rounded-lg bg-[#f7f9fa] px-3 py-3 text-[10px] leading-4 text-[#718294]">There is no identity review awaiting a decision. Current status: <b>{humanize(profile.verificationStatus)}</b>.</div>
            )}
          </section>
          <section className="rounded-[20px] border border-[#e1e8ee] bg-white p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#71869a]">Transaction security</p>
            <h2 className="mt-1 text-[14px] font-bold text-[#29425c]">Member PIN</h2>
            <p className="mt-2 text-[10px] leading-4 text-[#7e8d9c]">Status: <b>{detail.data.transactionPinConfigured ? 'PIN is set' : 'PIN is not set'}</b>. Administrators cannot view or choose the member’s PIN; a reset requires the member to create a new one.</p>
            <button type="button" disabled={!detail.data.transactionPinConfigured || resetTransactionPin.isPending} onClick={resetMemberTransactionPin} className="mt-4 rounded-lg border border-[#ead8d5] px-3 py-2.5 text-[10px] font-bold text-[#a24940] hover:bg-[#fff7f5] disabled:cursor-not-allowed disabled:opacity-50">{resetTransactionPin.isPending ? 'Resetting…' : 'Reset member PIN'}</button>
          </section>
        </aside>
      </div>
      {statusTarget && <TransactionStatusDialog
        transaction={statusTarget}
        pending={updateTransactionStatus.isPending}
        onClose={() => setStatusTarget(null)}
        onSave={saveUserTransactionStatus}
      />}
    </>
  );
}

const disclosureCopy: Record<string, { eyebrow: string; title: string; intro: string; sections: [string, string][] }> = {
  '/about': { eyebrow: 'About Globus', title: 'An internal ledger for clear account activity.', intro: 'Globus records multi-currency wallets, member transfers, requests and administrative balance adjustments in its application database.', sections: [['A platform, not a bank', 'Globus is not a licensed bank, payment institution or custodian. It does not accept, hold or send outside funds.'], ['Internal balances', 'Wallet balances are records in the Globus ledger. No external bank, payment gateway or money-transfer provider is connected.'], ['Built for clear review', 'Balances, requests and activity include statuses, references and audit records to make each change traceable.']] },
  '/help': { eyebrow: 'Support', title: 'Help with your Globus ledger.', intro: 'Understand how account activity is recorded inside Globus.', sections: [['How do deposits work?', 'Submit a ledger deposit request. An administrator must approve it before an internal wallet credit is recorded. No outside deposit is received.'], ['How do withdrawals work?', 'A pending withdrawal reserves the requested amount. Approval debits the internal wallet; rejection releases the reserve. No outside payout is made.'], ['Can I send someone money?', 'You can transfer an available balance to another active Globus member. Both internal wallets update together; no outside account is contacted.'], ['Where can I find my member ID?', 'Open Receive from your account navigation. Share your registered email with another member so they can address an internal transfer.']] },
  '/fees': { eyebrow: 'Fees and rates', title: 'Understand the scope of ledger activity.', intro: 'Globus does not process external deposits, payouts, payment gateway transactions or currency conversions.', sections: [['External providers', 'No bank, payment gateway or real-money transfer provider is connected. Requests only affect the Globus ledger after the required approval.'], ['Fees', 'Globus does not charge an external transaction fee because it does not process outside payments.'], ['Currency balances', 'Currency wallets are recorded separately. Globus does not provide a live exchange quote or guarantee that balances can be converted or redeemed.']] },
  '/privacy': { eyebrow: 'Privacy notice', title: 'Your information deserves clarity.', intro: 'This page summarizes account information Globus uses to provide its software services.', sections: [['Account details', 'Profile details and account identifiers associate internal records with your account. Authentication is provided through Clerk.'], ['Private identity documents', 'Documents submitted for internal review are stored privately and accessible only to the submitting member and authorized Globus admins. Files are deleted after approval or rejection. The verification status and an audit record of the decision remain. This review is not legal, bank or government identity verification.'], ['Operational records', 'Transactions and requests may include references, status, currency, amount, descriptions and timestamps.'], ['Your choices', 'Use Settings to review your profile and manage identity documents before submitting them. Contact the support team with questions about account information or platform operations.']] },
  '/terms': { eyebrow: 'Terms of use', title: 'Internal ledger records, not bank deposits.', intro: 'Globus records account activity in its own database and does not move outside funds.', sections: [['No banking service', 'Globus is not a licensed bank and does not accept deposits, provide credit, custody funds or promise payment execution.'], ['Internal records', 'Displayed balances and transactions represent entries in the Globus ledger. An approved deposit request records an internal credit; an approved withdrawal records an internal debit. Neither action moves outside funds.'], ['Use responsibly', 'Do not rely on ledger balances or status labels as proof of funds held by a bank or as a promise of payment.']] },
  '/contact': { eyebrow: 'Contact', title: 'Contact information is not configured yet.', intro: 'A verified support channel has not been configured for Globus.', sections: [['Account help', 'Visit Help for guidance about the software. Do not include passwords, verification codes or sensitive payment details in support requests.'], ['Recorded activity', 'Include the transaction reference when asking about a ledger entry in your account.'], ['Operational disclosure', 'Globus support cannot complete, trace or reverse an external payment through this product.']] },
};

export function DisclosurePage({ path }: { path: string }) {
  const data = disclosureCopy[path] ?? disclosureCopy['/about'];
  return (
    <div className="min-h-[100dvh] bg-[#f5f8fa]">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-6 sm:px-6"><Link href="/" aria-label="Globus Bank home" className="flex shrink-0 items-center"><img src={`${import.meta.env.BASE_URL}globus-wordmark.png`} alt="Globus Bank — Your world. Our priority." className="h-auto w-[128px] sm:w-[156px]" /></Link><Link href="/" className="text-[12px] font-semibold text-[#456077] hover:text-[#347e83]">Back to home</Link></header>
      <main className="mx-auto max-w-[1020px] px-6 pb-20 pt-10 sm:pt-16">
        <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#4b8b90]">{data.eyebrow}</p>
        <h1 className="bank-display mt-4 max-w-[760px] text-[clamp(2.6rem,7vw,5.2rem)] font-semibold leading-[1.02] text-[#16304f]">{data.title}</h1>
        <p className="mt-6 max-w-[670px] text-[15px] leading-7 text-[#66788c]">{data.intro}</p>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {data.sections.map(([title, copy], index) => <article key={title} className="rounded-[20px] border border-[#e0e8ed] bg-white p-6 sm:p-7"><span className="font-mono text-[10px] font-bold tracking-[.14em] text-[#70a0a1]">0{index + 1}</span><h2 className="mt-4 text-[17px] font-bold text-[#27405a]">{title}</h2><p className="mt-3 text-[12px] leading-6 text-[#76869a]">{copy}</p></article>)}
        </div>
        <div className="mt-8 rounded-xl border border-[#d9e7e8] bg-[#edf6f6] p-5 text-[11px] leading-5 text-[#4c7579]"><b className="text-[#35676b]">Important:</b> Globus Bank is a product name for a software platform. It is not a representation that Globus is a licensed bank or financial institution.</div>
      </main>
      <footer className="border-t border-[#e2e8ed] bg-white px-6 py-7 text-center text-[10px] text-[#8794a3]">Globus · Internal ledger software · no outside funds are held or sent</footer>
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="min-w-0 max-w-full"><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#548d92]">{eyebrow}</p><h1 className="bank-display mt-2 max-w-full break-words text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.08] text-[#1a334f]">{title}</h1><p className="mt-2 max-w-[760px] break-words text-[12px] leading-5 text-[#76879a]">{subtitle}</p></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-[11px] font-semibold text-[#435971]">{label}<span className="mt-2 block">{children}</span></label>;
}

function WalletCard({ wallet }: { wallet: Wallet }) {
  const accents: Record<string, string> = { USD: '#41878d', EUR: '#6881a3', GBP: '#a58b4e', NGN: '#598a70', CAD: '#a16964', AUD: '#6d7ea4' };
  return (
    <article className="rounded-[20px] border border-[#e1e8ed] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(27,51,78,.06)] sm:p-6">
      <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eff5f6] text-[11px] font-bold" style={{ color: accents[wallet.currency] }}>{wallet.currency}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold capitalize ${wallet.status === 'active' ? 'bg-[#eef7f3] text-[#4b826d]' : 'bg-[#fff4e7] text-[#a0793b]'}`}>{humanize(wallet.status)}</span></div>
      <p className="mt-5 text-[11px] text-[#8291a0]">{currencyNames[wallet.currency]}</p>
      <p className="bank-display mt-1 text-[27px] font-semibold tracking-[-.04em] text-[#1c3551]">{formatMoney(Number(wallet.available), wallet.currency)}</p>
      <div className="mt-5 border-t border-[#edf0f2] pt-4">
        <WalletAmount label="Pending" amount={wallet.pending} currency={wallet.currency} />
        <WalletAmount label="Reserved" amount={wallet.reserved} currency={wallet.currency} />
      </div>
    </article>
  );
}

function WalletAmount({ label, amount, currency }: { label: string; amount: string; currency: string }) {
  return <div className="flex items-center justify-between py-1 text-[10px]"><span className="text-[#8794a2]">{label}</span><span className="font-semibold text-[#576b80]">{formatMoney(Number(amount), currency)}</span></div>;
}

function WalletMini({ wallet }: { wallet: Wallet }) {
  return <div className="flex items-center justify-between rounded-xl bg-[#f6f8fa] px-3.5 py-3"><span><b className="block text-[11px] text-[#3b5168]">{wallet.currency}</b><small className="mt-1 block text-[9px] text-[#8b98a5]">{currencyNames[wallet.currency]}</small></span><span className="text-[11px] font-semibold text-[#3e566e]">{formatMoney(Number(wallet.available), wallet.currency)}</span></div>;
}

function transactionDisplayType(transaction: BankTransaction) {
  switch (transaction.type) {
    case 'simulation_credit':
      return 'Opening ledger balance';
    case 'admin_funding':
      return 'Balance adjustment credit';
    case 'admin_debit':
      return 'Balance adjustment debit';
    case 'transfer_in':
      return 'Member transfer received';
    case 'transfer_out':
      return 'Member transfer sent';
    case 'external_transfer':
    case 'external_transfer_in':
      return 'Prior ledger entry';
    default:
      return humanize(transaction.type);
  }
}
function TransactionList({
  transactions,
  onDelete,
  deletePending = false,
  onStatusOverride,
  statusPending = false,
}: {
  transactions: BankTransaction[];
  onDelete?: (transaction: BankTransaction, reason: string, transactionPin: string) => Promise<void>;
  deletePending?: boolean;
  onStatusOverride?: (transaction: BankTransaction) => void;
  statusPending?: boolean;
}) {
  const [receipt, setReceipt] = useState<BankTransaction | null>(null);
  const [historyTarget, setHistoryTarget] = useState<BankTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BankTransaction | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletePin, setDeletePin] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const submitDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deleteTarget || !onDelete) return;
    setDeleteError('');
    try {
      await onDelete(deleteTarget, deleteReason.trim(), deletePin);
      setDeleteTarget(null);
      setDeleteReason('');
      setDeletePin('');
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'The transaction could not be deleted.');
    }
  };
  return <>
    <div>{transactions.map(transaction => {
      const isIncoming = transaction.type === 'transfer_in' || transaction.type === 'external_transfer_in' || transaction.type === 'simulation_credit' || transaction.type === 'admin_funding';
      const canPrintReceipt = transaction.status === 'completed';
      return <div key={transaction.id} className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-[#edf0f2] px-4 py-4 last:border-0 sm:flex-nowrap sm:gap-4 sm:px-7">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isIncoming ? 'bg-[#edf7f3] text-[#4d8c72]' : 'bg-[#f0f4f7] text-[#658097]'}`}>{isIncoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#334a63]">{transaction.description || transactionDisplayType(transaction)}</p><p className="mt-1 truncate text-[9px] text-[#8996a4]">{transaction.counterparty || 'Internal ledger'} · {formatDate(transaction.createdAt)} · Internal ledger</p></div>
        <div className="shrink-0 text-right"><p className={`text-[11px] font-bold ${isIncoming ? 'text-[#417f69]' : 'text-[#3c5269]'}`}>{isIncoming ? '+' : '−'}{formatMoney(Number(transaction.amount), transaction.currency)}</p><p className={`mt-1 text-[9px] capitalize ${transaction.status === 'completed' ? 'text-[#4f8c75]' : 'text-[#9b8050]'}`}>{humanize(transaction.status)}</p></div>
        {(canPrintReceipt || onStatusOverride || onDelete) && <div className="flex w-full flex-wrap justify-end gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
          {canPrintReceipt && <button type="button" onClick={() => setReceipt(transaction)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9]" aria-label={`View receipt ${transaction.reference}`}><FileText size={13} /><span className="hidden sm:inline">Receipt</span></button>}
          {onStatusOverride && <button type="button" onClick={() => setHistoryTarget(transaction)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9]" aria-label={`View status history for ${transaction.reference}`}><History size={13} /><span className="hidden sm:inline">History</span></button>}
          {onStatusOverride && transaction.type !== 'deposit_request' && transaction.type !== 'withdrawal_request' && <button type="button" disabled={statusPending} onClick={() => onStatusOverride(transaction)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9] disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Override status for ${transaction.reference}`}><RefreshCw size={13} /><span className="hidden sm:inline">Status</span></button>}
          {onDelete && <button type="button" disabled={deletePending} onClick={() => { setDeleteTarget(transaction); setDeleteReason(''); setDeletePin(''); setDeleteError(''); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#ead8d5] px-2.5 py-2 text-[9px] font-bold text-[#a24940] hover:bg-[#fff7f5] disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Permanently delete transaction ${transaction.reference}`}><Trash2 size={13} /><span className="hidden sm:inline">Delete</span></button>}
        </div>}
      </div>;
    })}</div>
    {receipt && <ReceiptDialog transaction={receipt} onClose={() => setReceipt(null)} />}
    {historyTarget && <TransactionStatusHistoryDialog transaction={historyTarget} onClose={() => setHistoryTarget(null)} />}
    {deleteTarget && onDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14263e]/55 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="delete-transaction-title" className="w-full max-w-lg rounded-[22px] border border-[#dfe7ec] bg-white p-5 shadow-2xl sm:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#a24940]">Permanent action</p>
        <h2 id="delete-transaction-title" className="mt-1 text-[16px] font-bold text-[#29425c]">Delete transaction?</h2>
        <p className="mt-2 break-all text-[10px] text-[#7e8d9c]">{deleteTarget.reference}</p>
        <p className="mt-4 rounded-lg border border-[#f0d6d2] bg-[#fff7f5] px-4 py-3 text-[10px] leading-5 text-[#8f4a43]">This permanently removes the transaction and its ledger entries. Affected wallet balances will change, and this cannot be undone.</p>
        <form onSubmit={submitDelete} className="mt-5 space-y-4">
          <Field label="Audit reason">
            <textarea required minLength={5} maxLength={500} rows={3} value={deleteReason} onChange={event => setDeleteReason(event.target.value)} className={`${inputClass} h-auto py-3`} />
          </Field>
          <Field label="Your 6-digit transaction PIN">
            <input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={deletePin} onChange={event => setDeletePin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} />
          </Field>
          {deleteError && <p role="alert" className="rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{deleteError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border border-[#dfe6eb] px-4 py-3 text-[10px] font-bold text-[#546b80] hover:bg-[#f5f8f9]">Cancel</button>
            <button disabled={deletePending || deleteReason.trim().length < 5 || deletePin.length !== 6} className="rounded-xl bg-[#a24940] px-4 py-3 text-[10px] font-bold text-white hover:bg-[#8f3c34] disabled:cursor-not-allowed disabled:opacity-50">{deletePending ? 'Deleting…' : 'Permanently delete'}</button>
          </div>
        </form>
      </section>
    </div>}
  </>;
}

function TransactionStatusHistoryDialog({
  transaction,
  onClose,
}: {
  transaction: BankTransaction;
  onClose: () => void;
}) {
  const history = useListAdminTransactionStatusHistory(transaction.id, {
    query: {
      queryKey: getListAdminTransactionStatusHistoryQueryKey(transaction.id),
      retry: false,
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#14263e]/55 p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="transaction-status-history-title" className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-[22px] border border-[#dfe7ec] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Administrator audit record</p>
            <h2 id="transaction-status-history-title" className="mt-1 text-[16px] font-bold text-[#29425c]">Status change history</h2>
            <p className="mt-1 break-all text-[10px] text-[#7e8d9c]">{transaction.reference}</p>
          </div>
          <button type="button" aria-label="Close status history" onClick={onClose} className="rounded-lg p-2 text-[#6d8092] hover:bg-[#f1f5f7]"><X size={16} /></button>
        </div>
        <p className="mt-4 rounded-lg border border-[#e5e9ed] bg-[#f7f9fa] px-4 py-3 text-[10px] leading-4 text-[#64798e]">This is a read-only audit history. Viewing it does not change the transaction or wallet balances.</p>
        <div className="mt-5">
          {history.isLoading ? <ListSkeleton /> : history.isError ? <InlineError text="Status history is unavailable." retry={() => history.refetch()} /> : history.data?.length ? (
            <ol className="space-y-3">
              {history.data.map((entry, index) => (
                <li key={`${entry.timestamp}-${entry.actorEmail}-${index}`} className="rounded-xl border border-[#e5ebef] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-[#344b64]">{humanize(entry.previousStatus)} <ArrowRight size={12} className="mx-1 inline text-[#73939a]" /> {humanize(entry.newStatus)}</p>
                    <time className="text-[9px] text-[#8291a0]" dateTime={entry.timestamp}>{formatDateTime(entry.timestamp)}</time>
                  </div>
                  <p className="mt-2 text-[10px] text-[#5a7086]">Changed by <b className="text-[#344b64]">{entry.actorName}</b> · {entry.actorEmail}</p>
                  <p className="mt-3 whitespace-pre-wrap text-[10px] leading-5 text-[#61758a]"><b className="text-[#40566e]">Reason:</b> {entry.reason}</p>
                  <p className="mt-3 text-[9px] text-[#8492a0]">Affected member{entry.affectedMembers.length === 1 ? '' : 's'}: {entry.affectedMembers.map(member => `${member.name} (${member.email})`).join(', ')}</p>
                </li>
              ))}
            </ol>
          ) : <EmptyState title="No status changes recorded" text="This transaction has not had an administrator status override." />}
        </div>
        <div className="mt-5 flex justify-end border-t border-[#edf0f2] pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-[#dfe6eb] px-4 py-3 text-[10px] font-bold text-[#546b80] hover:bg-[#f5f8f9]">Close</button>
        </div>
      </section>
    </div>
  );
}

function TransactionStatusDialog({
  transaction,
  pending,
  onClose,
  onSave,
}: {
  transaction: BankTransaction;
  pending: boolean;
  onClose: () => void;
  onSave: (status: BankTransaction['status'], reason: string, transactionPin: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<BankTransaction['status']>(transaction.status);
  const [reason, setReason] = useState('');
  const [transactionPin, setTransactionPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setStatus(transaction.status);
    setReason('');
    setTransactionPin('');
    setError('');
  }, [transaction.id, transaction.status]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      await onSave(status, reason.trim(), transactionPin);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The transaction status could not be updated.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14263e]/55 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="transaction-status-title" className="w-full max-w-lg rounded-[22px] border border-[#dfe7ec] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Admin transaction control</p><h2 id="transaction-status-title" className="mt-1 text-[16px] font-bold text-[#29425c]">Override recorded status</h2><p className="mt-1 break-all text-[10px] text-[#7e8d9c]">{transaction.reference}</p></div>
          <button type="button" aria-label="Close status override" onClick={onClose} className="rounded-lg p-2 text-[#6d8092] hover:bg-[#f1f5f7]"><X size={16} /></button>
        </div>
        <p className="mt-4 rounded-lg border border-[#e5e9ed] bg-[#f7f9fa] px-4 py-3 text-[10px] leading-4 text-[#64798e]">This changes the transaction’s recorded status only. It does not change wallet balances, ledger entries, or move funds.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="New status">
            <select value={status} onChange={event => setStatus(event.target.value as BankTransaction['status'])} className={inputClass}>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="reversed">Reversed</option>
            </select>
          </Field>
          <Field label="Audit reason">
            <textarea required minLength={5} maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why this recorded status is being changed." className={`${inputClass} h-auto py-3`} />
          </Field>
          <Field label="Your 6-digit transaction PIN">
            <input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} />
          </Field>
          {error && <p role="alert" className="rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#dfe6eb] px-4 py-3 text-[10px] font-bold text-[#546b80] hover:bg-[#f5f8f9]">Cancel</button>
            <button disabled={pending || status === transaction.status || reason.trim().length < 5 || transactionPin.length !== 6} className="rounded-xl bg-[#142f51] px-4 py-3 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Saving status…' : 'Save status'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ReceiptDialog({ transaction, onClose }: { transaction: BankTransaction; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const downloadPdf = async () => {
    setDownloadError('');
    setDownloading(true);
    try {
      if (transaction.status !== 'completed') {
        throw new Error('PDF receipts are available for completed transactions only.');
      }
      await downloadTransactionReceiptPdf({
        reference: transaction.reference,
        amount: formatMoney(Number(transaction.amount), transaction.currency),
        status: humanize(transaction.status),
        date: formatDate(transaction.createdAt),
        description: transaction.description || transactionDisplayType(transaction),
        counterparty: transaction.counterparty || 'Internal ledger',
        activity: transactionDisplayType(transaction),
        disclaimer: 'This receipt records an entry in the Globus internal ledger. It is not proof of funds received or sent by an outside account. Globus does not connect to a bank, payment gateway, or real-money transfer service.',
      }, `${import.meta.env.BASE_URL}globus-wordmark.png`);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'The PDF receipt could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="receipt-backdrop fixed inset-0 z-50 grid place-items-center bg-[#10243c]/55 p-4 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="receipt-title"
        aria-modal="true"
        className="receipt-dialog w-full max-w-md rounded-[22px] bg-white p-6 shadow-2xl sm:p-8"
        role="dialog"
      >
        <article className="receipt-print">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#518c91]">Internal ledger receipt</p>
              <h2 id="receipt-title" className="bank-display mt-2 text-[24px] font-semibold text-[#203851]">{transactionDisplayType(transaction)}</h2>
            </div>
            <button type="button" aria-label="Close receipt" onClick={onClose} className="receipt-screen-only grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#718196] hover:bg-[#f1f4f6]"><X size={17} /></button>
          </div>
          <p className="mt-5 border-b border-dashed border-[#dfe6eb] pb-5 text-[28px] font-semibold tracking-[-.04em] text-[#203851]">{formatMoney(Number(transaction.amount), transaction.currency)}</p>
          <dl className="mt-5 space-y-4 text-[11px]">
            <div className="flex justify-between gap-4"><dt className="text-[#8492a1]">Reference</dt><dd className="break-all text-right font-mono font-semibold text-[#40566e]">{transaction.reference}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#8492a1]">Description</dt><dd className="text-right font-semibold text-[#40566e]">{transaction.description || transactionDisplayType(transaction)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#8492a1]">Counterparty label</dt><dd className="text-right font-semibold text-[#40566e]">{transaction.counterparty || 'Internal ledger'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#8492a1]">Recorded</dt><dd className="text-right font-semibold text-[#40566e]">{formatDate(transaction.createdAt)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#8492a1]">Status</dt><dd className="text-right font-semibold capitalize text-[#40566e]">{humanize(transaction.status)}</dd></div>
          </dl>
          <p className="mt-5 rounded-lg border border-[#e5ecef] bg-[#f7f9fa] p-3 text-[9px] leading-4 text-[#718294]">This receipt records an entry in the Globus internal ledger. It is not proof of funds received or sent by an outside account.</p>
        </article>
        <div className="receipt-actions mt-6 flex items-center justify-between border-t border-[#edf0f2] pt-5">
          <span className="text-[9px] font-bold uppercase tracking-[.13em] text-[#56837f]">Internal record</span>
          <div className="flex gap-2">
            <button type="button" data-testid="button-download-receipt-pdf" disabled={downloading || transaction.status !== 'completed'} onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-lg border border-[#dfe7eb] px-3 py-2.5 text-[10px] font-bold text-[#4a667e] hover:bg-[#f5f8f9] disabled:cursor-not-allowed disabled:opacity-50"><Download size={14} /> {downloading ? 'Preparing PDF…' : 'Download PDF'}</button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#142f51] px-4 py-2.5 text-[10px] font-bold text-white hover:bg-[#1b4269]"><Printer size={14} /> Print / Save PDF</button>
          </div>
        </div>
        {downloadError && <p role="alert" data-testid="status-receipt-download-error" className="mt-3 text-right text-[10px] text-[#a24940]">{downloadError}</p>}
      </section>
    </div>
  );
}

function StatusLine({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[11px] text-[#8793a1]">{label}</span><span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${positive ? 'text-[#4c836e]' : 'text-[#927944]'}`}><span className={`h-1.5 w-1.5 rounded-full ${positive ? 'bg-[#71ad8d]' : 'bg-[#d0ad5d]'}`} />{value}</span></div>;
}

function ActionTile({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return <Link href={href} className="flex items-center gap-2.5 rounded-xl border border-[#e5ebef] bg-[#fbfcfd] px-3 py-3 text-[11px] font-bold text-[#3d556d] transition hover:border-[#bbd7d8] hover:bg-[#f3f9f9]"><span className="text-[#478b90]">{icon}</span>{label}</Link>;
}

function TrustNote({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <div className="flex gap-3"><span className="mt-0.5 text-[#498a8e]">{icon}</span><span><b className="block text-[12px] text-[#304761]">{title}</b><span className="mt-1 block max-w-[280px] text-[11px] leading-5 text-[#7b8b9d]">{copy}</span></span></div>;
}

function FeatureBlock({ number, title, copy }: { number: string; title: string; copy: string }) {
  return <article className="border-t border-[#dfe6eb] pt-4"><span className="font-mono text-[10px] text-[#61959a]">{number} /</span><h3 className="mt-2 text-[14px] font-bold text-[#2c435c]">{title}</h3><p className="mt-2 text-[11px] leading-5 text-[#76879a]">{copy}</p></article>;
}

function Metric({ label, value }: { label: string; value?: number }) {
  return <div className="rounded-[18px] border border-[#e1e8ee] bg-white p-5"><p className="text-[10px] text-[#8290a0]">{label}</p><p className="bank-display mt-2 text-[30px] font-semibold text-[#223b56]">{value === undefined ? '—' : value.toLocaleString()}</p></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="px-6 py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#eef5f6] text-[#5b9397]"><Sparkles size={18} /></span><h3 className="mt-4 text-[13px] font-bold text-[#38506a]">{title}</h3><p className="mx-auto mt-1 max-w-[330px] text-[11px] leading-5 text-[#8693a1]">{text}</p></div>;
}

function PageSkeleton() {
  return <GlobusLoader label="Loading your Globus account" />;
}

function ListSkeleton() {
  return <div className="animate-pulse space-y-4 p-6">{[0, 1, 2, 3].map(item => <div key={item} className="flex items-center gap-4"><span className="h-9 w-9 rounded-xl bg-[#e7edf1]" /><span className="flex-1"><span className="block h-3 w-40 max-w-full rounded bg-[#e4ebef]" /><span className="mt-2 block h-2 w-28 rounded bg-[#edf1f3]" /></span><span className="h-3 w-16 rounded bg-[#e4ebef]" /></div>)}</div>;
}

function Failure({ title, text, retry }: { title: string; text?: string; retry: () => void }) {
  return <div className="mt-7 rounded-[20px] border border-[#eadfda] bg-white px-6 py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#fbf1ed] text-[#a56756]"><CircleHelp size={18} /></span><h2 className="mt-4 text-[14px] font-bold text-[#3c4d5e]">{title}</h2><p className="mt-2 text-[11px] text-[#8994a0]">{text ?? 'Please check your connection and try again.'}</p><button onClick={retry} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#dfe6ea] px-4 py-2.5 text-[10px] font-bold text-[#435b72] hover:bg-[#f4f7f9]"><RefreshCw size={13} /> Try again</button></div>;
}

function InlineError({ text, retry }: { text: string; retry: () => void }) {
  return <div className="flex items-center justify-between gap-4 px-5 py-5 text-[11px] text-[#a05c50]"><span>{text}</span><button onClick={retry} className="inline-flex shrink-0 items-center gap-1.5 font-bold"><RefreshCw size={12} />Retry</button></div>;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function humanize(value?: string | null) {
  return value ? value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase()) : 'Not available';
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const inputClass = 'h-11 w-full rounded-xl border border-[#dfe6eb] bg-white px-3.5 text-[12px] font-normal text-[#344b64] outline-none transition placeholder:text-[#a0acb7] focus:border-[#77aeb0] focus:ring-2 focus:ring-[#77aeb0]/15';
