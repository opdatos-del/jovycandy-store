import {
  CATALOGUE_CATEGORY_KEYS,
  CATALOGUE_CATEGORY_SEEDS,
  catalogueCategoryInputSchema,
  catalogueCategoryKeySchema,
  compareCatalogueOrder,
  familyInputSchema,
  familySlugFrom,
  missingCatalogueCategorySeeds,
  normalizeCatalogueInteraction,
  resolveCatalogueCategoryInteractionUpdate,
  uniqueFamilySlug,
  updateCatalogueCategorySchema,
} from "@jovy/lib/jovy/catalogue"

const validCategory = {
  name: "Sazonador",
  active: true,
  coming_soon: false,
  interaction_locked: false,
  sort_order: 0,
}

describe("seed de categorías de presentación", () => {
  it("expone las seis claves públicas fijas", () => {
    expect(CATALOGUE_CATEGORY_KEYS).toEqual([
      "sazonador",
      "chamoy",
      "gomitas_almidon",
      "dulces_paletas",
      "pinatero",
      "gomitas_grenetina",
    ])
    expect(CATALOGUE_CATEGORY_SEEDS).toHaveLength(6)
    expect(CATALOGUE_CATEGORY_SEEDS.map((seed) => seed.sort_order)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it("crea solo las claves ausentes y es idempotente", () => {
    const missing = missingCatalogueCategorySeeds(["sazonador", "chamoy"])
    expect(missing.map((seed) => seed.key)).toEqual([
      "gomitas_almidon",
      "dulces_paletas",
      "pinatero",
      "gomitas_grenetina",
    ])

    expect(missingCatalogueCategorySeeds(CATALOGUE_CATEGORY_KEYS)).toEqual([])
  })

  it("no reescribe una categoría existente aunque conserve la clave", () => {
    const existing = CATALOGUE_CATEGORY_SEEDS.map((seed) => seed.key)
    const edited = { ...CATALOGUE_CATEGORY_SEEDS[0], name: "Sazonador premium" }

    expect(missingCatalogueCategorySeeds(existing)).toEqual([])
    expect(edited.name).toBe("Sazonador premium")
  })

  it("rechaza claves fuera del contrato público", () => {
    expect(catalogueCategoryKeySchema.safeParse("sazonador").success).toBe(true)
    expect(catalogueCategoryKeySchema.safeParse("otra").success).toBe(false)
  })
})

describe("semántica active / coming_soon / interaction_locked", () => {
  it("bloquea la interacción cuando la categoría es próximamente", () => {
    expect(normalizeCatalogueInteraction({ active: true, coming_soon: true, interaction_locked: false })).toEqual({
      active: false,
      coming_soon: true,
      interaction_locked: true,
    })
  })

  it("conserva una tarjeta activa cuando no es próximamente", () => {
    expect(normalizeCatalogueInteraction({ active: true, coming_soon: false, interaction_locked: false })).toEqual({
      active: true,
      coming_soon: false,
      interaction_locked: false,
    })
  })

  it("conserva un bloqueo explícito aunque no sea próximamente", () => {
    expect(normalizeCatalogueInteraction({ active: false, coming_soon: false, interaction_locked: true })).toEqual({
      active: false,
      coming_soon: false,
      interaction_locked: true,
    })
  })

  it("reactiva y desbloquea al desmarcar coming_soon de una categoría próxima", () => {
    const stored = normalizeCatalogueInteraction({ active: true, coming_soon: true, interaction_locked: false })
    expect(resolveCatalogueCategoryInteractionUpdate(stored, { coming_soon: false })).toEqual({
      active: true,
      coming_soon: false,
      interaction_locked: false,
    })
  })

  it("conserva un bloqueo manual explícito al retirar coming_soon", () => {
    const stored = normalizeCatalogueInteraction({ active: true, coming_soon: true, interaction_locked: false })
    expect(resolveCatalogueCategoryInteractionUpdate(stored, {
      coming_soon: false,
      interaction_locked: true,
    })).toEqual({
      active: true,
      coming_soon: false,
      interaction_locked: true,
    })
  })

  it("no cambia disponibilidad durante una edición no relacionada ni fuera de la transición", () => {
    expect(resolveCatalogueCategoryInteractionUpdate({
      active: false,
      coming_soon: true,
      interaction_locked: true,
    }, { name: "Chamoy premium" })).toEqual({
      active: false,
      coming_soon: true,
      interaction_locked: true,
    })

    expect(resolveCatalogueCategoryInteractionUpdate({
      active: false,
      coming_soon: false,
      interaction_locked: true,
    }, { name: "Chamoy premium" })).toEqual({
      active: false,
      coming_soon: false,
      interaction_locked: true,
    })
  })
})

describe("esquemas de categoría y familia", () => {
  it("acepta una categoría completa válida", () => {
    expect(catalogueCategoryInputSchema.safeParse(validCategory).success).toBe(true)
  })

  it("normaliza el contrato completo sin permitir activa y próximamente", () => {
    expect(catalogueCategoryInputSchema.parse({ ...validCategory, coming_soon: true })).toMatchObject({
      active: false,
      coming_soon: true,
      interaction_locked: true,
    })
  })

  it("rechaza nombres demasiado cortos y URLs de imagen sin HTTPS", () => {
    expect(updateCatalogueCategorySchema.safeParse({ name: "a" }).success).toBe(false)
    expect(updateCatalogueCategorySchema.safeParse({ image_url: "http://example.test/a.png" }).success).toBe(false)
    expect(updateCatalogueCategorySchema.safeParse({ image_url: "https://example.test/a.png" }).success).toBe(true)
  })

  it("aplica valores por defecto solo al crear familias", () => {
    const created = familyInputSchema.parse({ name: "Chamoy", slug: "chamoy" })
    expect(created).toMatchObject({ active: true, sort_order: 0 })
  })

  it("rechaza slugs inválidos para familia", () => {
    expect(familyInputSchema.safeParse({ name: "Chamoy", slug: "Chamoy Fresa" }).success).toBe(false)
    expect(familyInputSchema.safeParse({ name: "Chamoy", slug: "chamoy-fresa" }).success).toBe(true)
  })
})

describe("derivación de familias para compatibilidad", () => {
  it("normaliza acentos y separadores", () => {
    expect(familySlugFrom("Gomitas de almidón")).toBe("gomitas-de-almidon")
    expect(familySlugFrom("Piñatero / Fiesta")).toBe("pinatero-fiesta")
  })

  it("evita colisiones de slug de forma determinista", () => {
    expect(uniqueFamilySlug("chamoy", [])).toBe("chamoy")
    expect(uniqueFamilySlug("chamoy", ["chamoy"])).toBe("chamoy-2")
    expect(uniqueFamilySlug("chamoy", ["chamoy", "chamoy-2"])).toBe("chamoy-3")
  })
})

describe("orden de catálogo", () => {
  it("ordena por sort_order, luego por creación e id", () => {
    const items = [
      { id: "b", sort_order: 1, created_at: "2026-11-13T10:00:00.000Z" },
      { id: "a", sort_order: 0, created_at: "2026-11-13T12:00:00.000Z" },
      { id: "c", sort_order: 1, created_at: "2026-11-13T09:00:00.000Z" },
    ].sort(compareCatalogueOrder)

    expect(items.map((item) => item.id)).toEqual(["a", "c", "b"])
  })
})
