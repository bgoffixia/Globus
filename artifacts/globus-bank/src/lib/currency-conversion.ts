/** Converts a decimal amount using integer arithmetic and rounds half up. */
export function previewConversion(
  amount: string,
  rate: string,
  targetDigits: number,
  sourceDigits = 2,
): string | null {
  if (
    !Number.isInteger(sourceDigits) ||
    sourceDigits < 0 ||
    sourceDigits > 4 ||
    !Number.isInteger(targetDigits) ||
    targetDigits < 0 ||
    targetDigits > 4
  ) return null;

  const amountMatch = /^(\d{1,12})(?:\.(\d{1,4}))?$/.exec(amount);
  const rateMatch = /^(\d{1,12})(?:\.(\d{1,10}))?$/.exec(rate);
  if (!amountMatch || !rateMatch || (amountMatch[2]?.length ?? 0) > sourceDigits) return null;

  const sourceScale = 10n ** BigInt(sourceDigits);
  const sourceMinor = BigInt(amountMatch[1]) * sourceScale +
    BigInt((amountMatch[2] ?? '').padEnd(sourceDigits, '0') || '0');
  const rateScale = 10n ** 10n;
  const rateScaled = BigInt(rateMatch[1]) * rateScale +
    BigInt((rateMatch[2] ?? '').padEnd(10, '0') || '0');
  const targetScale = 10n ** BigInt(targetDigits);
  const denominator = sourceScale * rateScale;
  const convertedMinor = (sourceMinor * rateScaled * targetScale + denominator / 2n) / denominator;
  if (targetDigits === 0) return convertedMinor.toString();
  return `${convertedMinor / targetScale}.${(convertedMinor % targetScale)
    .toString()
    .padStart(targetDigits, '0')}`;
}
