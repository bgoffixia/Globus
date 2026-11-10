import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeftRight, BadgeCheck, CalendarDays, Clock3, Download, Hash, ImageDown, Landmark, Printer, ShieldCheck, X } from 'lucide-react';
import type { BankTransaction, InternationalTransferRequest } from '@workspace/api-client-react';
import { destinationCurrencyDigits } from '@/lib/destination-currency';
import { downloadTransactionReceiptPdf, saveTransactionReceiptPng } from '@/lib/transaction-receipt-pdf';

export type ReceiptConversion = {
  sourceAmount: string;
  sourceCurrency: string;
  exchangeRate: string;
  destinationAmount: string;
  destinationCurrency: string;
};
export type ReceiptTransaction = BankTransaction & { conversion?: ReceiptConversion; recipient?: { name: string; bank: string; country: string; route: string; account: string; transferType: string } };

export function digitsFor(currency: string): number {
  try { return destinationCurrencyDigits(currency); } catch { return 2; }
}

/** Formats with the currency's natural minor digits unless the raw string carries more precision. */
export function formatAmount(amount: string | number, currency: string): string {
  const raw = String(amount);
  const rawDigits = (raw.split('.')[1] ?? '').length;
  const digits = Math.max(digitsFor(currency), Math.min(rawDigits, 4));
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(raw));
  } catch {
    return `${currency} ${Number(raw).toFixed(digits)}`;
  }
}

