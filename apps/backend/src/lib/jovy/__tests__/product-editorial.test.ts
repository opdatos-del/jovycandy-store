import {
  GRAMAJE_MAX_LENGTH,
  PRODUCT_CERTIFICATIONS,
  compareProductEditorialOrder,
  findEditorialFamily,
  isEditorialProductPublic,
  productEditorialInputSchema,
  productPresentationCategoryKeys,
  productPublishIssues,
  resolveEditorialFamily,
  resolveEditorialPublishedAt,
  type EditorialCatalogueCategory,
  type EditorialCatalogueFamily,
} from "@jovy/lib/jovy/product-editorial"

const families: EditorialCatalogueFamily[] = [
  { id: "fam_chamoy", slug: "chamoy", name: "Chamoy", medusa_category_id: "pcat_chamoy", active: true },
  { id: "fam_gomitas", slug: "gomitas", name: "Gomitas", medusa_category_id: "pcat_gomitas", active: true },
]

const categories: EditorialCatalogueCategory[] = [
  { key: "chamoy", medusa_category_id: "pcat_chamoy", active: true },
  { key: "gomitas_almidon", medusa_category_id: "pcat_gomitas", active: true },
  { key: "pinatero", medusa_category_id: null, active: true },
]

describe("validación de la ficha editorial", () => {
  it("acepta un cuerpo vacío para el upsert parcial", () => {
    expect(productEditorialInputSchema.safeParse({}).success).toBe(true)
  })

  it("limita el gramaje a 50 caracteres y lo recorta", () => {
    expect(productEditorialInputSchema.parse({ gramaje: "  250 g  " }).gramaje).toBe("250 g")
    expect(
      productEditorialInputSchema.safeParse({ gramaje: "x".repeat(GRAMAJE_MAX_LENGTH) }).success,
    ).toBe(true)
    expect(
      productEditorialInputSchema.safeParse({ gramaje: "x".repeat(GRAMAJE_MAX_LENGTH + 1) }).success,
    ).toBe(false)
    expect(productEditorialInputSchema.parse({ gramaje: null }).gramaje).toBeNull()
  })

  it("solo acepta certificaciones del catálogo permitido, sin repetir", () => {
    expect(productEditorialInputSchema.parse({ certifications: [...PRODUCT_CERTIFICATIONS] }).certifications).toEqual([
      "SGS",
      "OU Kosher",
      "Halal",
    ])
    expect(productEditorialInputSchema.parse({ certifications: [] }).certifications).toEqual([])
    expect(productEditorialInputSchema.safeParse({ certifications: ["SGS"] }).success).toBe(true)
    expect(productEditorialInputSchema.safeParse({ certifications: ["Orgánico"] }).success).toBe(false)
    expect(productEditorialInputSchema.safeParse({ certifications: ["SGS", "SGS"] }).success).toBe(false)
  })

  it("rechaza estados editoriales fuera del enum", () => {
    for (const value of ["draft", "published", "archived"]) {
      expect(productEditorialInputSchema.safeParse({ editorial_status: value }).success).toBe(true)
    }
    for (const value of ["live", "", "PUBLISHED", null]) {
      expect(productEditorialInputSchema.safeParse({ editorial_status: value }).success).toBe(false)
    }
  })

  it("valida tipos y rechaza claves desconocidas", () => {
    expect(productEditorialInputSchema.safeParse({ sort_order: -1 }).success).toBe(false)
    expect(productEditorialInputSchema.safeParse({ sort_order: 1.5 }).success).toBe(false)
    expect(productEditorialInputSchema.safeParse({ is_new: "sí" }).success).toBe(false)
    expect(productEditorialInputSchema.safeParse({ product_id: "prod_1" }).success).toBe(false)
    expect(productEditorialInputSchema.safeParse({ price: 10 }).success).toBe(false)
  })

  it("no inyecta valores por defecto en un guardado parcial", () => {
    expect(productEditorialInputSchema.parse({ is_new: true })).toEqual({ is_new: true })
  })
})

describe("familia efectiva del producto", () => {
  it("prefiere el Module Link sobre la categoría comercial", () => {
    const product = {
      id: "prod_1",
      categories: [{ id: "pcat_chamoy" }],
      jovy_product_family: { id: "fam_gomitas" },
    }
    expect(resolveEditorialFamily(product, families)?.id).toBe("fam_gomitas")
  })

  it("deriva la familia de la primera categoría mapeada cuando no hay vínculo", () => {
    const product = { id: "prod_1", categories: [{ id: "pcat_sin_familia" }, { id: "pcat_gomitas" }] }
    expect(resolveEditorialFamily(product, families)?.slug).toBe("gomitas")
  })

  it("no inventa familia cuando nada está mapeado", () => {
    expect(resolveEditorialFamily({ id: "prod_1", categories: [{ id: "pcat_otro" }] }, families)).toBeNull()
    expect(resolveEditorialFamily({ id: "prod_1" }, families)).toBeNull()
    expect(resolveEditorialFamily(null, families)).toBeNull()
  })

  it("resuelve el filtro por id canónico o slug histórico", () => {
    expect(findEditorialFamily(families, "fam_chamoy")?.slug).toBe("chamoy")
    expect(findEditorialFamily(families, " chamoy ")?.id).toBe("fam_chamoy")
    expect(findEditorialFamily(families, "chamoy-viejo")).toBeNull()
    expect(findEditorialFamily(families, "")).toBeNull()
  })
})

