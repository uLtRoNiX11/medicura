// Lightweight currency formatting helper.
// Accepts ISO 4217 codes (USD, INR, EUR, GBP, JPY, …) and falls back gracefully.

export function formatCurrency(
  amount: number | null | undefined,
  currency: string | null | undefined,
  options: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {},
): string {
  const value = Number(amount ?? 0);
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: options.minimumFractionDigits ?? 2,
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
    }).format(value);
  } catch {
    // Unknown / non-ISO code — show the code as a prefix.
    return `${code} ${value.toFixed(options.maximumFractionDigits ?? 2)}`;
  }
}
