import { logoInputSchema, updateLogoInputSchema } from "@jovy/lib/jovy/brand"
import {
  loadBrandFamilyDirectory,
  logoMatchesFamily,
  planLogoFamilyBackfill,
  resolveLogoFamilySelection,
  validateFamilySelection,
  type BrandFamilyRef,
} from "@jovy/lib/jovy/brand-family"

const directory: BrandFamilyRef[] = [
  { id: "fam_chamoy", slug: "chamoy", name: "Chamoy", active: true },
  { id: "fam_pinatero", slug: "pinatero", name: "Piñatero", active: true },
  { id: "fam_retirada", slug: "retirada", name: "Retirada", active: false },
]

describe("resolución de familias de un logo", () => {
  it("usa la relación real cuando el logo ya está vinculado", () => {
    const selection = resolveLogoFamilySelection({
      families_linked: true,
      families: ["chamoy", "historica"],
      family_ids: ["fam_pinatero", "fam_chamoy"],
      directory,
    })

    // Orden de presentación del catálogo, independiente del orden de escritura.
    expect(selection.family_ids).toEqual(["fam_chamoy", "fam_pinatero"])
    expect(selection.family_labels).toEqual([
      { id: "fam_chamoy", slug: "chamoy", name: "Chamoy" },
      { id: "fam_pinatero", slug: "pinatero", name: "Piñatero" },
    ])
    expect(selection.family_slugs).toEqual(["chamoy", "pinatero"])
    // El array legado se conserva íntegro y solo se reporta lo no mapeado.
    expect(selection.legacy_families).toEqual(["chamoy", "historica"])
    expect(selection.unmapped_families).toEqual(["historica"])
  })

  it("descarta ids de familia inexistentes sin inventar etiquetas", () => {
    const selection = resolveLogoFamilySelection({
      families_linked: true,
      families: null,
      family_ids: ["fam_inexistente", "fam_chamoy"],
      directory,
    })

    expect(selection.family_ids).toEqual(["fam_chamoy"])
    expect(selection.family_labels).toEqual([{ id: "fam_chamoy", slug: "chamoy", name: "Chamoy" }])
  })

  it("resuelve el array legado por slug exacto mientras no hay vínculo", () => {
    const selection = resolveLogoFamilySelection({
      families_linked: false,
      families: ["chamoy", "corporativa"],
      directory,
    })

    expect(selection.linked).toBe(false)
    expect(selection.family_ids).toEqual(["fam_chamoy"])
    expect(selection.family_slugs).toEqual(["chamoy", "corporativa"])
    expect(selection.unmapped_families).toEqual(["corporativa"])
  })

  it("mantiene vacío el logo sin familias ni legado", () => {
    const selection = resolveLogoFamilySelection({ families_linked: true, families: null, family_ids: [], directory })
    expect(selection).toMatchObject({ family_ids: [], family_labels: [], family_slugs: [], unmapped_families: [] })
  })
})

describe("filtro Store por familia", () => {
  const selection = resolveLogoFamilySelection({
    families_linked: true,
    families: null,
    family_ids: ["fam_chamoy"],
    directory,
  })

  it("acepta identificador real y slug", () => {
    expect(logoMatchesFamily(selection, "fam_chamoy")).toBe(true)
    expect(logoMatchesFamily(selection, "chamoy")).toBe(true)
  })

  it("excluye otra familia y no filtra sin parámetro", () => {
    expect(logoMatchesFamily(selection, "fam_pinatero")).toBe(false)
    expect(logoMatchesFamily(selection, "otra")).toBe(false)
    expect(logoMatchesFamily(selection, null)).toBe(true)
  })

  it("conserva el alias histórico: sin familias visible en todas", () => {
    const everyFamily = resolveLogoFamilySelection({ families_linked: true, families: null, family_ids: [], directory })
    expect(logoMatchesFamily(everyFamily, "fam_pinatero")).toBe(true)
  })

  it("sigue filtrando por slugs legado sin familia canónica", () => {
    const legacyOnly = resolveLogoFamilySelection({ families_linked: false, families: ["corporativa"], directory })
    expect(logoMatchesFamily(legacyOnly, "corporativa")).toBe(true)
    expect(logoMatchesFamily(legacyOnly, "chamoy")).toBe(false)
  })
})

