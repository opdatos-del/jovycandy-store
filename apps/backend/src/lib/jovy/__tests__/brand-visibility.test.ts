import { MedusaError } from "@medusajs/framework/utils"
import {
  MAX_VISIBLE_GALLERY_ITEMS,
  assertBrandVisibilityLimit,
  brandWindowEnd,
  brandWindowStart,
  galleryInputSchema,
  isBrandWindowActiveAt,
  isPublicBrandItem,
  maxSimultaneousBrandItems,
  reorderBrandSchema,
} from "@jovy/lib/jovy/brand"

type WindowInput = { status?: string; enabled?: boolean; starts_at?: string | null; ends_at?: string | null }

function window(input: WindowInput) {
  return { status: "published", enabled: true, starts_at: null, ends_at: null, ...input }
}

const T0 = "2026-12-01T00:00:00.000Z"
const T1 = "2026-12-01T01:00:00.000Z"
const T2 = "2026-12-01T02:00:00.000Z"
const T3 = "2026-12-01T03:00:00.000Z"
const T4 = "2026-12-01T04:00:00.000Z"

const baseGallery = { media_file_id: "file_demo" }

describe("ventanas de publicación de la galería", () => {
  it("permite hasta cuatro elementos simultáneos", () => {
    const four = Array.from({ length: MAX_VISIBLE_GALLERY_ITEMS }, () => window({ starts_at: T0, ends_at: T2 }))
    expect(maxSimultaneousBrandItems(four)).toBe(4)
    expect(() => assertBrandVisibilityLimit(four)).not.toThrow()

    const five = [...four, window({ starts_at: T0, ends_at: T2 })]
    expect(maxSimultaneousBrandItems(five)).toBe(5)
    expect(() => assertBrandVisibilityLimit(five)).toThrow(MedusaError)
    expect(() => assertBrandVisibilityLimit(five)).toThrow(
      "Casa Jovy Galería solo permite cuatro elementos activos publicados en el mismo periodo",
    )
  })

  it("ignora lo que no está publicado y activo", () => {
    const hidden = [
      window({ status: "draft", starts_at: T0, ends_at: T2 }),
      window({ status: "archived", starts_at: T0, ends_at: T2 }),
      window({ enabled: false, starts_at: T0, ends_at: T2 }),
    ]
    expect(maxSimultaneousBrandItems(hidden)).toBe(0)
    expect(() => assertBrandVisibilityLimit(hidden)).not.toThrow()
  })

  it("no suma ventanas disjuntas", () => {
    const items = [
      window({ starts_at: T0, ends_at: T1 }),
      window({ starts_at: T2, ends_at: T3 }),
      window({ starts_at: T4, ends_at: T4 }),
    ]
    expect(maxSimultaneousBrandItems(items)).toBe(1)
  })

  it("considera simultáneas dos ventanas contiguas en el borde compartido", () => {
    // Regla implementada: los intervalos son cerrados [starts_at, ends_at]; el
    // instante `a.ends_at == b.starts_at` pertenece a ambos elementos.
    const items = [window({ starts_at: T0, ends_at: T1 }), window({ starts_at: T1, ends_at: T2 })]
    expect(maxSimultaneousBrandItems(items)).toBe(2)
    expect(isBrandWindowActiveAt(items[0], Date.parse(T1))).toBe(true)
    expect(isBrandWindowActiveAt(items[1], Date.parse(T1))).toBe(true)
  })

  it("cuenta la ventana sin fin como abierta hasta el infinito", () => {
    const items = [window({ starts_at: T0 }), window({ starts_at: T1 })]
    expect(maxSimultaneousBrandItems(items)).toBe(2)
    expect(brandWindowEnd(items[0])).toBeGreaterThan(Date.parse("9999-01-01T00:00:00.000Z"))
  })

  it("cuenta la ventana sin inicio desde el principio de los tiempos", () => {
    const items = [window({ ends_at: T1 }), window({ ends_at: T2 })]
    expect(maxSimultaneousBrandItems(items)).toBe(2)
    expect(brandWindowStart(items[0])).toBeLessThan(Date.parse("0001-01-01T00:00:00.000Z"))
  })

  it("trata una ventana de duración cero como un único instante", () => {
    const zero = window({ starts_at: T1, ends_at: T1 })
    expect(isBrandWindowActiveAt(zero, Date.parse(T1))).toBe(true)
    expect(isBrandWindowActiveAt(zero, Date.parse(T1) + 1)).toBe(false)
    expect(maxSimultaneousBrandItems([zero])).toBe(1)
  })

  it("rechaza la quinta ventana que comparte sólo el borde final", () => {
    const ending = Array.from({ length: 4 }, () => window({ starts_at: T0, ends_at: T2 }))
    // Empieza exactamente cuando terminan las cuatro: el borde las hace simultáneas.
    expect(() => assertBrandVisibilityLimit([...ending, window({ starts_at: T2, ends_at: T3 })])).toThrow(MedusaError)
  })

  it("usa INVALID_DATA como tipo de error", () => {
    const five = Array.from({ length: 5 }, () => window({ starts_at: T0, ends_at: T1 }))
    try {
      assertBrandVisibilityLimit(five)
      throw new Error("debió fallar")
    } catch (error) {
      expect(error).toBeInstanceOf(MedusaError)
      expect((error as MedusaError).type).toBe(MedusaError.Types.INVALID_DATA)
    }
  })
})

