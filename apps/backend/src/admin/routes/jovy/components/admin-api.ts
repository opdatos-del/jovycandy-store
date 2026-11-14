/**
 * Cliente HTTP compartido por las pantallas de presentación (catálogo,
 * lanzamientos y anuncios). Reutiliza la sesión del Admin mediante cookies y
 * traduce los errores del backend a un mensaje visible para la persona usuaria.
 */
type ApiErrorBody = {
  message?: string
  errors?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
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
    const fieldMessage = body?.errors?.fieldErrors
      ? Object.values(body.errors.fieldErrors).flat()[0]
      : undefined
    // El status se conserva en el error: algunas pantallas necesitan distinguir
    // "no existe todavía" (404) de un fallo real sin volver a interpretar el cuerpo.
    throw Object.assign(
      new Error(
        fieldMessage ??
          body?.errors?.formErrors?.[0] ??
          body?.message ??
          `La operación falló (${response.status}).`,
      ),
      { status: response.status },
    )
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

/** El backend solo acepta PNG, JPEG o WebP de hasta 5 MB. */
export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp"

export type UploadedJovyImage = { id: string; url: string | null }

export async function uploadJovyImage(file: File): Promise<UploadedJovyImage> {
  const body = new FormData()
  body.append("files", file)
  const result = await adminRequest<{ file: { id: string; url?: string | null } }>(
    "/admin/jovy/marketing/media",
    { method: "POST", body },
  )
  return { id: result.file.id, url: result.file.url ?? null }
}

/** `#RGB` o `#RRGGBB`, la misma regla que valida el backend. */
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
export const isValidHexColor = (value: string) => HEX_COLOR_PATTERN.test(value)

/** `input[type=color]` solo admite `#rrggbb`; se expande el formato corto. */
export function expandHexColor(value: string) {
  if (!isValidHexColor(value)) return "#00afaa"
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase()
  }
  return value.toLowerCase()
}
