import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

import { JOVY_CONTENT_MODULE } from "@jovy/modules/jovy-content"
import type JovyContentModuleService from "@jovy/modules/jovy-content/service"

import { adminHeaders, createAdminSession, createPublishableApiKey, storeHeaders } from "./utils"

jest.setTimeout(120_000)

const TRANSLATIONS = {
  es: { title: "Página de prueba", excerpt: "Resumen de prueba", body: "Contenido editorial de prueba." },
  en: { title: "Test page", excerpt: "Test excerpt", body: "Test editorial content." },
}

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-content",
  testSuite: ({ api, getContainer }) => {
    let publishableApiKey: string
    let adminToken: string

    beforeAll(async () => {
      publishableApiKey = await createPublishableApiKey(getContainer())
      adminToken = await createAdminSession(getContainer(), api)
    })

    const getPage = (slug: string, key = publishableApiKey) =>
      api.get(`/store/jovy/content/pages/${slug}`, {
        headers: storeHeaders(key),
        validateStatus: () => true,
      })

    const adminConfig = () => ({ headers: adminHeaders(adminToken), validateStatus: () => true })

    const admin = (method: "post" | "put", url: string, body?: unknown) =>
      api[method](url, body, adminConfig())

    // `axios.delete` takes the config as its second argument, unlike post/put.
    const adminDelete = (url: string) => api.delete(url, adminConfig())

    it("publica una página por el ciclo admin y solo la expone cuando está publicada", async () => {
      const slug = "pagina-de-prueba"

      const created = await admin("post", "/admin/jovy/content/pages", {
        slug,
        status: "draft",
        translations: TRANSLATIONS,
        seo: { es: { title: "SEO de prueba" } },
      })

      expect(created.status).toBe(201)
      const pageId = created.data.page.id as string

      const draft = await getPage(slug)
      expect(draft.status).toBe(404)
      expect(draft.data).toEqual({ message: "Contenido no encontrado" })

      const published = await admin("put", `/admin/jovy/content/pages/${pageId}`, { status: "published" })
      expect(published.status).toBe(200)

      const visible = await getPage(slug)
      expect(visible.status).toBe(200)
      expect(visible.data.page.slug).toBe(slug)
      expect(visible.data.page.translations).toEqual(TRANSLATIONS)
      expect(visible.data.page.seo).toEqual({ es: { title: "SEO de prueba" } })
      expect(visible.data.page.published_at).toBeTruthy()
      expect(visible.data.page.updated_at).toBeTruthy()
      // Editorial state must not leak through the public contract.
      expect(Object.keys(visible.data.page).sort()).toEqual(
        ["published_at", "seo", "slug", "translations", "updated_at"],
      )

      const archived = await admin("put", `/admin/jovy/content/pages/${pageId}`, { status: "archived" })
      expect(archived.status).toBe(200)

      const hidden = await getPage(slug)
      expect(hidden.status).toBe(404)

      const removed = await adminDelete(`/admin/jovy/content/pages/${pageId}`)
      expect(removed.status).toBe(204)

      const gone = await getPage(slug)
      expect(gone.status).toBe(404)
    })

    it("oculta una página publicada con published_at en el futuro", async () => {
      const slug = "pagina-futura"

      const created = await admin("post", "/admin/jovy/content/pages", {
        slug,
        status: "published",
        translations: TRANSLATIONS,
        published_at: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
      })
      expect(created.status).toBe(201)

      const response = await getPage(slug)
      expect(response.status).toBe(404)

      const removed = await adminDelete(`/admin/jovy/content/pages/${created.data.page.id}`)
      expect(removed.status).toBe(204)
    })

    it("expone una página publicada sin published_at y responde 404 para un slug desconocido", async () => {
      const contentService = getContainer().resolve(JOVY_CONTENT_MODULE) as JovyContentModuleService
      const page = await contentService.createEditorialPages({
        slug: "pagina-sin-fecha",
        status: "published",
        translations: TRANSLATIONS,
        published_at: null,
      })

      const visible = await getPage("pagina-sin-fecha")
      expect(visible.status).toBe(200)
      expect(visible.data.page.slug).toBe("pagina-sin-fecha")

      const missing = await getPage("no-existe")
      expect(missing.status).toBe(404)
      expect(missing.data).toEqual({ message: "Contenido no encontrado" })

      await contentService.deleteEditorialPages(page.id)
    })

    it("exige una publishable key válida en el namespace /store", async () => {
      const withoutKey = await api.get("/store/jovy/content/pages/cualquier-slug", {
        validateStatus: () => true,
      })
      expect(withoutKey.status).toBe(400)
      expect(withoutKey.data.type).toBe("not_allowed")

      const invalidKey = await getPage("cualquier-slug", "pk_invalid_key_for_tests")
      expect(invalidKey.status).toBe(400)
      expect(invalidKey.data.type).toBe("not_allowed")
    })
  },
})
