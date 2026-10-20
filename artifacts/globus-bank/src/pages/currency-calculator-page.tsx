import { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUpRight, RefreshCw } from 'lucide-react';
import {
  getGetBankExchangeRateQuoteQueryKey,
  useGetBankExchangeRateQuote,
} from '@workspace/api-client-react';
import { Link } from 'wouter';
import { destinationCurrencies, currencyLabel } from '@/lib/destination-currency';
import { digitsFor, formatAmount, formatRate } from '@/components/transfer/transfer-receipt';
import { previewConversion } from '@/lib/currency-conversion';

const currencies = destinationCurrencies;
const transferWalletCurrencies = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD']);
const inputClass = 'h-12 w-full rounded-xl border border-[#dfe6ec] bg-white px-3.5 text-[13px] font-semibold text-[#273e57] outline-none transition focus:border-[#62a3a6] focus:ring-2 focus:ring-[#62a3a6]/15';

export function CurrencyCalculatorPage() {
  const [sourceCurrency, setSourceCurrency] = useState('USD');
  const [destinationCurrency, setDestinationCurrency] = useState('EUR');
  const [amount, setAmount] = useState('100');
  const quoteParams = useMemo(
    () => ({ sourceCurrency, destinationCurrency }),
    [sourceCurrency, destinationCurrency],
  );
  const quote = useGetBankExchangeRateQuote(quoteParams, {
    query: {
      queryKey: getGetBankExchangeRateQuoteQueryKey(quoteParams),
      retry: false,
      refetchInterval: 15 * 60_000,
      refetchOnWindowFocus: true,
      staleTime: 12 * 60_000,
    },
  });
  const sourceDigits = digitsFor(sourceCurrency);
  const targetDigits = digitsFor(destinationCurrency);
  const converted = quote.data?.rate
    ? previewConversion(amount, quote.data.rate, targetDigits, sourceDigits)
    : null;
  const canPrefillTransfer = transferWalletCurrencies.has(sourceCurrency);
  const transferParams = new URLSearchParams();
  if (canPrefillTransfer) {
    transferParams.set('currency', sourceCurrency);
    transferParams.set('destinationCurrency', destinationCurrency);
    if (amount && converted !== null) transferParams.set('amount', amount);
  }
  const transferHref = `/transfer${transferParams.size ? `?${transferParams.toString()}` : ''}`;

  function swapCurrencies() {
    setSourceCurrency(destinationCurrency);
    setDestinationCurrency(sourceCurrency);
  }

  return (
    <div className="mx-auto flex min-w-0 max-w-[980px] flex-col" data-testid="currency-calculator">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#4d858a]">Currency tools</p>
          <h1 className="bank-display mt-0.5 text-[22px] font-semibold leading-tight text-[#213a55] sm:text-[26px]">Currency converter</h1>
          <p className="mt-1 text-[9px] text-[#718195]">Live reference-rate estimate</p>
        </div>
        <button
          type="button"
          onClick={() => void quote.refetch()}
          disabled={quote.isFetching}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#dce6e9] bg-white px-3 text-[9px] font-bold text-[#3c7278] transition hover:bg-[#f3f8f8] disabled:opacity-60"
          data-testid="button-refresh-conversion"
        >
          <RefreshCw size={13} className={quote.isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <section className="mt-3 overflow-hidden rounded-[18px] border border-[#e0e8ed] bg-white shadow-[0_12px_32px_rgba(24,48,73,.05)]">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_.95fr]">
          <div className="space-y-3 p-3.5 sm:p-5">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.12em] text-[#718195]">From</span>
                <select
                  aria-label="Convert from currency"
                  data-testid="select-source-currency"
                  className={inputClass}
                  value={sourceCurrency}
                  onChange={event => {
                    const nextCurrency = event.target.value;
                    const digits = digitsFor(nextCurrency);
                    setSourceCurrency(nextCurrency);
                    setAmount(current => {
                      const [whole, fraction] = current.split('.');
                      return fraction === undefined || digits === 0
                        ? whole
                        : `${whole}.${fraction.slice(0, digits)}`;
                    });
                  }}
                >
                  {currencies.map(currency => <option key={currency} value={currency}>{currencyLabel(currency)}</option>)}
                </select>
              </label>
              <button type="button" onClick={swapCurrencies} aria-label="Swap currencies" data-testid="button-swap-currencies" className="grid h-8 w-8 justify-self-center place-items-center rounded-full border border-[#e0e8ed] bg-[#f7fafb] text-[#3f777d] transition hover:bg-[#eaf4f4] sm:mb-0.5">
                <ArrowLeftRight size={16} />
              </button>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.12em] text-[#718195]">To</span>
                <select
                  aria-label="Convert to currency"
                  data-testid="select-destination-currency"
                  className={inputClass}
                  value={destinationCurrency}
                  onChange={event => setDestinationCurrency(event.target.value)}
                >
                  {currencies.map(currency => <option key={currency} value={currency}>{currencyLabel(currency)}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.12em] text-[#718195]">Amount</span>
              <div className="flex h-[48px] items-center gap-3 rounded-lg border border-[#dfe6ec] bg-white px-3.5 transition focus-within:border-[#62a3a6] focus-within:ring-2 focus-within:ring-[#62a3a6]/15">
                <span className="shrink-0 text-[12px] font-bold text-[#4b637b]">{sourceCurrency}</span>
                <input
                  aria-label={`Amount in ${sourceCurrency}`}
                  data-testid="input-conversion-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={event => {
                    const next = event.target.value.replace(/[^0-9.]/g, '');
                    if (
                      /^\d{0,12}(?:\.\d{0,4})?$/.test(next) &&
                      (next.split('.')[1]?.length ?? 0) <= sourceDigits
                    ) setAmount(next);
                  }}
                  className="min-w-0 flex-1 bg-transparent text-right text-[18px] font-semibold text-[#1e3854] outline-none"
                  placeholder="0"
                />
              </div>
            </label>
          </div>

          <div className="flex min-h-[152px] flex-col justify-between bg-[#122d4d] p-4 text-white sm:min-h-[170px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#c4d5df]">Estimated conversion</p>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-[#e0c77d]"><ArrowDown size={15} /></span>
            </div>
            <div aria-live="polite" aria-busy={quote.isLoading || quote.isFetching}>
              {quote.isLoading && !quote.data ? (
                <div className="mt-4 h-8 w-40 animate-pulse rounded-lg bg-white/10" />
              ) : quote.isError ? (
                <div className="mt-3">
                  <p role="alert" className="text-[12px] font-semibold text-[#ffe4bd]" data-testid="status-rate-unavailable">Rate unavailable</p>
                  <p className="mt-1 text-[9px] leading-4 text-[#d0dce5]">Try another pair or refresh.</p>
                </div>
              ) : (
                <>
                  <p data-testid="text-calculated-amount" className="bank-display mt-3 break-words text-[26px] font-semibold leading-tight sm:text-[30px]">
                    {converted === null ? (quote.data ? 'Enter a valid amount' : `— ${destinationCurrency}`) : formatAmount(converted, destinationCurrency)}
                  </p>
                  {quote.data && <p data-testid="text-calculator-rate" className="mt-1.5 break-all font-mono text-[9px] text-[#d4e0e8]">1 {sourceCurrency} = {formatRate(quote.data.rate)} {destinationCurrency}</p>}
                </>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-white/15 pt-2.5 text-[8px] text-[#c0d0dc]">
              <span>{quote.data ? `${quote.data.provider} reference rate` : 'Checking rate sources…'}</span>
              <span>{quote.data?.checkedAt ? `Updated ${new Date(quote.data.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-[#edf1f4] bg-[#fbfcfd] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[8px] leading-4 text-[#748496]">Estimate uses the displayed rate.</p>
          <Link href={transferHref} data-testid="link-start-transfer" className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#173a60] px-4 text-[9px] font-bold text-white transition hover:bg-[#214c76]">
            {canPrefillTransfer ? 'Start a transfer' : 'Open transfer'} <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
