import { Link, useRoute } from 'wouter';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Contact,
  Copy,
  Calculator,
  Building2,
  CreditCard,
  Download,
  FileText,
  Globe2,
  History,
  LockKeyhole,
  Printer,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Trash2,
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
  getListBankExchangeRatesQueryKey,
  getListInternationalTransferRequestsQueryKey,
  getListMyIdentityDocumentsQueryKey,
  getListBankTransactionsQueryKey,
  getListBankWalletsQueryKey,
  getListBankWithdrawalDestinationsQueryKey,
  useCreateAdminFunding,
  useCreateIdentityDocumentUploadUrl,
  useCompleteIdentityDocumentUpload,
  useCreateBankTransfer,
  useCreateBankWithdrawalDestination,
  useCreateInternationalTransferRequest,
  useCreateLedgerRequest,
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
  useListBankWithdrawalDestinations,
  useListBankExchangeRates,
  useListInternationalTransferRequests,
  useUpdateAdminUserStatus,
  useUpdateAdminTransactionStatus,
  useUpdateAdminUserVerification,
  useReviewAdminLedgerRequest,
  useResetAdminUserTransactionPin,
  useUpdateTransactionPin,
  useUpdateBankProfile,
  useUpsertBankExchangeRate,
  useDeleteMyIdentityDocument,
  useDeleteBankWithdrawalDestination,
  useSubmitIdentityDocuments,
} from '@workspace/api-client-react';
import type { AdminLedgerRequest, AdminUser, BankTransaction, IdentityDocument, InternationalTransferRequest, Wallet, WithdrawalDestination } from '@workspace/api-client-react';
import { GlobusLoader } from '@/components/globus-loader';
import { BankSelect } from '@/components/bank-select';
import { CountrySelect } from '@/components/country-select';
import { InstallAppButton } from '@/components/pwa-install-prompt';
import { countries } from '@/lib/countries';
import { destinationCurrencyForCountry } from '@/lib/destination-currency';
import { TransferReceiptModal } from '@/components/transfer/transfer-receipt';
const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as const;
type Currency = typeof currencies[number];
type ReceiptConversion = {
  sourceAmount: string;
  sourceCurrency: string;
  exchangeRate: string;
  destinationAmount: string;
  destinationCurrency: string;
};
type ReceiptTransaction = BankTransaction & { conversion?: ReceiptConversion };
const currencyNames: Record<string, string> = {
  USD: 'US dollar',
  EUR: 'Euro',
  GBP: 'Pound sterling',
  NGN: 'Nigerian naira',
  CAD: 'Canadian dollar',
  AUD: 'Australian dollar',
};

function currencyFromQuery(): Currency | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('currency');
  return currencies.find(currency => currency === value) ?? null;
}

function preferredCurrencyFromQuery(): Currency {
  return currencyFromQuery() ?? 'USD';
}

function currencyActionHref(path: string, currency: Currency) {
  return `${path}?currency=${encodeURIComponent(currency)}`;
}

