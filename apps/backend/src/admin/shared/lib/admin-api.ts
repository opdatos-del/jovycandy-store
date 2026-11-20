/**
 * Cliente HTTP único del Admin. Mantiene la cookie de sesión, normaliza el
 * cuerpo de error de Medusa, conserva el status para decisiones de dominio y
 * expone utilidades de descarga reutilizables.
 */

export type ApiErrorBody = {
  message?: string
  errors?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
}

export class AdminApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody | null

  constructor(message: string, status: number, body: ApiErrorBody | null = null) {
    super(message)
    this.name = "AdminApiError"
    this.status = status
    this.body = body
  }
}

function bodyMessage(body: ApiErrorBody | null): string | undefined {
  const fieldMessage = body?.errors?.fieldErrors
    ? Object.values(body.errors.fieldErrors).flat()[0]
    : undefined
  return fieldMessage ?? body?.errors?.formErrors?.[0] ?? body?.message
}

export async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...init?.headers,
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new AdminApiError(
      bodyMessage(body) ?? `La operación falló (${response.status}).`,
      response.status,
      body,
    )
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

/** Serializa query params sin enviar vacíos; conserva `0` y `false`. */
export function adminQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    query.set(key, String(value))
  }
  return query.toString()
}

export type AdminDownload = {
  blob: Blob
  fileName: string
  count: number | null
  sheets: number | null
}

function headerInteger(response: Response, name: string): number | null {
  const raw = response.headers.get(name)
  if (!raw || !/^\d+$/.test(raw.trim())) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function fileNameFromResponse(response: Response): string | null {
  const disposition = response.headers.get("Content-Disposition") ?? ""
  return /filename="([^"]+)"/.exec(disposition)?.[1] ?? null
}

/** Descarga autenticada de CSV/XLSX; el cuerpo se conserva como bytes. */
export async function downloadAdminFile(
  path: string,
  fallbackName: string,
): Promise<AdminDownload> {
  const response = await fetch(path, { credentials: "include" })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new AdminApiError(
      bodyMessage(body) ?? `La exportación falló (${response.status}).`,
      response.status,
      body,
    )
  }

  return {
    blob: await response.blob(),
    fileName: fileNameFromResponse(response) ?? fallbackName,
    count: headerInteger(response, "X-Export-Count"),
    sheets: headerInteger(response, "X-Export-Sheets"),
  }
}

/** Guarda un Blob como descarga sin dejar el objeto URL vivo. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
