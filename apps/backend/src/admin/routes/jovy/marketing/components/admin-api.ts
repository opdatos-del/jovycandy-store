export async function marketingApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...init?.headers,
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "La operación no pudo completarse." }))
    throw new Error(body.message ?? "La operación no pudo completarse.")
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const toDateTimeLocal = (value: string | null) => {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
export const toIso = (value: string) => value ? new Date(value).toISOString() : null
