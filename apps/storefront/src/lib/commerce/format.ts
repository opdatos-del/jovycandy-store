export function formatMoney(
  amount: number | null | undefined,
  currencyCode: string | null | undefined,
  locale: "es" | "en",
) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—"
  const currency = (currencyCode ?? "mxn").toUpperCase()
  try {
    return new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}
