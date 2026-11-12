import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"

type GalleryInput = {
  id?: string
  title?: string | null
  description?: string | null
  media_file_id: string
  status: "draft" | "published" | "archived"
  enabled: boolean
  sort_order: number
  starts_at?: string | null
  ends_at?: string | null
  actor_id: string | null
  action: "create" | "update" | "publish" | "unpublish" | "archive"
}

type LogoInput = {
  id?: string
  slug: string
  name: string
  alt?: string | null
  families?: string[] | null
  media_file_id: string
  crop?: { zoom: number; offset_x: number; offset_y: number } | null
  enabled: boolean
  sort_order: number
  actor_id: string | null
  action: "create" | "update"
}

type ScheduledGallery = {
  id: string
  status: string
  enabled: boolean
  starts_at?: Date | null
  ends_at?: Date | null
}

const MIN_TIME = -8_640_000_000_000_000
const MAX_TIME = 8_640_000_000_000_000

function one<T>(value: T | T[]): T {
  const result = Array.isArray(value) ? value[0] : value
  if (!result) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Medusa no devolvió el registro guardado")
  return result
}

function intervalStart(item: ScheduledGallery) {
  return item.starts_at ? new Date(item.starts_at).getTime() : MIN_TIME
}

function intervalEnd(item: ScheduledGallery) {
  return item.ends_at ? new Date(item.ends_at).getTime() : MAX_TIME
}

function assertAtMostFourVisible(items: ScheduledGallery[]) {
  const visible = items.filter((item) => item.status === "published" && item.enabled)
  const boundaries = new Set<number>()
  for (const item of visible) {
    boundaries.add(intervalStart(item))
    boundaries.add(intervalEnd(item))
  }

  for (const boundary of boundaries) {
    const simultaneous = visible.filter((item) => intervalStart(item) <= boundary && intervalEnd(item) >= boundary).length
    if (simultaneous > 4) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Casa Jovy Galería solo permite cuatro elementos activos publicados en el mismo periodo",
      )
    }
  }
}

async function assertPublicFile(container: { resolve: (key: string) => { retrieveFile: (id: string) => Promise<unknown> } }, mediaFileId: string) {
  try {
    await container.resolve(Modules.FILE).retrieveFile(mediaFileId)
  } catch {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "El archivo multimedia no existe")
  }
}

const saveGalleryStep = createStep("save-gallery", async (input: GalleryInput, { container }) => {
  const service = container.resolve(JOVY_BRAND_MODULE)
  const locking = container.resolve(Modules.LOCKING)
  await assertPublicFile(container, input.media_file_id)
  type GalleryRecord = Awaited<ReturnType<typeof service.updateJovyGalleryItems>>[number]
  let gallery: GalleryRecord

  await locking.execute("jovy-brand:gallery-visible-limit", async () => {
    const { id, actor_id: _actorId, action: _action, starts_at, ends_at, ...data } = input
    const scheduledData = {
      ...data,
      starts_at: starts_at ? new Date(starts_at) : null,
      ends_at: ends_at ? new Date(ends_at) : null,
      published_at: data.status === "published" ? new Date() : null,
    }
    const existing = await service.listJovyGalleryItems({})
    const candidate = {
      id: id ?? "new-gallery-item",
      status: data.status,
      enabled: data.enabled,
      starts_at: scheduledData.starts_at,
      ends_at: scheduledData.ends_at,
    }
    assertAtMostFourVisible([...existing.filter((item) => item.id !== id), candidate])
    gallery = id
      ? one((await service.updateJovyGalleryItems({ id, ...scheduledData })) as unknown as GalleryRecord | GalleryRecord[])
      : one((await service.createJovyGalleryItems(scheduledData)) as unknown as GalleryRecord | GalleryRecord[])
  })

  await service.createJovyBrandAuditLogs({
    actor_id: input.actor_id,
    entity_type: "gallery_item",
    entity_id: gallery!.id,
    action: input.action,
    metadata: {
      status: gallery!.status,
      enabled: gallery!.enabled,
      sort_order: gallery!.sort_order,
    },
  })
  return new StepResponse(gallery!, gallery!.id)
})

