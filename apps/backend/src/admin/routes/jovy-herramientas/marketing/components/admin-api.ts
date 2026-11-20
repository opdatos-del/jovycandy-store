import { adminRequest } from "@admin/shared/lib/admin-api"

/** Alias del cliente común; conserva el nombre que usan las pantallas de Marketing. */
export const marketingApi = adminRequest

export const toDateTimeLocal = (value: string | null) => {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export const toIso = (value: string) => (value ? new Date(value).toISOString() : null)
