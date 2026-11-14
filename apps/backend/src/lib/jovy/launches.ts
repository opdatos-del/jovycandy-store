import { z } from "@medusajs/framework/zod"

export const LAUNCH_DEFAULT_BACKGROUND_COLOR = "#00AFAA"

const id = z.string().trim().min(1).max(255)
const httpsUrl = z
  .string()
  .trim()
  .max(1_000)
  .refine((value) => value.startsWith("https://"), "La URL de imagen debe usar HTTPS")
export const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "El color debe ser hexadecimal #RGB o #RRGGBB")

const launchFields = {
  product_id: id.nullable().optional(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2_000).nullable().optional(),
  image_file_id: id.nullable().optional(),
  image_url: httpsUrl.nullable().optional(),
  sort_order: z.number().int().min(0),
  active: z.boolean(),
}

/**
 * Un lanzamiento puede apuntar a un producto Medusa, mostrar una imagen propia
 * (File Module o URL externa HTTPS) o ambas cosas. Nunca copia SKU, precio ni
 * stock: el producto se resuelve en el Product Module al escribir.
 */
export function launchAssetIssues(input: {
  product_id?: string | null
  image_file_id?: string | null
  image_url?: string | null
}) {
  const issues: string[] = []
  if (!input.product_id && !input.image_file_id && !input.image_url) {
    issues.push("producto o imagen")
  }
  return issues
}

export const launchInputSchema = z
  .object({
    ...launchFields,
    sort_order: z.number().int().min(0).default(0),
    active: z.boolean().default(true),
  })
  .superRefine((input, ctx) => {
    if (launchAssetIssues(input).length) {
      ctx.addIssue({
        code: "custom",
        path: ["product_id"],
        message: "Un lanzamiento requiere un producto o una imagen",
      })
    }
  })

// Un PATCH parcial no debe restaurar `active: true` ni `sort_order: 0`.
export const updateLaunchInputSchema = z.object(launchFields).partial()
export const launchSettingsSchema = z.object({ background_color: hexColorSchema })

export type LaunchInput = z.infer<typeof launchInputSchema>

type Orderable = {
  sort_order: number
  created_at?: Date | string | null
  id?: string
}

export function compareLaunchOrder(a: Orderable, b: Orderable) {
  const sortOrder = a.sort_order - b.sort_order
  if (sortOrder !== 0) return sortOrder
  if (a.created_at && b.created_at) {
    const timeA = new Date(a.created_at).getTime()
    const timeB = new Date(b.created_at).getTime()
    if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) return timeA - timeB
  }
  return (a.id ?? "").localeCompare(b.id ?? "")
}

/**
 * Los lanzamientos son independientes del Hero genérico: no usan estado
 * editorial ni ventana temporal. `active` es la única bandera de publicación.
 */
export function isLaunchVisible(launch: { active: boolean }) {
  return launch.active
}

export const launchReorderSchema = z.object({
  ids: z
    .array(id)
    .min(1)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, "Los identificadores no deben repetirse"),
})