export function formatRate(rate: string): string {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(rate.trim());
  if (!m) return rate;
  const int = m[1].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = (m[2] ?? '').replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

export function humanizeStatus(value?: string | null) {
  return value ? value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Not available';
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function parseReceiptConversion(t: ReceiptTransaction): ReceiptConversion | null {
  if (t.conversion) return t.conversion;
  if (t.type !== 'external_transfer' || !t.description) return null;
  const m = /(?:^| · )(\d+(?:\.\d{1,2})?) ([A-Z]{3}) converted to (\d+(?:\.\d{1,4})?) ([A-Z]{3}) at (\d+(?:\.\d{1,10})?)(?:$| · )/.exec(t.description);
  if (!m) return null;
  return { sourceAmount: m[1], sourceCurrency: m[2], destinationAmount: m[3], destinationCurrency: m[4], exchangeRate: m[5] };
}

export function receiptFromRequest(r: InternationalTransferRequest): ReceiptTransaction {
  const typeLabel = r.transferType === 'local_routing' ? 'Local routing' : 'International wire';
  return {
    id: r.id,
    reference: r.reference,
    type: 'external_transfer',
    status: r.status,
    currency: r.sourceCurrency,
    amount: r.sourceAmount,
    fee: '0.00',
    counterparty: `${r.recipientBank} · ****${r.recipientAccountLast4} · ${r.destinationCountry}`,
    description: `${typeLabel} transfer · ${r.sourceAmount} ${r.sourceCurrency} converted to ${r.destinationAmount} ${r.destinationCurrency} at ${r.exchangeRate}`,
    mode: 'internal_ledger',
    createdAt: r.createdAt,
    conversion: { sourceAmount: r.sourceAmount, sourceCurrency: r.sourceCurrency, exchangeRate: r.exchangeRate, destinationAmount: r.destinationAmount, destinationCurrency: r.destinationCurrency },
    recipient: { name: r.recipientAccountName, bank: r.recipientBank, country: r.destinationCountry, route: typeLabel, account: `****${r.recipientAccountLast4}`, transferType: r.transferType },
  } as ReceiptTransaction;
}

export function TransferReceiptModal({ transaction, onClose, title }: { transaction: ReceiptTransaction; onClose: () => void; title?: string }) {
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const printRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [receiptFit, setReceiptFit] = useState({ scale: 1, height: 0 });
  onCloseRef.current = onClose;
  const conversion = parseReceiptConversion(transaction);
  const completed = transaction.status === 'completed';
  const pending = transaction.status === 'pending';
  const isTransfer = transaction.type === 'external_transfer';
  const heading = title ?? (isTransfer ? 'Routed transfer' : humanizeStatus(transaction.type));

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('keydown', esc); prev?.focus?.(); };
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const documentHeight = printRef.current?.scrollHeight ?? 0;
      const actionHeight = actionsRef.current?.offsetHeight ?? 0;
      if (!documentHeight) return;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const availableHeight = Math.max(0, Math.min(viewportHeight * 0.8, viewportHeight - 24) - actionHeight);
      const scale = Math.min(0.86, availableHeight / documentHeight);
      setReceiptFit(current => {
        const height = Math.ceil(documentHeight * scale);
        return current.scale === scale && current.height === height ? current : { scale, height };
      });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (printRef.current) observer?.observe(printRef.current);
    if (actionsRef.current) observer?.observe(actionsRef.current);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [downloadError]);

  const exportData = () => ({
    reference: transaction.reference,
    amount: formatAmount(transaction.amount, transaction.currency),
    status: humanizeStatus(transaction.status),
    date: formatDateTime(transaction.createdAt),
    description: transaction.description || heading,
    counterparty: transaction.counterparty || 'Globus account',
    activity: heading,
    sourceAmount: conversion ? formatAmount(conversion.sourceAmount, conversion.sourceCurrency) : undefined,
    exchangeRate: conversion ? `1 ${conversion.sourceCurrency} = ${formatRate(conversion.exchangeRate)} ${conversion.destinationCurrency}` : undefined,
    convertedAmount: conversion ? formatAmount(conversion.destinationAmount, conversion.destinationCurrency) : undefined,
    recipient: transaction.recipient?.name,
    recipientBank: transaction.recipient?.bank,
    recipientCountry: transaction.recipient?.country,
    recipientAccount: transaction.recipient?.account,
    route: transaction.recipient?.route,
    fee: formatAmount(transaction.fee, transaction.currency),
  });

  const downloadPdf = async () => {
    setDownloadError('');
    setExporting('pdf');
    try {
      if (!completed) throw new Error('PDF receipts are available for completed transactions only.');
      await downloadTransactionReceiptPdf(exportData(), `${import.meta.env.BASE_URL}globus-wordmark-transparent.png`);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'The PDF receipt could not be downloaded.');
    } finally {
      setExporting(null);
    }
  };

  const downloadPng = async () => {
    setDownloadError('');
    setExporting('png');
    try {
      if (!completed) throw new Error('PNG receipts are available for completed transactions only.');
      await saveTransactionReceiptPng(exportData(), `${import.meta.env.BASE_URL}globus-wordmark-transparent.png`);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'The PNG receipt could not be saved.');
    } finally {
      setExporting(null);
    }
  };

  const Row = ({ label, value, testId, strong }: { label: string; value: string; testId?: string; strong?: boolean }) => (
    <div className="flex items-start justify-between gap-4 border-b border-[#e9edf0] py-2 last:border-0">
      <dt className="shrink-0 text-[10px] font-medium text-[#8291a0]">{label}</dt>
      <dd data-testid={testId} className={`min-w-0 break-words text-right text-[10px] ${strong ? 'font-bold text-[#246d69]' : 'font-semibold text-[#344b63]'}`}>{value}</dd>
    </div>
  );

  return (
    <div className="receipt-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#dce5eb]/85 p-2 backdrop-blur-sm sm:p-3" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" data-testid="dialog-transfer-receipt" className="receipt-dialog relative flex w-full max-w-[460px] flex-col overflow-hidden rounded-[20px] border border-[#d9e2e7] bg-[#fffefa] shadow-[0_22px_65px_rgba(14,40,61,.22)]">
        <div data-testid="receipt-document-frame" className="receipt-document-frame w-full shrink-0" style={{ height: `${receiptFit.height}px` }}>
          <article ref={printRef} className="receipt-print w-full bg-[#fffefa] text-[#203a54]" style={{ transform: `scale(${receiptFit.scale})`, transformOrigin: 'top center' }}>
            <header className="px-5 pb-4 pt-4 sm:px-6">
              <div className="flex items-center justify-between border-b border-[#e8ecee] pb-3">
                <img src={`${import.meta.env.BASE_URL}globus-wordmark-transparent.png`} alt="Globus Bank" className="h-auto w-[104px]" />
                <button ref={closeRef} type="button" aria-label="Close receipt" data-testid="button-close-receipt" onClick={onClose} className="receipt-screen-only grid h-8 w-8 place-items-center rounded-full border border-[#e1e8eb] text-[#607589] transition hover:bg-[#f1f6f7]"><X size={15} /></button>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#478783]">Globus Bank · transaction record</p>
                  <h2 id="receipt-title" className="bank-display mt-1 text-[19px] font-bold tracking-[-.045em] text-[#183450]">Payment receipt</h2>
                  <p className="mt-0.5 text-[10px] text-[#7d8d9b]">{heading}</p>
                </div>
                <span data-testid="text-receipt-status" className={`mb-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold ${completed ? 'border-[#d5e7dc] bg-[#eff7f2] text-[#47755f]' : pending ? 'border-[#eadfbf] bg-[#fbf7eb] text-[#8b7440]' : 'border-[#f1d8d5] bg-[#fbefed] text-[#9c4d46]'}`}>
                  {completed ? <BadgeCheck size={11} /> : <Clock3 size={11} />}
                  {completed ? 'RECORDED' : pending ? 'PENDING REVIEW' : humanizeStatus(transaction.status).toUpperCase()}
                </span>
              </div>
              <div className="relative mt-3 overflow-hidden rounded-[15px] bg-[#173858] p-4 text-white">
                <div className="absolute -right-8 -top-12 h-32 w-32 rounded-full border border-white/[.09]" />
                <div className="absolute -right-3 -top-7 h-20 w-20 rounded-full border border-[#d6bb70]/30" />
                <p className="relative text-[9px] font-bold uppercase tracking-[.16em] text-[#a9d6d3]">Transaction amount</p>
                <p data-testid="text-receipt-amount" className="bank-display relative mt-1 text-[25px] font-bold tracking-[-.04em]">{formatAmount(transaction.amount, transaction.currency)}</p>
                {conversion && <div className="relative mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-white/15 pt-3">
                  <div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#a9c0d1]">Source amount</p><p data-testid="text-receipt-source-amount" className="mt-0.5 truncate text-[11px] font-semibold">{formatAmount(conversion.sourceAmount, conversion.sourceCurrency)}</p></div>
                  <ArrowLeftRight size={13} className="text-[#d4bc76]" />
                  <div className="min-w-0 text-right"><p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#a9c0d1]">{completed ? 'Converted total' : 'Expected converted'}</p><p data-testid="text-receipt-converted-total" className="mt-0.5 truncate text-[11px] font-semibold">{formatAmount(conversion.destinationAmount, conversion.destinationCurrency)}</p></div>
                </div>}
                {conversion && <p data-testid="text-receipt-exchange-rate" className="relative mt-2 text-[9px] text-[#c2d2dd]">Rate: 1 {conversion.sourceCurrency} = {formatRate(conversion.exchangeRate)} {conversion.destinationCurrency}</p>}
              </div>
            </header>
            <div className="px-5 pb-3 sm:px-6">
              {transaction.recipient && <section className="rounded-xl border border-[#e4e9eb] bg-white p-3">
                <p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#8291a0]">Transfer to</p>
                <div className="mt-2 flex items-center gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef5f5] text-[#397b7b]"><Landmark size={15} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-[#263f58]">{transaction.recipient.name}</p>
                    <p className="mt-0.5 truncate text-[9px] text-[#7b8b9b]">{transaction.recipient.bank} · {transaction.recipient.country}</p>
                  </div>
                  <p className="shrink-0 font-mono text-[9px] font-semibold text-[#526a80]">{transaction.recipient.account}</p>
                </div>
              </section>}
              <div className="mt-3 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-[#718599]"><Hash size={11} className="text-[#528c89]" />Transaction details</div>
              <dl className="mt-1">
                <Row label="Reference" value={transaction.reference} testId="text-receipt-reference" strong />
                <Row label="Date and time" value={formatDateTime(transaction.createdAt)} />
                <Row label={transaction.recipient ? 'Transfer route' : 'Counterparty'} value={transaction.recipient?.route || transaction.counterparty || 'Globus account'} />
                <Row label="Fee" value={formatAmount(transaction.fee, transaction.currency)} />
                <Row label="Description" value={transaction.description || heading} />
              </dl>
              <div className="mt-3 flex items-center gap-2 border-t border-dashed border-[#dfe6e9] pt-3">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#edf5f1] text-[#4a826d]"><ShieldCheck size={13} /></div>
                <p className="text-[9px] leading-4 text-[#7d8c98]">Recorded by Globus Bank <span className="mx-1 text-[#c1cbd0]">·</span> Keep this receipt for your records</p>
                <CalendarDays size={12} className="ml-auto shrink-0 text-[#8da0ab]" />
              </div>
            </div>
          </article>
        </div>
        <div ref={actionsRef} className="receipt-actions shrink-0 border-t border-[#e7ecee] bg-[#fafbf9] px-3 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" data-testid="button-save-receipt-png" aria-label="Save receipt PNG to device or gallery" disabled={exporting !== null || !completed} onClick={downloadPng} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dbe4e8] bg-white px-2.5 py-2 text-[9px] font-bold text-[#456179] hover:bg-[#f4f8f9] disabled:cursor-not-allowed disabled:opacity-50"><ImageDown size={13} />{exporting === 'png' ? 'Preparing image…' : 'Save PNG'}</button>
            <button type="button" data-testid="button-download-receipt-pdf" disabled={exporting !== null || !completed} onClick={downloadPdf} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dbe4e8] bg-white px-2.5 py-2 text-[9px] font-bold text-[#456179] hover:bg-[#f4f8f9] disabled:cursor-not-allowed disabled:opacity-50"><Download size={13} />{exporting === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}</button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#173858] px-3 py-2 text-[9px] font-bold text-white hover:bg-[#21496c]"><Printer size={13} /> Print</button>
          </div>
          {downloadError && <p role="alert" data-testid="status-receipt-download-error" className="mt-1 text-right text-[9px] text-[#a24940]">{downloadError}</p>}
          <p className="mt-1 text-right text-[8px] text-[#8794a2]">On supported phones, choose “Save Image” to add the PNG to your gallery.</p>
        </div>
      </section>
    </div>
  );
}
