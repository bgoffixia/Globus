type FrankfurterRateReply = {
  date?: unknown;
  base?: unknown;
  quote?: unknown;
  rate?: unknown;
};

type GreyRateReply = {
  status?: unknown;
  data?: {
    source_currency?: unknown;
    destination_currency?: unknown;
    source_destination_currency_rate?: unknown;
  } | null;
};

export type ExchangeRateQuote = {
  rate: string;
  provider: "Frankfurter" | "Grey";
  checkedAt: Date;
};

type CachedExchangeRate = ExchangeRateQuote & { expiresAt: number };
const exchangeRateCache = new Map<string, CachedExchangeRate>();
const exchangeRateLoads = new Map<string, Promise<CachedExchangeRate>>();
const EXCHANGE_RATE_CACHE_MS = 15 * 60 * 1000;

async function fetchFrankfurterExchangeRate(
  sourceCurrency: string,
  destinationCurrency: string,
): Promise<CachedExchangeRate> {
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(sourceCurrency)}/${encodeURIComponent(destinationCurrency)}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error("Frankfurter rate provider returned an error.");

  const payload = (await response.json()) as FrankfurterRateReply;
  const numericRate = typeof payload.rate === "number" ? payload.rate : Number(payload.rate);
  if (
    payload.base !== sourceCurrency ||
    payload.quote !== destinationCurrency ||
    typeof payload.date !== "string" ||
    !Number.isFinite(Date.parse(payload.date)) ||
    !Number.isFinite(numericRate) ||
    numericRate <= 0
  ) {
    throw new Error("Frankfurter could not quote this currency pair.");
  }
  return {
    rate: numericRate.toFixed(10).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""),
    provider: "Frankfurter",
    checkedAt: new Date(),
    expiresAt: Date.now() + EXCHANGE_RATE_CACHE_MS,
  };
}

async function fetchGreyExchangeRate(
  sourceCurrency: string,
  destinationCurrency: string,
): Promise<CachedExchangeRate> {
  const secretKey = process.env.GREY_API_SECRET_KEY;
  if (!secretKey) throw new Error("Grey rate fallback is not configured.");

  const response = await fetch("https://businessapi.grey.co/v1/currency/rate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_amount: 1000,
      source_currency: sourceCurrency,
      destination_currency: destinationCurrency,
      transaction_type: "swap",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Grey rate provider returned an error.");

  const payload = (await response.json()) as GreyRateReply;
  const rawRate = payload.data?.source_destination_currency_rate;
  const numericRate = typeof rawRate === "number" ? rawRate : Number(rawRate);
  if (
    payload.status !== "success" ||
    !Number.isFinite(numericRate) ||
    numericRate <= 0 ||
    payload.data?.source_currency !== sourceCurrency ||
    payload.data?.destination_currency !== destinationCurrency
  ) {
    throw new Error("Grey could not quote this currency pair.");
  }
  return {
    rate: numericRate.toFixed(10).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""),
    provider: "Grey",
    checkedAt: new Date(),
    expiresAt: Date.now() + EXCHANGE_RATE_CACHE_MS,
  };
}

export async function getExchangeRate(
  sourceCurrency: string,
  destinationCurrency: string,
): Promise<ExchangeRateQuote> {
  const cacheKey = `${sourceCurrency}:${destinationCurrency}`;
  const cached = exchangeRateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;
  const inflight = exchangeRateLoads.get(cacheKey);
  if (inflight) return inflight;

  const request = (async () => {
    let frankfurterError: unknown;
    try {
      const result = await fetchFrankfurterExchangeRate(sourceCurrency, destinationCurrency);
      exchangeRateCache.set(cacheKey, result);
      return result;
    } catch (error) {
      frankfurterError = error;
    }
    try {
      const result = await fetchGreyExchangeRate(sourceCurrency, destinationCurrency);
      exchangeRateCache.set(cacheKey, result);
      return result;
    } catch (greyError) {
      throw new AggregateError(
        [frankfurterError, greyError],
        "Neither exchange-rate source could quote this currency pair.",
      );
    }
  })();
  exchangeRateLoads.set(cacheKey, request);
  try {
    return await request;
  } finally {
    exchangeRateLoads.delete(cacheKey);
  }
}
