import {
  compareLaunchOrder,
  isLaunchVisible,
  launchAssetIssues,
  launchInputSchema,
  launchSettingsSchema,
  updateLaunchInputSchema,
} from "@jovy/lib/jovy/launches"

describe("reglas de lanzamientos", () => {
  it("exige título obligatorio", () => {
    expect(launchInputSchema.safeParse({ product_id: "prod_1" }).success).toBe(false)
    expect(launchInputSchema.safeParse({ title: "", product_id: "prod_1" }).success).toBe(false)
    expect(launchInputSchema.safeParse({ title: "Nuevo sabor", product_id: "prod_1" }).success).toBe(true)
  })

  it("exige producto o imagen", () => {
    expect(launchAssetIssues({})).toEqual(["producto o imagen"])
    expect(launchAssetIssues({ product_id: "prod_1" })).toEqual([])
    expect(launchAssetIssues({ image_file_id: "file_1" })).toEqual([])
    expect(launchAssetIssues({ image_url: "https://example.test/a.png" })).toEqual([])

    const parsed = launchInputSchema.safeParse({ title: "Nuevo sabor" })
    expect(parsed.success).toBe(false)
    expect(parsed.success ? [] : parsed.error.flatten().fieldErrors.product_id).toEqual([
      "Un lanzamiento requiere un producto o una imagen",
    ])
  })

  it("acepta imagen propia y producto a la vez sin copiar datos comerciales", () => {
    const parsed = launchInputSchema.parse({
      title: "Nuevo sabor",
      product_id: "prod_1",
      image_file_id: "file_1",
      image_url: "https://example.test/a.png",
    })
    expect(parsed).toMatchObject({ active: true, sort_order: 0, product_id: "prod_1" })
    expect(Object.keys(parsed)).not.toContain("price")
    expect(Object.keys(parsed)).not.toContain("sku")
  })

  it("rechaza imágenes externas sin HTTPS", () => {
    expect(launchInputSchema.safeParse({ title: "Nuevo sabor", image_url: "http://example.test/a.png" }).success).toBe(false)
  })

  it("no restaura valores por defecto en un PATCH parcial", () => {
    expect(updateLaunchInputSchema.parse({ active: false })).toEqual({ active: false })
  })

  it("solo publica lanzamientos activos", () => {
    expect(isLaunchVisible({ active: true })).toBe(true)
    expect(isLaunchVisible({ active: false })).toBe(false)
  })
})

describe("configuración de color de lanzamientos", () => {
  it("acepta hexadecimal de 3 o 6 dígitos", () => {
    expect(launchSettingsSchema.safeParse({ background_color: "#00AFAA" }).success).toBe(true)
    expect(launchSettingsSchema.safeParse({ background_color: "#0AF" }).success).toBe(true)
  })

  it("rechaza colores fuera del formato hexadecimal", () => {
    for (const value of ["00AFAA", "#00AF", "#GGGGGG", "teal", "#00AFAA80"]) {
      expect(launchSettingsSchema.safeParse({ background_color: value }).success).toBe(false)
    }
  })
})

describe("orden de lanzamientos", () => {
  it("ordena por sort_order, luego por creación e id", () => {
    const launches = [
      { id: "b", sort_order: 1, created_at: "2026-11-13T10:00:00.000Z" },
      { id: "a", sort_order: 0, created_at: "2026-11-13T12:00:00.000Z" },
      { id: "c", sort_order: 1, created_at: "2026-11-13T09:00:00.000Z" },
    ].sort(compareLaunchOrder)

    expect(launches.map((launch) => launch.id)).toEqual(["a", "c", "b"])
  })
})
