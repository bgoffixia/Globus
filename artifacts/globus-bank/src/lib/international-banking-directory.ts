import directoryCsv from './international-banking-directory.csv?raw';

export type DirectoryBank = {
  name: string;
  logoLookupUrl: string;
};

export type DirectoryCountry = {
  code: string;
  name: string;
  currency: string;
  flag: string;
  flagUrl: string;
  banks: readonly DirectoryBank[];
};

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && csv[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some(value => value.trim())) rows.push(row);
  }

  return rows;
}

const [rawHeaders = [], ...rawRows] = parseCsv(directoryCsv);
const headers = rawHeaders.map(header => header.replace(/^\uFEFF/, '').trim());
const headerIndex = new Map(headers.map((header, index) => [header, index]));

function value(row: string[], key: string): string {
  const index = headerIndex.get(key);
  return index === undefined ? '' : (row[index] ?? '').trim();
}

function internalCode(name: string): string {
  return `AREA_${name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
}

const countryIdentityOverrides: Record<string, { code: string; flag: string; flagUrl: string }> = {
  'Caribbean Netherlands / Caribbean guilder area': { code: 'BQ', flag: '🇧🇶', flagUrl: 'https://flagcdn.com/w80/bq.png' },
  'Euro Area (not a country)': { code: 'AREA_EURO_AREA', flag: '🇪🇺', flagUrl: 'https://flagcdn.com/w80/eu.png' },
  'French Polynesia / CFP zone': { code: 'PF', flag: '🇵🇫', flagUrl: 'https://flagcdn.com/w80/pf.png' },
  'Republic of the Congo': { code: 'CG', flag: '🇨🇬', flagUrl: 'https://flagcdn.com/w80/cg.png' },
  'Saint Helena': { code: 'SH', flag: '🇸🇭', flagUrl: 'https://flagcdn.com/w80/sh.png' },
  'São Tomé and Príncipe': { code: 'ST', flag: '🇸🇹', flagUrl: 'https://flagcdn.com/w80/st.png' },
};

function logoLookupUrl(sourceUrl: string, bankName: string): string {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.protocol === 'https:' && parsed.hostname === 'www.google.com' && parsed.pathname === '/search') {
      return parsed.toString();
    }
  } catch {
    // Build a safe, equivalent search link when the workbook cell is blank or malformed.
  }
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${bankName} official bank logo`)}`;
}

export const internationalBankingDirectory: readonly DirectoryCountry[] = rawRows
  .map(row => {
    const name = value(row, 'country_or_territory');
    const identityOverride = countryIdentityOverrides[name];
    const rawCode = value(row, 'country_iso2').toUpperCase();
    const banks = Array.from({ length: 10 }, (_, index) => {
      const number = index + 1;
      const bankName = value(row, `bank_${number}`);
      if (!bankName) return undefined;
      return {
        name: bankName,
        logoLookupUrl: logoLookupUrl(value(row, `bank_${number}_logo_lookup`), bankName),
      };
    }).filter((bank): bank is DirectoryBank => !!bank);

    return {
      code: identityOverride?.code ?? (/^[A-Z]{2}$/.test(rawCode) ? rawCode : internalCode(name)),
      name,
      currency: value(row, 'currency_code').toUpperCase(),
      flag: value(row, 'country_flag') || identityOverride?.flag || '',
      flagUrl: value(row, 'country_flag_image_url') || identityOverride?.flagUrl || '',
      banks,
    };
  })
  .filter(country => country.name && country.currency)
  .sort((a, b) => a.name.localeCompare(b.name));

const countriesByCode = new Map(internationalBankingDirectory.map(country => [country.code, country]));
const countriesByName = new Map(internationalBankingDirectory.map(country => [country.name, country]));

export function countryDirectoryEntry(countryCode: string): DirectoryCountry | undefined {
  return countriesByCode.get(countryCode.toUpperCase());
}

export function countryDirectoryEntryByName(countryName: string): DirectoryCountry | undefined {
  return countriesByName.get(countryName);
}

export function banksForCountry(countryCode: string): readonly DirectoryBank[] {
  return countryDirectoryEntry(countryCode)?.banks ?? [];
}
