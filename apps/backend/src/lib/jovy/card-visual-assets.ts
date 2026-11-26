import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { z } from "@medusajs/framework/zod"

export const RINGS_VISUAL_MARKER = "jovy-rings-assets-v1"
export const RINGS_VISUAL_DEFAULT_HANDLE = "jovy-mx-rings-rings-manzana"

const assetSchema = z.object({
  role: z.enum(["base", "full", "overlay", "gummy"]),
  file: z
    .string()
    .min(1)
    .refine((file) => path.basename(file) === file, "El archivo no debe contener rutas"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  provenance: z.string().min(1),
})

const cardVisualManifestSchema = z.object({
  version: z.literal(1),
  product_handle: z.string().regex(/^jovy-mx-/),
  preset: z.literal("jovy-gummies"),
  background: z.string().regex(/^#[0-9a-f]{6}$/i),
  description: z.string().min(1),
  assets: z
    .array(assetSchema)
    .length(4)
    .refine(
      (assets) => new Set(assets.map((asset) => asset.role)).size === 4,
      "Cada rol visual debe existir una sola vez",
    ),
})

export type CardVisualAsset = z.infer<typeof assetSchema>
export type CardVisualManifest = z.infer<typeof cardVisualManifestSchema>

/** Una configuración existente sin marcador se considera manual. */
export function canManageCardVisual(
  metadata: Record<string, unknown> | null | undefined,
  force = false,
): boolean {
  if (force) return true
  if (metadata?.card_visual_managed_by === RINGS_VISUAL_MARKER) return true
  return !metadata?.card_hover_mode
}

export function cardVisualAssetDirectory(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.CARD_HOVER_SOURCE ??
    path.resolve(process.cwd(), "src", "data", "card-visuals", "rings")
  )
}

export async function loadCardVisualManifest(
  directory = cardVisualAssetDirectory(),
): Promise<CardVisualManifest> {
  const raw = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
  )
  return cardVisualManifestSchema.parse(raw)
}

/** Verifica tamaño y SHA-256 antes de que un recurso llegue al File Module. */
export async function readVerifiedCardVisualAsset(
  directory: string,
  asset: CardVisualAsset,
): Promise<Buffer> {
  const contents = await readFile(path.join(directory, asset.file))
  const digest = createHash("sha256").update(contents).digest("hex")
  if (contents.byteLength !== asset.bytes || digest !== asset.sha256) {
    throw new Error(`El recurso ${asset.file} no coincide con el manifiesto`)
  }
  return contents
}

export async function remoteCardVisualHash(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return null
    return createHash("sha256")
      .update(Buffer.from(await response.arrayBuffer()))
      .digest("hex")
  } catch {
    return null
  }
}