describe("límites exactos de los intervalos temporales", () => {
  it("rechaza starts_at == ends_at", () => {
    const parsed = galleryInputSchema.safeParse({ ...baseGallery, starts_at: T0, ends_at: T0 })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.path).toEqual(["ends_at"])
  })

  it("rechaza un rango invertido", () => {
    expect(galleryInputSchema.safeParse({ ...baseGallery, starts_at: T2, ends_at: T1 }).success).toBe(false)
  })

  it("acepta un rango con un solo milisegundo de diferencia", () => {
    const parsed = galleryInputSchema.safeParse({
      ...baseGallery,
      starts_at: "2026-12-01T00:00:00.000Z",
      ends_at: "2026-12-01T00:00:00.001Z",
    })
    expect(parsed.success).toBe(true)
  })

  it("acepta ends_at ausente como ventana abierta", () => {
    const parsed = galleryInputSchema.safeParse({ ...baseGallery, starts_at: T0 })
    expect(parsed.success).toBe(true)
    expect(parsed.data?.ends_at).toBeUndefined()
  })

  it("acepta un inicio futuro sin fin", () => {
    expect(galleryInputSchema.safeParse({ ...baseGallery, starts_at: "2030-01-01T00:00:00.000Z" }).success).toBe(true)
  })

  it("acepta marcas con desplazamiento horario y las interpreta como UTC", () => {
    const parsed = galleryInputSchema.safeParse({
      ...baseGallery,
      starts_at: "2026-12-01T02:00:00+02:00",
      ends_at: "2026-12-01T04:00:00+02:00",
    })
    expect(parsed.success).toBe(true)
    expect(new Date(parsed.data!.starts_at!).toISOString()).toBe(T0)
    expect(new Date(parsed.data!.ends_at!).toISOString()).toBe(T2)
  })

  it("rechaza fechas sin zona horaria explícita", () => {
    expect(galleryInputSchema.safeParse({ ...baseGallery, starts_at: "2026-12-01T00:00:00" }).success).toBe(false)
  })
})

describe("reordenamiento de marca", () => {
  it("rechaza identificadores repetidos igual que marketing y eventos", () => {
    expect(reorderBrandSchema.safeParse({ ids: ["a", "b"] }).success).toBe(true)
    const duplicated = reorderBrandSchema.safeParse({ ids: ["a", "a"] })
    expect(duplicated.success).toBe(false)
    expect(duplicated.error?.issues[0]?.message).toBe("Los identificadores no deben repetirse")
  })
})

describe("visibilidad pública", () => {
  it("incluye los bordes exactos del intervalo", () => {
    const item = window({ starts_at: T1, ends_at: T2 })
    expect(isPublicBrandItem(item, new Date(T1))).toBe(true)
    expect(isPublicBrandItem(item, new Date(T2))).toBe(true)
    expect(isPublicBrandItem(item, new Date(Date.parse(T1) - 1))).toBe(false)
    expect(isPublicBrandItem(item, new Date(Date.parse(T2) + 1))).toBe(false)
  })

  it("no expone borradores, archivados ni desactivados", () => {
    expect(isPublicBrandItem(window({ status: "draft" }))).toBe(false)
    expect(isPublicBrandItem(window({ status: "archived" }))).toBe(false)
    expect(isPublicBrandItem(window({ enabled: false }))).toBe(false)
  })
})
