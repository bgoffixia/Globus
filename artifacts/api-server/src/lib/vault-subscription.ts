export const VAULT_SUBSCRIPTION_PLANS = [
  {
    code: "1m",
    label: "1 month",
    durationMonths: 1,
    priceSetting: "vaultPlan1mPriceMinor",
  },
  {
    code: "3m",
    label: "3 months",
    durationMonths: 3,
    priceSetting: "vaultPlan3mPriceMinor",
  },
  {
    code: "1y",
    label: "1 year",
    durationMonths: 12,
    priceSetting: "vaultPlan1yPriceMinor",
  },
] as const;

export type VaultSubscriptionPlanCode =
  (typeof VAULT_SUBSCRIPTION_PLANS)[number]["code"];

type VaultPlanPrices = {
  vaultPlan1mPriceMinor: string;
  vaultPlan3mPriceMinor: string;
  vaultPlan1yPriceMinor: string;
};

export function isVaultSubscriptionPlanCode(
  value: string,
): value is VaultSubscriptionPlanCode {
  return VAULT_SUBSCRIPTION_PLANS.some((plan) => plan.code === value);
}

export function getVaultSubscriptionPlan(
  code: string,
): (typeof VAULT_SUBSCRIPTION_PLANS)[number] | undefined {
  return VAULT_SUBSCRIPTION_PLANS.find((plan) => plan.code === code);
}

export function getVaultPlanPriceMinor(
  settings: VaultPlanPrices,
  code: VaultSubscriptionPlanCode,
): string {
  const plan = getVaultSubscriptionPlan(code);
  if (!plan) throw new Error("Unknown private vault subscription plan.");
  return settings[plan.priceSetting];
}

export function minorAmountToDecimal(minorAmount: string): string {
  if (!/^\d+$/.test(minorAmount)) {
    throw new Error("Invalid minor currency amount.");
  }
  const value = BigInt(minorAmount);
  const major = value / 100n;
  const minor = (value % 100n).toString().padStart(2, "0");
  return `${major}.${minor}`;
}

export function addVaultSubscriptionMonths(
  start: Date,
  months: number,
): Date {
  const result = new Date(start);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
