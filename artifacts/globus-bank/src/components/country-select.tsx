import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { countries } from '@/lib/countries';

/**
 * Anchored, searchable country picker. Opens as a drawer directly BELOW the trigger
 * (never a centered or bottom-sheet modal). Keyboard: Enter/ArrowDown opens, arrows move,
 * Enter selects, Escape closes; outside click closes. Focus returns to the trigger.
 */
export function CountrySelect({
  value,
  onChange,
  label = 'Destination country',
  testId = 'input-destination-country',
  disabled = false,
}: {
  value: string;
  onChange: (country: string) => void;
  label?: string;
  testId?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return countries.filter(c => !q || c.name.toLocaleLowerCase().includes(q) || c.code.toLocaleLowerCase() === q);
  }, [search]);

  const close = (returnFocus = true) => {
    setOpen(false);
    setSearch('');
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, filtered.findIndex(c => c.name === value));
    setActive(idx);
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { setActive(0); }, [search]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const select = (name: string) => { onChange(name); close(); };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(filtered.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(filtered.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) select(filtered[active].name); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') { close(false); }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        data-testid={testId}
        aria-label={`${label}${value ? `: ${value}` : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={e => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}
        className={`flex h-11 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3.5 text-left text-[12px] text-[#344b64] outline-none transition hover:border-[#9ab9bd] focus-visible:border-[#77aeb0] focus-visible:ring-2 focus-visible:ring-[#77aeb0]/20 disabled:opacity-60 ${open ? 'border-[#77aeb0] ring-2 ring-[#77aeb0]/15' : 'border-[#dfe6eb]'}`}
      >
        <span className={`flex min-w-0 items-center gap-2 ${value ? '' : 'text-[#a0acb7]'}`}>
          {value && <span aria-hidden="true" className="shrink-0 text-base leading-none">{flagForCountry(countries.find(c => c.name === value)?.code ?? '')}</span>}
          <span className="truncate">{value || 'Choose a country'}</span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-[#7d8d9d] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div data-testid={`${testId}-drawer`} className="country-drawer absolute left-0 right-0 top-[calc(100%+6px)] z-[60] overflow-hidden rounded-xl border border-[#d9e4e8] bg-white shadow-[0_18px_40px_rgba(20,45,75,.16)]">
          <label className="relative block border-b border-[#edf1f3] p-2">
            <span className="sr-only">Search countries</span>
            <Search size={14} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#8695a5]" />
            <input
              data-testid={`${testId}-search`}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].code}` : undefined}
              aria-autocomplete="list"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={onKey}
              placeholder="Search countries"
              className="h-9 w-full rounded-lg bg-[#f5f8f9] pl-8 pr-3 text-[12px] outline-none focus:ring-2 focus:ring-[#77aeb0]/25"
            />
          </label>
          <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="max-h-[min(260px,40dvh)] overflow-y-auto overscroll-contain p-1">
            {filtered.map((c, i) => (
              <li
                key={c.code}
                id={`${listId}-${c.code}`}
                data-index={i}
                role="option"
                aria-selected={value === c.name}
                onMouseDown={e => e.preventDefault()}
                onClick={() => select(c.name)}
                onMouseMove={() => setActive(i)}
                className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-[12px] text-[#3a516a] ${i === active ? 'bg-[#eaf4f5]' : ''}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="shrink-0 text-base leading-none">{flagForCountry(c.code)}</span>
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="flex items-center gap-2 font-mono text-[10px] text-[#8b98a5]">{c.code}{value === c.name && <Check size={14} className="text-[#408589]" />}</span>
              </li>
            ))}
            {!filtered.length && <li className="px-3 py-6 text-center text-[12px] text-[#8794a2]">No country matches that search.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function flagForCountry(code: string) {
  const letters = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(letters)) return '';
  return String.fromCodePoint(...[...letters].map(letter => 127397 + letter.charCodeAt(0)));
}
