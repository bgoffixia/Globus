import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, ArrowLeft, ArrowRight, Delete, FileText, Globe2, Landmark, LockKeyhole, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetBankDashboardQueryKey,
  getGetBankExchangeRateQuoteQueryKey,
  getGetBankProfileQueryKey,
  getListBankNotificationsQueryKey,
  getListBankTransactionsQueryKey,
  getListBankWalletsQueryKey,
  getListInternationalTransferRequestsQueryKey,
  useCreateInternationalTransferRequest,
  useGetBankExchangeRateQuote,
  useGetBankProfile,
  useListBankWallets,
  useListInternationalTransferRequests,
} from '@workspace/api-client-react';
import type { InternationalTransferRequestInput } from '@workspace/api-client-react';
import { BankSelect } from '@/components/bank-select';
import { CountrySelect } from '@/components/country-select';
import { countries } from '@/lib/countries';
import { currencyLabel, destinationCurrencies, destinationCurrencyForCountry } from '@/lib/destination-currency';
import { previewConversion } from '@/lib/currency-conversion';
import { digitsFor, formatAmount, formatRate, humanizeStatus, receiptFromRequest, TransferReceiptModal, type ReceiptTransaction } from './transfer-receipt';

type TransferType = 'local_routing' | 'international_wire';
type SourceCurrency = InternationalTransferRequestInput['sourceCurrency'];
const sourceCurrencies = ['USD', 'EUR', 'GBP', 'CAD'] as const;
const STEPS = ['Route', 'Recipient', 'Amount', 'Review', 'Authorise'] as const;
const GUIDE = [
  'Pick the wallet to debit, where the money is going, and the currency the recipient should receive.',
  'Enter the recipient exactly as their bank holds it. A contact email is optional.',
  'Enter the amount from your wallet. The converted total uses a Frankfurter rate quote, with Grey as a fallback.',
  'Read every line. Confirming locks this rate; if it changes you will be asked to review again.',
  'Enter your six-digit transaction PIN on the keypad to submit.',
];
const SWIFT_RE = /^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/;
const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function InternationalTransferPage() {
  const queryClient = useQueryClient();
  const profile = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } });
  const wallets = useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } });
  const requests = useListInternationalTransferRequests({ query: { queryKey: getListInternationalTransferRequestsQueryKey() } });
  const createRequest = useCreateInternationalTransferRequest();

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [transferType, setTransferType] = useState<TransferType>(params.get('type') === 'international_wire' ? 'international_wire' : 'local_routing');
  const [step, setStep] = useState(0);
  const [sourceCurrency, setSourceCurrency] = useState<SourceCurrency>(() => {
    const requested = params.get('currency');
    return sourceCurrencies.find(currency => currency === requested) ?? 'USD';
  });
  const [destinationCountry, setDestinationCountry] = useState('');
  const [recipientBank, setRecipientBank] = useState('');
  const [destinationCurrency, setDestinationCurrency] = useState(() => {
    const requested = (params.get('destinationCurrency') ?? '').toUpperCase();
    return destinationCurrencies.includes(requested) ? requested : '';
  });
  const [recipientAccountName, setRecipientAccountName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientAccountNumber, setRecipientAccountNumber] = useState('');
  const [routingCode, setRoutingCode] = useState('');
  const [swiftBic, setSwiftBic] = useState('');
  const [remark, setRemark] = useState('');
  const [amount, setAmount] = useState(() => {
    const requested = params.get('amount') ?? '';
    return AMOUNT_RE.test(requested) ? requested : '';
  });
  const [confirmed, setConfirmed] = useState(false);
  const [rateSnapshot, setRateSnapshot] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptTransaction | null>(null);
  const [receiptNotice, setReceiptNotice] = useState('');
  const keyRef = useRef<{ fp: string; key: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const pending = createRequest.isPending;
  const verified = profile.data?.verificationStatus === 'approved';
  const pinConfigured = profile.data?.transactionPinConfigured !== false;
  const walletList = (wallets.data ?? []).filter(
    (w): w is typeof w & { currency: SourceCurrency } =>
      sourceCurrencies.includes(w.currency as SourceCurrency),
  );
  const wallet = walletList.find(w => w.currency === sourceCurrency);
  const available = Number(wallet?.available ?? 0);
  const countryCode = countries.find(c => c.name === destinationCountry)?.code ?? '';
  const targetDigits = destinationCurrency ? digitsFor(destinationCurrency) : 2;
  const quoteParams = { sourceCurrency, destinationCurrency };
  const quote = useGetBankExchangeRateQuote(quoteParams, {
    query: {
      queryKey: getGetBankExchangeRateQuoteQueryKey(quoteParams),
      enabled: !!destinationCurrency,
      retry: false,
      refetchInterval: 15 * 60_000,
      refetchOnWindowFocus: true,
      staleTime: 12 * 60_000,
    },
  });

  useEffect(() => {
    if (walletList.length && !walletList.some(w => w.currency === sourceCurrency)) setSourceCurrency(walletList[0].currency);
  }, [walletList, sourceCurrency]);

  const liveRate = quote.isError ? null : quote.data?.rate ?? null;
  const liveConverted = liveRate && AMOUNT_RE.test(amount) ? previewConversion(amount, liveRate, targetDigits) : null;
  const snapshotConverted = rateSnapshot && AMOUNT_RE.test(amount) ? previewConversion(amount, rateSnapshot, targetDigits) : null;
  const rateChanged = rateSnapshot !== null && liveRate !== null && formatRate(liveRate) !== formatRate(rateSnapshot);
  const rateLost = rateSnapshot !== null && liveRate === null && !quote.isLoading;

  const fingerprint = JSON.stringify([transferType, sourceCurrency, destinationCountry, recipientBank, destinationCurrency, recipientAccountName.trim(), recipientEmail.trim().toLowerCase(), recipientAccountNumber.replace(/\s/g, ''), transferType === 'local_routing' ? routingCode.trim() : swiftBic.toUpperCase(), remark.trim(), amount, rateSnapshot]);
  const idempotencyKey = useMemo(() => {
    if (!keyRef.current || keyRef.current.fp !== fingerprint) keyRef.current = { fp: fingerprint, key: newKey() };
    return keyRef.current.key;
  }, [fingerprint]);

  // Any edit after confirmation invalidates the review.
  useEffect(() => { if (step < 3) { setConfirmed(false); setRateSnapshot(null); } }, [step]);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [step]);

  const stepValid = [
    !!wallet && !!countryCode && !!recipientBank.trim() && !!destinationCurrency,
    recipientAccountName.trim().length > 1 &&
      (!recipientEmail.trim() ||
        (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()) &&
          recipientEmail.trim().length <= 254)) &&
      /^[A-Za-z0-9 ]{4,34}$/.test(recipientAccountNumber) &&
      (transferType === 'local_routing'
        ? /^[A-Za-z0-9 -]{2,24}$/.test(routingCode.trim())
        : SWIFT_RE.test(swiftBic)),
    AMOUNT_RE.test(amount) && Number(amount) > 0 && Number(amount) <= available && !!liveRate && liveConverted !== null && Number(liveConverted) > 0 && wallet?.status !== 'restricted',
    confirmed && !!rateSnapshot && !rateChanged && !rateLost,
    pin.length === 6 && !rateChanged && !rateLost && pinConfigured,
  ];

  const go = (n: number) => { if (!pending) { setError(''); if (n < 4) setPin(''); setStep(n); } };
  const next = () => {
    if (!stepValid[step]) return;
    if (step === 2) { setRateSnapshot(liveRate); setConfirmed(false); }
    go(step + 1);
  };
  const switchType = (t: TransferType) => { if (pending || t === transferType) return; setTransferType(t); setStep(s => Math.min(s, 1)); setPin(''); setError(''); };
  const selectCountry = (name: string) => {
    setDestinationCountry(name);
    setRecipientBank('');
    const code = countries.find(c => c.name === name)?.code;
    const auto = code ? destinationCurrencyForCountry(code) : undefined;
    setDestinationCurrency(auto ?? '');
  };

  const resetAll = () => {
    setStep(0); setDestinationCountry(''); setRecipientBank(''); setDestinationCurrency(''); setRecipientAccountName(''); setRecipientEmail(''); setRecipientAccountNumber('');
    setRoutingCode(''); setSwiftBic(''); setRemark(''); setAmount(''); setConfirmed(false); setRateSnapshot(null); setPin(''); keyRef.current = null;
  };

  const submit = () => {
    if (pending || !stepValid[4] || !rateSnapshot) return;
    setError('');
    createRequest.mutate({
      data: {
        transferType,
        destinationCountry: destinationCountry.trim(),
        recipientBank: recipientBank.trim(),
        ...(transferType === 'local_routing' ? { routingCode: routingCode.trim() } : { swiftBic: swiftBic.trim().toUpperCase() }),
        recipientAccountName: recipientAccountName.trim(),
        ...(recipientEmail.trim()
          ? { recipientEmail: recipientEmail.trim().toLowerCase() }
          : {}),
        recipientAccountNumber,
        sourceCurrency,
        destinationCurrency,
        amount,
        ...(remark.trim() ? { remark: remark.trim() } : {}),
        transactionPin: pin,
        idempotencyKey,
        expectedExchangeRate: rateSnapshot,
      },
    }, {
      onSuccess: request => {
        setPin('');
        setReceipt(receiptFromRequest(request));
        setReceiptNotice(request.recipientEmailNotificationSkipped
          ? 'The transfer was recorded, but no recipient email notification was sent.'
          : '');
        resetAll();
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: getListInternationalTransferRequestsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListBankNotificationsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListBankTransactionsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListBankWalletsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetBankDashboardQueryKey() }),
        ]);
      },
      onError: err => {
        setPin('');
        setError(err instanceof Error ? err.message : 'The transfer could not be recorded. Your details are kept; please try again.');
      },
    });
  };

  if (wallets.isLoading || profile.isLoading) {
    return <div className="mx-auto mt-6 max-w-[560px] animate-pulse rounded-[24px] border border-[#e1e8ee] bg-white p-6"><div className="h-10 rounded-xl bg-[#eef2f5]" /><div className="mt-5 h-3 w-2/3 rounded bg-[#eef2f5]" />{[0, 1, 2, 3].map(i => <div key={i} className="mt-4 h-11 rounded-xl bg-[#f1f4f6]" />)}</div>;
  }
  if (wallets.isError || profile.isError) {
    return <div className="mx-auto mt-6 max-w-[560px] rounded-[24px] border border-[#eadfda] bg-white p-8 text-center"><p className="text-[13px] font-bold text-[#3c4d5e]">Your account details could not be loaded.</p><button type="button" onClick={() => { void wallets.refetch(); void profile.refetch(); }} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#dfe6ea] px-4 py-2.5 text-[10px] font-bold text-[#435b72]"><RefreshCw size={13} /> Try again</button></div>;
  }

  const routeLabel = transferType === 'local_routing' ? 'Local routing' : 'International wire';

  return (
    <div className="transfer-page">
      <div className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-[580px] flex-col justify-center py-2">
        <section data-testid="transfer-wizard" aria-labelledby="transfer-step-title" className="flex min-w-0 flex-col overflow-visible rounded-[24px] border border-[#dfe7ec] bg-white shadow-[0_24px_60px_rgba(22,48,78,.08)]">
          <div className="rounded-t-[24px] border-b border-[#edf1f3] px-4 pt-4 sm:px-6 sm:pt-5">
            <div role="tablist" aria-label="Transfer route" className="grid grid-cols-2 gap-1 rounded-xl bg-[#eff3f5] p-1">
              {(['local_routing', 'international_wire'] as const).map(t => (
                <button key={t} type="button" role="tab" aria-selected={transferType === t} disabled={pending} data-testid={`tab-${t.replace('_', '-')}`} onClick={() => switchType(t)} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-[11px] font-bold transition ${transferType === t ? 'bg-white text-[#173452] shadow-sm' : 'text-[#6f8195] hover:text-[#2d4864]'}`}>
                  {t === 'local_routing' ? <Landmark size={14} /> : <Globe2 size={14} />}{t === 'local_routing' ? 'Local routing' : 'International wire'}
                </button>
              ))}
            </div>
            <ol aria-label="Transfer progress" className="mt-4 flex items-center gap-1.5 pb-4">
              {STEPS.map((label, i) => (
                <li key={label} aria-current={i === step ? 'step' : undefined} className="flex flex-1 flex-col gap-1.5">
                  <span className={`h-1 rounded-full transition-colors ${i < step ? 'bg-[#3f8a8f]' : i === step ? 'bg-[#173b62]' : 'bg-[#e3e9ed]'}`} />
                  <span className={`hidden text-[9px] font-bold uppercase tracking-[.1em] sm:block ${i === step ? 'text-[#173b62]' : 'text-[#9aa7b3]'}`}>{label}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#4f8b90]">Step {step + 1} of 5 · {routeLabel}</p>
            <h1 id="transfer-step-title" ref={headingRef} tabIndex={-1} className="bank-display mt-1 text-[22px] font-semibold tracking-[-.03em] text-[#18324f] outline-none">{['Where is it going?', 'Who receives it?', 'How much?', 'Review and confirm', 'Authorise with PIN'][step]}</h1>
            <p data-testid="text-transfer-guide" className="mt-1 text-[11px] leading-5 text-[#6d7f92]">{GUIDE[step]}</p>

            <div className="mt-4 space-y-3">
              {step === 0 && <>
                <F label="Source wallet">
                  <select data-testid="select-source-currency" value={sourceCurrency} onChange={e => setSourceCurrency(e.target.value as SourceCurrency)} className={inputCls}>
                    {walletList.map(w => <option key={w.id} value={w.currency}>{w.currency} wallet · {formatAmount(w.available, w.currency)} available{w.status === 'restricted' ? ' · frozen' : ''}</option>)}
                  </select>
                </F>
                <F label="Destination country"><CountrySelect value={destinationCountry} onChange={selectCountry} /></F>
                <div className="grid gap-3 sm:grid-cols-2">
                  <F label="Recipient bank"><BankSelect key={countryCode || 'none'} countryCode={countryCode} value={recipientBank} onChange={setRecipientBank} /></F>
                  <F label="Recipient receives" hint={destinationCountry && !destinationCurrencyForCountry(countryCode) ? 'No default currency for this country; choose one.' : destinationCurrency ? 'Auto-selected from country. You can change it.' : undefined}>
                    <select data-testid="select-destination-currency" value={destinationCurrency} onChange={e => setDestinationCurrency(e.target.value)} className={inputCls}>
                      <option value="">Choose currency</option>
                      {destinationCurrencies.map((c: string) => <option key={c} value={c}>{currencyLabel(c)}</option>)}
                    </select>
                  </F>
                </div>
              </>}

              {step === 1 && <>
                <F label="Recipient account name"><input data-testid="input-recipient-account-name" maxLength={120} value={recipientAccountName} onChange={e => setRecipientAccountName(e.target.value)} placeholder="Name on the account" className={inputCls} /></F>
                <F label="Recipient email (optional)" hint="A transfer-status email is sent only when you provide an address."><input type="email" data-testid="input-recipient-email" maxLength={254} autoComplete="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="name@example.com (optional)" className={inputCls} /></F>
                <F label={transferType === 'local_routing' ? 'Recipient account number' : 'Recipient account number / IBAN'}><input data-testid="input-recipient-account-number" maxLength={34} autoComplete="off" value={recipientAccountNumber} onChange={e => setRecipientAccountNumber(e.target.value.replace(/[^A-Za-z0-9 ]/g, ''))} placeholder={transferType === 'local_routing' ? 'Account number' : 'Account number or IBAN'} className={`${inputCls} font-mono`} /></F>
                {transferType === 'local_routing'
                  ? <F label="Routing / clearing code"><input data-testid="input-local-routing-code" maxLength={24} value={routingCode} onChange={e => setRoutingCode(e.target.value.replace(/[^A-Za-z0-9 -]/g, ''))} placeholder="Routing or sort code" className={`${inputCls} font-mono`} /></F>
                  : <F label="SWIFT / BIC" hint={swiftBic && !SWIFT_RE.test(swiftBic) ? 'Use 8 or 11 letters and numbers.' : undefined}><input data-testid="input-swift-bic" maxLength={11} value={swiftBic} onChange={e => setSwiftBic(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="8 or 11 characters" className={`${inputCls} font-mono uppercase`} /></F>}
                <F label="Remark (optional)"><input data-testid="input-transfer-remark" maxLength={140} value={remark} onChange={e => setRemark(e.target.value)} placeholder="Reason or note" className={inputCls} /></F>
              </>}

              {step === 2 && <>
                <F label={`Amount in ${sourceCurrency}`} hint={`Available ${formatAmount(available, sourceCurrency)}`}>
                  <input data-testid="input-international-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className={`${inputCls} h-14 text-[22px] font-semibold`} />
                </F>
                {Number(amount) > available && <p role="alert" className="text-[10px] text-[#a24940]">That is more than the available balance.</p>}
                {liveConverted !== null && Number(amount) > 0 && Number(liveConverted) === 0 && <p role="alert" className="text-[10px] text-[#a24940]">Increase the source amount so the converted total is at least one destination minor unit.</p>}
                {wallet?.status === 'restricted' && <p role="alert" className="text-[10px] text-[#a24940]">This wallet is frozen; outgoing transfers are unavailable.</p>}
                <div data-testid="conversion-quote" aria-live="polite" className="rounded-xl border border-[#d9e7ea] bg-[#f3f8f9] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#4f868b]">Current conversion quote</p>
                  {quote.isLoading && !quote.data ? <div className="mt-2 h-7 w-40 animate-pulse rounded bg-[#e2ecee]" /> : liveRate ? <>
                    <p data-testid="text-converted-total" className="bank-display mt-1 text-[24px] font-semibold text-[#1b3654]">{liveConverted ? formatAmount(liveConverted, destinationCurrency) : `— ${destinationCurrency}`}</p>
                    <p data-testid="text-conversion-rate" className="mt-1 font-mono text-[10px] text-[#5d7488]">1 {sourceCurrency} = {formatRate(liveRate)} {destinationCurrency}</p>
                    <p className="mt-1 text-[9px] text-[#8996a3]">{quote.data?.provider !== 'Globus' ? `${quote.data?.provider} quote · checked ${quote.data?.checkedAt ? new Date(quote.data.checkedAt).toLocaleString() : 'just now'}` : 'Same-currency rate · 1:1'}</p>
                  </> : <p data-testid="status-rate-unavailable" className="mt-2 flex items-start gap-2 text-[11px] leading-5 text-[#8a6430]"><AlertTriangle size={14} className="mt-0.5 shrink-0" />No rate source could quote {sourceCurrency} to {destinationCurrency}. Choose another currency pair or try again later.</p>}
                </div>
              </>}

              {step === 3 && <>
                <dl data-testid="transfer-review" className="divide-y divide-dashed divide-[#e3e9ed] rounded-xl border border-[#e3e9ed] px-4 text-[11px]">
                  <R k="Route" v={routeLabel} />
                  <R k="From" v={`${sourceCurrency} wallet`} />
                  <R k="Recipient" v={recipientAccountName.trim()} />
                  {recipientEmail.trim() && <R k="Recipient email" v={recipientEmail.trim()} />}
                  <R k="Bank" v={`${recipientBank} · ${destinationCountry}`} />
                  <R k="Account" v={recipientAccountNumber} mono />
                  <R k={transferType === 'local_routing' ? 'Routing number' : 'SWIFT / BIC'} v={transferType === 'local_routing' ? routingCode : swiftBic} mono />
                  {remark.trim() && <R k="Remark" v={remark.trim()} />}
                  <R k="You send" v={formatAmount(amount, sourceCurrency)} />
                  <R k="Rate" v={rateSnapshot ? `1 ${sourceCurrency} = ${formatRate(rateSnapshot)} ${destinationCurrency}` : '—'} mono />
                  <R k="Recipient gets" v={snapshotConverted ? formatAmount(snapshotConverted, destinationCurrency) : '—'} strong testId="text-review-converted-total" />
                </dl>
                <RateWarning changed={rateChanged} lost={rateLost} onReview={() => { setRateSnapshot(liveRate); setConfirmed(false); }} />
                <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#f5f8f9] p-3 text-[11px] leading-5 text-[#3e566e]">
                  <input data-testid="checkbox-confirm-transfer" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#173b62]" />
                  <span>I confirm these details are correct. {verified ? 'Globus will record this transfer once I enter my PIN.' : 'My account is not yet verified, so this will be sent to an administrator for review.'}</span>
                </label>
              </>}

              {step === 4 && <>
                <div className="flex items-center justify-between rounded-xl bg-[#f3f8f9] px-4 py-3 text-[11px]"><span className="text-[#6a7d90]">{formatAmount(amount, sourceCurrency)} to {recipientAccountName.trim()}</span><b className="text-[#1b3654]">{snapshotConverted ? formatAmount(snapshotConverted, destinationCurrency) : ''}</b></div>
                <RateWarning changed={rateChanged} lost={rateLost} onReview={() => go(3)} />
                {!pinConfigured && <p className="rounded-lg border border-[#eadfbe] bg-[#fbf7eb] px-4 py-3 text-[10px] leading-5 text-[#806b3d]">Set up your transaction PIN in <Link href="/settings" className="font-bold underline">Settings</Link> first.</p>}
                <PinPad value={pin} onChange={setPin} disabled={pending || !pinConfigured} onSubmit={submit} />
              </>}
            </div>

            {error && <p data-testid="status-transfer-error" role="alert" className="mt-4 rounded-lg bg-[#fff1ef] px-4 py-3 text-[11px] leading-5 text-[#a24940]">{error}</p>}
          </div>

          <div className="mt-auto flex items-center gap-2 rounded-b-[24px] border-t border-[#edf1f3] bg-[#fafbfc] px-4 py-3 sm:px-6">
            {step > 0 && <button type="button" data-testid="button-transfer-back" disabled={pending} onClick={() => go(step - 1)} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[#dbe3e8] bg-white px-4 text-[11px] font-bold text-[#3e566e] disabled:opacity-50"><ArrowLeft size={14} /> Back</button>}
            {step < 4
              ? <button type="button" data-testid="button-transfer-next" disabled={!stepValid[step]} onClick={next} className="ml-auto inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#142f51] px-5 text-[12px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none sm:min-w-[180px]">{step === 3 ? 'Confirm and continue' : 'Continue'} <ArrowRight size={15} /></button>
              : <button type="button" data-testid="button-submit-international-transfer" disabled={!stepValid[4] || pending} onClick={submit} className="ml-auto inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#142f51] px-5 text-[12px] font-bold text-white transition hover:bg-[#1b4269] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none sm:min-w-[180px]"><LockKeyhole size={14} /> {pending ? 'Submitting…' : verified ? 'Complete transfer' : 'Submit for review'}</button>}
          </div>
        </section>
      </div>

      <section className="mx-auto mt-6 max-w-[580px] overflow-hidden rounded-[20px] border border-[#e1e8ee] bg-white" aria-labelledby="transfer-history-title">
        <div className="flex items-center justify-between border-b border-[#edf0f3] px-5 py-4"><h2 id="transfer-history-title" className="text-[13px] font-bold text-[#28405c]">Transfer history</h2><span className="text-[10px] font-semibold text-[#8291a1]">{requests.data?.length ?? 0} transfers</span></div>
        {requests.isLoading ? <div className="space-y-3 p-5">{[0, 1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded-lg bg-[#f0f3f5]" />)}</div>
          : requests.isError ? <div className="flex items-center justify-between px-5 py-5 text-[11px] text-[#a05c50]"><span>Transfer history is unavailable.</span><button type="button" onClick={() => requests.refetch()} className="inline-flex items-center gap-1.5 font-bold"><RefreshCw size={12} />Retry</button></div>
          : requests.data?.length ? <ul className="divide-y divide-[#edf0f3]">{requests.data.map(r => (
            <li key={r.id} data-testid={`request-international-${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
               <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-[#304962]">{r.recipientAccountName} · {r.destinationCountry}</p><p className="mt-0.5 truncate text-[10px] text-[#7d8b99]">{r.recipientEmail ? `${r.recipientEmail} · ` : ''}{humanizeStatus(r.transferType)} · {r.reference}</p><p className="mt-0.5 text-[10px] text-[#60748a]">{formatAmount(r.sourceAmount, r.sourceCurrency)} → {formatAmount(r.destinationAmount, r.destinationCurrency)}</p></div>
              <div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${r.status === 'completed' ? 'bg-[#edf7f1] text-[#3f7560]' : 'bg-[#fbf7eb] text-[#806b3d]'}`}>{humanizeStatus(r.status)}</span><button type="button" data-testid={`button-view-receipt-${r.id}`} onClick={() => { setReceiptNotice(''); setReceipt(receiptFromRequest(r)); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe7eb] px-2.5 py-1.5 text-[10px] font-bold text-[#3e5a72] hover:bg-[#f5f8f9]"><FileText size={13} /> Receipt</button></div>
            </li>))}</ul>
          : <div className="px-6 py-10 text-center"><p className="text-[12px] font-bold text-[#38506a]">No transfers yet</p><p className="mt-1 text-[11px] text-[#8693a1]">Completed transfers and review requests appear here with their receipts.</p></div>}
      </section>
      {receipt && <TransferReceiptModal transaction={receipt} onClose={() => { setReceipt(null); setReceiptNotice(''); }} notice={receiptNotice || undefined} title={receipt.status === 'completed' ? 'Transfer completed' : 'Transfer request submitted'} />}
    </div>
  );
}

function F({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="block min-w-0"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-[#5c7085]">{label}</span>{children}{hint && <span className="mt-1 block text-[10px] text-[#8391a0]">{hint}</span>}</div>;
}

function R({ k, v, mono, strong, testId }: { k: string; v: string; mono?: boolean; strong?: boolean; testId?: string }) {
  return <div className="flex justify-between gap-4 py-2"><dt className="shrink-0 text-[#8492a1]">{k}</dt><dd data-testid={testId} className={`min-w-0 break-words text-right ${mono ? 'font-mono' : ''} ${strong ? 'text-[13px] font-bold text-[#245b62]' : 'font-semibold text-[#3b5169]'}`}>{v}</dd></div>;
}

function RateWarning({ changed, lost, onReview }: { changed: boolean; lost: boolean; onReview: () => void }) {
  if (!changed && !lost) return null;
  return <div role="alert" data-testid="status-rate-changed" className="flex items-start justify-between gap-3 rounded-xl border border-[#ecdcb6] bg-[#fcf7ea] p-3 text-[11px] leading-5 text-[#7d6230]"><span className="flex gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{lost ? 'A current quote for this pair is unavailable. This transfer cannot be submitted.' : 'The conversion rate changed since you confirmed. Review the new total before continuing.'}</span>{changed && <button type="button" onClick={onReview} className="shrink-0 font-bold underline">Review</button>}</div>;
}

function PinPad({ value, onChange, disabled, onSubmit }: { value: string; onChange: (v: string) => void; disabled: boolean; onSubmit: () => void }) {
  const press = (d: string) => { if (!disabled && value.length < 6) onChange(value + d); };
  const back = () => { if (!disabled) onChange(value.slice(0, -1)); };
  return (
    <div
      data-testid="transfer-pin-pad"
      tabIndex={0}
      aria-label="Transaction PIN keypad. Type digits, Backspace to delete, Enter to submit."
      onKeyDown={e => { if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); back(); } else if (e.key === 'Enter' && value.length === 6) { e.preventDefault(); onSubmit(); } }}
      className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#77aeb0]/40"
    >
      <div role="status" aria-label={`${value.length} of 6 digits entered`} data-testid="text-pin-progress" className="flex justify-center gap-2.5 py-2">
        {Array.from({ length: 6 }).map((_, i) => <span key={i} className={`h-3 w-3 rounded-full transition ${i < value.length ? 'scale-110 bg-[#173b62]' : 'border border-[#c7d3dc] bg-white'}`} />)}
      </div>
      <div className="mx-auto mt-2 grid max-w-[300px] grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <Key key={d} label={d} onClick={() => press(d)} disabled={disabled} />)}
        <Key label="Clear" onClick={() => !disabled && onChange('')} disabled={disabled} small testId="button-pin-clear" />
        <Key label="0" onClick={() => press('0')} disabled={disabled} />
        <button type="button" aria-label="Delete last digit" data-testid="button-pin-delete" disabled={disabled} onClick={back} className="grid h-12 place-items-center rounded-xl text-[#4a637b] transition hover:bg-[#eef3f5] active:scale-95 disabled:opacity-40"><Delete size={18} /></button>
      </div>
    </div>
  );
}

function Key({ label, onClick, disabled, small, testId }: { label: string; onClick: () => void; disabled: boolean; small?: boolean; testId?: string }) {
  return <button type="button" data-testid={testId ?? `button-pin-${label}`} disabled={disabled} onClick={onClick} className={`h-12 rounded-xl border border-[#e3e9ed] bg-[#fafbfc] font-semibold text-[#1d3754] transition hover:bg-[#eef4f6] active:scale-95 disabled:opacity-40 ${small ? 'text-[10px] uppercase tracking-[.08em]' : 'bank-display text-[18px]'}`}>{label}</button>;
}

const inputCls = 'h-11 w-full rounded-xl border border-[#dfe6eb] bg-white px-3.5 text-[12px] text-[#344b64] outline-none transition placeholder:text-[#a0acb7] focus:border-[#77aeb0] focus:ring-2 focus:ring-[#77aeb0]/15';
