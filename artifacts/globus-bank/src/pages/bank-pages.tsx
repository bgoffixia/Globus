import { Link } from 'wouter';
import {
  ArrowDownLeft,
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
  FileText,
  Globe2,
  LockKeyhole,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminAccessQueryKey,
  getGetAdminSummaryQueryKey,
  getGetBankDashboardQueryKey,
  getGetBankProfileQueryKey,
  getHealthCheckQueryKey,
  getListAdminLedgerQueryKey,
  getListAdminUsersQueryKey,
  getListBankTransactionsQueryKey,
  getListBankWalletsQueryKey,
  useCreateAdminFunding,
  useCreateBankTransfer,
  useCreateExternalTransfer,
  useCreateIncomingExternalTransfer,
  useCreateSimulationRequest,
  useGetAdminAccess,
  useGetAdminSummary,
  useGetBankDashboard,
  useGetBankProfile,
  useHealthCheck,
  useListAdminLedger,
  useListAdminUsers,
  useListBankTransactions,
  useListBankWallets,
  useUpdateAdminUserStatus,
  useUpdateBankProfile,
} from '@workspace/api-client-react';
import type { AdminUser, BankTransaction, Wallet } from '@workspace/api-client-react';

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
    <div className="min-h-[100dvh] overflow-hidden bg-[#f6f8fa] text-[#192e49]">
      <header className="relative z-10 mx-auto flex max-w-[1320px] items-center justify-between px-6 py-6 lg:px-12">
        <Link href="/" className="bank-brand flex items-center gap-3 text-[22px] font-extrabold">
          <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#132f52] text-[16px] text-[#d1b05f]">G</span>
          globus
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] font-medium text-[#607187] md:flex">
          <Link href="/about" className="hover:text-[#142d4d]">About</Link>
          <Link href="/fees" className="hover:text-[#142d4d]">Fees</Link>
          <Link href="/help" className="hover:text-[#142d4d]">Help</Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/sign-in" className="rounded-xl px-3 py-2.5 text-[12px] font-bold text-[#263e5b] hover:bg-[#eaf0f4] sm:px-4 sm:text-[13px]">Sign in</Link>
          <Link href="/sign-up" className="rounded-xl bg-[#142f51] px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-[#1b4269] sm:px-5 sm:text-[13px]">Open an account</Link>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-[1320px] items-center gap-14 px-6 pb-20 pt-9 lg:grid-cols-[1.04fr_.96fr] lg:px-12 lg:pb-28 lg:pt-16">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dbe7e9] bg-white px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#3b777d]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#55a5a9]" />
            A simulation-first money platform
          </div>
          <h1 className="bank-display max-w-[700px] text-[clamp(3.2rem,7.3vw,6.5rem)] font-semibold leading-[.98] tracking-[-.07em] text-[#142c49]">
            Your Money.
            <br />
            <span className="text-[#438f98]">Your World.</span>
            <br />
            One Wallet.
          </h1>
          <p className="mt-7 max-w-[510px] text-[16px] leading-7 text-[#64758a] sm:text-[18px] sm:leading-8">
            Bring your currencies together, understand every movement, and simulate cross-border transfers in a clear, controlled environment.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/sign-up" className="inline-flex items-center gap-3 rounded-xl bg-[#152f50] px-6 py-4 text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(18,43,75,.16)] transition hover:-translate-y-0.5 hover:bg-[#1b4168]">
              Get started <ArrowRight size={16} />
            </Link>
            <Link href="/about" className="rounded-xl px-5 py-4 text-[13px] font-bold text-[#36506c] hover:bg-[#eaf0f4]">How Globus works</Link>
          </div>
          <div className="mt-11 flex flex-wrap gap-x-7 gap-y-3 text-[11px] font-medium text-[#68798d]">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[#478b8e]" /> Simulated activity clearly marked</span>
            <span className="inline-flex items-center gap-2"><Globe2 size={15} className="text-[#478b8e]" /> Six supported currencies</span>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[560px]">
          <div className="absolute -right-12 -top-14 h-72 w-72 rounded-full bg-[#dfeef0] blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-[#eae5d6] blur-3xl" />
          <div className="relative rotate-[1.2deg] rounded-[28px] border border-white/80 bg-white p-4 shadow-[0_34px_90px_rgba(31,56,83,.17)] sm:p-6">
            <div className="rounded-[22px] bg-[#f4f7f9] p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#78889a]">Illustrative interface</p>
                  <p className="mt-1 text-[11px] text-[#8492a2]">No account or balance data shown</p>
                </div>
                <span className="rounded-lg border border-[#d5e6e7] bg-[#edf7f7] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#43868b]">Simulation mode</span>
              </div>
              <div className="balance-panel mt-5 overflow-hidden rounded-[19px] px-5 py-6 text-white sm:px-7 sm:py-7">
                <div className="flex items-center justify-between text-[11px] text-[#d4e1eb]">
                  <span>Provider-backed balance</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#e4c876]" /> USD reference</span>
                </div>
                <div className="bank-display mt-3 text-[30px] font-semibold tracking-[-.05em] sm:text-[38px]">Not available</div>
                <div className="mt-5 flex gap-2">
                  {currencies.map((code, i) => <span key={code} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${i === 0 ? 'bg-white/15 text-white' : 'bg-white/[.07] text-[#cedce6]'}`}>{code}</span>)}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ['US dollar', 'Provider not configured', 'USD'],
                  ['Euro', 'Provider not configured', 'EUR'],
                ].map(([name, value, code]) => (
                  <div key={code} className="rounded-2xl border border-[#e6ebef] bg-white p-4">
                    <div className="flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#edf5f6] text-[10px] font-bold text-[#43878e]">{code.slice(0, 2)}</span><span className="text-[9px] font-semibold text-[#8b98a7]">{code}</span></div>
                    <p className="mt-4 text-[10px] text-[#8290a0]">{name}</p>
                    <p className="mt-1 font-semibold text-[#1e3653]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-white px-4 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef5f5] text-[#4b898e]"><ArrowUpRight size={16} /></span>
                <div className="flex-1"><p className="text-[11px] font-semibold text-[#334b66]">No activity yet</p><p className="mt-0.5 text-[10px] text-[#8b98a7]">Transactions appear only after a real app action</p></div>
                <p className="text-[12px] font-semibold text-[#2e665f]">—</p>
              </div>
            </div>
            <div className="absolute -left-7 top-[38%] hidden -rotate-[4deg] items-center gap-3 rounded-2xl border border-[#e8edf0] bg-white px-4 py-3 shadow-lg sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f3f4] text-[#4b8f94]"><LockKeyhole size={16} /></span>
              <span><b className="block text-[11px] text-[#30465f]">Clear by design</b><small className="mt-1 block text-[9px] text-[#8391a1]">Simulated activity is clearly identified</small></span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e2e8ed] bg-white">
        <div className="mx-auto grid max-w-[1320px] gap-8 px-6 py-8 sm:grid-cols-3 lg:px-12">
          <TrustNote icon={<Globe2 size={17} />} title="One view, many currencies" copy="Keep USD, EUR, GBP, NGN, CAD and AUD in view." />
          <TrustNote icon={<ShieldCheck size={17} />} title="Simulation, stated plainly" copy="All transaction activity is fictional. No payment provider is connected." />
          <TrustNote icon={<BadgeCheck size={17} />} title="No banking claims" copy="Globus is a software platform, not a licensed bank." />
        </div>
      </section>
      <section className="mx-auto grid max-w-[1320px] gap-12 px-6 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-12 lg:py-28">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#528f95]">A considered way to explore</p>
          <h2 className="bank-display mt-4 max-w-[450px] text-[42px] font-semibold leading-[1.08] text-[#17304f] sm:text-[52px]">Know what’s real.<br />Know what’s simulated.</h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <FeatureBlock number="01" title="See the whole picture" copy="Review individual currency wallets, pending amounts and recent transactions in one focused workspace." />
          <FeatureBlock number="02" title="Practice with purpose" copy="Simulate member transfers, external sends and incoming transfers from a labeled external source, with each ledger effect clearly shown." />
          <FeatureBlock number="03" title="Understand the limits" copy="Adding funds, withdrawals and currency exchanges record a request. They do not move money while providers are unconfigured." />
          <FeatureBlock number="04" title="Keep a clean record" copy="Every simulated transaction has a reference, status and timestamp for straightforward review." />
        </div>
      </section>
      <section className="mx-6 mb-16 rounded-[28px] bg-[#132f51] px-7 py-12 text-white sm:mx-10 sm:px-12 lg:mx-auto lg:max-w-[1240px] lg:px-16 lg:py-16">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#a6d5d8]">Make your next step clearer</p><h2 className="bank-display mt-3 max-w-[640px] text-[34px] font-semibold leading-tight sm:text-[45px]">Your financial toolkit, ready to explore.</h2><p className="mt-4 max-w-[520px] text-[14px] leading-6 text-[#cfdae4]">Start with a simulated account and see how Globus brings international money workflows into focus.</p></div>
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
      <PageHeading eyebrow="Your overview" title={`Good to see you${dash?.profile.firstName ? `, ${dash.profile.firstName}` : ''}.`} subtitle="A clear view of your currencies and recent simulated activity." />
      <div className="mt-7 grid gap-5 xl:grid-cols-[1.32fr_.68fr]">
        <section className="balance-panel relative overflow-hidden rounded-[22px] p-6 text-white sm:p-8">
          <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border border-white/[.08]" />
          <div className="absolute -right-3 -top-7 h-44 w-44 rounded-full border border-white/[.08]" />
          <div className="relative flex items-start justify-between gap-4">
            <div><p className="text-[11px] font-medium text-[#cad9e4]">{dash?.referenceCurrency} simulated balance</p><div className="bank-display mt-3 text-[40px] font-semibold tracking-[-.06em] sm:text-[54px]">{referenceBalance ? formatMoney(Number(referenceBalance.available), referenceBalance.currency) : '—'}</div><p className="mt-2 text-[11px] text-[#b5c7d4]">Fictional ledger value · other currencies stay separate</p></div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/[.08] px-3 py-2 text-[9px] font-bold uppercase tracking-[.13em] text-[#d9e7eb]"><span className="h-1.5 w-1.5 rounded-full bg-[#8fd2cf]" /> Simulation</span>
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
          {dash?.recentTransactions.length ? <TransactionList transactions={dash.recentTransactions.slice(0, 5)} /> : <EmptyState title="Nothing recorded yet" text="Your simulated activity will appear here." />}
        </section>
        <section className="rounded-[22px] border border-[#e2e9ef] bg-white p-6 sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#589198]">Available actions</p>
          <h2 className="bank-display mt-2 text-[24px] font-semibold text-[#203851]">Move at your pace.</h2>
          <p className="mt-2 text-[12px] leading-5 text-[#79899b]">Internal transfers are simulated. Provider actions only record a request.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <ActionTile href="/send" icon={<ArrowUpRight size={16} />} label="Send" />
            <ActionTile href="/receive" icon={<ArrowDownLeft size={16} />} label="Receive" />
            <ActionTile href="/add-money" icon={<WalletCards size={16} />} label="Add money" />
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
      <div className="mt-7 flex items-center gap-3 rounded-2xl border border-[#dce9ea] bg-[#eef7f7] px-4 py-4 text-[12px] leading-5 text-[#467b80]"><Globe2 size={17} className="shrink-0" /> Balances are simulated ledger values. They are not deposits or funds held by Globus.</div>
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
      <PageHeading eyebrow="Ledger view" title="Activity" subtitle="Search your recorded transactions. Each entry is clearly identified as simulated activity." />
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8695a5]" /><input aria-label="Search transactions" data-testid="input-transaction-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search description, reference or recipient" className="h-12 w-full rounded-xl border border-[#dfe6ec] bg-white pl-11 pr-4 text-[12px] outline-none transition focus:border-[#6aa6aa]" /></label>
        <select aria-label="Filter by currency" data-testid="select-transaction-currency" value={currency} onChange={event => setCurrency(event.target.value)} className="h-12 rounded-xl border border-[#dfe6ec] bg-white px-4 text-[12px] text-[#435872] outline-none focus:border-[#6aa6aa]"><option value="">All currencies</option>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select>
      </div>
      <section className="mt-5 overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0f3] px-5 py-4 sm:px-7"><p className="text-[13px] font-bold text-[#28405c]">Transaction history</p><span className="text-[10px] font-semibold text-[#8291a1]">{query.data?.length ?? 0} entries</span></div>
        {query.isLoading ? <ListSkeleton /> : query.isError ? <Failure title="Transaction history isn’t available" retry={() => query.refetch()} /> : query.data?.length ? <TransactionList transactions={query.data} /> : <EmptyState title="No matching activity" text="Try a different search, or come back after recording a simulated transaction." />}
      </section>
    </>
  );
}

export function SendPage() {
  const queryClient = useQueryClient();
  const walletsQuery = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const memberTransfer = useCreateBankTransfer();
  const externalTransfer = useCreateExternalTransfer();
  const [destinationType, setDestinationType] = useState<'member' | 'external'>('member');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [success, setSuccess] = useState<BankTransaction | null>(null);
  const [receipt, setReceipt] = useState<BankTransaction | null>(null);
  const [message, setMessage] = useState('');
  const available = Number(walletsQuery.data?.find(item => item.currency === currency)?.available ?? 0);
  const pending = memberTransfer.isPending || externalTransfer.isPending;
  const hasError = memberTransfer.isError || externalTransfer.isError;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setSuccess(null);
    const onSuccess = (transaction: BankTransaction) => {
      setSuccess(transaction);
      setRecipientEmail('');
      setRecipientName('');
      setDestinationCountry('');
      setAmount('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() });
    };
    const onError = (error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'The simulated transfer could not be recorded. Please try again.');
    };
    const idempotencyKey = crypto.randomUUID();
    if (destinationType === 'external') {
      externalTransfer.mutate({
        data: {
          recipientName: recipientName.trim(),
          destinationCountry: destinationCountry.trim(),
          currency,
          amount,
          ...(description.trim() ? { description: description.trim() } : {}),
          idempotencyKey,
        },
      }, { onSuccess, onError });
      return;
    }
    memberTransfer.mutate({
      data: {
        recipientEmail: recipientEmail.trim(),
        currency,
        amount,
        ...(description.trim() ? { description: description.trim() } : {}),
        idempotencyKey,
      },
    }, { onSuccess, onError });
  };
  return (
    <>
      <PageHeading eyebrow="Simulated transfer" title="Simulate a transfer" subtitle="See how a member or external transfer affects your simulated ledger. No real funds move." />
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} className="rounded-[22px] border border-[#e1e8ee] bg-white p-5 sm:p-8">
          <div className="mb-7 flex gap-3 rounded-xl border border-[#d9e9e9] bg-[#f0f8f8] p-4 text-[11px] leading-5 text-[#497b80]"><ShieldCheck size={17} className="mt-0.5 shrink-0" /><span><b className="text-[#2d646a]">Simulated transaction</b><br />This changes simulated ledger records only. No bank, payment network or external recipient account is contacted or credited.</span></div>
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-[11px] font-semibold text-[#465c74]">Transfer destination</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-[11px] font-semibold ${destinationType === 'member' ? 'border-[#77aeb0] bg-[#f0f8f8] text-[#2e6870]' : 'border-[#dfe6ec] text-[#667a8e]'}`}>
                  <input type="radio" name="destination-type" value="member" checked={destinationType === 'member'} onChange={() => setDestinationType('member')} />
                  Globus member
                </label>
                <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-[11px] font-semibold ${destinationType === 'external' ? 'border-[#77aeb0] bg-[#f0f8f8] text-[#2e6870]' : 'border-[#dfe6ec] text-[#667a8e]'}`}>
                  <input type="radio" name="destination-type" value="external" checked={destinationType === 'external'} onChange={() => setDestinationType('external')} />
                  External recipient
                </label>
              </div>
            </fieldset>
            {destinationType === 'member' ? (
              <Field label="Recipient email"><input required type="email" value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} placeholder="name@example.com" className={inputClass} /></Field>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Recipient name"><input required maxLength={120} value={recipientName} onChange={event => setRecipientName(event.target.value)} placeholder="Recipient name" className={inputClass} /></Field>
                  <Field label="Destination country"><input required minLength={2} maxLength={80} value={destinationCountry} onChange={event => setDestinationCountry(event.target.value)} placeholder="Country or region" className={inputClass} /></Field>
                </div>
                <p className="-mt-2 text-[10px] leading-4 text-[#8391a0]">Name and country are simulation labels only. Do not enter bank or payment account details.</p>
              </>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Currency"><select value={currency} onChange={event => setCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select></Field>
              <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max={available || undefined} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className={inputClass} /><span className="mt-1.5 block text-[10px] text-[#8391a0]">Available in {currency}: {formatMoney(available, currency)}</span></Field>
            </div>
            <Field label="Note (optional)"><input maxLength={140} value={description} onChange={event => setDescription(event.target.value)} placeholder="What’s this transfer for?" className={inputClass} /></Field>
          </div>
          {(message || hasError) && <p role="alert" className="mt-5 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{message || 'Please check the transfer details and try again.'}</p>}
          {success && <div role="status" className="mt-5 rounded-xl border border-[#cfe5db] bg-[#f1f8f4] p-4 text-[12px] text-[#417461]"><p className="font-bold">Simulated {success.type === 'external_transfer' ? 'external' : 'member'} transfer recorded</p><p className="mt-1">Reference {success.reference} · {humanize(success.status)}</p><p className="mt-1">No real funds moved and no external account was credited.</p><button type="button" onClick={() => setReceipt(success)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#bfd8cc] bg-white px-3 py-2 text-[10px] font-bold text-[#3d725d] hover:bg-[#f7fbf8]"><FileText size={14} /> View receipt</button></div>}
          <button disabled={pending || !amount || Number(amount) <= 0 || Number(amount) > available || (destinationType === 'external' && (!recipientName.trim() || !destinationCountry.trim()))} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#142f51] text-[12px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Recording simulation…' : 'Simulate transfer'} <ArrowRight size={15} /></button>
        </form>
        <aside className="rounded-[22px] bg-[#eaf0f4] p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#638092]">Simulation only</p>
          <h2 className="bank-display mt-3 text-[23px] font-semibold leading-tight text-[#213a55]">Explore the transfer flow without moving money.</h2>
          <ul className="mt-5 space-y-4 text-[11px] leading-5 text-[#60748a]"><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#43888b]" /> Member transfers require a registered Globus account.</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#43888b]" /> External recipient details are labels only; no bank account is used.</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#43888b]" /> The ledger records a fictional transaction; no provider is connected.</li></ul>
        </aside>
      </div>
      {receipt && <ReceiptDialog transaction={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

export function ProviderRequestPage({ type }: { type: 'deposit' | 'withdrawal' | 'exchange' }) {
  const queryClient = useQueryClient();
  const walletsQuery = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const mutation = useCreateSimulationRequest();
  const [currency, setCurrency] = useState<Currency>('USD');
  const [destination, setDestination] = useState<Currency>('EUR');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<{ reference: string; message: string; status: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const isExchange = type === 'exchange';
  const heading = type === 'deposit' ? 'Add money' : type === 'withdrawal' ? 'Withdraw' : 'Exchange';
  const sub = type === 'deposit' ? 'Record a simulated request to add funds to a currency wallet.' : type === 'withdrawal' ? 'Record a simulated withdrawal request from a currency wallet.' : 'Record a simulated exchange request between currency wallets.';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);
    setErrorMessage('');
    mutation.mutate({ data: { type, currency, ...(isExchange ? { destinationCurrency: destination } : {}), amount, idempotencyKey: crypto.randomUUID() } }, {
      onSuccess: request => {
        setResult(request);
        setAmount('');
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
      },
      onError: error => setErrorMessage(error instanceof Error ? error.message : 'Request could not be recorded. Please try again.'),
    });
  };
  return (
    <>
      <PageHeading eyebrow="Simulation" title={heading} subtitle={sub} />
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} className="rounded-[22px] border border-[#e1e8ee] bg-white p-5 sm:p-8">
          <div className="mb-7 rounded-xl border border-[#eadfbe] bg-[#fbf7eb] p-4">
            <div className="flex gap-3"><Clock3 size={17} className="mt-0.5 shrink-0 text-[#a17e36]" /><div><p className="text-[12px] font-bold text-[#715b2c]">Simulation only</p><p className="mt-1 text-[11px] leading-5 text-[#89784f]">This records a simulated request. No provider is connected and no funds are added, withdrawn or exchanged.</p></div></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={isExchange ? 'You exchange' : 'Wallet currency'}><select value={currency} onChange={event => setCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select></Field>
            {isExchange && <Field label="Into"><select value={destination} onChange={event => setDestination(event.target.value as Currency)} className={inputClass}>{currencies.filter(item => item !== currency).map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select></Field>}
            <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className={inputClass} /></Field>
          </div>
          {(errorMessage || mutation.isError) && <p role="alert" className="mt-5 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{errorMessage || 'The request could not be recorded.'}</p>}
          {result && <div role="status" className="mt-5 rounded-xl border border-[#d6e6e5] bg-[#f2f8f7] p-4 text-[12px] text-[#426e70]"><p className="font-bold">Request recorded · {humanize(result.status)}</p><p className="mt-1">{result.message}</p><p className="mt-2 font-mono text-[10px]">Reference {result.reference}</p></div>}
          <button disabled={mutation.isPending || !amount || Number(amount) <= 0} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#142f51] text-[12px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending ? 'Recording request…' : 'Record simulated request'} <ArrowRight size={15} /></button>
          <p className="mt-3 text-center text-[10px] text-[#8794a1]">No provider action will be attempted.</p>
        </form>
        <div className="rounded-[22px] border border-[#e1e8ee] bg-white p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#72859b]">Wallet availability</p>
          <div className="mt-4 space-y-3">{walletsQuery.isLoading ? <ListSkeleton /> : walletsQuery.isError ? <InlineError text="Wallet balances are unavailable." retry={() => walletsQuery.refetch()} /> : (walletsQuery.data ?? []).filter(wallet => wallet.currency === currency || (isExchange && wallet.currency === destination)).map(wallet => <WalletMini key={wallet.id} wallet={wallet} />)}</div>
          <Link href="/fees" className="mt-6 inline-flex items-center gap-1 text-[11px] font-bold text-[#3b7e84]">See fee disclosures <ChevronRight size={14} /></Link>
        </div>
      </div>
    </>
  );
}

export function ReceivePage() {
  const queryClient = useQueryClient();
  const profile = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const walletsQuery = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const incomingTransfer = useCreateIncomingExternalTransfer();
  const [copied, setCopied] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [sourceCountry, setSourceCountry] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState<BankTransaction | null>(null);
  const [receipt, setReceipt] = useState<BankTransaction | null>(null);
  const identifier = profile.data?.id ?? '';
  const submitIncomingTransfer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccess(null);
    incomingTransfer.mutate({
      data: {
        sourceName: sourceName.trim(),
        sourceCountry: sourceCountry.trim(),
        currency,
        amount,
        ...(description.trim() ? { description: description.trim() } : {}),
        idempotencyKey: crypto.randomUUID(),
      },
    }, {
      onSuccess: transaction => {
        setSuccess(transaction);
        setSourceName('');
        setSourceCountry('');
        setAmount('');
        setDescription('');
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() });
      },
      onError: error => setErrorMessage(error instanceof Error ? error.message : 'The simulated incoming transfer could not be recorded. Please try again.'),
    });
  };
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
      <PageHeading eyebrow="Receive" title="Your internal wallet ID" subtitle="Share this identifier with a registered Globus member for an internal simulated transfer." />
      {profile.isLoading ? <PageSkeleton /> : profile.isError ? <Failure title="Your wallet identifier isn’t available" retry={() => profile.refetch()} /> : (
        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_.78fr]">
          <section className="balance-panel rounded-[22px] p-6 text-white sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#a5d8d8]"><WalletCards size={22} /></span>
            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[.16em] text-[#bfd0dd]">Globus member identifier</p>
            <p className="mt-3 break-all font-mono text-[19px] font-semibold tracking-wide sm:text-[24px]">{identifier}</p>
            <button onClick={copyIdentifier} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-[11px] font-bold text-[#17314f] hover:bg-[#ecf3f5]"><Copy size={14} />{copied ? 'Copied' : 'Copy identifier'}</button>
            <p className="mt-7 max-w-lg text-[11px] leading-5 text-[#c1d0db]">This identifier is for internal Globus member-to-member simulated transfers. It is not a bank account number, routing number or payment address.</p>
          </section>
          <section className="rounded-[22px] border border-[#e1e8ee] bg-white p-6 sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#518c91]">How it works</p>
            <ol className="mt-5 space-y-5">{[['Share your email', 'The sender enters the email registered to your Globus profile.'], ['Confirm the currency', 'They choose one of your currency wallets and a simulated amount.'], ['Review activity', 'The simulated transfer appears in your transaction history.']].map(([title, copy], index) => <li key={title} className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#edf5f6] text-[11px] font-bold text-[#42868b]">0{index + 1}</span><span><b className="block text-[12px] text-[#2c425c]">{title}</b><span className="mt-1 block text-[11px] leading-5 text-[#7d8b9b]">{copy}</span></span></li>)}</ol>
            <Link href="/send" className="mt-7 inline-flex items-center gap-2 text-[11px] font-bold text-[#367b82]">Try a simulated transfer <ArrowRight size={14} /></Link>
          </section>
        </div>
      )}
      <section className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submitIncomingTransfer} className="rounded-[22px] border border-[#e1e8ee] bg-white p-5 sm:p-8">
          <PageHeading eyebrow="Simulation only" title="Record an incoming transfer" subtitle="Add a fictional external transfer to your simulated wallet history." />
          <div className="my-6 flex gap-3 rounded-xl border border-[#d9e9e9] bg-[#f0f8f8] p-4 text-[11px] leading-5 text-[#497b80]">
            <ShieldCheck size={17} className="mt-0.5 shrink-0" />
            <span><b className="text-[#2d646a]">No external account is involved</b><br />Source name and country are labels only. This credits only your simulated Globus wallet; no bank or payment provider is contacted.</span>
          </div>
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Source name"><input required maxLength={120} value={sourceName} onChange={event => setSourceName(event.target.value)} placeholder="Sender or organization" className={inputClass} /></Field>
              <Field label="Source country"><input required minLength={2} maxLength={80} value={sourceCountry} onChange={event => setSourceCountry(event.target.value)} placeholder="Country or region" className={inputClass} /></Field>
            </div>
            <p className="-mt-3 text-[10px] leading-4 text-[#8391a0]">Do not enter account numbers, routing details or payment credentials.</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Currency"><select value={currency} onChange={event => setCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select></Field>
              <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className={inputClass} /><span className="mt-1.5 block text-[10px] text-[#8391a0]">This will increase your simulated {currency} balance.</span></Field>
            </div>
            <Field label="Note (optional)"><input maxLength={140} value={description} onChange={event => setDescription(event.target.value)} placeholder="What is this simulated transfer for?" className={inputClass} /></Field>
          </div>
          {(errorMessage || incomingTransfer.isError) && <p role="alert" className="mt-5 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{errorMessage || 'Please check the transfer details and try again.'}</p>}
          {success && <div role="status" className="mt-5 rounded-xl border border-[#cfe5db] bg-[#f1f8f4] p-4 text-[12px] text-[#417461]"><p className="font-bold">Simulated incoming transfer recorded</p><p className="mt-1">Reference {success.reference} · {humanize(success.status)}</p><p className="mt-1">Only your simulated wallet was credited. No external account was contacted.</p><button type="button" onClick={() => setReceipt(success)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#bfd8cc] bg-white px-3 py-2 text-[10px] font-bold text-[#3d725d] hover:bg-[#f7fbf8]"><FileText size={14} /> View receipt</button></div>}
          <button disabled={incomingTransfer.isPending || !sourceName.trim() || sourceCountry.trim().length < 2 || !amount || Number(amount) <= 0} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#142f51] text-[12px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{incomingTransfer.isPending ? 'Recording simulation…' : 'Simulate incoming transfer'} <ArrowDownLeft size={15} /></button>
        </form>
        <aside className="rounded-[22px] bg-[#eaf0f4] p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#638092]">Wallet credit</p>
          <h2 className="bank-display mt-3 text-[23px] font-semibold leading-tight text-[#213a55]">Choose the currency wallet to receive the simulated amount.</h2>
          <div className="mt-5 space-y-3">{walletsQuery.isLoading ? <ListSkeleton /> : walletsQuery.isError ? <InlineError text="Wallet balances are unavailable." retry={() => walletsQuery.refetch()} /> : (walletsQuery.data ?? []).filter(wallet => wallet.currency === currency).map(wallet => <WalletMini key={wallet.id} wallet={wallet} />)}</div>
          <p className="mt-5 text-[10px] leading-5 text-[#60748a]">The transaction is recorded with balanced simulated ledger entries and appears as an incoming credit in your activity.</p>
        </aside>
      </section>
      {receipt && <ReceiptDialog transaction={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const query = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const update = useUpdateBankProfile();
  const { user } = useUser();
  const [note, setNote] = useState('');
  const [photoMessage, setPhotoMessage] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoPending, setPhotoPending] = useState(false);
  const profile = query.data;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [initialised, setInitialised] = useState(false);
  useEffect(() => {
    if (profile && !initialised) {
      setFirstName(profile.firstName ?? '');
      setLastName(profile.lastName ?? '');
      setPhone(profile.phone ?? '');
      setCountry(profile.country ?? '');
      setInitialised(true);
    }
  }, [profile, initialised]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNote('');
    update.mutate({ data: { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), country: country.trim(), acceptedTerms: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBankProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
        setAccepted(false);
        setNote('Profile saved. Account review status is managed separately.');
      },
      onError: error => setNote(error instanceof Error ? error.message : 'Profile could not be saved. Please try again.'),
    });
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
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <Failure title="Profile settings are unavailable" retry={() => query.refetch()} />;
  return (
    <>
      <PageHeading eyebrow="Account settings" title="Your profile" subtitle="Manage your details and review your account status." />
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={submit} className="rounded-[22px] border border-[#e1e8ee] bg-white p-5 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First name"><input required maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} className={inputClass} /></Field>
            <Field label="Last name"><input required maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} className={inputClass} /></Field>
            <Field label="Phone"><input required minLength={3} maxLength={32} value={phone} onChange={event => setPhone(event.target.value)} className={inputClass} /></Field>
            <Field label="Country or region"><input required minLength={2} maxLength={80} value={country} onChange={event => setCountry(event.target.value)} className={inputClass} /></Field>
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
          <div className="mt-6 border-t border-[#edf0f2] pt-5"><p className="text-[10px] text-[#8995a2]">Member since</p><p className="mt-1 text-[12px] font-semibold text-[#324962]">{formatDate(profile?.createdAt)}</p><p className="mt-4 text-[10px] leading-5 text-[#8895a3]">Globus is a simulation-only software platform and is not a licensed bank. Account status does not represent identity verification by a financial institution.</p></div>
        </section>
      </div>
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
  const [fundCurrency, setFundCurrency] = useState<Currency>('USD');
  const [fundAmount, setFundAmount] = useState('');
  const [fundReason, setFundReason] = useState('');
  const [fundingError, setFundingError] = useState('');
  const [fundingSuccess, setFundingSuccess] = useState<BankTransaction | null>(null);
  const params = useMemo(() => ({ ...(search.trim() ? { search: search.trim() } : {}), limit: 100 }), [search]);
  const users = useListAdminUsers(params, { query: { queryKey: getListAdminUsersQueryKey(params), enabled: !!access.data?.allowed } });
  const ledgerParams = { limit: 100 };
  const ledger = useListAdminLedger(ledgerParams, { query: { queryKey: getListAdminLedgerQueryKey(ledgerParams), enabled: !!access.data?.allowed } });
  const update = useUpdateAdminUserStatus();
  const funding = useCreateAdminFunding();
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
        currency: fundCurrency,
        amount: fundAmount,
        reason: fundReason.trim(),
        idempotencyKey: crypto.randomUUID(),
      },
    }, {
      onSuccess: transaction => {
        setFundingSuccess(transaction);
        setFundAmount('');
        setFundReason('');
        queryClient.invalidateQueries({ queryKey: getListAdminLedgerQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
      },
      onError: error => setFundingError(error instanceof Error ? error.message : 'Simulated funding could not be recorded.'),
    });
  };
  return (
    <>
      <PageHeading eyebrow="Restricted operations" title="Operations overview" subtitle="Review platform totals, registered users and the simulated ledger." />
      {summary.isError && <InlineError text="Summary totals are unavailable." retry={() => summary.refetch()} />}
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Registered users" value={summary.data?.registeredUsers} />
        <Metric label="Active wallets" value={summary.data?.activeWallets} />
        <Metric label="Pending provider requests" value={summary.data?.pendingProviderRequests} />
        <Metric label="Ledger transactions" value={summary.data?.ledgerTransactions} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#d9e7e8] bg-[#eff7f7] px-4 py-3 text-[11px] text-[#48767b]"><ShieldCheck size={15} /> Simulation mode {summary.data?.simulationMode ? 'is active' : 'status unavailable'} <span className="text-[#adc0c2]">/</span> Provider {humanize(summary.data?.providerStatus)}</div>
      {statusError && <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{statusError}</p>}
      {fundTarget && <section className="mt-6 rounded-[20px] border border-[#dfe7ec] bg-white p-5 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Simulation only</p><h2 className="mt-1 text-[15px] font-bold text-[#29425c]">Fund a user wallet</h2><p className="mt-1 text-[11px] text-[#7e8d9c]">{[fundTarget.firstName, fundTarget.lastName].filter(Boolean).join(' ') || 'Globus member'} · {fundTarget.email}</p></div>
          <button type="button" aria-label="Close funding form" onClick={() => { setFundTarget(null); setFundingError(''); setFundingSuccess(null); }} className="rounded-lg p-2 text-[#6d8092] hover:bg-[#f1f5f7]"><X size={16} /></button>
        </div>
        <p className="mb-5 rounded-lg border border-[#d9e8e9] bg-[#f2f8f8] px-4 py-3 text-[10px] leading-4 text-[#4e777a]">This posts fictional value to the selected currency wallet and writes an audit record. No real funds are sent. Maximum per entry: 1,000,000.00.</p>
        <form onSubmit={submitFunding} className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency"><select value={fundCurrency} onChange={event => setFundCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select></Field>
          <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max="1000000" value={fundAmount} onChange={event => setFundAmount(event.target.value)} placeholder="0.00" className={inputClass} /></Field>
          <div className="sm:col-span-2"><Field label="Reason (recorded in the audit log)"><textarea required minLength={5} maxLength={500} rows={3} value={fundReason} onChange={event => setFundReason(event.target.value)} placeholder="Reason for this simulated credit" className={`${inputClass} h-auto py-3`} /></Field></div>
          {fundingError && <p role="alert" className="sm:col-span-2 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{fundingError}</p>}
          {fundingSuccess && <p role="status" className="sm:col-span-2 rounded-lg border border-[#cfe5db] bg-[#f1f8f4] px-4 py-3 text-[11px] text-[#417461]">Simulated funding recorded · {fundingSuccess.reference}</p>}
          <div className="sm:col-span-2"><button disabled={funding.isPending || !fundAmount || !fundReason.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#142f51] px-5 text-[11px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{funding.isPending ? 'Recording funding…' : 'Record simulated funding'} <ArrowRight size={14} /></button></div>
        </form>
      </section>}
      <section className="mt-7 overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#edf0f3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div><h2 className="text-[14px] font-bold text-[#28405c]">Registered users</h2><p className="mt-1 text-[10px] text-[#8592a1]">Account status changes require a documented reason.</p></div><label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8996a4]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search users" className="h-10 w-full rounded-lg border border-[#e0e7ec] bg-white pl-9 pr-3 text-[11px] outline-none sm:w-[240px]" /></label></div>
        {users.isLoading ? <ListSkeleton /> : users.isError ? <InlineError text="User records are unavailable." retry={() => users.refetch()} /> : users.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-[#f7f9fa] text-[9px] uppercase tracking-[.13em] text-[#8291a0]"><tr><th className="px-6 py-3">Member</th><th className="px-4 py-3">Region</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Wallets</th><th className="px-6 py-3 text-right">Actions</th></tr></thead><tbody>{users.data.map(user => <tr key={user.id} className="border-t border-[#edf0f2] text-[11px] text-[#445a71]"><td className="px-6 py-4"><b className="block text-[#2d435c]">{[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Globus member'}</b><span className="mt-1 block text-[10px] text-[#8a97a5]">{user.email}</span></td><td className="px-4 py-4">{user.country || '—'}</td><td className="px-4 py-4">{humanize(user.verificationStatus)}</td><td className="px-4 py-4">{humanize(user.accountStatus)}</td><td className="px-4 py-4">{user.walletCount}</td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button disabled={user.accountStatus !== 'active'} onClick={() => { setFundTarget(user); setFundingError(''); setFundingSuccess(null); }} className="rounded-lg bg-[#eff7f7] px-3 py-2 text-[10px] font-bold text-[#36777c] hover:bg-[#e2f1f1] disabled:cursor-not-allowed disabled:opacity-40">Fund</button><button disabled={update.isPending} onClick={() => setStatus(user.id, user.accountStatus === 'active' ? 'suspended' : 'active')} className="rounded-lg border border-[#dfe6eb] px-3 py-2 text-[10px] font-bold text-[#3f5c75] hover:bg-[#f4f7f8] disabled:opacity-50">{user.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No users found" text="Try another email or name." />}
      </section>
      <section className="mt-6 overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
        <div className="border-b border-[#edf0f3] px-5 py-4 sm:px-7"><h2 className="text-[14px] font-bold text-[#28405c]">Ledger review</h2><p className="mt-1 text-[10px] text-[#8592a1]">Recorded simulated activity; no provider settlement is implied.</p></div>
        {ledger.isLoading ? <ListSkeleton /> : ledger.isError ? <InlineError text="Ledger records are unavailable." retry={() => ledger.refetch()} /> : ledger.data?.length ? <TransactionList transactions={ledger.data} /> : <EmptyState title="Ledger is clear" text="There are no recorded transactions to review." />}
      </section>
    </>
  );
}

const disclosureCopy: Record<string, { eyebrow: string; title: string; intro: string; sections: [string, string][] }> = {
  '/about': { eyebrow: 'About Globus', title: 'International by perspective. Careful by design.', intro: 'Globus is a simulation-only multi-currency software platform for people who want a clearer view of global money workflows.', sections: [['A platform, not a bank', 'Globus is not a licensed bank, payment institution or custodian. It does not accept deposits or hold customer funds.'], ['Simulated value stays simulated', 'Currency balances and transfers shown in the product are fictional ledger records. No provider is connected and no live money moves.'], ['Built for clear review', 'Balances, activity and provider requests are presented with statuses and references to make their state easier to understand.']] },
  '/help': { eyebrow: 'Support', title: 'Help, without the fine print.', intro: 'Find your way around Globus and understand what happens when you simulate a transaction.', sections: [['Why are transactions simulated?', 'Globus records fictional ledger activity only. No live payment provider is connected and no external payment can complete.'], ['Can I send someone money?', 'You can simulate a transfer to a registered Globus member or record a simulated external-recipient transfer. Neither is a real payment.'], ['Where can I find my wallet identifier?', 'Open Receive from your account navigation. The identifier helps another registered member direct an internal simulated transfer.']] },
  '/fees': { eyebrow: 'Fees and rates', title: 'Understand costs before any action.', intro: 'Globus does not process provider-backed deposits, withdrawals or currency exchanges.', sections: [['Provider availability', 'External money movement providers are not connected. Add-money, withdrawal and exchange actions create simulated requests only.'], ['Fees', 'No provider transaction fee is charged by Globus because no provider action completes. This does not describe any future third-party provider pricing.'], ['Exchange rates', 'No live exchange quote or guaranteed conversion is provided. Currency values should not be interpreted as exchangeable funds.']] },
  '/privacy': { eyebrow: 'Privacy notice', title: 'Your information deserves clarity.', intro: 'This page summarizes the kinds of account information a Globus platform may use to provide its software experience.', sections: [['Account details', 'Profile details and account identifiers are used to associate your simulated records with your account. Authentication is provided through Clerk.'], ['Operational records', 'Transactions and requests recorded through the product may include references, status, currency, amount, descriptions and timestamps.'], ['Your choices', 'Use Settings to review your profile. Contact the support team with questions about account information or platform operations.']] },
  '/terms': { eyebrow: 'Terms of use', title: 'A platform for simulation, not deposits.', intro: 'By using Globus, you understand that the product records simulated financial activity only.', sections: [['No banking service', 'Globus is not a licensed bank and does not accept deposits, provide credit, custody funds or promise payment execution.'], ['Simulated records', 'Displayed balances and transactions are fictional ledger records. Provider requests may be stored for testing but do not mean a deposit, withdrawal or exchange has occurred.'], ['Use responsibly', 'Do not rely on simulated balances or status labels for financial, tax, investment or payment decisions.']] },
  '/contact': { eyebrow: 'Contact', title: 'Contact information is not configured yet.', intro: 'This simulation-only product does not currently have a verified support channel.', sections: [['Account help', 'Visit Help for guidance about the software experience. Do not include passwords, verification codes or sensitive payment details in support requests.'], ['Recorded activity', 'Include the transaction reference when asking about a simulated entry in your account.'], ['Operational disclosure', 'Globus support cannot complete, trace or reverse a real payment through this product.']] },
};

export function DisclosurePage({ path }: { path: string }) {
  const data = disclosureCopy[path] ?? disclosureCopy['/about'];
  return (
    <div className="min-h-[100dvh] bg-[#f5f8fa]">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-6"><Link href="/" className="bank-brand flex items-center gap-3 text-[21px] font-extrabold text-[#17304f]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#142f51] text-[14px] text-[#d2b562]">G</span>globus</Link><Link href="/" className="text-[12px] font-semibold text-[#456077] hover:text-[#347e83]">Back to home</Link></header>
      <main className="mx-auto max-w-[1020px] px-6 pb-20 pt-10 sm:pt-16">
        <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#4b8b90]">{data.eyebrow}</p>
        <h1 className="bank-display mt-4 max-w-[760px] text-[clamp(2.6rem,7vw,5.2rem)] font-semibold leading-[1.02] text-[#16304f]">{data.title}</h1>
        <p className="mt-6 max-w-[670px] text-[15px] leading-7 text-[#66788c]">{data.intro}</p>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {data.sections.map(([title, copy], index) => <article key={title} className="rounded-[20px] border border-[#e0e8ed] bg-white p-6 sm:p-7"><span className="font-mono text-[10px] font-bold tracking-[.14em] text-[#70a0a1]">0{index + 1}</span><h2 className="mt-4 text-[17px] font-bold text-[#27405a]">{title}</h2><p className="mt-3 text-[12px] leading-6 text-[#76869a]">{copy}</p></article>)}
        </div>
        <div className="mt-8 rounded-xl border border-[#d9e7e8] bg-[#edf6f6] p-5 text-[11px] leading-5 text-[#4c7579]"><b className="text-[#35676b]">Important:</b> Globus Bank is a product name for a software platform. It is not a representation that Globus is a licensed bank or financial institution.</div>
      </main>
      <footer className="border-t border-[#e2e8ed] bg-white px-6 py-7 text-center text-[10px] text-[#8794a3]">Globus · Simulation-only multi-currency software</footer>
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#548d92]">{eyebrow}</p><h1 className="bank-display mt-2 text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.08] text-[#1a334f]">{title}</h1><p className="mt-2 max-w-[760px] text-[12px] leading-5 text-[#76879a]">{subtitle}</p></div>;
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

function TransactionList({ transactions }: { transactions: BankTransaction[] }) {
  const [receipt, setReceipt] = useState<BankTransaction | null>(null);
  return <>
    <div>{transactions.map(transaction => {
      const isIncoming = transaction.type === 'transfer_in' || transaction.type === 'external_transfer_in' || transaction.type === 'simulation_credit' || transaction.type === 'admin_funding';
      const canPrintReceipt = transaction.status === 'completed';
      return <div key={transaction.id} className="flex items-center gap-3 border-b border-[#edf0f2] px-5 py-4 last:border-0 sm:gap-4 sm:px-7">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isIncoming ? 'bg-[#edf7f3] text-[#4d8c72]' : 'bg-[#f0f4f7] text-[#658097]'}`}>{isIncoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#334a63]">{transaction.description || humanize(transaction.type)}</p><p className="mt-1 truncate text-[9px] text-[#8996a4]">{transaction.counterparty || 'Simulation ledger'} · {formatDate(transaction.createdAt)} · {transaction.mode}</p></div>
        <div className="shrink-0 text-right"><p className={`text-[11px] font-bold ${isIncoming ? 'text-[#417f69]' : 'text-[#3c5269]'}`}>{isIncoming ? '+' : '−'}{formatMoney(Number(transaction.amount), transaction.currency)}</p><p className={`mt-1 text-[9px] capitalize ${transaction.status === 'completed' ? 'text-[#4f8c75]' : 'text-[#9b8050]'}`}>{humanize(transaction.status)}</p></div>
        {canPrintReceipt && <button type="button" onClick={() => setReceipt(transaction)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9]" aria-label={`View receipt ${transaction.reference}`}><FileText size={13} /><span className="hidden sm:inline">Receipt</span></button>}
      </div>;
    })}</div>
    {receipt && <ReceiptDialog transaction={receipt} onClose={() => setReceipt(null)} />}
  </>;
}

function ReceiptDialog({ transaction, onClose }: { transaction: BankTransaction; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

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
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#518c91]">Simulation receipt</p>
              <h2 id="receipt-title" className="bank-display mt-2 text-[24px] font-semibold text-[#203851]">{humanize(transaction.type)}</h2>
            </div>
            <button type="button" aria-label="Close receipt" onClick={onClose} className="receipt-screen-only grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#718196] hover:bg-[#f1f4f6]"><X size={17} /></button>
          </div>
          <p className="mt-5 border-b border-dashed border-[#dfe6eb] pb-5 text-[28px] font-semibold tracking-[-.04em] text-[#203851]">{formatMoney(Number(transaction.amount), transaction.currency)}</p>
          <dl className="mt-5 space-y-4 text-[11px]">
            <div className="flex justify-between gap-4"><dt className="text-[#8492a1]">Reference</dt><dd className="break-all text-right font-mono font-semibold text-[#40566e]">{transaction.reference}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#8492a1]">Description</dt><dd className="text-right font-semibold text-[#40566e]">{transaction.description || humanize(transaction.type)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#8492a1]">Source or recipient</dt><dd className="text-right font-semibold text-[#40566e]">{transaction.counterparty || 'Simulation ledger'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#8492a1]">Recorded</dt><dd className="text-right font-semibold text-[#40566e]">{formatDate(transaction.createdAt)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#8492a1]">Status</dt><dd className="text-right font-semibold capitalize text-[#40566e]">{humanize(transaction.status)} · simulated</dd></div>
          </dl>
          <p className="mt-5 rounded-lg border border-[#e5ecef] bg-[#f7f9fa] p-3 text-[9px] leading-4 text-[#718294]">This receipt records fictional activity only. It is not proof of payment; no real funds moved and no external account was credited.</p>
        </article>
        <div className="receipt-actions mt-6 flex items-center justify-between border-t border-[#edf0f2] pt-5">
          <span className="text-[9px] font-bold uppercase tracking-[.13em] text-[#56837f]">Simulation only</span>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#142f51] px-4 py-2.5 text-[10px] font-bold text-white hover:bg-[#1b4269]"><Printer size={14} /> Print / Save PDF</button>
        </div>
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
  return <div className="animate-pulse"><div className="h-3 w-28 rounded bg-[#dfe7ec]" /><div className="mt-4 h-9 w-64 max-w-full rounded-lg bg-[#dfe7ec]" /><div className="mt-3 h-4 w-[420px] max-w-full rounded bg-[#e6edf1]" /><div className="mt-8 grid gap-4 md:grid-cols-2"><div className="h-52 rounded-[22px] bg-[#e3ebef]" /><div className="h-52 rounded-[22px] bg-[#e3ebef]" /></div><div className="mt-5 h-64 rounded-[22px] bg-[#e3ebef]" /></div>;
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

const inputClass = 'h-11 w-full rounded-xl border border-[#dfe6eb] bg-white px-3.5 text-[12px] font-normal text-[#344b64] outline-none transition placeholder:text-[#a0acb7] focus:border-[#77aeb0] focus:ring-2 focus:ring-[#77aeb0]/15';
