import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { countries } from '@/lib/countries';

export function CountrySelect({
  value,
  onChange,
  label = 'Destination country',
  testId = 'input-destination-country',
}: {
  value: string;
  onChange: (country: string) => void;
  label?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filteredCountries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return countries.filter(country =>
      !query || country.name.toLocaleLowerCase().includes(query) || country.code.toLocaleLowerCase() === query,
    );
  }, [search]);

  const selectCountry = (country: string) => {
    onChange(country);
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <button
        type="button"
        data-testid={testId}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-[#dfe6ec] bg-white px-4 text-left text-[12px] text-[#435872] outline-none transition hover:border-[#9ab9bd] focus:border-[#6aa6aa]"
      >
        <span className={value ? 'truncate' : 'truncate text-[#93a0ad]'}>{value || 'Choose a country'}</span>
        <ChevronDown size={15} className="shrink-0 text-[#7d8d9d]" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[#14263e]/45 p-0 sm:items-center sm:p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="country-select-title"
            className="flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-[24px] border border-[#e0e7eb] bg-white shadow-2xl sm:rounded-[22px]"
          >
            <div className="flex items-center justify-between border-b border-[#edf0f2] px-5 py-4">
              <h2 id="country-select-title" className="text-[14px] font-bold text-[#263e58]">{label}</h2>
              <button type="button" aria-label="Close country list" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-[#718196] hover:bg-[#f1f4f6]"><X size={17} /></button>
            </div>
            <label className="relative mx-4 mt-4">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8695a5]" />
              <input
                autoFocus
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search countries"
                className="h-11 w-full rounded-xl border border-[#dfe6ec] bg-[#fbfcfd] pl-10 pr-3 text-[12px] outline-none focus:border-[#6aa6aa]"
              />
            </label>
            <ul className="mt-3 min-h-0 flex-1 overflow-y-auto p-2" role="listbox" aria-label="Countries">
              {filteredCountries.map(country => (
                <li key={country.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === country.name}
                    onClick={() => selectCountry(country.name)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-[12px] text-[#435872] hover:bg-[#f2f7f8]"
                  >
                    <span>{country.name}</span>
                    <span className="flex items-center gap-2 text-[10px] text-[#8b98a5]">{country.code}{value === country.name && <Check size={14} className="text-[#408589]" />}</span>
                  </button>
                </li>
              ))}
              {!filteredCountries.length && <li className="px-3 py-8 text-center text-[12px] text-[#8794a2]">No country matches that search.</li>}
            </ul>
            <div className="border-t border-[#edf0f2] px-4 py-3 sm:hidden">
              <button type="button" onClick={() => setOpen(false)} className="h-11 w-full rounded-xl bg-[#142f51] text-[12px] font-bold text-white">Close</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
