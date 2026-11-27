export async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as (T & { message?: string }) | null
  if (!response.ok || !payload) throw new Error(payload?.message ?? "No se pudo completar la operación.")
  return payload
}
