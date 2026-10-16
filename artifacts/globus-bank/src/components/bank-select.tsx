import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
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
  const banks = useMemo(() => banksForCountry(countryCode), [countryCode]);
  const matches = useMemo(() => {
    const query = value.trim().toLocaleLowerCase();
    return banks.filter(bank => !query || bank.toLocaleLowerCase().includes(query));
  }, [banks, value]);

  return (
    <div className="relative">
      <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8795a4]" />
      <input
        data-testid="input-recipient-bank"
        role="combobox"
        aria-label="Recipient bank"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="recipient-bank-options"
        autoComplete="off"
        disabled={!countryCode}
        maxLength={120}
        required
        value={value}
        onFocus={() => countryCode && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        onKeyDown={event => {
          if (event.key === 'Escape') setOpen(false);
        }}
        onChange={event => {
          onChange(event.target.value);
          setOpen(true);
        }}
        placeholder={countryCode ? 'Search or enter bank name' : 'Select a country first'}
        className="h-12 w-full rounded-xl border border-[#dfe6ec] bg-white pl-10 pr-4 text-[12px] text-[#435872] outline-none transition placeholder:text-[#93a0ad] focus:border-[#6aa6aa] disabled:cursor-not-allowed disabled:bg-[#f5f7f8]"
      />
      {open && countryCode && (
        <div
          id="recipient-bank-options"
          role="listbox"
          aria-label="Suggested banks"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#e0e7eb] bg-white p-1.5 shadow-xl"
        >
          {matches.length ? matches.map(bank => (
            <button
              key={bank}
              type="button"
              role="option"
              aria-selected={value === bank}
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                onChange(bank);
                setOpen(false);
              }}
              className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-[11px] text-[#3e566e] hover:bg-[#f2f7f8]"
            >
              <span>{bank}</span>
              {value === bank && <Check size={14} className="shrink-0 text-[#408589]" />}
            </button>
          )) : (
            <p className="px-3 py-3 text-[10px] leading-5 text-[#8492a0]">
              No matching suggestion. You can enter the bank name manually.
            </p>
          )}
        </div>
      )}
      {countryCode && !banks.length && (
        <span className="mt-1.5 block text-[10px] text-[#8794a2]">Enter the bank name; suggestions are not available for this country.</span>
      )}
    </div>
  );
}
