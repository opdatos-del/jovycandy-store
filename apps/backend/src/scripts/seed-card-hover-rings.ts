/**
 * Carga los recursos de hover de Jovy Rings en Medusa y configura el producto.
 *
 *   pnpm --dir apps/backend seed:card-hover
 *
 * Variables opcionales:
 *   CARD_HOVER_SOURCE  carpeta con los cuatro .webp (por defecto Downloads)
 *   CARD_HOVER_HANDLE  handle del producto (por defecto jovy-aros-manzana-verde)
 *
 * - Sube los archivos con el File Module existente (file-local), sin copiarlos
 *   al repositorio del storefront.
 * - Asigna la bolsa original como thumbnail y el resto como galería.
 * - Guarda las URLs reales en `product.metadata` con el esquema card_hover_*.
 * - Es idempotente: si las URLs ya existen y responden, no vuelve a subir.
 */
import { readFile, stat } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
    pagination?: { take: number; skip: number }
  }) => Promise<{ data: unknown[] }>
}

type FileUploader = {
  getUploadStream: (data: {
    filename: string
    mimeType: string
    access?: "public" | "private"
  }) => Promise<{
    writeStream: { end: (buffer: Buffer) => void }
    promise: Promise<{ url?: string; fileKey?: string }>
    url: string
  }>
}

type ProductRow = {
  id: string
  handle?: string | null
  metadata?: Record<string, unknown> | null
  images?: Array<{ id: string; url: string }> | null
}

const FILES = {
  base: "jovy-rings-01-bolsa-original.webp",
  full: "jovy-rings-02-hover-completo.webp",
  overlay: "jovy-rings-03-gomitas-explosion.webp",
  gummy: "jovy-rings-04-gomita-individual.webp",
} as const

const METADATA_KEYS = {
  base: "card_hover_base_url",
  overlay: "card_hover_overlay_url",
  full: "card_hover_full_url",
  gummy: "card_gummy_url",
} as const

function sourceDirectory() {
  return (
    process.env.CARD_HOVER_SOURCE ??
    path.join(homedir(), "Downloads", "jovy-rings-assets-medusa-storefront")
  )
}

async function isReachable(url: string | null | undefined) {
  if (!url || typeof url !== "string") return false
  try {
    const response = await fetch(url, { method: "HEAD" })
    return response.ok
  } catch {
    return false
  }
}

async function uploadFile(fileService: FileUploader, directory: string, filename: string) {
  const filePath = path.join(directory, filename)
  await stat(filePath)
  const contents = await readFile(filePath)
  const stream = await fileService.getUploadStream({
    filename,
    mimeType: "image/webp",
    access: "public",
  })
  stream.writeStream.end(contents)
  const result = await stream.promise
  const url = result.url ?? stream.url
  if (!url) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `No se pudo subir ${filename}`)
  }
  return url
}

export default async function seedCardHoverRings({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const fileService = container.resolve(Modules.FILE) as unknown as FileUploader
  const handle = process.env.CARD_HOVER_HANDLE ?? "jovy-aros-manzana-verde"
  const directory = sourceDirectory()

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata", "images.id", "images.url", "thumbnail"],
    filters: { handle },
  })
  const product = (data as ProductRow[])[0]
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `No existe el producto ${handle}`)
  }

  const metadata = (product.metadata ?? {}) as Record<string, unknown>
  const existing = {
    base: typeof metadata[METADATA_KEYS.base] === "string" ? (metadata[METADATA_KEYS.base] as string) : null,
    overlay:
      typeof metadata[METADATA_KEYS.overlay] === "string"
        ? (metadata[METADATA_KEYS.overlay] as string)
        : null,
    full: typeof metadata[METADATA_KEYS.full] === "string" ? (metadata[METADATA_KEYS.full] as string) : null,
    gummy: typeof metadata[METADATA_KEYS.gummy] === "string" ? (metadata[METADATA_KEYS.gummy] as string) : null,
  }

  const reusable =
    (await isReachable(existing.base)) &&
    (await isReachable(existing.overlay)) &&
    (await isReachable(existing.full))

  let urls = existing
  if (!reusable) {
    logger.info(`[jovy-hover] subiendo recursos desde ${directory}`)
    urls = {
      base: await uploadFile(fileService, directory, FILES.base),
      full: await uploadFile(fileService, directory, FILES.full),
      overlay: await uploadFile(fileService, directory, FILES.overlay),
      gummy: await uploadFile(fileService, directory, FILES.gummy),
    }
  } else {
    logger.info("[jovy-hover] URLs existentes reutilizadas")
  }

  const gallery = [
    ...(product.images ?? []).map((image) => ({ id: image.id, url: image.url })),
    { url: urls.full! },
    { url: urls.overlay! },
    { url: urls.gummy! },
  ]
  const uniqueGallery = gallery.filter(
    (image, index, list) => list.findIndex((candidate) => candidate.url === image.url) === index,
  )

  await updateProductsWorkflow(container).run({
    input: {
      products: [
        {
          id: product.id,
          thumbnail: urls.base!,
          images: uniqueGallery,
          metadata: {
            ...metadata,
            card_hover_enabled: true,
            card_hover_mode: "layered",
            [METADATA_KEYS.base]: urls.base,
            [METADATA_KEYS.overlay]: urls.overlay,
            [METADATA_KEYS.full]: urls.full,
            [METADATA_KEYS.gummy]: urls.gummy,
            card_hover_background: "#EAF7E8",
          },
        },
      ],
    },
  })

  logger.info(`[jovy-hover] ${handle} configurado con ${urls.overlay}`)
}
