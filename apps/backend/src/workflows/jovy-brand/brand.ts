import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { GALLERY_VISIBILITY_LOCK, LOGO_LOCK } from "@jovy/lib/jovy/brand"
import { persistGalleryItem, persistLogoItem } from "@jovy/lib/jovy/brand-persistence"
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

const saveGalleryStep = createStep("save-gallery", async (input: GalleryInput, { container }) => {
  const service = container.resolve(JOVY_BRAND_MODULE)
  const gallery = await persistGalleryItem(container, input)

  await service.createJovyBrandAuditLogs({
    actor_id: input.actor_id,
    entity_type: "gallery_item",
    entity_id: gallery.id,
    action: input.action,
    metadata: {
      status: gallery.status,
      enabled: gallery.enabled,
      sort_order: gallery.sort_order,
    },
  })
  return new StepResponse(gallery, gallery.id)
})

export const saveGalleryWorkflow = createWorkflow("save-gallery", (input: GalleryInput) => new WorkflowResponse(saveGalleryStep(input)))

const saveLogoStep = createStep("save-logo", async (input: LogoInput, { container }) => {
  const service = container.resolve(JOVY_BRAND_MODULE)
  const logo = await persistLogoItem(container, input)
  await service.createJovyBrandAuditLogs({
    actor_id: input.actor_id,
    entity_type: "logo",
    entity_id: logo.id,
    action: input.action,
    metadata: { slug: logo.slug, enabled: logo.enabled, families: logo.families },
  })
  return new StepResponse(logo, logo.id)
})

export const saveLogoWorkflow = createWorkflow("save-logo", (input: LogoInput) => new WorkflowResponse(saveLogoStep(input)))

const reorderBrandStep = createStep(
  "reorder-brand",
  async (input: { entity: "gallery" | "logo"; ids: string[]; actor_id: string | null }, { container }) => {
    const service = container.resolve(JOVY_BRAND_MODULE)
    const locking = container.resolve(Modules.LOCKING)
    await locking.execute(input.entity === "gallery" ? GALLERY_VISIBILITY_LOCK : LOGO_LOCK, async () => {
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
  await locking.execute(input.entity === "gallery" ? GALLERY_VISIBILITY_LOCK : LOGO_LOCK, async () => {
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
