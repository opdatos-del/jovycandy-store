import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"
import type JovyMarketingModuleService from "@jovy/modules/jovy-marketing/service"

import { createPublishableApiKey, storeHeaders } from "./utils"

jest.setTimeout(120_000)

const DAY = 24 * 60 * 60 * 1_000

const heroTranslations = (title: string) => ({
  es: { title, description: "Descripción de prueba", cta_label: "Ver más" },
  en: { title: `${title} EN`, description: "Test description", cta_label: "See more" },
})

const bannerTranslations = (title: string) => ({
  es: { title, description: "Descripción de prueba", cta_label: "Ver más", alt: `${title} alt` },
  en: { title: `${title} EN`, description: "Test description", cta_label: "See more", alt: `${title} alt EN` },
})

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-marketing",
  testSuite: ({ api, getContainer }) => {
    let publishableApiKey: string

    beforeAll(async () => {
      publishableApiKey = await createPublishableApiKey(getContainer())
    })

    const marketingService = () => getContainer().resolve(JOVY_MARKETING_MODULE) as JovyMarketingModuleService

    const getHero = (key = publishableApiKey) =>
      api.get("/store/jovy/marketing/hero", { headers: storeHeaders(key), validateStatus: () => true })

    const getBanners = (slot: string, key = publishableApiKey) =>
      api.get(`/store/jovy/marketing/banners/${slot}`, {
        headers: storeHeaders(key),
        validateStatus: () => true,
      })

    it("expone solo los Hero publicados, habilitados y dentro de la ventana, en orden", async () => {
      const now = Date.now()
      const created = await marketingService().createHeroItems([
        { translations: heroTranslations("Segundo visible"), status: "published", enabled: true, sort_order: 2 },
        { translations: heroTranslations("Primero visible"), status: "published", enabled: true, sort_order: 1 },
        { translations: heroTranslations("Borrador"), status: "draft", enabled: true, sort_order: 0 },
        { translations: heroTranslations("Archivado"), status: "archived", enabled: true, sort_order: 0 },
        { translations: heroTranslations("Deshabilitado"), status: "published", enabled: false, sort_order: 0 },
        {
          translations: heroTranslations("Programado"),
          status: "published",
          enabled: true,
          sort_order: 0,
          starts_at: new Date(now + DAY),
        },
        {
          translations: heroTranslations("Expirado"),
          status: "published",
          enabled: true,
          sort_order: 0,
          ends_at: new Date(now - DAY),
        },
      ])

      const response = await getHero()
      expect(response.status).toBe(200)

      const titles = (response.data.hero_items as Array<{ translations: { es: { title: string } } }>).map(
        (item) => item.translations.es.title,
      )
      expect(titles).toEqual(["Primero visible", "Segundo visible"])

      const visibleIds = (response.data.hero_items as Array<{ id: string }>).map((item) => item.id)
      for (const hidden of created.slice(2)) {
        expect(visibleIds).not.toContain(hidden.id)
      }
      expect(visibleIds).toEqual([created[1].id, created[0].id])

      // Editorial state is internal and must not leak through the Store contract.
      for (const item of response.data.hero_items as Array<Record<string, unknown>>) {
        expect(Object.keys(item).sort()).toEqual([
          "background_color",
          "cta_url",
          "id",
          "media_file_id",
          "media_url",
          "sort_order",
          "translations",
        ])
      }
    })

    it("expone solo los banners vigentes del slot pedido y ordena por prioridad y posición", async () => {
      const now = Date.now()
      await marketingService().createMarketingBanners([
        {
          slot: "promo",
          translations: bannerTranslations("Prioridad baja"),
          status: "published",
          priority: 0,
          sort_order: 0,
        },
        {
          slot: "promo",
          translations: bannerTranslations("Prioridad alta, posición 1"),
          status: "published",
          priority: 10,
          sort_order: 1,
        },
        {
          slot: "promo",
          translations: bannerTranslations("Prioridad alta, posición 0"),
          status: "published",
          priority: 10,
          sort_order: 0,
        },
        { slot: "promo", translations: bannerTranslations("Borrador"), status: "draft", priority: 50 },
        { slot: "promo", translations: bannerTranslations("Archivado"), status: "archived", priority: 50 },
        {
          slot: "promo",
          translations: bannerTranslations("Deshabilitado"),
          status: "published",
          enabled: false,
          priority: 50,
        },
        {
          slot: "promo",
          translations: bannerTranslations("Programado"),
          status: "published",
          priority: 50,
          starts_at: new Date(now + DAY),
        },
        {
          slot: "promo",
          translations: bannerTranslations("Expirado"),
          status: "published",
          priority: 50,
          ends_at: new Date(now - DAY),
        },
        { slot: "hint", translations: bannerTranslations("Otro slot"), status: "published", priority: 100 },
      ])

      const response = await getBanners("promo")
      expect(response.status).toBe(200)

      const titles = (response.data.banners as Array<{ translations: { es: { title: string } } }>).map(
        (banner) => banner.translations.es.title,
      )
      expect(titles).toEqual([
        "Prioridad alta, posición 0",
        "Prioridad alta, posición 1",
        "Prioridad baja",
      ])

      for (const banner of response.data.banners as Array<Record<string, unknown>>) {
        expect(Object.keys(banner).sort()).toEqual([
          "auto_open",
          "cta_url",
          "frequency",
          "id",
          "media_file_id",
          "media_url",
          "priority",
          "sort_order",
          "translations",
        ])
      }
    })

    it("responde 404 para un slot desconocido", async () => {
      const response = await getBanners("sidebar")

      expect(response.status).toBe(404)
      expect(response.data).toEqual({ message: "Slot no encontrado" })
    })

    it("exige una publishable key válida en las rutas de marketing", async () => {
      const heroWithoutKey = await api.get("/store/jovy/marketing/hero", { validateStatus: () => true })
      expect(heroWithoutKey.status).toBe(400)
      expect(heroWithoutKey.data.type).toBe("not_allowed")

      const bannersWithoutKey = await api.get("/store/jovy/marketing/banners/promo", {
        validateStatus: () => true,
      })
      expect(bannersWithoutKey.status).toBe(400)

      const invalidKey = await getHero("pk_invalid_key_for_tests")
      expect(invalidKey.status).toBe(400)
      expect(invalidKey.data.type).toBe("not_allowed")
    })
  },
})
