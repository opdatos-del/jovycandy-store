import { z } from "@medusajs/framework/zod"

/**
 * "Categorías del catálogo" son tarjetas de PRESENTACIÓN, no la taxonomía
 * comercial de Medusa. Las seis claves son públicas y fijas: el storefront las
 * usa como identificadores estables, por lo que agregar o renombrar una clave
 * requiere una migración de datos, no una edición editorial.
 */
export const CATALOGUE_CATEGORY_KEYS = [
  "sazonador",
  "chamoy",
  "gomitas_almidon",
  "dulces_paletas",
  "pinatero",
  "gomitas_grenetina",
] as const

export type CatalogueCategoryKey = (typeof CATALOGUE_CATEGORY_KEYS)[number]

export const catalogueCategoryKeySchema = z.enum(CATALOGUE_CATEGORY_KEYS)

export type CatalogueCategorySeed = {
  key: CatalogueCategoryKey
  name: string
  sort_order: number
}

/**
 * Valores iniciales de las seis tarjetas. El seed solo crea las claves
 * ausentes: nunca reescribe nombre, descripción, orden ni banderas ya editadas
 * desde el Admin.
 */
export const CATALOGUE_CATEGORY_SEEDS: readonly CatalogueCategorySeed[] = [
  { key: "sazonador", name: "Sazonador", sort_order: 0 },
  { key: "chamoy", name: "Chamoy", sort_order: 1 },
  { key: "gomitas_almidon", name: "Gomitas de almidón", sort_order: 2 },
  { key: "dulces_paletas", name: "Dulces y paletas", sort_order: 3 },
  { key: "pinatero", name: "Piñatero", sort_order: 4 },
  { key: "gomitas_grenetina", name: "Gomitas de grenetina", sort_order: 5 },
]

export function missingCatalogueCategorySeeds(existingKeys: Iterable<string>): CatalogueCategorySeed[] {
  const present = new Set(existingKeys)
  return CATALOGUE_CATEGORY_SEEDS
    .filter((seed) => !present.has(seed.key))
    .map((seed) => ({ ...seed }))
}

const id = z.string().trim().min(1).max(255)
const httpsUrl = z
  .string()
  .trim()
  .max(1_000)
  .refine((value) => value.startsWith("https://"), "La URL de imagen debe usar HTTPS")

const categoryFields = {
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2_000).nullable().optional(),
  active: z.boolean(),
  coming_soon: z.boolean(),
  interaction_locked: z.boolean(),
  sort_order: z.number().int().min(0),
  image_file_id: id.nullable().optional(),
  image_url: httpsUrl.nullable().optional(),
  medusa_category_id: id.nullable().optional(),
}

// La actualización parcial se completa contra el registro existente antes de
// normalizar: no puede decidir `active` sin ese contexto.
export const catalogueCategoryInputSchema = z.object(categoryFields).transform((input) => ({
  ...input,
  ...normalizeCatalogueInteraction(input),
}))
export const updateCatalogueCategorySchema = z.object(categoryFields).partial()

const familyFields = {
  name: z.string().trim().min(2).max(180),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug debe usar minúsculas, números y guiones"),
  description: z.string().trim().max(2_000).nullable().optional(),
  medusa_category_id: id.nullable().optional(),
  sort_order: z.number().int().min(0),
  active: z.boolean(),
}

export const familyInputSchema = z.object({
  ...familyFields,
  sort_order: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
})

// Un PATCH parcial no debe restaurar los valores por defecto de creación.
export const updateFamilyInputSchema = z.object(familyFields).partial()

export const catalogueReorderSchema = z.object({
  ids: z
    .array(id)
    .min(1)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, "Los identificadores no deben repetirse"),
})

export type UpdateCatalogueCategoryInput = z.infer<typeof updateCatalogueCategorySchema>

type CatalogueInteraction = {
  active: boolean
  coming_soon: boolean
  interaction_locked?: boolean | null
}
export type FamilyInput = z.infer<typeof familyInputSchema>

/**
 * `coming_soon` es un estado no publicado: fuerza `active = false` y bloquea
 * interacción.
 *
 * `interaction_locked` se persiste explícito para que la respuesta Store no
 * necesite derivarlo y protege lecturas de filas históricas inválidas.
 */
export function normalizeCatalogueInteraction(input: CatalogueInteraction) {
  return {
    active: input.coming_soon ? false : input.active,
    coming_soon: input.coming_soon,
    interaction_locked: input.coming_soon || Boolean(input.interaction_locked),
  }
}

/**
 * Resuelve la transición editorial contra el estado almacenado. Al retirar
 * `coming_soon` de una categoría que sí estaba próxima, se publica y libera
 * de nuevo. Un `interaction_locked: true` incluido en esa misma escritura
 * tiene precedencia: conserva el bloqueo manual sobre la tarjeta publicada.
 *
 * Sin esa transición concreta, esta función solo conserva el estado efectivo;
 * por tanto un guardado no relacionado no puede reactivar ni desbloquear.
 */
export function resolveCatalogueCategoryInteractionUpdate(
  current: CatalogueInteraction,
  patch: UpdateCatalogueCategoryInput,
) {
  if (current.coming_soon && patch.coming_soon === false) {
    return normalizeCatalogueInteraction({
      active: true,
      coming_soon: false,
      interaction_locked: patch.interaction_locked === true,
    })
  }

  return normalizeCatalogueInteraction({
    active: patch.active ?? current.active,
    coming_soon: patch.coming_soon ?? current.coming_soon,
    interaction_locked: patch.interaction_locked ?? current.interaction_locked,
  })
}

type Orderable = {
  sort_order: number
  created_at?: Date | string | null
  id?: string
}

export function compareCatalogueOrder(a: Orderable, b: Orderable) {
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
 * Compatibilidad: el histórico guardaba `family_id` como slug. En esta
 * instancia no existe esa columna, así que el único agrupamiento mapeable son
 * las Product Categories de Medusa. El slug se deriva del handle o del nombre,
 * sin inventar familias.
 */
export function familySlugFrom(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180)
}

export function uniqueFamilySlug(base: string, taken: Iterable<string>) {
  const used = new Set(taken)
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}
