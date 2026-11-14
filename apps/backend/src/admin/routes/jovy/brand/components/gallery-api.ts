/**
 * Cliente HTTP de la pestaña Galería. Repite el contrato mínimo de
 * `routes/jovy/components/admin-api.ts` porque la regla de lint prohíbe subir
 * dos niveles con imports relativos y el Admin no resuelve el alias `@jovy/*`.
 */
type ApiErrorBody = {
  message?: string
  errors?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
}

export const GALLERY_MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const GALLERY_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]
export const GALLERY_ACCEPT = GALLERY_IMAGE_TYPES.join(",")

export async function galleryRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export const galleryErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export async function uploadGalleryImage(file: File): Promise<{ id: string; url: string | null }> {
  const body = new FormData()
  body.append("files", file)
  const result = await galleryRequest<{ file: { id: string; url?: string | null } }>(
    "/admin/jovy/marketing/media",
    { method: "POST", body },
  )
  return { id: result.file.id, url: result.file.url ?? null }
}

/** Error visible y conciso para archivos rechazados antes de tocar la red. */
export function validateGalleryImage(file: File) {
  if (!GALLERY_IMAGE_TYPES.includes(file.type)) return "Formato no admitido; usa PNG, JPEG o WebP."
  if (file.size > GALLERY_MAX_IMAGE_BYTES) return "Excede el límite de 5 MB."
  return null
}
