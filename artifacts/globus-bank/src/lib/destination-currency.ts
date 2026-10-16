const euroCountries = new Set([
  'AD', 'AT', 'BE', 'BG', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MC', 'ME', 'MT', 'NL', 'PT', 'SI', 'SK',
  'SM', 'VA', 'XK',
]);

const supportedCountryCurrencies: Record<string, string> = {
  US: 'USD',
  EC: 'USD',
  SV: 'USD',
  PA: 'USD',
  TL: 'USD',
  FM: 'USD',
  MH: 'USD',
  PW: 'USD',
  GB: 'GBP',
  GG: 'GBP',
  IM: 'GBP',
  JE: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
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
