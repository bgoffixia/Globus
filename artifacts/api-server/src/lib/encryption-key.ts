export function decodeAes256Key(encodedValue: string): Buffer | null {
  const encoded = encodedValue.trim();
  if (/^[a-f0-9]{64}$/i.test(encoded)) {
    return Buffer.from(encoded, "hex");
  }

  const base64UrlKey = Buffer.from(encoded, "base64url");
  if (
    base64UrlKey.length === 32 &&
    base64UrlKey.toString("base64url") === encoded
  ) {
    return base64UrlKey;
  }
  base64UrlKey.fill(0);

  const base64Key = Buffer.from(encoded, "base64");
  if (
    base64Key.length === 32 &&
    (base64Key.toString("base64") === encoded ||
      base64Key.toString("base64").replace(/=+$/, "") === encoded)
  ) {
    return base64Key;
  }
  base64Key.fill(0);
  return null;
}
