import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  assertBrandVisibilityLimit,
  GALLERY_VISIBILITY_LOCK,
  LOGO_LOCK,
} from "@jovy/lib/jovy/brand"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"

/**
 * Persistence port for the brand module. The services keep the same shape as the
 * generated module methods so the workflows can pass the resolved container
 * straight through while tests can provide the real module service.
 */
type BrandScope = { resolve: (key: string) => unknown }

type GalleryRow = {
  id: string
  status: string
  enabled: boolean
  sort_order: number
  starts_at?: Date | string | null
  ends_at?: Date | string | null
  [key: string]: unknown
}

type LogoRow = {
  id: string
  slug: string
  name: string
  enabled: boolean
  families?: string[] | null
  crop?: unknown
  [key: string]: unknown
}

type GalleryService = {
  listJovyGalleryItems: (filters: Record<string, unknown>) => Promise<GalleryRow[]>
  createJovyGalleryItems: (data: Record<string, unknown>) => Promise<GalleryRow | GalleryRow[]>
  updateJovyGalleryItems: (data: Record<string, unknown>) => Promise<GalleryRow | GalleryRow[]>
}

type LogoService = {
  createLogo: (data: Record<string, unknown>) => Promise<LogoRow | LogoRow[]>
  updateLogo: (data: Record<string, unknown>) => Promise<LogoRow | LogoRow[]>
}

type LockingService = {
  execute: <T>(keys: string | string[], job: () => Promise<T>) => Promise<T>
}

type FileLookup = { retrieveFile: (id: string) => Promise<unknown> }

export type BrandCrop = { zoom: number; offset_x: number; offset_y: number }

export type GalleryItemPersistenceInput = {
  id?: string
  title?: string | null
  description?: string | null
  media_file_id: string
  status: "draft" | "published" | "archived"
  enabled: boolean
  sort_order: number
  starts_at?: string | null
  ends_at?: string | null
  actor_id?: string | null
  action?: string
}

export type LogoPersistenceInput = {
  id?: string
  slug: string
  name: string
  alt?: string | null
  families?: string[] | null
  media_file_id: string
  crop?: BrandCrop | null
  enabled: boolean
  sort_order: number
  actor_id?: string | null
  action?: string
}

function one<T>(value: T | T[]): T {
  const result = Array.isArray(value) ? value[0] : value
  if (!result) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Medusa no devolvió el registro guardado")
  return result
}

/**
 * Validates the referenced media through the File Module instead of the marketing
 * module, so brand stays usable even if marketing media routes change.
 */
export async function assertMediaFileExists(file: FileLookup, mediaFileId: string): Promise<void> {
  try {
    await file.retrieveFile(mediaFileId)
  } catch {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "El archivo multimedia no existe")
  }
}

export async function persistGalleryItem(
  scope: BrandScope,
  input: GalleryItemPersistenceInput,
): Promise<GalleryRow> {
  const gallery = scope.resolve(JOVY_BRAND_MODULE) as GalleryService
  const locking = scope.resolve(Modules.LOCKING) as LockingService
  const file = scope.resolve(Modules.FILE) as FileLookup
  await assertMediaFileExists(file, input.media_file_id)

  let saved: GalleryRow | undefined
  await locking.execute(GALLERY_VISIBILITY_LOCK, async () => {
    const { id, actor_id: _actorId, action: _action, starts_at, ends_at, ...data } = input
    const scheduledData = {
      ...data,
      starts_at: starts_at ? new Date(starts_at) : null,
      ends_at: ends_at ? new Date(ends_at) : null,
      published_at: data.status === "published" ? new Date() : null,
    }
    const existing = await gallery.listJovyGalleryItems({})
    assertBrandVisibilityLimit([
      ...existing.filter((item) => item.id !== id),
      { status: data.status, enabled: data.enabled, starts_at, ends_at },
    ])
    saved = one(
      id
        ? await gallery.updateJovyGalleryItems({ id, ...scheduledData })
        : await gallery.createJovyGalleryItems(scheduledData),
    )
  })

  return saved!
}

export async function persistLogoItem(scope: BrandScope, input: LogoPersistenceInput): Promise<LogoRow> {
  const logos = scope.resolve(JOVY_BRAND_MODULE) as LogoService
  const locking = scope.resolve(Modules.LOCKING) as LockingService
  const file = scope.resolve(Modules.FILE) as FileLookup
  await assertMediaFileExists(file, input.media_file_id)

  let saved: LogoRow | undefined
  await locking.execute(LOGO_LOCK, async () => {
    const { id, actor_id: _actorId, action: _action, ...data } = input
    saved = id ? one(await logos.updateLogo({ id, ...data })) : one(await logos.createLogo(data))
  })

  return saved!
}
