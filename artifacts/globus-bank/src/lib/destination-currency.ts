// Country defaults are suggestions; a recipient may hold an account in another currency.
const currencyRegions: Record<string, string> = {
  EUR: 'AD AT AX BE BG BL CY DE EE ES FI FR GF GP GR HR IE IT LT LU LV MC ME MF MQ MT NL PM PT RE SI SK SM TF VA XK YT',
  USD: 'AS BQ EC FM GU IO MH MP PA PR PW SV TC TL UM US VG VI',
  GBP: 'GB GG GS IM JE', AUD: 'AU CC CX HM KI NF NR TV',
  XAF: 'CF CG CM GA GQ TD', XOF: 'BF BJ CI GW ML NE SN TG',
  XCD: 'AG AI DM GD KN LC MS VC', XPF: 'NC PF WF',
  NZD: 'CK NU NZ PN TK', DKK: 'DK FO GL', NOK: 'BV NO SJ',
  CHF: 'CH LI', ILS: 'IL PS', MAD: 'EH MA', ZAR: 'ZA',
  AED: 'AE', AFN: 'AF', ALL: 'AL', AMD: 'AM', AOA: 'AO', ARS: 'AR',
  AWG: 'AW', AZN: 'AZ', BAM: 'BA', BBD: 'BB', BDT: 'BD', BHD: 'BH',
  BIF: 'BI', BMD: 'BM', BND: 'BN', BOB: 'BO', BRL: 'BR', BSD: 'BS',
  BTN: 'BT', BWP: 'BW', BYN: 'BY', BZD: 'BZ', CAD: 'CA', CDF: 'CD',
  CLP: 'CL', CNY: 'CN', COP: 'CO', CRC: 'CR', CUP: 'CU', CVE: 'CV',
  CZK: 'CZ', DJF: 'DJ', DOP: 'DO', DZD: 'DZ', EGP: 'EG', ERN: 'ER',
  ETB: 'ET', FJD: 'FJ', FKP: 'FK', GEL: 'GE', GHS: 'GH', GIP: 'GI',
  GMD: 'GM', GNF: 'GN', GTQ: 'GT', GYD: 'GY', HKD: 'HK', HNL: 'HN',
  HTG: 'HT', HUF: 'HU', IDR: 'ID', INR: 'IN', IQD: 'IQ', IRR: 'IR',
  ISK: 'IS', JMD: 'JM', JOD: 'JO', JPY: 'JP', KES: 'KE', KGS: 'KG',
  KHR: 'KH', KMF: 'KM', KPW: 'KP', KRW: 'KR', KWD: 'KW', KYD: 'KY',
  KZT: 'KZ', LAK: 'LA', LBP: 'LB', LKR: 'LK', LRD: 'LR', LSL: 'LS',
  LYD: 'LY', MDL: 'MD', MGA: 'MG', MKD: 'MK', MMK: 'MM', MNT: 'MN',
  MOP: 'MO', MRU: 'MR', MUR: 'MU', MVR: 'MV', MWK: 'MW', MXN: 'MX',
  MYR: 'MY', MZN: 'MZ', NAD: 'NA', NGN: 'NG', NIO: 'NI', NPR: 'NP',
  OMR: 'OM', PEN: 'PE', PGK: 'PG', PHP: 'PH', PKR: 'PK', PLN: 'PL',
  PYG: 'PY', QAR: 'QA', RON: 'RO', RSD: 'RS', RUB: 'RU', RWF: 'RW',
  SAR: 'SA', SBD: 'SB', SCR: 'SC', SDG: 'SD', SEK: 'SE', SGD: 'SG',
  SHP: 'SH', SLE: 'SL', SOS: 'SO', SRD: 'SR', SSP: 'SS', STN: 'ST',
  SYP: 'SY', SZL: 'SZ', THB: 'TH', TJS: 'TJ', TMT: 'TM', TND: 'TN',
  TOP: 'TO', TRY: 'TR', TTD: 'TT', TWD: 'TW', TZS: 'TZ', UAH: 'UA',
  UGX: 'UG', UYU: 'UY', UZS: 'UZ', VES: 'VE', VND: 'VN', VUV: 'VU',
  WST: 'WS', XCG: 'CW SX', YER: 'YE', ZMW: 'ZM', ZWG: 'ZW',
};
const countryCurrencies = new Map(
  Object.entries(currencyRegions).flatMap(([currency, regions]) =>
    regions.split(' ').map(region => [region, currency] as const)),
);

export function destinationCurrencyForCountry(countryCode: string): string | undefined {
  return countryCurrencies.get(countryCode.toUpperCase());
}

// Stable ISO catalogue rather than the five currencies in which Globus offers source wallets.
export const destinationCurrencies = `
AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND
BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU
CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP
GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY
KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA
MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD
OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK
SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD
TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XAG XAU
XBA XBB XBC XBD XCD XCG XDR XOF XPD XPF XPT XSU XUA YER ZAR ZMW ZWG ZWL
`.trim().split(/\s+/).sort();

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });
export function currencyLabel(code: string): string {
  return `${code} · ${currencyNames.of(code) ?? code}`;
}
export function destinationCurrencyDigits(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency })
    .resolvedOptions().maximumFractionDigits ?? 2;
}
