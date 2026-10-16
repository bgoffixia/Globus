const banksByCountry: Record<string, readonly string[]> = {
  US: ['Bank of America', 'Capital One', 'Chase', 'Citibank', 'PNC Bank', 'Truist Bank', 'U.S. Bank', 'Wells Fargo'],
  GB: ['Barclays', 'HSBC UK', 'Lloyds Bank', 'Monzo', 'Nationwide Building Society', 'NatWest', 'Santander UK', 'Starling Bank'],
  CA: ['Bank of Montreal (BMO)', 'CIBC', 'Desjardins', 'National Bank of Canada', 'RBC Royal Bank', 'Scotiabank', 'TD Canada Trust'],
  AU: ['ANZ', 'Bendigo Bank', 'Commonwealth Bank', 'ING Australia', 'Macquarie Bank', 'National Australia Bank', 'Westpac'],
  NZ: ['ANZ New Zealand', 'ASB Bank', 'Bank of New Zealand', 'Kiwibank', 'Westpac New Zealand'],
  IE: ['AIB', 'Bank of Ireland', 'EBS', 'Permanent TSB', 'Revolut Bank'],
  FR: ['BNP Paribas', 'BoursoBank', 'Crédit Agricole', 'Crédit Mutuel', 'La Banque Postale', 'Société Générale'],
  DE: ['Commerzbank', 'Deutsche Bank', 'ING Deutschland', 'N26', 'Sparkasse', 'Volksbank'],
  ES: ['Banco Sabadell', 'Banco Santander', 'Bankinter', 'BBVA', 'CaixaBank', 'ING España'],
  IT: ['Banca Monte dei Paschi di Siena', 'Banca Sella', 'Banco BPM', 'BPER Banca', 'Intesa Sanpaolo', 'UniCredit'],
  NL: ['ABN AMRO', 'ASN Bank', 'ING Netherlands', 'Rabobank', 'bunq'],
  BE: ['Argenta', 'Belfius', 'BNP Paribas Fortis', 'CBC Banque', 'ING Belgium', 'KBC'],
  AT: ['BAWAG', 'Erste Bank', 'Oberbank', 'Raiffeisen Bank', 'UniCredit Bank Austria'],
  PT: ['Banco BPI', 'Banco CTT', 'Banco Santander Totta', 'Caixa Geral de Depósitos', 'Millennium bcp', 'Novo Banco'],
  GR: ['Alpha Bank', 'Eurobank', 'National Bank of Greece', 'Piraeus Bank'],
  CH: ['Banque Cantonale Vaudoise', 'PostFinance', 'Raiffeisen Switzerland', 'UBS', 'Zürcher Kantonalbank'],
  NG: ['Access Bank', 'Fidelity Bank', 'First Bank of Nigeria', 'First City Monument Bank', 'Guaranty Trust Bank', 'Stanbic IBTC Bank', 'Sterling Bank', 'United Bank for Africa', 'Zenith Bank'],
  GH: ['Absa Bank Ghana', 'Access Bank Ghana', 'Fidelity Bank Ghana', 'GCB Bank', 'Standard Chartered Ghana', 'Stanbic Bank Ghana'],
  KE: ['Absa Bank Kenya', 'Co-operative Bank of Kenya', 'Equity Bank', 'KCB Bank Kenya', 'NCBA Bank Kenya', 'Standard Chartered Kenya'],
  ZA: ['Absa Bank', 'Capitec Bank', 'First National Bank', 'Nedbank', 'Standard Bank'],
  IN: ['Axis Bank', 'Bank of Baroda', 'Canara Bank', 'HDFC Bank', 'ICICI Bank', 'Punjab National Bank', 'State Bank of India'],
  SG: ['DBS Bank', 'HSBC Singapore', 'Maybank Singapore', 'OCBC Bank', 'Standard Chartered Singapore', 'UOB'],
  AE: ['Abu Dhabi Commercial Bank', 'Abu Dhabi Islamic Bank', 'Dubai Islamic Bank', 'Emirates NBD', 'First Abu Dhabi Bank', 'Mashreq'],
  JP: ['Japan Post Bank', 'Mizuho Bank', 'MUFG Bank', 'Resona Bank', 'SMBC (Sumitomo Mitsui Banking Corporation)'],
  BR: ['Banco Bradesco', 'Banco do Brasil', 'Banco Inter', 'Caixa Econômica Federal', 'Itaú Unibanco', 'Nubank'],
  MX: ['Banco Azteca', 'Banorte', 'BBVA México', 'Citibanamex', 'HSBC México', 'Santander México'],
  HK: ['Bank of China (Hong Kong)', 'Hang Seng Bank', 'HSBC Hong Kong', 'Standard Chartered Hong Kong'],
};

export function banksForCountry(countryCode: string): readonly string[] {
  return banksByCountry[countryCode.toUpperCase()] ?? [];
}