export const saveGalleryWorkflow = createWorkflow("save-gallery", (input: GalleryInput) => new WorkflowResponse(saveGalleryStep(input)))

const saveLogoStep = createStep("save-logo", async (input: LogoInput, { container }) => {
  const service = container.resolve(JOVY_BRAND_MODULE)
  const locking = container.resolve(Modules.LOCKING)
  await assertPublicFile(container, input.media_file_id)
  let logo: Awaited<ReturnType<typeof service.updateLogo>>

  await locking.execute("jovy-brand:logos", async () => {
    const { id, actor_id: _actorId, action: _action, ...data } = input
    logo = id
      ? await service.updateLogo({ id, ...data })
      : await service.createLogo(data)
  })
  await service.createJovyBrandAuditLogs({
    actor_id: input.actor_id,
    entity_type: "logo",
    entity_id: logo!.id,
    action: input.action,
    metadata: { slug: logo!.slug, enabled: logo!.enabled, families: logo!.families },
  })
  return new StepResponse(logo!, logo!.id)
})

export const saveLogoWorkflow = createWorkflow("save-logo", (input: LogoInput) => new WorkflowResponse(saveLogoStep(input)))

const reorderBrandStep = createStep(
  "reorder-brand",
  async (input: { entity: "gallery" | "logo"; ids: string[]; actor_id: string | null }, { container }) => {
    const service = container.resolve(JOVY_BRAND_MODULE)
    const locking = container.resolve(Modules.LOCKING)
    await locking.execute(input.entity === "gallery" ? "jovy-brand:gallery-visible-limit" : "jovy-brand:logos", async () => {
      const items = input.entity === "gallery"
        ? await service.listJovyGalleryItems({ id: input.ids })
        : await service.listLogos({ id: input.ids })
      if (items.length !== input.ids.length || new Set(input.ids).size !== input.ids.length) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "No se pueden reordenar registros inexistentes o repetidos")
      }
      await Promise.all(input.ids.map((id, sort_order) => input.entity === "gallery"
        ? service.updateJovyGalleryItems({ id, sort_order })
        : service.updateLogo({ id, sort_order })))
    })
    await service.createJovyBrandAuditLogs({
      actor_id: input.actor_id,
      entity_type: input.entity === "gallery" ? "gallery_item" : "logo",
      entity_id: input.ids.join(","),
      action: "reorder",
      metadata: { ids: input.ids },
    })
    return new StepResponse({ ids: input.ids })
  },
)

export const reorderBrandWorkflow = createWorkflow(
  "reorder-brand",
  (input: { entity: "gallery" | "logo"; ids: string[]; actor_id: string | null }) => new WorkflowResponse(reorderBrandStep(input)),
)

const deleteBrandStep = createStep("delete-brand", async (input: { entity: "gallery" | "logo"; id: string; actor_id: string | null }, { container }) => {
  const service = container.resolve(JOVY_BRAND_MODULE)
  const locking = container.resolve(Modules.LOCKING)
  await locking.execute(input.entity === "gallery" ? "jovy-brand:gallery-visible-limit" : "jovy-brand:logos", async () => {
    if (input.entity === "gallery") await service.deleteJovyGalleryItems(input.id)
    else await service.deleteLogo(input.id)
  })
  await service.createJovyBrandAuditLogs({
    actor_id: input.actor_id,
    entity_type: input.entity === "gallery" ? "gallery_item" : "logo",
    entity_id: input.id,
    action: "delete",
  })
  return new StepResponse({ id: input.id })
})

export const deleteBrandWorkflow = createWorkflow(
  "delete-brand",
  (input: { entity: "gallery" | "logo"; id: string; actor_id: string | null }) => new WorkflowResponse(deleteBrandStep(input)),
)