export function HomePage() {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false } });
  return (
    <div className="public-viewport-scroll bg-[#f6f8fa] text-[#192e49]">
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
          <InstallAppButton className="inline-flex items-center gap-1 rounded-xl border border-[#dbe5eb] bg-white px-2 py-2.5 text-[10px] font-bold text-[#36516d] hover:bg-[#f0f5f7] sm:gap-1.5 sm:px-3 sm:text-[12px]" />
          <Link href="/sign-in" className="whitespace-nowrap rounded-xl px-2 py-2.5 text-[12px] font-bold text-[#263e5b] hover:bg-[#eaf0f4] sm:px-4 sm:text-[13px]">Sign in</Link>
          <Link href="/sign-up" className="whitespace-nowrap rounded-xl bg-[#142f51] px-2.5 py-2.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#1b4269] sm:px-5 sm:text-[13px]"><span className="sm:hidden">Open</span><span className="hidden sm:inline">Open an account</span></Link>
        </div>
      </header>

      <section className="relative mx-auto grid min-w-0 max-w-[1320px] items-center gap-10 px-4 pb-16 pt-7 sm:gap-14 sm:px-6 sm:pb-20 sm:pt-9 lg:grid-cols-[1.04fr_.96fr] lg:px-12 lg:pb-28 lg:pt-16">
        <div className="relative z-10 min-w-0">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dbe7e9] bg-white px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#3b777d]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#55a5a9]" />
            A multi-currency account workspace
          </div>
          <h1 className="bank-display max-w-full text-[clamp(2.75rem,14vw,6.5rem)] font-semibold leading-[.98] tracking-[-.07em] text-[#142c49] sm:max-w-[700px] sm:text-[clamp(3.2rem,7.3vw,6.5rem)]">
            Your Money.
            <br />
            <span className="text-[#438f98]">Your World.</span>
            <br />
            One Wallet.
          </h1>
          <p className="mt-7 max-w-[510px] text-[16px] leading-7 text-[#64758a] sm:text-[18px] sm:leading-8">
            Bring your currencies together, understand every movement, and manage routed transfers and reviewed deposit requests with clear statuses.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-2 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Link href="/sign-up" className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#152f50] px-5 py-3.5 text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(18,43,75,.16)] transition hover:-translate-y-0.5 hover:bg-[#1b4168] sm:w-auto sm:px-6 sm:py-4">
              Get started <ArrowRight size={16} />
            </Link>
            <Link href="/about" className="rounded-xl px-5 py-3.5 text-center text-[13px] font-bold text-[#36506c] hover:bg-[#eaf0f4] sm:py-4">How Globus works</Link>
          </div>
          <div className="mt-8 flex min-w-0 flex-wrap gap-x-5 gap-y-3 text-[10px] font-medium text-[#68798d] sm:mt-11 sm:gap-x-7 sm:text-[11px]">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[#478b8e]" /> Globus account activity clearly identified</span>
            <span className="inline-flex items-center gap-2"><Globe2 size={15} className="text-[#478b8e]" /> Five supported currencies</span>
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
                <span className="rounded-lg border border-[#d5e6e7] bg-[#edf7f7] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#43868b]">Globus account</span>
              </div>
              <div className="balance-panel mt-5 overflow-hidden rounded-[19px] px-5 py-6 text-white sm:px-7 sm:py-7">
                <div className="flex items-center justify-between text-[11px] text-[#d4e1eb]">
                  <span>Wallet balance</span>
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
                <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-[#334b66]">No account activity yet</p><p className="mt-0.5 break-words text-[10px] text-[#8b98a7]">Approved and recorded activity appears here</p></div>
                <p className="text-[12px] font-semibold text-[#2e665f]">—</p>
              </div>
            </div>
            <div className="absolute -left-7 top-[38%] hidden -rotate-[4deg] items-center gap-3 rounded-2xl border border-[#e8edf0] bg-white px-4 py-3 shadow-lg sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f3f4] text-[#4b8f94]"><LockKeyhole size={16} /></span>
              <span><b className="block text-[11px] text-[#30465f]">Clear by design</b><small className="mt-1 block text-[9px] text-[#8391a1]">Each record is clearly identified</small></span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1320px] gap-12 px-6 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-12 lg:py-28">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#528f95]">Globus account records, clearly scoped</p>
          <h2 className="bank-display mt-4 max-w-[450px] text-[42px] font-semibold leading-[1.08] text-[#17304f] sm:text-[52px]">Know what Globus records.<br />Know what it doesn’t.</h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <FeatureBlock number="01" title="See the whole picture" copy="Review individual currency wallets, pending amounts and recent transactions in one focused workspace." />
          <FeatureBlock number="02" title="Route transfers with clarity" copy="Choose local routing or an international wire, review the currency conversion, and follow the recorded status in your account." />
          <FeatureBlock number="03" title="Review deposit requests" copy="Card and bank-transfer deposit requests require administrator approval before a wallet balance changes." />
          <FeatureBlock number="04" title="Keep a clear record" copy="Every transaction has a reference, status and timestamp for straightforward review." />
        </div>
      </section>
      <section className="mx-4 mb-16 rounded-[28px] bg-[#132f51] px-5 py-10 text-white sm:mx-10 sm:px-12 sm:py-12 lg:mx-auto lg:max-w-[1240px] lg:px-16 lg:py-16">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#a6d5d8]">Make your next step clearer</p><h2 className="bank-display mt-3 max-w-[640px] text-[34px] font-semibold leading-tight sm:text-[45px]">Your Globus account workspace, ready to use.</h2></div>
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
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const dash = query.data;
  const selectedWallet = dash?.wallets.find(wallet => wallet.currency === selectedCurrency)
    ?? dash?.wallets.find(wallet => wallet.currency === dash.referenceCurrency)
    ?? dash?.wallets[0];
  const actionCurrency = (selectedWallet?.currency ?? dash?.referenceCurrency ?? 'USD') as Currency;
  const recentTransactions = dash?.recentTransactions.filter(
    transaction => !selectedWallet || transaction.currency === selectedWallet.currency,
  ) ?? [];
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <Failure title="Your overview isn’t available" retry={() => query.refetch()} />;
  return (
    <>
      <PageHeading eyebrow="Your dashboard" title={`Good to see you${dash?.profile.firstName ? `, ${dash.profile.firstName}` : ''}.`} subtitle="Wallets, quick actions, and recent activity." />

      <div className="mt-3 grid min-w-0 gap-2.5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="balance-panel relative min-w-0 overflow-hidden rounded-[18px] p-3.5 text-white sm:p-4 xl:col-start-1 xl:row-start-1">
          <div className="absolute -right-10 -top-12 h-48 w-48 rounded-full border border-white/[.08]" />
          <div className="absolute -right-2 -top-5 h-32 w-32 rounded-full border border-white/[.08]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-[#cad9e4]">{selectedWallet ? `${currencyNames[selectedWallet.currency]} · available` : 'Available balance'}</p>
              <div data-testid="dashboard-active-wallet-balance" className="bank-display mt-1.5 break-words text-[clamp(1.8rem,7vw,2.8rem)] font-semibold tracking-[-.06em]">{selectedWallet ? formatMoney(Number(selectedWallet.available), selectedWallet.currency) : '—'}</div>
              {selectedWallet && <p className="mt-0.5 text-[10px] text-[#b5c7d4]">{selectedWallet.currency} wallet</p>}
            </div>
            {selectedWallet && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[.08] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.13em] text-[#d9e7eb]"><span className="h-1.5 w-1.5 rounded-full bg-[#8fd2cf]" /> {selectedWallet.currency}</span>}
          </div>
          <div className="relative mt-2.5 border-t border-white/10 pt-2.5">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-[.14em] text-[#b5c7d4]">Switch wallet</p>
            {dash?.wallets.length ? (
              <div role="group" aria-label="Switch dashboard wallet" className="flex min-w-0 gap-2 overflow-x-auto pb-1">
                {dash.wallets.map(wallet => {
                  const isSelected = wallet.id === selectedWallet?.id;
                  return (
                    <button
                      key={wallet.id}
                      type="button"
                      data-testid={`dashboard-wallet-${wallet.currency.toLowerCase()}`}
                      aria-label={`${wallet.currency} wallet, available ${formatMoney(Number(wallet.available), wallet.currency)}`}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedCurrency(wallet.currency as Currency)}
                      className={`min-w-[98px] shrink-0 rounded-lg border px-2 py-1 text-left transition ${isSelected ? 'border-white/35 bg-white/15 text-white' : 'border-white/10 bg-white/[.06] text-[#d4e1eb] hover:bg-white/[.12]'}`}
                    >
                      <span className="block text-[8px] font-bold">{wallet.currency}</span>
                      <span className="mt-0.5 block text-[8px] text-[#c2d2dd]">{formatMoney(Number(wallet.available), wallet.currency)}</span>
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-[11px] text-[#c2d2dd]">No wallets are available.</p>}
          </div>
          {dash?.profile.accountStatus === 'suspended' && <p role="status" className="relative mt-2 rounded-lg border border-white/15 bg-white/[.08] px-3 py-1.5 text-[8px] leading-4 text-[#f2d8d1]">Your account is suspended. Financial actions are unavailable.</p>}
          {dash?.profile.accountStatus === 'restricted' && <p role="status" className="relative mt-2 rounded-lg border border-white/15 bg-white/[.08] px-3 py-1.5 text-[8px] leading-4 text-[#f2e7c9]">Some account operations are restricted.</p>}
          {selectedWallet?.status === 'restricted' && dash?.profile.accountStatus === 'active' && <p role="status" className="relative mt-2 rounded-lg border border-white/15 bg-white/[.08] px-3 py-1.5 text-[8px] leading-4 text-[#f2e7c9]">This wallet is frozen. Outgoing transfers and withdrawals are unavailable.</p>}
        </section>

        <section data-testid="dashboard-action-toolbar" aria-label="Dashboard quick actions" className="min-w-0 rounded-[16px] border border-[#e2e9ef] bg-white p-3 xl:col-start-1 xl:row-start-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#589198]">Quick actions</p>
              <p className="mt-0.5 text-[9px] text-[#8190a0]">Using {actionCurrency}</p>
            </div>
            {selectedWallet && <span className="shrink-0 rounded-full bg-[#eff5f6] px-2 py-1 text-[8px] font-bold text-[#456c73]">{selectedWallet.currency} wallet</span>}
          </div>
          <nav role="toolbar" aria-label="Dashboard actions" className="grid min-w-0 grid-cols-3 gap-2">
            <ActionTile href="/customer-id" icon={<Contact size={16} />} label="Customer ID" testId="dashboard-quick-customer-id" />
            <ActionTile href={currencyActionHref('/add-money', actionCurrency)} icon={<WalletCards size={16} />} label="Deposit" testId="dashboard-quick-deposit" />
            <ActionTile href={currencyActionHref('/withdraw', actionCurrency)} icon={<ArrowUpRight size={16} />} label="Withdraw" testId="dashboard-quick-withdraw" />
            <ActionTile href={currencyActionHref('/transfer', actionCurrency)} icon={<ArrowLeftRight size={16} />} label="Transfer" testId="dashboard-quick-transfer" />
            <ActionTile href="/calculator" icon={<Calculator size={16} />} label="Convert" testId="dashboard-quick-converter" />
            <ActionTile href="/transactions" icon={<History size={16} />} label="Activity" testId="dashboard-quick-activity" />
          </nav>
        </section>

        <section className="rounded-[16px] border border-[#e2e9ef] bg-white p-3.5 sm:p-4 xl:col-start-2 xl:row-start-1">
          <div className="flex items-start justify-between">
            <div><p className="text-[9px] font-medium text-[#78889a]">Account standing</p><h2 className="mt-1 text-[15px] font-semibold text-[#203851]">Your details, in order</h2></div>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef5f6] text-[#43888e]"><ShieldCheck size={16} /></span>
          </div>
          <div className="mt-3 space-y-2.5">
            <StatusLine label="Account" value={humanize(dash?.profile.accountStatus)} positive={dash?.profile.accountStatus === 'active'} />
            <StatusLine label="Identity review" value={humanize(dash?.profile.verificationStatus)} positive={dash?.profile.verificationStatus === 'approved'} />
          </div>
          <Link href="/profile" data-testid="link-dashboard-profile" className="mt-3 inline-flex items-center gap-1 text-[9px] font-bold text-[#377b82]">Review profile <ChevronRight size={12} /></Link>
        </section>
        <section className="min-w-0 overflow-hidden rounded-[16px] border border-[#e2e9ef] bg-white xl:col-start-2 xl:row-start-2">
          <div className="flex items-center justify-between gap-2 border-b border-[#edf0f3] px-3.5 py-2.5">
            <div><h2 className="text-[12px] font-bold text-[#203851]">Recent activity{selectedWallet ? ` · ${selectedWallet.currency}` : ''}</h2><p className="mt-0.5 text-[9px] text-[#8592a1]">Latest wallet entries</p></div>
            <Link href={currencyActionHref('/transactions', actionCurrency)} aria-label="View all activity" className="inline-flex shrink-0 items-center gap-1 text-[9px] font-bold text-[#397d83]">View all <ChevronRight size={12} /></Link>
          </div>
          <div className="max-h-[190px] overflow-y-auto">
            {recentTransactions.length ? <TransactionList transactions={recentTransactions.slice(0, 3)} /> : <EmptyState title="Nothing recorded yet" text="Your latest activity will appear here." />}
          </div>
        </section>
      </div>
    </>
  );
}

export function WalletsPage() {
  const query = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const profile = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <Failure title="Wallets could not be loaded" retry={() => query.refetch()} />;
  return (
    <>
      <PageHeading eyebrow="Currencies" title="Your wallets" subtitle="Available, pending and reserved amounts, shown separately." />
      <div className="mt-7 flex items-center gap-3 rounded-2xl border border-[#dce9ea] bg-[#eef7f7] px-4 py-4 text-[12px] leading-5 text-[#467b80]"><Globe2 size={17} className="shrink-0" /> Balances show activity recorded in your Globus account. No outside bank or payment service holds or moves funds.</div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(query.data ?? []).map((wallet) => <div key={wallet.id} className="min-w-0"><WalletCard wallet={wallet} /><WalletReference customerId={profile.data?.customerId ?? ''} wallet={wallet} /></div>)}
      </div>
      {!query.data?.length && <EmptyState title="No currency wallets yet" text="Wallets will appear here when they are provisioned for your account." />}
    </>
  );
}

function WalletReference({ customerId, wallet }: { customerId: string; wallet: Wallet }) {
  const reference = walletReferenceValue(customerId, wallet);
  return (
    <div className="mt-2 min-w-0 rounded-xl border border-[#e0e8ed] bg-white px-4 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#7c8c99]">Globus wallet reference</p>
      <p className="mt-1 break-all font-mono text-[11px] font-semibold text-[#294763]">{reference}</p>
      <p className="mt-1 text-[9px] leading-4 text-[#8794a1]">Identifies this Globus wallet only. It is not a bank account, routing number, or payment destination.</p>
    </div>
  );
}

function walletReferenceValue(customerId: string, wallet: Wallet) {
  return customerId
    ? `GB-${customerId}-${wallet.currency}-${wallet.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
    : `GB-${wallet.currency}-${wallet.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState(() => currencyFromQuery() ?? '');
  const params = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(currency ? { currency: currency as Currency } : {}),
    limit: 100,
  }), [search, currency]);
  const query = useListBankTransactions(params, { query: { queryKey: getListBankTransactionsQueryKey(params) } });
  return (
    <>
      <PageHeading eyebrow="Account activity" title="Activity" subtitle="Search transactions recorded in your Globus account." />
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8695a5]" /><input aria-label="Search transactions" data-testid="input-transaction-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search description, reference or recipient" className="h-12 w-full rounded-xl border border-[#dfe6ec] bg-white pl-11 pr-4 text-[12px] outline-none transition focus:border-[#6aa6aa]" /></label>
        <select aria-label="Filter by currency" data-testid="select-transaction-currency" value={currency} onChange={event => setCurrency(event.target.value)} className="h-12 rounded-xl border border-[#dfe6ec] bg-white px-4 text-[12px] text-[#435872] outline-none focus:border-[#6aa6aa]"><option value="">All currencies</option>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select>
      </div>
      <section className="mt-5 overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0f3] px-5 py-4 sm:px-7"><p className="text-[13px] font-bold text-[#28405c]">Transaction history</p><span className="text-[10px] font-semibold text-[#8291a1]">{query.data?.length ?? 0} entries</span></div>
        {query.isLoading ? <ListSkeleton /> : query.isError ? <Failure title="Transaction history isn’t available" retry={() => query.refetch()} /> : query.data?.length ? <TransactionList transactions={query.data} /> : <EmptyState title="No matching activity" text="Try a different search or check back when an account transaction is recorded." />}
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
  const [currency, setCurrency] = useState<Currency>(() => preferredCurrencyFromQuery());
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeading eyebrow="Internal ledger" title="Send to a Globus member" subtitle="Transfers update both members’ Globus ledger wallets. No outside account is contacted." />
        <Link href="/transfer" className="mb-1 inline-flex items-center gap-2 rounded-xl border border-[#d8e4e9] bg-white px-4 py-2.5 text-[10px] font-bold text-[#365771] hover:bg-[#f4f8f9]"><ArrowLeftRight size={14} /> International transfer request</Link>
      </div>
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
          {profileQuery.data?.transactionPinConfigured === false && <p className="mt-4 rounded-lg border border-[#eadfbe] bg-[#fbf7eb] px-4 py-3 text-[10px] leading-5 text-[#806b3d]">Set up your transaction PIN in <Link href="/profile" className="font-bold underline">Profile</Link> before sending a transfer.</p>}
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

export { InternationalTransferPage } from '@/components/transfer/transfer-wizard';

export function ProviderRequestPage({ type }: { type: 'deposit' | 'withdrawal' }) {
  const queryClient = useQueryClient();
  const profileQuery = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const walletsQuery = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const withdrawalDestinationsQuery = useListBankWithdrawalDestinations({
    query: {
      queryKey: getListBankWithdrawalDestinationsQueryKey(),
      enabled: type === 'withdrawal',
    },
  });
  const mutation = useCreateLedgerRequest();
  const createWithdrawalDestination = useCreateBankWithdrawalDestination();
  const deleteWithdrawalDestination = useDeleteBankWithdrawalDestination();
  const [currency, setCurrency] = useState<Currency | null>(() => type === 'deposit' ? currencyFromQuery() : preferredCurrencyFromQuery());
  const [depositWalletSelected, setDepositWalletSelected] = useState(() => type === 'deposit' && currencyFromQuery() !== null);
  const [withdrawalWalletSelected, setWithdrawalWalletSelected] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [depositMethod, setDepositMethod] = useState<'bank_card' | 'bank_transfer'>('bank_transfer');
  const [withdrawalMethod, setWithdrawalMethod] = useState<'bank_card' | 'bank_transfer'>('bank_transfer');
  const [withdrawalDestinationId, setWithdrawalDestinationId] = useState('');
  const [showDestinationForm, setShowDestinationForm] = useState(false);
  const [destinationError, setDestinationError] = useState('');
  const [cardBrand, setCardBrand] = useState<'visa' | 'mastercard' | 'amex' | 'discover' | 'other'>('visa');
  const [cardLastFour, setCardLastFour] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankCountry, setBankCountry] = useState('');
  const [accountLastFour, setAccountLastFour] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [transactionPin, setTransactionPin] = useState('');
  const [copiedWalletReference, setCopiedWalletReference] = useState(false);
  const [result, setResult] = useState<{ reference: string; message: string; status: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const selectedWallet = walletsQuery.data?.find(wallet => wallet.currency === currency);
  const available = Number(selectedWallet?.available ?? 0);
  const destinationsForMethod = (withdrawalDestinationsQuery.data ?? []).filter(
    destination => destination.method === withdrawalMethod,
  );
  const selectedDestination = destinationsForMethod.find(
    destination => destination.id === withdrawalDestinationId,
  );
  const shouldShowDestinationForm =
    showDestinationForm ||
    (withdrawalDestinationsQuery.isSuccess && destinationsForMethod.length === 0);
  const heading = type === 'deposit' ? 'Request a deposit' : 'Request a withdrawal';
  const sub = type === 'deposit'
    ? 'Choose a request method and ask an administrator to review a credit to your selected wallet.'
    : 'Ask an administrator to review a withdrawal from your selected wallet.';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);
    setErrorMessage('');
    if (type === 'withdrawal' && !selectedDestination) {
      setErrorMessage('Choose or save a withdrawal destination before continuing.');
      return;
    }
    const requestDescription = type === 'deposit'
      ? `${depositMethod === 'bank_card' ? 'Bank card' : 'Bank transfer'} deposit request${sourceReference.trim() ? ` · Reference: ${sourceReference.trim()}` : ''}${description.trim() ? ` · Note: ${description.trim()}` : ''}`.slice(0, 140)
      : description.trim();
    mutation.mutate({ data: { type, currency: currency ?? preferredCurrencyFromQuery(), amount, ...(requestDescription ? { description: requestDescription } : {}), ...(type === 'withdrawal' && selectedDestination ? { withdrawalDestinationId: selectedDestination.id, withdrawalMethod } : {}), transactionPin, idempotencyKey: crypto.randomUUID() } }, {
      onSuccess: request => {
        setResult(request);
        setAmount('');
        setDescription('');
        setSourceReference('');
        setTransactionPin('');
        queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() });
      },
      onError: error => setErrorMessage(error instanceof Error ? error.message : 'Request could not be recorded. Please try again.'),
    });
  };
  if (type === 'deposit') {
    const accountHolder = [profileQuery.data?.firstName, profileQuery.data?.lastName].filter(Boolean).join(' ') || 'Globus member';
    const walletReference = selectedWallet ? walletReferenceValue(profileQuery.data?.customerId ?? '', selectedWallet) : '';
    const copyWalletReference = async () => {
      if (!walletReference) return;
      try {
        await navigator.clipboard.writeText(walletReference);
        setCopiedWalletReference(true);
        window.setTimeout(() => setCopiedWalletReference(false), 1800);
      } catch {
        setCopiedWalletReference(false);
      }
    };

    return (
      <div className="mx-auto min-w-0 max-w-[1100px]" data-testid="deposit-workflow">
        <header className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#4d858a]">Wallet services</p>
            <h1 className="bank-display mt-0.5 truncate text-[22px] font-semibold leading-tight text-[#213a55] sm:text-[26px]">Deposit</h1>
          </div>
          {depositWalletSelected && selectedWallet && (
            <button type="button" onClick={() => { setDepositWalletSelected(false); setResult(null); }} className="shrink-0 rounded-lg border border-[#dce6e9] bg-white px-3 py-2 text-[10px] font-bold text-[#3c7278] hover:bg-[#f3f8f8]" data-testid="button-change-deposit-wallet">
              Change wallet
            </button>
          )}
        </header>

        {walletsQuery.isLoading ? (
          <div className="mt-4 rounded-2xl border border-[#e1e8ee] bg-white p-5"><ListSkeleton /></div>
        ) : walletsQuery.isError ? (
          <div className="mt-4 rounded-2xl border border-[#e1e8ee] bg-white p-5"><InlineError text="Wallets could not be loaded." retry={() => walletsQuery.refetch()} /></div>
        ) : !depositWalletSelected || !selectedWallet ? (
          <section className="mt-4 rounded-2xl border border-[#e1e8ee] bg-white p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h2 className="text-[12px] font-bold text-[#2c425c]">Choose a wallet</h2><p className="mt-0.5 text-[10px] text-[#8391a0]">Select the wallet for this deposit request.</p></div>
              <WalletCards size={18} className="shrink-0 text-[#4d858a]" />
            </div>
            {walletsQuery.data?.length ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {walletsQuery.data.map(wallet => (
                  <button key={wallet.id} type="button" onClick={() => { setCurrency(wallet.currency as Currency); setDepositWalletSelected(true); setResult(null); setErrorMessage(''); }} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#e1e8ed] bg-[#fbfcfd] px-3.5 py-3 text-left transition hover:border-[#71a8aa] hover:bg-[#f3f9f9]" data-testid={`button-select-deposit-wallet-${wallet.currency.toLowerCase()}`}>
                    <span className="flex min-w-0 items-center gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eaf4f4] text-[10px] font-extrabold text-[#397b80]">{wallet.currency}</span><span className="min-w-0"><b className="block truncate text-[10px] text-[#344b64]">{currencyNames[wallet.currency] ?? wallet.currency}</b><small className="mt-0.5 block text-[9px] text-[#8492a1]">{humanize(wallet.status)}</small></span></span>
                    <span className="shrink-0 text-[10px] font-bold text-[#344b64]">{formatMoney(Number(wallet.available), wallet.currency)}</span>
                  </button>
                ))}
              </div>
            ) : <EmptyState title="No wallets available" text="There are no wallets to select for a deposit request." />}
          </section>
        ) : (
          <div className="mt-3 grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
            <section className="min-w-0 rounded-2xl border border-[#e1e8ee] bg-white p-3.5 sm:p-4" data-testid="deposit-wallet-details">
              <div className="relative isolate min-h-[174px] overflow-hidden rounded-[18px] bg-gradient-to-br from-[#18375d] via-[#15506c] to-[#147078] p-4 text-white shadow-[0_12px_28px_rgba(20,47,81,.18)] sm:min-h-[184px] sm:p-5">
                <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full border border-white/10 before:absolute before:inset-4 before:rounded-full before:border before:border-[#dfc477]/35 after:absolute after:inset-10 after:rounded-full after:border after:border-white/10" />
                <div className="relative flex items-start justify-between gap-4">
                  <div><p className="text-[12px] font-extrabold tracking-[.12em]">GLOBUS</p><p className="mt-0.5 text-[7px] font-bold tracking-[.32em] text-[#e0c77d]">BANK</p></div>
                  <div className="text-right"><p className="text-[8px] font-bold uppercase tracking-[.14em] text-white/75">Wallet card</p><p className="mt-1 text-[11px] font-bold">{selectedWallet.currency} wallet</p></div>
                </div>
                <div className="relative mt-5 flex items-center gap-2.5">
                  <div aria-hidden="true" className="h-6 w-8 rounded-md border border-[#f3d78f]/65 bg-gradient-to-br from-[#f4e2ae] via-[#c8a959] to-[#f2d98d] shadow-inner" />
                  <span className="font-mono text-[11px] font-semibold tracking-[.14em] text-white/95">•••• •••• •••• {walletReference.slice(-4)}</span>
                </div>
                <div className="relative mt-5 flex items-end justify-between gap-3">
                  <div className="min-w-0"><p className="text-[7px] uppercase tracking-[.13em] text-white/60">Account holder</p><p className="mt-1 truncate text-[10px] font-semibold">{accountHolder}</p></div>
                  <p className="shrink-0 text-[9px] font-bold tracking-[.12em] text-[#e4ce8e]">{selectedWallet.currency}</p>
                </div>
              </div>
              <div className="mt-3">
                <h2 className="text-[11px] font-bold text-[#2d435c]">Account details</h2>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-[#f7f9fa] px-3.5 py-3">
                  <div className="min-w-0"><dt className="text-[8px] font-semibold uppercase tracking-[.1em] text-[#8593a1]">Account holder</dt><dd className="mt-0.5 truncate text-[9px] font-semibold text-[#40576f]">{accountHolder}</dd></div>
                  <div><dt className="text-[8px] font-semibold uppercase tracking-[.1em] text-[#8593a1]">Currency</dt><dd className="mt-0.5 text-[9px] font-semibold text-[#40576f]">{selectedWallet.currency}</dd></div>
                  <div><dt className="text-[8px] font-semibold uppercase tracking-[.1em] text-[#8593a1]">Available</dt><dd className="mt-0.5 text-[9px] font-semibold text-[#40576f]">{formatMoney(Number(selectedWallet.available), selectedWallet.currency)}</dd></div>
                  <div className="min-w-0"><dt className="text-[8px] font-semibold uppercase tracking-[.1em] text-[#8593a1]">Wallet reference</dt><dd className="mt-0.5 flex min-w-0 items-center gap-1"><span className="min-w-0 break-all font-mono text-[8px] font-semibold leading-3 text-[#40576f]" title={walletReference}>{walletReference}</span><button type="button" onClick={() => void copyWalletReference()} aria-label="Copy wallet reference" data-testid="button-copy-wallet-reference" className="shrink-0 rounded p-1 text-[#4a8588] hover:bg-white">{copiedWalletReference ? <Check size={12} /> : <Copy size={12} />}</button></dd></div>
                </dl>
              </div>
            </section>

            <form onSubmit={submit} className="min-w-0 rounded-2xl border border-[#e1e8ee] bg-white p-3.5 sm:p-4" data-testid="deposit-request-form">
              <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-[12px] font-bold text-[#2c425c]">Request a deposit</h2><p className="mt-0.5 text-[9px] text-[#8391a0]">Selected wallet · {selectedWallet.currency}</p></div><span className="rounded-lg bg-[#eef7f7] px-2.5 py-1.5 text-[9px] font-bold text-[#377b82]">{selectedWallet.currency}</span></div>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Deposit request method">
                <button type="button" onClick={() => setDepositMethod('bank_card')} aria-pressed={depositMethod === 'bank_card'} data-testid="button-deposit-bank-card" className={`rounded-lg border px-3 py-2.5 text-left text-[9px] font-bold transition ${depositMethod === 'bank_card' ? 'border-[#4e8c91] bg-[#f1f8f8] text-[#315c67]' : 'border-[#e1e8ed] bg-white text-[#718195]'}`}>Bank card</button>
                <button type="button" onClick={() => setDepositMethod('bank_transfer')} aria-pressed={depositMethod === 'bank_transfer'} data-testid="button-deposit-bank-transfer" className={`rounded-lg border px-3 py-2.5 text-left text-[9px] font-bold transition ${depositMethod === 'bank_transfer' ? 'border-[#4e8c91] bg-[#f1f8f8] text-[#315c67]' : 'border-[#e1e8ed] bg-white text-[#718195]'}`}>Bank transfer</button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max="1000000" value={amount} onChange={event => setAmount(event.target.value)} placeholder={`0.00 ${selectedWallet.currency}`} className={inputClass} data-testid="input-deposit-amount" /><span className="mt-1 block text-[8px] text-[#8492a1]">Maximum 1,000,000.00</span></Field>
                <Field label="Payment reference (optional)"><input maxLength={70} value={sourceReference} onChange={event => setSourceReference(event.target.value)} placeholder="Reference or sender bank" className={inputClass} data-testid="input-deposit-reference" /></Field>
              </div>
              <div className="mt-2"><Field label="Note (optional)"><input maxLength={80} value={description} onChange={event => setDescription(event.target.value)} placeholder="Add a note" className={inputClass} data-testid="input-deposit-note" /></Field></div>
              <div className="mt-2"><Field label="6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter your PIN" className={inputClass} data-testid="input-deposit-pin" /></Field></div>
              {profileQuery.data?.transactionPinConfigured === false && <p className="mt-2 rounded-lg border border-[#eadfbe] bg-[#fbf7eb] px-3 py-2 text-[9px] leading-4 text-[#806b3d]">Set up your transaction PIN in <Link href="/profile" className="font-bold underline">Profile</Link> before submitting.</p>}
              {(errorMessage || mutation.isError) && <p role="alert" className="mt-2 rounded-lg bg-[#fff1ef] px-3 py-2 text-[9px] text-[#a24940]" data-testid="status-deposit-error">{errorMessage || 'The request could not be recorded.'}</p>}
              {result && <div role="status" className="mt-2 rounded-lg border border-[#d6e6e5] bg-[#f2f8f7] px-3 py-2 text-[9px] text-[#426e70]" data-testid="status-deposit-result"><p className="font-bold">Request recorded · {humanize(result.status)}</p><p className="mt-0.5">{result.message} · Ref {result.reference}</p></div>}
              <button type="submit" disabled={mutation.isPending || transactionPin.length !== 6 || !amount || Number(amount) <= 0} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#142f51] text-[10px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-submit-deposit">{mutation.isPending ? 'Sending…' : 'Submit deposit request'} <ArrowRight size={13} /></button>
            </form>
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      <PageHeading eyebrow="Withdrawal request" title={heading} subtitle={sub} />
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} className="rounded-[22px] border border-[#e1e8ee] bg-white p-5 sm:p-8">
          <div className="mb-7 rounded-xl border border-[#eadfbe] bg-[#fbf7eb] p-4">
            <div className="flex gap-3"><Clock3 size={17} className="mt-0.5 shrink-0 text-[#a17e36]" /><div><p className="text-[12px] font-bold text-[#715b2c]">Administrator review required</p><p className="mt-1 text-[11px] leading-5 text-[#89784f]">The requested amount remains reserved while pending. Approval records the withdrawal in Globus; no outside payout is made.</p></div></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Wallet currency"><select value={currency ?? 'USD'} onChange={event => setCurrency(event.target.value as Currency)} className={inputClass}>{currencies.map(item => <option key={item} value={item}>{item} · {currencyNames[item]}</option>)}</select></Field>
            <Field label="Amount"><input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" min="0.01" max={available} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className={inputClass} /><span className="mt-1.5 block text-[10px] text-[#8391a0]">{`Available to withdraw: ${formatMoney(available, currency ?? 'USD')}`}</span></Field>
          </div>
          <div className="mt-5"><Field label="Note for the administrator (optional)"><input maxLength={80} value={description} onChange={event => setDescription(event.target.value)} placeholder="Add context for your request" className={inputClass} /></Field></div>
          <div className="mt-5"><Field label="6-digit transaction PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter your PIN" className={inputClass} /></Field></div>
          {profileQuery.data?.transactionPinConfigured === false && <p className="mt-4 rounded-lg border border-[#eadfbe] bg-[#fbf7eb] px-4 py-3 text-[10px] leading-5 text-[#806b3d]">Set up your transaction PIN in <Link href="/profile" className="font-bold underline">Profile</Link> before submitting this request.</p>}
          {(errorMessage || mutation.isError) && <p role="alert" className="mt-5 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{errorMessage || 'The request could not be recorded.'}</p>}
          {result && <div role="status" className="mt-5 rounded-xl border border-[#d6e6e5] bg-[#f2f8f7] p-4 text-[12px] text-[#426e70]"><p className="font-bold">Request recorded · {humanize(result.status)}</p><p className="mt-1">{result.message}</p><p className="mt-2 font-mono text-[10px]">Reference {result.reference}</p></div>}
          <button disabled={mutation.isPending || transactionPin.length !== 6 || !amount || Number(amount) <= 0 || Number(amount) > available} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#142f51] text-[12px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending ? 'Sending for review…' : 'Submit request'} <ArrowRight size={15} /></button>
          <p className="mt-3 text-center text-[10px] text-[#8794a1]">The request and review result are saved to your Globus activity.</p>
        </form>
        <div className="rounded-[22px] border border-[#e1e8ee] bg-white p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#72859b]">Selected wallet</p>
          <div className="mt-4 space-y-3">{walletsQuery.isLoading ? <ListSkeleton /> : walletsQuery.isError ? <InlineError text="Wallet balances are unavailable." retry={() => walletsQuery.refetch()} /> : selectedWallet && <><WalletMini wallet={selectedWallet} /><WalletReference customerId={profileQuery.data?.customerId ?? ''} wallet={selectedWallet} /></>}</div>
          <p className="mt-6 text-[10px] leading-5 text-[#7d8b9b]">Account activity is recorded in Globus. A deposit request does not transfer outside funds.</p>
        </div>
      </div>
    </>
  );
}

export function CustomerIdPage() {
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
      {profile.isLoading ? <PageSkeleton /> : profile.isError ? <Failure title="Your account ID isn’t available" retry={() => profile.refetch()} /> : (
        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_.78fr]">
          <section className="balance-panel rounded-[22px] p-6 text-white sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#a5d8d8]"><WalletCards size={22} /></span>
            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[.16em] text-[#bfd0dd]">Globus Customer ID</p>
            <p className="mt-3 break-all font-mono text-[19px] font-semibold tracking-wide sm:text-[24px]">{identifier}</p>
            <button onClick={copyIdentifier} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-[11px] font-bold text-[#17314f] hover:bg-[#ecf3f5]"><Copy size={14} />{copied ? 'Copied' : 'Copy Customer ID'}</button>
            <p className="mt-7 max-w-lg text-[11px] leading-5 text-[#c1d0db]">Keep this ID for sign-in. It identifies your Globus account and is not a bank account or payment address.</p>
          </section>
          <section className="rounded-[22px] border border-[#e1e8ee] bg-white p-6 sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#518c91]">Account access</p>
            <h2 className="mt-3 text-[15px] font-bold text-[#2c425c]">Use your Customer ID to sign in</h2>
            <p className="mt-3 text-[11px] leading-5 text-[#7d8b9b]">Enter this seven-character ID and your password on the Globus sign-in page. Keep it private; it is not a bank account number or payment address.</p>
          </section>
        </div>
      )}
      <section className="mt-8 rounded-[22px] border border-[#e1e8ee] bg-white p-6">
        <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#518c91]">Your wallets</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {walletsQuery.isLoading ? <ListSkeleton /> : walletsQuery.isError ? <InlineError text="Wallet balances are unavailable." retry={() => walletsQuery.refetch()} /> : (walletsQuery.data ?? []).map(wallet => <WalletMini key={wallet.id} wallet={wallet} />)}
        </div>
        <Link href="/add-money" className="mt-6 inline-flex items-center gap-2 text-[11px] font-bold text-[#367b82]">Request a deposit <ArrowRight size={14} /></Link>
      </section>
    </>
  );
}

export function ProfilePage() {
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
        file.size < 5 * 1024 * 1024 ||
        file.size > 10 * 1024 * 1024,
    );
    if (invalidFile) {
      setIdentityError('Each PDF, JPG or PNG file must be between 5 MB and 10 MB.');
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
  if (query.isError) return <Failure title="Your profile is unavailable" retry={() => query.refetch()} />;
  return (
    <>
      <PageHeading eyebrow="Your account" title="Your profile" subtitle="Manage your details, profile photo, and identity documents." />
      <section className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#e1e8ee] bg-white px-4 py-3">
        <div>
          <p className="text-[8px] font-bold uppercase tracking-[.15em] text-[#718296]">Your Globus Customer ID</p>
          <p className="mt-1 font-mono text-[17px] font-bold tracking-[.16em] text-[#17314f]">{profile?.customerId}</p>
        </div>
        <button type="button" data-testid="button-copy-customer-id" onClick={copyCustomerId} className="inline-flex items-center gap-2 rounded-lg border border-[#dfe6eb] px-3 py-2 text-[9px] font-bold text-[#355570] hover:bg-[#f5f8f9]"><Copy size={13} />{customerIdCopied ? 'Copied' : 'Copy ID'}</button>
      </section>
      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={submit} className="rounded-[18px] border border-[#e1e8ee] bg-white p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name"><input required maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} className={inputClass} /></Field>
            <Field label="Last name"><input maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} className={inputClass} /></Field>
            <Field label="Phone"><input required minLength={3} maxLength={32} value={phone} onChange={event => setPhone(event.target.value)} className={inputClass} /></Field>
            <Field label="Country or region"><input required minLength={2} maxLength={80} value={country} onChange={event => setCountry(event.target.value)} className={inputClass} /></Field>
            <Field label="Date of birth"><input type="date" value={dateOfBirth} onChange={event => setDateOfBirth(event.target.value)} className={inputClass} /></Field>
            <Field label="Email address"><input disabled value={profile?.email ?? ''} className={`${inputClass} bg-[#f4f7f9] text-[#8190a0]`} /></Field>
          </div>
          <label className="mt-3 flex items-start gap-2.5 text-[10px] leading-4 text-[#728296]"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-0.5 accent-[#387e84]" /><span>I confirm these profile details are accurate and accept the Globus account terms and privacy notice.</span></label>
          {note && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-[10px] ${note.startsWith('Profile saved') ? 'bg-[#f0f8f4] text-[#41755f]' : 'bg-[#fff1ef] text-[#a24940]'}`}>{note}</p>}
          <button disabled={!accepted || update.isPending} className="mt-3 h-10 rounded-lg bg-[#142f51] px-4 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-45">{update.isPending ? 'Saving profile…' : 'Save profile'}</button>
        </form>
        <section className="rounded-[18px] border border-[#e1e8ee] bg-white p-4">
          <div className="mb-4 border-b border-[#edf0f2] pb-4">
            <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#71869a]">Profile photo</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[#dbe5ea] bg-[#eef5f6] text-[15px] font-bold text-[#387b82]">
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
            <p className="mt-2 text-[9px] leading-4 text-[#708196]">Your photo appears across Globus.</p>
            {photoMessage && <p role="status" className="mt-2 rounded-lg bg-[#f0f8f4] px-3 py-2 text-[9px] text-[#41755f]">{photoMessage}</p>}
            {photoError && <p role="alert" className="mt-2 rounded-lg bg-[#fff1ef] px-3 py-2 text-[9px] text-[#a24940]">{photoError}</p>}
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#71869a]">Account status</p>
          <div className="mt-3 space-y-3"><StatusLine label="Account" value={humanize(profile?.accountStatus)} positive={profile?.accountStatus === 'active'} /><StatusLine label="Verification" value={humanize(profile?.verificationStatus)} positive={profile?.verificationStatus === 'approved'} /></div>
          <div className="mt-4 border-t border-[#edf0f2] pt-3"><p className="text-[9px] text-[#8995a2]">Member since</p><p className="mt-1 text-[11px] font-semibold text-[#324962]">{formatDate(profile?.createdAt)}</p></div>
        </section>
      </div>
      <section id="identity-verification" className="mt-3 rounded-[18px] border border-[#e1e8ee] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#55868b]">Transaction security</p>
            <h2 className="mt-1 text-[13px] font-bold text-[#29425c]">{profile?.transactionPinConfigured ? 'Update transaction PIN' : 'Create transaction PIN'}</h2>
            <p className="mt-1.5 max-w-2xl text-[10px] leading-4 text-[#718296]">Use a six-digit PIN to authorize every transfer, deposit request, and withdrawal request from your account. Your PIN is stored as a secure hash and cannot be viewed by administrators.</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-[9px] font-bold ${profile?.transactionPinConfigured ? 'bg-[#eef7f3] text-[#4b826d]' : 'bg-[#fbf7eb] text-[#92773e]'}`}>{profile?.transactionPinConfigured ? 'PIN active' : 'PIN not set'}</span>
        </div>
        <form onSubmit={submitPin} className="mt-3 grid gap-3 sm:grid-cols-2">
          {profile?.transactionPinConfigured && <Field label="Current PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={currentPin} onChange={event => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>}
          <Field label="New 6-digit PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="new-password" value={newPin} onChange={event => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
          <Field label="Confirm new PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="new-password" value={confirmPin} onChange={event => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
          {pinMessage && <p role={pinMessage.startsWith('Transaction PIN saved') ? 'status' : 'alert'} className={`sm:col-span-2 rounded-lg px-4 py-3 text-[11px] ${pinMessage.startsWith('Transaction PIN saved') ? 'bg-[#f0f8f4] text-[#41755f]' : 'bg-[#fff1ef] text-[#a24940]'}`}>{pinMessage}</p>}
          <button disabled={updatePin.isPending || newPin.length !== 6 || confirmPin.length !== 6} className="h-10 w-fit rounded-lg bg-[#142f51] px-4 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{updatePin.isPending ? 'Saving PIN…' : profile?.transactionPinConfigured ? 'Update PIN' : 'Create PIN'}</button>
        </form>
      </section>
      <section className="mt-3 rounded-[18px] border border-[#e1e8ee] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#55868b]">Private identity review</p>
            <h2 className="mt-1 text-[13px] font-bold text-[#29425c]">Submit identity documents</h2>
            <p className="mt-1.5 max-w-2xl text-[10px] leading-4 text-[#718296]">Upload PDF, JPG or PNG files. Each must be 5–10 MB; you can upload up to five.</p>
          </div>
          <span className="shrink-0 rounded-lg border border-[#d9e8e9] bg-[#f2f8f8] px-3 py-2 text-[10px] font-bold text-[#4e777a]">{humanize(profile?.verificationStatus)}</span>
        </div>
        {profile?.verificationNote && <p className="mt-3 rounded-lg border border-[#e4e9ed] bg-[#f8fafb] px-3 py-2.5 text-[10px] leading-4 text-[#52677c]"><b>Message from the reviewer:</b> {profile.verificationNote}</p>}
        {identityMessage && <p role="status" className="mt-3 rounded-lg border border-[#cfe5db] bg-[#f1f8f4] px-3 py-2.5 text-[10px] text-[#417461]">{identityMessage}</p>}
        {identityError && <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] px-3 py-2.5 text-[10px] text-[#a24940]">{identityError}</p>}
        <div className="mt-3">
          {documentsQuery.isLoading ? <ListSkeleton /> : documentsQuery.isError ? <InlineError text="Your identity documents are unavailable." retry={() => documentsQuery.refetch()} /> : documentsQuery.data?.length ? (
            <ul className="space-y-1.5">
              {documentsQuery.data.map((document, index) => (
                <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e7edf0] px-3 py-2">
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
            <label htmlFor="identity-document-upload" className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#dfe7eb] px-3 py-2.5 text-[9px] font-bold text-[#3f5c75] hover:bg-[#f5f8f9] ${identityUploadPending ? 'pointer-events-none opacity-50' : ''}`}>
              <FileText size={14} />
              {identityUploadPending ? 'Uploading documents…' : 'Choose PDF, JPG or PNG files'}
            </label>
            <input id="identity-document-upload" type="file" multiple accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={uploadIdentityDocuments} disabled={identityUploadPending} />
            <p className="mt-2 text-[9px] leading-4 text-[#8794a2]">Do not upload documents for another person. Upload only government-approved identity documents that belong to you.</p>
            <form onSubmit={submitForIdentityReview} className="mt-3 border-t border-[#edf0f2] pt-3">
              <label className="flex items-start gap-2.5 text-[10px] leading-4 text-[#65798e]">
                <input type="checkbox" required checked={identityConsent} onChange={event => setIdentityConsent(event.target.checked)} className="mt-0.5 accent-[#387e84]" />
                <span>I confirm these documents belong to me and the details on it match my personal information provided when creating my account.</span>
              </label>
              <button disabled={!identityConsent || submitIdentityDocuments.isPending || identityUploadPending || !(documentsQuery.data ?? []).some(document => document.status === 'uploaded') || (documentsQuery.data ?? []).some(document => document.status === 'uploading')} className="mt-3 h-10 rounded-lg bg-[#142f51] px-4 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-45">
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
          <p className="mt-1 text-[10px] leading-4 text-[#8592a1]">Approval records a Globus wallet credit or debit only. It does not receive an outside deposit or make a payout. Every decision needs an audit reason and administrator PIN.</p>
        </div>
        {error && !reviewTarget && <p role="alert" className="border-b border-[#edf0f3] bg-[#fff1ef] px-5 py-3 text-[11px] text-[#a24940]">{error}</p>}
        {requests.isLoading ? <ListSkeleton /> : requests.isError ? <InlineError text="Customer requests are unavailable." retry={() => requests.refetch()} /> : requests.data?.length ? (
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
          <h2 id="ledger-review-title" className="mt-1 text-[16px] font-bold text-[#29425c]">{reviewTarget.decision === 'approve' ? 'Approve customer request' : 'Reject customer request'}</h2>
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
  const adminProfile = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey(), enabled: !!access.data?.allowed } });
  const exchangeRates = useListBankExchangeRates({ query: { queryKey: getListBankExchangeRatesQueryKey(), enabled: !!access.data?.allowed } });
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
  const [rateSource, setRateSource] = useState<Currency>('USD');
  const [rateDestination, setRateDestination] = useState<Currency>('EUR');
  const [rateValue, setRateValue] = useState('');
  const [rateReason, setRateReason] = useState('');
  const [ratePin, setRatePin] = useState('');
  const [rateMessage, setRateMessage] = useState('');
  const [statusTarget, setStatusTarget] = useState<BankTransaction | null>(null);
  const params = useMemo(() => ({ ...(search.trim() ? { search: search.trim() } : {}), limit: 100 }), [search]);
  const usersQuery = useListAdminUsers(params, { query: { queryKey: getListAdminUsersQueryKey(params), enabled: !!access.data?.allowed } });
  const users = { ...usersQuery, data: usersQuery.data?.items };
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
  const updateTransactionStatus = useUpdateAdminTransactionStatus();
  const upsertExchangeRate = useUpsertBankExchangeRate();
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
  const saveTransactionStatus = async (
    status: BankTransaction['status'],
    reason: string,
    transactionPin: string,
  ) => {
    if (!statusTarget) return;
    await updateTransactionStatus.mutateAsync({
      transactionId: statusTarget.id,
      data: { status, reason, transactionPin, confirmed: true },
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
  const submitExchangeRate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRateMessage('');
    upsertExchangeRate.mutate({
      data: {
        sourceCurrency: rateSource,
        destinationCurrency: rateDestination,
        rate: rateValue.trim(),
        reason: rateReason.trim(),
        transactionPin: ratePin,
      },
    }, {
      onSuccess: () => {
        setRateMessage(`Saved ${rateSource} → ${rateDestination} rate.`);
        setRateValue('');
        setRateReason('');
        setRatePin('');
        void queryClient.invalidateQueries({ queryKey: getListBankExchangeRatesQueryKey() });
      },
      onError: error => setRateMessage(error instanceof Error ? error.message : 'The internal rate could not be saved.'),
    });
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
      <PageHeading eyebrow="Restricted operations" title="Operations overview" subtitle="Review customer accounts, requests and recorded balance activity." />
      {summary.isError && <InlineError text="Summary totals are unavailable." retry={() => summary.refetch()} />}
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Registered users" value={summary.data?.registeredUsers} />
        <Metric label="Active accounts" value={summary.data?.activeAccounts} />
        <Metric label="Pending operations" value={summary.data?.pendingOperations} />
        <Metric label="Wallet transactions" value={summary.data?.ledgerTransactions} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#d9e7e8] bg-[#eff7f7] px-4 py-3 text-[11px] text-[#48767b]"><ShieldCheck size={15} /> Globus wallet records only · no outside funds are held or sent.</div>
      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-[#dfe7ec] bg-white px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#718296]">Your admin identity</p>
          <p className="mt-1 text-[12px] font-semibold text-[#304962]">Verification status: {humanize(adminProfile.data?.verificationStatus)}</p>
          <p className="mt-1 text-[10px] leading-4 text-[#7c8b9a]">Upload your own documents in Profile. You may approve your own review; the decision is recorded in the audit log.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/profile#identity-verification" className="rounded-lg border border-[#dfe6eb] px-3 py-2.5 text-[10px] font-bold text-[#3f5c75] hover:bg-[#f5f8f9]">Manage my documents</Link>
          {adminProfile.data?.verificationStatus === 'pending' && <button type="button" onClick={() => openIdentityReview({
            id: adminProfile.data!.id,
            email: adminProfile.data!.email,
            customerId: adminProfile.data!.customerId,
            firstName: adminProfile.data!.firstName,
            lastName: adminProfile.data!.lastName,
            country: adminProfile.data!.country,
            verificationStatus: adminProfile.data!.verificationStatus,
            verificationNote: adminProfile.data!.verificationNote,
            accountStatus: adminProfile.data!.accountStatus,
            accountRestrictionReason: null,
            accountRestrictionNotes: null,
            accountRestrictedAt: null,
            walletCount: 0,
            createdAt: adminProfile.data!.createdAt,
          })} className="rounded-lg bg-[#142f51] px-3 py-2.5 text-[10px] font-bold text-white hover:bg-[#1b4269]">Review my identity</button>}
        </div>
      </section>
      <section className="mt-6 rounded-[20px] border border-[#dfe7ec] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Internal conversion rates</p><h2 className="mt-1 text-[15px] font-bold text-[#29425c]">Manage calculator rates</h2><p className="mt-1 max-w-2xl text-[10px] leading-5 text-[#718296]">Rates are entered by Globus administrators and are not live market quotes. Each request stores the rate and timestamp used for its estimate.</p></div>
        </div>
        <form onSubmit={submitExchangeRate} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="From"><select data-testid="select-rate-source" value={rateSource} onChange={event => setRateSource(event.target.value as Currency)} className={inputClass}>{currencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></Field>
          <Field label="To"><select data-testid="select-rate-destination" value={rateDestination} onChange={event => setRateDestination(event.target.value as Currency)} className={inputClass}>{currencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></Field>
          <Field label="Rate (1 from = amount to)"><input data-testid="input-exchange-rate" required inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,10})?" min="0.0000000001" max="999999999999" step="0.0000000001" value={rateValue} onChange={event => setRateValue(event.target.value)} placeholder="e.g. 0.92" className={inputClass} /></Field>
          <Field label="Audit reason"><input data-testid="input-exchange-rate-reason" required minLength={5} maxLength={500} value={rateReason} onChange={event => setRateReason(event.target.value)} placeholder="Why is this rate changing?" className={inputClass} /></Field>
          <Field label="Your 6-digit transaction PIN"><input data-testid="input-exchange-rate-pin" required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={ratePin} onChange={event => setRatePin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} /></Field>
          <button data-testid="button-save-exchange-rate" disabled={upsertExchangeRate.isPending || rateSource === rateDestination || !rateValue || rateReason.trim().length < 5 || ratePin.length !== 6} className="h-11 self-end rounded-xl bg-[#142f51] px-4 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{upsertExchangeRate.isPending ? 'Saving…' : 'Save rate'}</button>
        </form>
        {rateMessage && <p role="status" className="mt-3 rounded-lg border border-[#dfe8ec] bg-[#f7f9fa] px-3 py-2 text-[10px] text-[#516b80]">{rateMessage}</p>}
        {exchangeRates.isLoading ? <div className="mt-5"><ListSkeleton /></div> : exchangeRates.isError ? <InlineError text="Conversion rates are unavailable." retry={() => exchangeRates.refetch()} /> : exchangeRates.data?.length ? <div className="mt-5 overflow-x-auto rounded-xl border border-[#e7edf0]"><table className="w-full min-w-[440px] text-left"><thead className="bg-[#f7f9fa] text-[9px] uppercase tracking-[.13em] text-[#8291a0]"><tr><th className="px-4 py-3">Pair</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Updated</th></tr></thead><tbody>{exchangeRates.data.map(rate => <tr key={`${rate.sourceCurrency}-${rate.destinationCurrency}`} data-testid={`row-rate-${rate.sourceCurrency}-${rate.destinationCurrency}`} className="border-t border-[#edf0f2] text-[10px] text-[#445a71]"><td className="px-4 py-3 font-semibold">{rate.sourceCurrency} → {rate.destinationCurrency}</td><td className="px-4 py-3 font-mono">{rate.rate}</td><td className="px-4 py-3">{formatDateTime(rate.updatedAt)}</td></tr>)}</tbody></table></div> : <div className="mt-5 rounded-xl bg-[#f7f9fa] px-4 py-3 text-[10px] text-[#75879a]">No rates are configured. Add a currency pair to enable the conversion calculator.</div>}
      </section>
      {statusError && <p role="alert" className="mt-3 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{statusError}</p>}
      {reviewFeedback && <p role="status" className="mt-3 rounded-lg border border-[#cfe5db] bg-[#f1f8f4] px-4 py-3 text-[11px] text-[#417461]">{reviewFeedback}</p>}
      {fundTarget && <section className="mt-6 rounded-[20px] border border-[#dfe7ec] bg-white p-5 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Admin balance adjustment</p><h2 className="mt-1 text-[15px] font-bold text-[#29425c]">Adjust a user wallet</h2><p className="mt-1 text-[11px] text-[#7e8d9c]">{[fundTarget.firstName, fundTarget.lastName].filter(Boolean).join(' ') || 'Globus member'} · {fundTarget.email}</p></div>
          <button type="button" aria-label="Close funding form" onClick={() => { setFundTarget(null); setFundingError(''); setFundingSuccess(null); setFundSenderName(''); setFundDescription(''); setFundReason(''); setFundTransactionPin(''); }} className="rounded-lg p-2 text-[#6d8092] hover:bg-[#f1f5f7]"><X size={16} /></button>
        </div>
        <p className="mb-5 rounded-lg border border-[#d9e8e9] bg-[#f2f8f8] px-4 py-3 text-[10px] leading-4 text-[#4e777a]">This records a wallet credit or debit in Globus and writes an audit entry. It does not move outside funds. Maximum per entry: 1,000,000.00.</p>
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
        <div className="border-b border-[#edf0f3] px-5 py-4 sm:px-7"><h2 className="text-[14px] font-bold text-[#28405c]">Transaction review</h2><p className="mt-1 text-[10px] text-[#8592a1]">Review account activity and transaction status. Corrections preserve the original record and create separate audited entries.</p></div>
        {ledger.isLoading ? <ListSkeleton /> : ledger.isError ? <InlineError text="Transaction records are unavailable." retry={() => ledger.refetch()} /> : ledger.data?.length ? <TransactionList transactions={ledger.data} onStatusOverride={transaction => setStatusTarget(transaction)} statusPending={updateTransactionStatus.isPending} /> : <EmptyState title="No transactions to review" text="There are no recorded transactions to review." />}
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
                {identityTarget.id !== adminProfile.data?.id && <>
                  <option value="rejected">Reject and close review</option>
                  <option value="additional_information_required">Request more information</option>
                </>}
              </select>
            </Field>
            {identityTarget.id === adminProfile.data?.id && <p className="mt-3 rounded-lg border border-[#eadfbe] bg-[#fbf7eb] px-4 py-3 text-[10px] leading-5 text-[#806b3d]">This is a self-approval. Globus records the decision but does not provide independent identity verification.</p>}
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

  const saveUserTransactionStatus = async (
    status: BankTransaction['status'],
    reason: string,
    transactionPin: string,
  ) => {
    if (!statusTarget) return;
    await updateTransactionStatus.mutateAsync({
      transactionId: statusTarget.id,
      data: { status, reason, transactionPin, confirmed: true },
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
        subtitle="Review this member’s profile, wallet balances, activity, and account status."
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
            <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#71869a]">Wallets</p><h2 className="mt-1 text-[14px] font-bold text-[#28405c]">Wallet balances</h2></div><span className="text-[10px] text-[#8492a0]">{detail.data.wallets.length} wallet{detail.data.wallets.length === 1 ? '' : 's'}</span></div>
            {detail.data.wallets.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{detail.data.wallets.map(wallet => <WalletCard key={wallet.id} wallet={wallet} />)}</div> : <EmptyState title="No wallets yet" text="Wallets are created with the account. Approved account adjustments update their balances." />}
          </section>

          <section className="overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white">
            <div className="border-b border-[#edf0f3] px-5 py-4 sm:px-7"><h2 className="text-[14px] font-bold text-[#28405c]">Recent activity</h2><p className="mt-1 text-[10px] text-[#8592a1]">Latest 50 transactions. Posted records remain intact; corrections create separate audited entries.</p></div>
            {detail.data.transactions.length ? <TransactionList transactions={detail.data.transactions} onStatusOverride={transaction => setStatusTarget(transaction)} statusPending={updateTransactionStatus.isPending} /> : <EmptyState title="No activity yet" text="This member has no recorded transactions." />}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[20px] border border-[#e1e8ee] bg-white p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Globus account</p>
            <h2 className="mt-1 text-[14px] font-bold text-[#29425c]">Fund this user</h2>
            <p className="mt-2 text-[10px] leading-4 text-[#7e8d9c]">Records a wallet credit or debit with an audit entry. No outside funds are moved.</p>
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
  '/about': { eyebrow: 'About Globus', title: 'Clear multi-currency account activity.', intro: 'Globus records multi-currency wallets, routed transfer requests and administrative balance adjustments in its application database.', sections: [['A platform, not a bank', 'Globus is not a licensed bank, payment institution or custodian. It does not accept, hold or send outside funds.'], ['Account balances', 'Wallet balances and transactions are records in Globus. No external bank or payment service processes these operations.'], ['Built for clear review', 'Balances, requests and activity include statuses, references and audit records to make each change traceable.']] },
  '/help': { eyebrow: 'Support', title: 'Help with your Globus account.', intro: 'Understand how account activity and requests are handled.', sections: [['How do deposits work?', 'Choose a bank-card or bank-transfer request. An administrator must approve it before your Globus wallet balance changes. Globus does not charge a card or receive an outside deposit.'], ['How do withdrawals work?', 'A pending withdrawal reserves the requested amount. Approval records the change in Globus; rejection releases the reserve. No outside payout is made.'], ['Can I send someone money?', 'Globus does not support member-to-member transfers. Transfer requests record the details in Globus but do not contact the recipient’s bank or send outside funds.'], ['How do international requests work?', 'Frankfurter reference rates are used to show converted amounts, with Grey available as a rate-only fallback. Rate quotes do not execute transfers; Globus does not contact the destination bank or send outside funds.'], ['Where can I find my Customer ID?', 'Open Customer ID in your account navigation. It identifies your Globus account, not a bank account or payment address.']] },
  '/fees': { eyebrow: 'Fees and rates', title: 'Understand transfer requests and rates.', intro: 'Globus does not process external deposits, payouts, or card payments.', sections: [['Rate quotes', 'Globus uses Frankfurter reference rates, with Grey as a fallback source. Availability depends on currency-pair support; quotes can change and are not confirmation of a payment.'], ['Fees', 'Globus records account requests and does not charge an outside transaction fee through a payment provider.'], ['Currency balances', 'Currency wallets are recorded separately. The rate and converted amount shown on a transfer receipt match the quote used when Globus recorded that request.']] },
  '/privacy': { eyebrow: 'Privacy notice', title: 'Your information deserves clarity.', intro: 'This page summarizes account information Globus uses to provide its software services.', sections: [['Account details', 'Profile details and account identifiers associate internal records with your account. Authentication is provided through Clerk.'], ['Private identity documents', 'Documents submitted for internal review are stored privately and accessible only to the submitting member and authorized Globus admins. Files are deleted after approval or rejection. The verification status and an audit record of the decision remain. This review is not legal, bank or government identity verification.'], ['Operational records', 'Transactions and requests may include references, status, currency, amount, descriptions and timestamps. For international transfer requests, only the recipient account’s last four characters are retained.'], ['Your choices', 'Use your Profile page to review your details and manage identity documents before submitting them. Contact the support team with questions about account information or platform operations.']] },
  '/terms': { eyebrow: 'Terms of use', title: 'Globus account records, not bank deposits.', intro: 'Globus records account activity in its own database and does not move outside funds.', sections: [['No banking service', 'Globus is not a licensed bank and does not accept deposits, provide credit, custody funds or promise payment execution.'], ['Account records', 'Displayed balances and transactions represent entries in Globus. An approved deposit request records a wallet credit; an approved withdrawal records a wallet debit. Neither action moves outside funds.'], ['Use responsibly', 'Do not rely on Globus balances or status labels as proof of funds held by a bank or as a promise of payment.']] },
  '/contact': { eyebrow: 'Contact', title: 'Contact information is not configured yet.', intro: 'A verified support channel has not been configured for Globus.', sections: [['Account help', 'Visit Help for guidance about the software. Do not include passwords, verification codes or sensitive payment details in support requests.'], ['Recorded activity', 'Include the transaction reference when asking about an account record.'], ['Operational disclosure', 'Globus support cannot complete, trace or reverse an external payment through this product.']] },
};

export function DisclosurePage({ path }: { path: string }) {
  const data = disclosureCopy[path] ?? disclosureCopy['/about'];
  return (
    <div className="public-viewport-scroll bg-[#f5f8fa]">
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
      <footer className="border-t border-[#e2e8ed] bg-white px-6 py-7 text-center text-[10px] text-[#8794a3]">Globus · Account activity software · no outside funds are held or sent</footer>
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
      return 'Opening balance';
    case 'admin_funding':
      return 'Balance adjustment credit';
    case 'admin_debit':
      return 'Balance adjustment debit';
    case 'transfer_in':
      return 'Member transfer';
    case 'transfer_out':
      return 'Member transfer sent';
    case 'external_transfer':
      return transaction.status === 'pending' ? 'Transfer request' : 'Routed transfer';
    case 'external_transfer_in':
      return 'Prior account record';
    default:
      return humanize(transaction.type);
  }
}
function TransactionList({
  transactions,
  onStatusOverride,
  statusPending = false,
}: {
  transactions: BankTransaction[];
  onStatusOverride?: (transaction: BankTransaction) => void;
  statusPending?: boolean;
}) {
  const [receipt, setReceipt] = useState<BankTransaction | null>(null);
  const [historyTarget, setHistoryTarget] = useState<BankTransaction | null>(null);
  return <>
    <div>{transactions.map(transaction => {
      const isIncoming = transaction.type === 'transfer_in' || transaction.type === 'external_transfer_in' || transaction.type === 'simulation_credit' || transaction.type === 'admin_funding';
      const isInternationalRequest = transaction.type === 'external_transfer' && transaction.status === 'pending';
      const canPrintReceipt = transaction.status === 'completed';
      return <div key={transaction.id} className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-[#edf0f2] px-4 py-4 last:border-0 sm:flex-nowrap sm:gap-4 sm:px-7">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isIncoming ? 'bg-[#edf7f3] text-[#4d8c72]' : isInternationalRequest ? 'bg-[#fbf7eb] text-[#a0793b]' : 'bg-[#f0f4f7] text-[#658097]'}`}>{isInternationalRequest ? <Globe2 size={16} /> : isIncoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#334a63]">{transaction.description || transactionDisplayType(transaction)}</p><p className="mt-1 truncate text-[9px] text-[#8996a4]">{transaction.counterparty || 'Globus account'} · {formatDate(transaction.createdAt)} · Globus record</p></div>
        <div className="shrink-0 text-right"><p className={`text-[11px] font-bold ${isIncoming ? 'text-[#417f69]' : isInternationalRequest ? 'text-[#a0793b]' : 'text-[#3c5269]'}`}>{isInternationalRequest ? 'Request · ' : isIncoming ? '+' : '−'}{formatMoney(Number(transaction.amount), transaction.currency)}</p><p className={`mt-1 text-[9px] capitalize ${transaction.status === 'completed' ? 'text-[#4f8c75]' : 'text-[#9b8050]'}`}>{humanize(transaction.status)}</p></div>
        {(canPrintReceipt || onStatusOverride) && <div className="flex w-full flex-wrap justify-end gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
          {canPrintReceipt && <button type="button" onClick={() => setReceipt(transaction)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9]" aria-label={`View receipt ${transaction.reference}`}><FileText size={13} /><span className="hidden sm:inline">Receipt</span></button>}
          {onStatusOverride && <button type="button" onClick={() => setHistoryTarget(transaction)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9]" aria-label={`View status history for ${transaction.reference}`}><History size={13} /><span className="hidden sm:inline">History</span></button>}
          {onStatusOverride && transaction.type !== 'deposit_request' && transaction.type !== 'withdrawal_request' && <button type="button" disabled={statusPending} onClick={() => onStatusOverride(transaction)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9] disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Override status for ${transaction.reference}`}><RefreshCw size={13} /><span className="hidden sm:inline">Status</span></button>}
        </div>}
      </div>;
    })}</div>
    {receipt && <ReceiptDialog transaction={receipt} onClose={() => setReceipt(null)} />}
    {historyTarget && <TransactionStatusHistoryDialog transaction={historyTarget} onClose={() => setHistoryTarget(null)} />}
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
  const allowedStatuses: BankTransaction['status'][] =
    transaction.type === 'deposit_request' || transaction.type === 'withdrawal_request'
      ? []
      : transaction.status === 'pending'
      ? ['failed', 'rejected']
      : transaction.status === 'failed'
        ? ['pending']
        : [];

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
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#55868b]">Admin transaction control</p><h2 id="transaction-status-title" className="mt-1 text-[16px] font-bold text-[#29425c]">Correct internal processing status</h2><p className="mt-1 break-all text-[10px] text-[#7e8d9c]">{transaction.reference}</p></div>
          <button type="button" aria-label="Close status override" onClick={onClose} className="rounded-lg p-2 text-[#6d8092] hover:bg-[#f1f5f7]"><X size={16} /></button>
        </div>
        <p className="mt-4 rounded-lg border border-[#e5e9ed] bg-[#f7f9fa] px-4 py-3 text-[10px] leading-4 text-[#64798e]">This status-only correction never changes wallet balances or their underlying records. The server checks the authoritative transaction; posted operations must use a separate audited reversal. Pending deposits and withdrawals must be handled in their review queue.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="New status">
            <select value={status} onChange={event => setStatus(event.target.value as BankTransaction['status'])} className={inputClass}>
              <option value={transaction.status} disabled>{transaction.status.replaceAll('_', ' ')} (current)</option>
              {allowedStatuses.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Audit reason">
            <textarea required minLength={5} maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why this recorded status is being changed." className={`${inputClass} h-auto py-3`} />
          </Field>
          <Field label="Your 6-digit transaction PIN">
            <input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={transactionPin} onChange={event => setTransactionPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} />
          </Field>
          <label className="flex items-start gap-2 rounded-lg bg-[#f5f7f8] p-3 text-[10px] leading-4 text-[#64798e]"><input required type="checkbox" className="mt-0.5 accent-[#315f73]" />I reviewed the internal status and confirm this correction.</label>
          {error && <p role="alert" className="rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] text-[#a24940]">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#dfe6eb] px-4 py-3 text-[10px] font-bold text-[#546b80] hover:bg-[#f5f8f9]">Cancel</button>
            <button disabled={pending || !allowedStatuses.includes(status) || reason.trim().length < 5 || transactionPin.length !== 6} className="rounded-xl bg-[#142f51] px-4 py-3 text-[10px] font-bold text-white hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Saving status…' : 'Confirm status correction'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ReceiptDialog({ transaction, onClose }: { transaction: ReceiptTransaction; onClose: () => void }) {
  return <TransferReceiptModal transaction={transaction} onClose={onClose} title={transactionDisplayType(transaction)} />;
}

function StatusLine({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[11px] text-[#8793a1]">{label}</span><span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${positive ? 'text-[#4c836e]' : 'text-[#927944]'}`}><span className={`h-1.5 w-1.5 rounded-full ${positive ? 'bg-[#71ad8d]' : 'bg-[#d0ad5d]'}`} />{value}</span></div>;
}

function ActionTile({ href, icon, label, testId }: { href: string; icon: ReactNode; label: string; testId?: string }) {
  return <Link href={href} data-testid={testId} className="flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-[#e5ebef] bg-[#fbfcfd] px-1.5 py-2 text-center text-[9px] font-bold text-[#3d556d] transition hover:border-[#bbd7d8] hover:bg-[#f3f9f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#43888e]"><span className="grid h-6 w-6 place-items-center rounded-md bg-[#edf5f6] text-[#478b90]">{icon}</span><span className="w-full truncate">{label}</span></Link>;
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

function previewConversionAmount(amount: string, rate: string): string | null {
  const amountMatch = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(amount);
  const rateMatch = /^(\d{1,12})(?:\.(\d{1,10}))?$/.exec(rate);
  if (!amountMatch || !rateMatch) return null;
  const minor = BigInt(amountMatch[1]) * 100n + BigInt((amountMatch[2] ?? '').padEnd(2, '0'));
  const scale = 10n ** 10n;
  const rateScaled = BigInt(rateMatch[1]) * scale + BigInt((rateMatch[2] ?? '').padEnd(10, '0'));
  const converted = (minor * rateScaled + scale / 2n) / scale;
  return `${converted / 100n}.${(converted % 100n).toString().padStart(2, '0')}`;
}

function getReceiptConversion(transaction: ReceiptTransaction): ReceiptConversion | null {
  if (transaction.conversion) return transaction.conversion;
  if (transaction.type !== 'external_transfer' || !transaction.description) return null;
  const match = /(?:^| · )(\d+(?:\.\d{1,2})?) ([A-Z]{3}) converted to (\d+(?:\.\d{1,2})?) ([A-Z]{3}) at (\d+(?:\.\d{1,10})?)(?:$| · )/.exec(transaction.description);
  if (!match) return null;
  return {
    sourceAmount: match[1],
    sourceCurrency: match[2],
    destinationAmount: match[3],
    destinationCurrency: match[4],
    exchangeRate: match[5],
  };
}

function formatExchangeRate(rate: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(rate.trim());
  if (!match) return rate;

  const integer = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : integer;
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
