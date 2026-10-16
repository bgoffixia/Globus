const euroCountries = new Set([
  'AD', 'AT', 'BE', 'BG', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MC', 'ME', 'MT', 'NL', 'PT', 'SI', 'SK',
  'SM', 'VA', 'XK',
]);

const supportedCountryCurrencies: Record<string, string> = {
  AS: 'USD',
  BQ: 'USD',
  EC: 'USD',
  FM: 'USD',
  GU: 'USD',
  MH: 'USD',
  MP: 'USD',
  PA: 'USD',
  PR: 'USD',
  SV: 'USD',
  TC: 'USD',
  TL: 'USD',
  UM: 'USD',
  US: 'USD',
  VG: 'USD',
  VI: 'USD',
  GB: 'GBP',
  GG: 'GBP',
  IM: 'GBP',
  JE: 'GBP',
  GS: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  CC: 'AUD',
  HM: 'AUD',
  KI: 'AUD',
  NR: 'AUD',
  TV: 'AUD',
  CX: 'AUD',
  NF: 'AUD',
};

export function destinationCurrencyForCountry(countryCode: string): string | undefined {
  const code = countryCode.toUpperCase();
  return euroCountries.has(code) ? 'EUR' : supportedCountryCurrencies[code];
}
