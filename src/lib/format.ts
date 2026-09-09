export function formatDate(value?: string | null) {
  if (!value) return "Not set"
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function formatMoney(amount?: number | string | null, currency = "PKR") {
  const numeric = Number(amount ?? 0)
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(numeric)
}
