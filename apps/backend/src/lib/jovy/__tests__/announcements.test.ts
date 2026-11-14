import { announcementSettingsSchema } from "@jovy/lib/jovy/announcements"

describe("mensaje corporativo de anuncios", () => {
  it("exige el reemplazo completo de ambos idiomas", () => {
    expect(announcementSettingsSchema.safeParse({}).success).toBe(false)
    expect(announcementSettingsSchema.safeParse({ corporate_message_es: "Hola" }).success).toBe(false)
  })

  it("permite ocultar cada idioma con null", () => {
    expect(
      announcementSettingsSchema.safeParse({
        corporate_message_es: "Endulzamos tus momentos",
        corporate_message_en: null,
      }).success,
    ).toBe(true)

    expect(
      announcementSettingsSchema.safeParse({ corporate_message_es: null, corporate_message_en: null }).success,
    ).toBe(true)
  })

  it("recorta espacios y rechaza mensajes demasiado largos o vacíos", () => {
    expect(
      announcementSettingsSchema.parse({ corporate_message_es: "  Hola  ", corporate_message_en: "  Hi  " }),
    ).toEqual({ corporate_message_es: "Hola", corporate_message_en: "Hi" })

    expect(
      announcementSettingsSchema.safeParse({ corporate_message_es: "x".repeat(601), corporate_message_en: null }).success,
    ).toBe(false)
    expect(
      announcementSettingsSchema.safeParse({ corporate_message_es: "a", corporate_message_en: null }).success,
    ).toBe(false)
  })
})
