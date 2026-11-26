/**
 * Carga los recursos de hover de Jovy Rings desde el paquete versionado en el
 * backend y configura el producto mediante el File Module existente.
 *
 *   pnpm --dir apps/backend seed:card-hover
 *
 * No requiere el producto histórico ni archivos en Downloads. CARD_HOVER_HANDLE
 * permite apuntar a otro producto; CARD_HOVER_SOURCE permite usar otro paquete
 * con su propio manifest.json y hashes.
 */
import path from "node:path"

import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

import {
  canManageCardVisual,
  loadCardVisualManifest,
  readVerifiedCardVisualAsset,
  remoteCardVisualHash,
  RINGS_VISUAL_MARKER,
  type CardVisualAsset,
  type CardVisualManifest,
} from "@jovy/lib/jovy/card-visual-assets"

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

const URL_KEY: Record<CardVisualAsset["role"], string> = {
  base: "card_hover_base_url",
  full: "card_hover_full_url",
  overlay: "card_hover_overlay_url",
  gummy: "card_gummy_url",
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

async function uploadAsset(
  fileService: FileUploader,
  directory: string,
  asset: CardVisualAsset,
): Promise<string> {
  const contents = await readVerifiedCardVisualAsset(directory, asset)
  const stream = await fileService.getUploadStream({
    filename: asset.file,
    mimeType: "image/webp",
    access: "public",
  })
  stream.writeStream.end(contents)
  const result = await stream.promise
  const url = result.url ?? stream.url
  if (!url) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `No se pudo subir ${asset.file}`,
    )
  }
  return url
}

async function resolveAssetUrls(
  fileService: FileUploader,
  directory: string,
  manifest: CardVisualManifest,
  metadata: Record<string, unknown>,
  managed: boolean,
): Promise<Record<CardVisualAsset["role"], string>> {
  const urls = {} as Record<CardVisualAsset["role"], string>
  for (const asset of manifest.assets) {
    const existing = managed ? stringValue(metadata[URL_KEY[asset.role]]) : null
    if (existing && (await remoteCardVisualHash(existing)) === asset.sha256) {
      urls[asset.role] = existing
      continue
    }
    urls[asset.role] = await uploadAsset(fileService, directory, asset)
  }
  return urls
}

export default async function seedCardHoverRings({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const fileService = container.resolve(Modules.FILE) as unknown as FileUploader
  const directory = process.env.CARD_HOVER_SOURCE
    ? path.resolve(process.env.CARD_HOVER_SOURCE)
    : undefined
  const manifest = await loadCardVisualManifest(directory)
  const handle = process.env.CARD_HOVER_HANDLE ?? manifest.product_handle
  const force = process.env.CARD_HOVER_FORCE === "1"

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
  const managed = metadata.card_visual_managed_by === RINGS_VISUAL_MARKER
  if (!canManageCardVisual(metadata, force)) {
    logger.info(
      `[jovy-hover] ${handle} conserva una configuración manual; usa CARD_HOVER_FORCE=1 para reemplazarla`,
    )
    return
  }

  const sourceDirectory =
    directory ?? path.resolve(process.cwd(), "src", "data", "card-visuals", "rings")
  const urls = await resolveAssetUrls(
    fileService,
    sourceDirectory,
    manifest,
    metadata,
    managed,
  )

  const gallery = [
    ...(product.images ?? []).map((image) => ({ id: image.id, url: image.url })),
    { url: urls.full },
    { url: urls.overlay },
    { url: urls.gummy },
  ]
  const uniqueGallery = gallery.filter(
    (image, index, list) =>
      list.findIndex((candidate) => candidate.url === image.url) === index,
  )

  await updateProductsWorkflow(container).run({
    input: {
      products: [
        {
          id: product.id,
          thumbnail: urls.base,
          images: uniqueGallery,
          metadata: {
            ...metadata,
            card_hover_enabled: true,
            card_hover_mode: "layered",
            card_hover_preset: manifest.preset,
            card_visual_version: 1,
            card_visual_managed_by: RINGS_VISUAL_MARKER,
            card_visual_asset_version: manifest.version,
            card_hover_duration_ms: 450,
            card_hover_intensity: 100,
            card_hover_background: manifest.background,
            [URL_KEY.base]: urls.base,
            [URL_KEY.full]: urls.full,
            [URL_KEY.overlay]: urls.overlay,
            [URL_KEY.gummy]: urls.gummy,
          },
        },
      ],
    },
  })

  logger.info(`[jovy-hover] ${handle} configurado con ${urls.overlay}`)
}