describe("categorías de presentación del producto", () => {
  it("solo expone claves de tarjetas mapeadas a las categorías comerciales del producto", () => {
    const product = { id: "prod_1", categories: [{ id: "pcat_chamoy" }] }
    expect(productPresentationCategoryKeys(product, categories)).toEqual(["chamoy"])
    expect(productPresentationCategoryKeys({ id: "prod_1" }, categories)).toEqual([])
    expect(productPresentationCategoryKeys(null, categories)).toEqual([])
    // Una tarjeta sin `medusa_category_id` no agrupa productos.
    expect(productPresentationCategoryKeys(product, [{ key: "pinatero", medusa_category_id: null }])).toEqual([])
  })
})

describe("regla histórica de publicación", () => {
  const complete = {
    id: "prod_1",
    title: "Chamoy 250 g",
    thumbnail: "https://example.test/chamoy.png",
    categories: [{ id: "pcat_chamoy" }],
    jovy_product_family: { id: "fam_chamoy" },
  }

  it("no exige gramaje ni certificaciones", () => {
    expect(productPublishIssues(complete, categories, families)).toEqual([])
  })

  it("enumera lo que falta en el orden histórico", () => {
    expect(productPublishIssues({ id: "prod_1" }, categories, families)).toEqual([
      "categoría de presentación",
      "familia",
      "nombre",
      "imagen principal",
    ])
    expect(productPublishIssues(complete, [], families)).toEqual(["categoría de presentación"])
    expect(productPublishIssues(complete, categories, [])).toEqual(["familia"])
    expect(productPublishIssues({ ...complete, title: "  " }, categories, families)).toEqual(["nombre"])
    expect(productPublishIssues({ ...complete, thumbnail: null }, categories, families)).toEqual(["imagen principal"])
  })

  it("exige un producto comercial existente", () => {
    expect(productPublishIssues(null, categories, families)).toEqual(["producto comercial"])
  })

  it("una tarjeta oculta sigue siendo una categoría válida para publicar", () => {
    // `active` controla la tarjeta en Store, no el estado editorial del producto:
    // ocultarla no bloquea la publicación, solo su presentación.
    const hidden = categories.map((category) => ({ ...category, active: false }))
    expect(productPublishIssues(complete, hidden, families)).toEqual([])
  })

  it("publica solo el estado published", () => {
    expect(isEditorialProductPublic({ editorial_status: "published" })).toBe(true)
    expect(isEditorialProductPublic({ editorial_status: "draft" })).toBe(false)
    expect(isEditorialProductPublic({ editorial_status: "archived" })).toBe(false)
  })
})

describe("fecha de publicación editorial", () => {
  const now = new Date("2026-11-13T18:00:00.000Z")

  it("conserva la fecha original al guardar una ficha ya publicada", () => {
    const original = "2026-11-01T09:30:00.000Z"
    expect(
      resolveEditorialPublishedAt({ editorial_status: "published", published_at: original }, "published", now),
    ).toEqual(new Date(original))
  })

  it("asigna fecha sólo al transicionar a published", () => {
    expect(resolveEditorialPublishedAt({ editorial_status: "draft", published_at: null }, "published", now)).toEqual(now)
    expect(
      resolveEditorialPublishedAt({ editorial_status: "archived", published_at: null }, "published", now),
    ).toEqual(now)
    expect(
      resolveEditorialPublishedAt({ editorial_status: "published", published_at: "2026-11-01T00:00:00.000Z" }, "draft", now),
    ).toBeNull()
    expect(
      resolveEditorialPublishedAt({ editorial_status: "published", published_at: "2026-11-01T00:00:00.000Z" }, "archived", now),
    ).toBeNull()
  })

  it("repara una ficha publicada sin fecha válida", () => {
    expect(resolveEditorialPublishedAt({ editorial_status: "published", published_at: null }, "published", now)).toEqual(now)
    expect(
      resolveEditorialPublishedAt({ editorial_status: "published", published_at: "no-es-fecha" }, "published", now),
    ).toEqual(now)
  })
})

describe("orden editorial", () => {
  it("ordena por sort_order, luego creación e id", () => {
    const records = [
      { id: "b", sort_order: 1, created_at: "2026-11-13T10:00:00.000Z" },
      { id: "a", sort_order: 0, created_at: "2026-11-13T12:00:00.000Z" },
      { id: "c", sort_order: 1, created_at: "2026-11-13T09:00:00.000Z" },
      { id: "d", sort_order: 1, created_at: "2026-11-13T09:00:00.000Z" },
    ].sort(compareProductEditorialOrder)

    expect(records.map((record) => record.id)).toEqual(["a", "c", "d", "b"])
  })
})
