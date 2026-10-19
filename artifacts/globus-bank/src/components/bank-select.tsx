import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ExternalLink, Search } from 'lucide-react';
import { banksForCountry } from '@/lib/banks-by-country';

export function BankSelect({
  countryCode,
  value,
  onChange,
}: {
  countryCode: string;
  value: string;
  onChange: (bank: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const banks = useMemo(() => banksForCountry(countryCode), [countryCode]);
  const matches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return banks.filter(bank => !query || bank.name.toLocaleLowerCase().includes(query));
  }, [banks, search]);

  const close = (returnFocus = true) => {
    setOpen(false);
    setSearch('');
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (bank: string) => {
    onChange(bank);
    close();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid="input-recipient-bank"
        role="combobox"
        aria-label={`Recipient bank${value ? `: ${value}` : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-options` : undefined}
        disabled={!countryCode}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3.5 text-left text-[12px] outline-none transition hover:border-[#9ab9bd] focus-visible:border-[#77aeb0] focus-visible:ring-2 focus-visible:ring-[#77aeb0]/20 disabled:cursor-not-allowed disabled:bg-[#f5f7f8] ${open ? 'border-[#77aeb0] ring-2 ring-[#77aeb0]/15' : 'border-[#dfe6ec]'}`}
      >
        <span className={`flex min-w-0 items-center gap-2.5 ${value ? 'text-[#435872]' : 'text-[#93a0ad]'}`}>
          {value && <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#dce7ec] bg-[#f3f7f8] text-[9px] font-extrabold tracking-tight text-[#315773]">{bankInitials(value)}</span>}
          <span className="truncate">{value || (countryCode ? 'Choose or search a bank' : 'Select a country first')}</span>
        </span>
        <ChevronDown size={15} aria-hidden="true" className={`shrink-0 text-[#7d8d9d] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && countryCode && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[60] overflow-hidden rounded-xl border border-[#d9e4e8] bg-white shadow-[0_18px_40px_rgba(20,45,75,.16)]">
          <label className="relative block border-b border-[#edf1f3] p-2">
            <span className="sr-only">Search banks</span>
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#8695a5]" />
            <input
              ref={searchRef}
              data-testid="input-recipient-bank-search"
              aria-label="Search or enter bank name"
              aria-controls={`${id}-options`}
              autoComplete="off"
              value={search}
              onChange={event => setSearch(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && search.trim()) {
                  event.preventDefault();
                  choose(search.trim());
                }
              }}
              placeholder="Search or enter bank name"
              className="h-9 w-full rounded-lg bg-[#f5f8f9] pl-8 pr-3 text-[12px] outline-none focus:ring-2 focus:ring-[#77aeb0]/25"
            />
          </label>
          <ul id={`${id}-options`} role="listbox" aria-label="Suggested banks" className="max-h-[min(240px,36dvh)] overflow-y-auto overscroll-contain p-1.5">
            {matches.map(bank => (
              <li key={bank.name} role="presentation" className="flex items-center gap-1 rounded-lg pr-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === bank.name}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => choose(bank.name)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-[11px] text-[#3e566e] hover:bg-[#f2f7f8]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#dce7ec] bg-[#f3f7f8] text-[9px] font-extrabold tracking-tight text-[#315773]">{bankInitials(bank.name)}</span>
                    <span className="truncate">{bank.name}</span>
                  </span>
                  {value === bank.name && <Check size={14} aria-hidden="true" className="shrink-0 text-[#408589]" />}
                </button>
                <a
                  href={bank.logoLookupUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Search images for ${bank.name} logo`}
                  title="Search for this bank’s logo"
                  onMouseDown={event => event.preventDefault()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#718697] hover:bg-[#edf4f5] hover:text-[#315773]"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </li>
            ))}
            {search.trim() && !banks.some(bank => bank.name.toLocaleLowerCase() === search.trim().toLocaleLowerCase()) && (
              <li role="option">
                <button
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => choose(search.trim())}
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[11px] font-semibold text-[#367b82] hover:bg-[#f2f7f8]"
                >
                  <Check size={14} aria-hidden="true" />
                  Use “{search.trim()}”
                </button>
              </li>
            )}
            {!matches.length && !search.trim() && (
              <li className="px-3 py-3 text-[10px] leading-5 text-[#8492a0]">
                No curated bank suggestions are available for this country. Tap the search field to enter a bank name.
              </li>
            )}
            {!matches.length && search.trim() && (
              <li className="px-3 py-2 text-[10px] text-[#8492a0]">No matching suggestion. You can use the name you entered.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function bankInitials(name: string) {
  const words = name.replace(/[()]/g, '').trim().split(/\s+/).filter(Boolean);
  const initials = words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2);
  return (initials || 'BK').toUpperCase();
}
