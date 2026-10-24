import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BadgeCheck, Clock3, Download, ImageDown, Printer, X } from 'lucide-react';
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
      const availableHeight = Math.max(120, viewportHeight - 24 - actionHeight);
      const scale = Math.min(1, availableHeight / documentHeight);
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
    route: transaction.recipient?.route,
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
    <div className="flex justify-between gap-4 py-2"><dt className="shrink-0 text-[#8492a1]">{label}</dt><dd data-testid={testId} className={`min-w-0 break-words text-right ${strong ? 'text-[13px] font-bold text-[#245b62]' : 'font-semibold text-[#3b5169]'}`}>{value}</dd></div>
  );

  return (
    <div className="receipt-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#10243c]/60 p-2 backdrop-blur-sm sm:p-3" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" data-testid="dialog-transfer-receipt" className="receipt-dialog relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[440px] flex-col overflow-hidden rounded-[22px] bg-[#fcfbf8] shadow-[0_30px_80px_rgba(10,30,55,.35)]">
        <div data-testid="receipt-document-frame" className="receipt-document-frame w-full shrink-0" style={{ height: `${receiptFit.height}px` }}>
          <article ref={printRef} className="receipt-print w-full" style={{ transform: `scale(${receiptFit.scale})`, transformOrigin: 'top center' }}>
            <header className="relative overflow-hidden bg-[#132f51] px-6 pb-6 pt-5 text-white">
              <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full border border-white/10" />
              <div className="absolute -right-4 -top-8 h-28 w-28 rounded-full border border-white/10" />
              <div className="relative flex items-center justify-between">
                <img src={`${import.meta.env.BASE_URL}globus-wordmark-transparent.png`} alt="Globus Bank" className="h-auto w-[104px] brightness-0 invert" />
                <button ref={closeRef} type="button" aria-label="Close receipt" data-testid="button-close-receipt" onClick={onClose} className="receipt-screen-only grid h-9 w-9 place-items-center rounded-lg text-[#c9d7e2] hover:bg-white/10"><X size={17} /></button>
              </div>
              <p className="relative mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-[#a8d3d6]">Globus transaction receipt</p>
              <h2 id="receipt-title" className="bank-display relative mt-1 text-[20px] font-semibold">{heading}</h2>
              <p data-testid="text-receipt-amount" className="bank-display relative mt-3 text-[32px] font-semibold tracking-[-.04em]">{formatAmount(transaction.amount, transaction.currency)}</p>
              <span data-testid="text-receipt-status" className={`relative mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${completed ? 'bg-[#2c6b5a] text-[#d9f2e6]' : 'bg-[#6b5a2c] text-[#f6e8c4]'}`}>
                {completed ? <BadgeCheck size={13} /> : <Clock3 size={13} />}
                {completed ? 'Recorded in Globus' : `${humanizeStatus(transaction.status)} · awaiting administrator review`}
              </span>
            </header>
            <div className="px-6 pb-2 pt-4">
              {conversion && (
                <div className="mb-3 rounded-xl border border-[#dce8ea] bg-[#f1f7f7] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#4f878c]">{completed ? 'Converted total' : 'Converted total (if approved)'}</p>
                  <p data-testid="text-receipt-converted-total" className="bank-display mt-1 text-[22px] font-semibold text-[#1d3a56]">{formatAmount(conversion.destinationAmount, conversion.destinationCurrency)}</p>
                  <p data-testid="text-receipt-exchange-rate" className="mt-1 font-mono text-[10px] text-[#5d7488]">1 {conversion.sourceCurrency} = {formatRate(conversion.exchangeRate)} {conversion.destinationCurrency}</p>
                </div>
              )}
              <dl className="divide-y divide-dashed divide-[#e2e8ec] text-[11px]">
                <div className="flex justify-between gap-4 py-2"><dt className="text-[#8492a1]">Reference</dt><dd data-testid="text-receipt-reference" className="break-all text-right font-mono font-semibold text-[#3b5169]">{transaction.reference}</dd></div>
                {conversion && <Row label="Source amount" value={formatAmount(conversion.sourceAmount, conversion.sourceCurrency)} testId="text-receipt-source-amount" />}
                {transaction.recipient && <>
                  <Row label="Recipient" value={transaction.recipient.name} />
                  <Row label="Bank" value={`${transaction.recipient.bank} · ${transaction.recipient.account}`} />
                  <Row label="Destination" value={transaction.recipient.country} />
                  <Row label="Route" value={transaction.recipient.route} />
                </>}
                {!transaction.recipient && <Row label="Counterparty" value={transaction.counterparty || 'Globus account'} />}
                <Row label="Description" value={transaction.description || heading} />
                <Row label="Recorded" value={formatDateTime(transaction.createdAt)} />
                <Row label="Status" value={humanizeStatus(transaction.status)} />
              </dl>
            </div>
          </article>
        </div>
        <div ref={actionsRef} className="receipt-actions shrink-0 border-t border-[#ecefef] px-3 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" data-testid="button-save-receipt-png" aria-label="Save receipt PNG to device or gallery" disabled={exporting !== null || !completed} onClick={downloadPng} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe7eb] bg-white px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9] disabled:cursor-not-allowed disabled:opacity-50"><ImageDown size={13} />{exporting === 'png' ? 'Preparing image…' : 'Save PNG'}</button>
            <button type="button" data-testid="button-download-receipt-pdf" disabled={exporting !== null || !completed} onClick={downloadPdf} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe7eb] bg-white px-2.5 py-2 text-[9px] font-bold text-[#4a667e] hover:bg-[#f5f8f9] disabled:cursor-not-allowed disabled:opacity-50"><Download size={13} />{exporting === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}</button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#142f51] px-3 py-2 text-[9px] font-bold text-white hover:bg-[#1b4269]"><Printer size={13} /> Print</button>
          </div>
          {downloadError && <p role="alert" data-testid="status-receipt-download-error" className="mt-1 text-right text-[9px] text-[#a24940]">{downloadError}</p>}
          <p className="mt-1 text-right text-[8px] text-[#8794a2]">On supported phones, choose “Save Image” to add the PNG to your gallery.</p>
        </div>
      </section>
    </div>
  );
}