describe("validación de la selección", () => {
  it("separa ids desconocidos de familias inactivas", () => {
    expect(validateFamilySelection(directory, ["fam_chamoy", "fam_retirada", "fam_inexistente"])).toEqual({
      missing: ["fam_inexistente"],
      inactive: ["fam_retirada"],
    })
    expect(validateFamilySelection(directory, ["fam_chamoy"])).toEqual({ missing: [], inactive: [] })
  })

  it("acepta family_ids en el esquema y rechaza repetidos", () => {
    const base = { slug: "logo", name: "Logo", media_file_id: "file_demo", family_ids: ["fam_chamoy"] }
    expect(logoInputSchema.safeParse(base).success).toBe(true)
    expect(logoInputSchema.safeParse({ ...base, family_ids: ["fam_chamoy", "fam_chamoy"] }).success).toBe(false)
    expect(logoInputSchema.safeParse({ ...base, family_ids: "fam_chamoy" }).success).toBe(false)
    expect(updateLogoInputSchema.safeParse({ family_ids: [] }).success).toBe(true)
  })

  it("sigue rechazando campos desconocidos", () => {
    expect(logoInputSchema.safeParse({ slug: "logo", name: "Logo", media_file_id: "file_demo", family: "chamoy" }).success).toBe(false)
  })
})

describe("backfill de familias de logos", () => {
  it("mapea sólo coincidencias exactas por slug contra familias activas", () => {
    const plan = planLogoFamilyBackfill(
      [
        { id: "logo_1", families: ["chamoy", "corporativa", "chamoy"], families_linked: false },
        { id: "logo_2", families: ["retirada", "pinatero"], families_linked: false },
        { id: "logo_3", families: ["chamoy"], families_linked: true },
        { id: "logo_4", families: null, families_linked: false },
      ],
      directory,
    )

    expect(plan.mappings).toEqual([
      { logo_id: "logo_1", family_ids: ["fam_chamoy"], family_slugs: ["chamoy"] },
      { logo_id: "logo_2", family_ids: ["fam_pinatero"], family_slugs: ["pinatero"] },
    ])
    expect(plan.alreadyLinked).toBe(1)
    expect(plan.unmapped).toEqual([
      { logo_id: "logo_1", slug: "corporativa" },
      { logo_id: "logo_2", slug: "retirada" },
    ])
  })

  it("es idempotente al repetir el plan con los logos ya vinculados", () => {
    const first = planLogoFamilyBackfill(
      [{ id: "logo_1", families: ["chamoy"], families_linked: false }],
      directory,
    )
    expect(first.mappings).toHaveLength(1)

    const second = planLogoFamilyBackfill(
      [{ id: "logo_1", families: ["chamoy"], families_linked: true }],
      directory,
    )
    expect(second.mappings).toEqual([])
    expect(second.alreadyLinked).toBe(1)
  })
})

describe("directorio de familias", () => {
  it("lee solo la taxonomía del catálogo y normaliza los campos públicos", async () => {
    const listProductFamilies = jest.fn(async () => [
      { id: "fam_chamoy", slug: "chamoy", name: "Chamoy", active: true, sort_order: 1, extra: "ignorado" },
    ])
    const scope = { resolve: jest.fn(() => ({ listProductFamilies })) }

    await expect(loadBrandFamilyDirectory(scope)).resolves.toEqual([
      { id: "fam_chamoy", slug: "chamoy", name: "Chamoy", active: true },
    ])
    expect(listProductFamilies).toHaveBeenCalledWith({}, { order: { sort_order: "ASC", created_at: "ASC" } })
  })
})
