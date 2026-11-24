import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"

import { createAdminSession, adminHeaders, createPublishableApiKey, storeHeaders } from "./utils"

jest.setTimeout(120_000)

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLfkQAAAABJRU5ErkJggg==",
  "base64",
)

type Category = {
  id: string
  key: string
  name: string
  active: boolean
  coming_soon: boolean
  interaction_locked: boolean
  sort_order: number
  image_url: string | null
}

type Family = { id: string; slug: string; name: string; active: boolean; product_ids?: string[] }

type Launch = { id: string; title: string; product_id: string | null; image_url: string | null; sort_order: number }

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-catalogue-launches",
  testSuite: ({ api, getContainer }) => {
    let adminToken: string
    let publishableApiKey: string

    beforeAll(async () => {
      publishableApiKey = await createPublishableApiKey(getContainer())
      adminToken = await createAdminSession(getContainer(), api)
    })

    const adminConfig = () => ({ headers: adminHeaders(adminToken), validateStatus: () => true })

    const adminGet = (url: string, params?: Record<string, unknown>) =>
      api.get(url, { ...adminConfig(), params })

    const adminSend = (method: "post" | "put", url: string, body?: unknown) =>
      api[method](url, body, adminConfig())

    const adminDelete = (url: string) => api.delete(url, adminConfig())

    const store = (url: string, params?: Record<string, unknown>, key = publishableApiKey) =>
      api.get(url, { headers: storeHeaders(key), params, validateStatus: () => true })

    const seedCategories = async () => adminSend("post", "/admin/jovy/catalogue/categories/seed")

    const categoryByKey = (categories: Category[], key: string) => {
      const category = categories.find((candidate) => candidate.key === key)
      expect(category).toBeTruthy()
      return category as Category
    }

    const createProductCategory = async (name: string, handle: string) => {
      const productService = getContainer().resolve(Modules.PRODUCT)
      return productService.createProductCategories({ name, handle, is_active: true })
    }

    const createFile = async (filename: string, mimeType: string, content: Buffer) => {
      const files = getContainer().resolve(Modules.FILE)
      return files.createFiles({ filename, mimeType, content: content.toString("base64"), access: "public" })
    }

    const linkPublicFamily = async (key: string, suffix: string) => {
      const seeded = await seedCategories()
      const category = categoryByKey(seeded.data.categories as Category[], key)
      const commercial = await createProductCategory(`Categoría ${suffix}`, `categoria-${suffix}`)
      expect(await adminSend("put", `/admin/jovy/catalogue/categories/${category.id}`, {
        medusa_category_id: commercial.id,
      })).toMatchObject({ status: 200 })
      const created = await adminSend("post", "/admin/jovy/catalogue/families", {
        name: `Familia ${suffix}`,
        slug: `familia-${suffix}`,
        medusa_category_id: commercial.id,
      })
      expect(created.status).toBe(201)
      const publicFamilies = await store("/store/jovy/catalogue/families", { category_key: category.key })
      expect(publicFamilies.status).toBe(200)
      expect(publicFamilies.data.families).toContainEqual(expect.objectContaining({ id: created.data.family.id }))
      return { category, family: created.data.family as Family }
    }

    it("exige una sesión de administrador en las rutas nuevas", async () => {
      expect((await api.get("/admin/jovy/catalogue/categories", { validateStatus: () => true })).status).toBe(401)
      expect((await api.get("/admin/jovy/catalogue/families", { validateStatus: () => true })).status).toBe(401)
      expect((await api.get("/admin/jovy/launches", { validateStatus: () => true })).status).toBe(401)
      expect(
        (await api.get("/admin/jovy/announcements/settings", { validateStatus: () => true })).status,
      ).toBe(401)
      expect(
        (await api.put("/admin/jovy/announcements/settings", {}, { validateStatus: () => true })).status,
      ).toBe(401)
    })

    it("siembra las seis categorías una sola vez y no pisa ediciones", async () => {
      const first = await seedCategories()
      expect(first.status).toBe(200)
      expect(first.data.created).toBe(6)
      expect((first.data.categories as Category[]).map((category) => category.key)).toEqual([
        "sazonador",
        "chamoy",
        "gomitas_almidon",
        "dulces_paletas",
        "pinatero",
        "gomitas_grenetina",
      ])

      const sazonador = categoryByKey(first.data.categories as Category[], "sazonador")
      const edited = await adminSend("put", `/admin/jovy/catalogue/categories/${sazonador.id}`, {
        name: "Sazonador premium",
        image_url: "https://example.test/sazonador.png",
      })
      expect(edited.status).toBe(200)
      expect(edited.data.category.name).toBe("Sazonador premium")

      const second = await seedCategories()
      expect(second.data.created).toBe(0)
      expect(categoryByKey(second.data.categories as Category[], "sazonador").name).toBe("Sazonador premium")

      const storeResponse = await store("/store/jovy/catalogue/categories")
      expect(storeResponse.status).toBe(200)
      const publicSazonador = categoryByKey(storeResponse.data.categories as Category[], "sazonador")
      expect(publicSazonador.image_url).toBe("https://example.test/sazonador.png")
    })

    it("normaliza próximamente, no lo publica y protege lecturas de filas históricas", async () => {
      const { category: chamoy, family } = await linkPublicFamily("chamoy", "upcoming-transition")

      const locked = await adminSend("put", `/admin/jovy/catalogue/categories/${chamoy.id}`, {
        coming_soon: true,
        interaction_locked: false,
      })
      expect(locked.status).toBe(200)
      expect(locked.data.category).toMatchObject({ active: false, coming_soon: true, interaction_locked: true })

      const visible = await store("/store/jovy/catalogue/categories")
      expect((visible.data.categories as Category[]).map((category) => category.key)).not.toContain("chamoy")
      const lockedFamilies = await store("/store/jovy/catalogue/families", { category_key: "chamoy" })
      expect(lockedFamilies.data.families).toEqual([])

      const reloadedWhileUpcoming = await adminGet(`/admin/jovy/catalogue/categories/${chamoy.id}`)
      expect(reloadedWhileUpcoming.data.category).toMatchObject({
        active: false,
        coming_soon: true,
        interaction_locked: true,
      })

      // Simula una fila escrita antes del invariante. No se muta durante la
      // lectura, pero Admin y Store aplican el estado efectivo histórico.
      const catalogue = getContainer().resolve(JOVY_CATALOGUE_MODULE) as {
        updateCatalogueCategories: (input: Record<string, unknown>) => Promise<unknown>
      }
      await catalogue.updateCatalogueCategories({
        id: chamoy.id,
        active: true,
        coming_soon: true,
        interaction_locked: false,
      })
      const adminCategories = await adminGet("/admin/jovy/catalogue/categories")
      expect(categoryByKey(adminCategories.data.categories as Category[], "chamoy")).toMatchObject({
        active: false,
        coming_soon: true,
        interaction_locked: true,
      })
      const historicalStore = await store("/store/jovy/catalogue/categories")
      expect((historicalStore.data.categories as Category[]).map((category) => category.key)).not.toContain("chamoy")

      const unmarked = await adminSend("put", `/admin/jovy/catalogue/categories/${chamoy.id}`, {
        coming_soon: false,
      })
      expect(unmarked.data.category).toMatchObject({ active: true, coming_soon: false, interaction_locked: false })
      const reloadedAfterUnmark = await adminGet(`/admin/jovy/catalogue/categories/${chamoy.id}`)
      expect(reloadedAfterUnmark.data.category).toMatchObject({
        active: true,
        coming_soon: false,
        interaction_locked: false,
      })
      const afterRestore = await store("/store/jovy/catalogue/categories")
      expect(categoryByKey(afterRestore.data.categories as Category[], "chamoy")).toMatchObject({
        active: true,
        coming_soon: false,
        interaction_locked: false,
      })
      const restoredFamilies = await store("/store/jovy/catalogue/families", { category_key: "chamoy" })
      expect(restoredFamilies.data.families).toContainEqual(expect.objectContaining({ id: family.id }))
    })

    it("valida payloads y el enlace lógico a la categoría comercial", async () => {
      const seeded = await seedCategories()
      const pinatero = categoryByKey(seeded.data.categories as Category[], "pinatero")

      const shortName = await adminSend("put", `/admin/jovy/catalogue/categories/${pinatero.id}`, { name: "a" })
      expect(shortName.status).toBe(400)

      const insecureImage = await adminSend("put", `/admin/jovy/catalogue/categories/${pinatero.id}`, {
        image_url: "http://example.test/pinatero.png",
      })
      expect(insecureImage.status).toBe(400)

      const unknownCategory = await adminSend("put", `/admin/jovy/catalogue/categories/${pinatero.id}`, {
        medusa_category_id: "pcat_missing",
      })
      expect(unknownCategory.status).toBe(404)

      const commercial = await createProductCategory("Piñatero", "pinatero")
      const linked = await adminSend("put", `/admin/jovy/catalogue/categories/${pinatero.id}`, {
        medusa_category_id: commercial.id,
      })
      expect(linked.status).toBe(200)
      expect(linked.data.category.medusa_category_id).toBe(commercial.id)

      const missingCategory = await adminSend("put", "/admin/jovy/catalogue/categories/jcat_missing", {
        name: "Fantasma",
      })
      expect(missingCategory.status).toBe(404)
    })

    it("valida image_file_id del catálogo contra el File Module", async () => {
      const seeded = await seedCategories()
      const sazonador = categoryByKey(seeded.data.categories as Category[], "sazonador")
      const image = await createFile("categoria.png", "image/png", PNG)
      const text = await createFile("categoria.txt", "text/plain", Buffer.from("no soy una imagen", "utf8"))

      const saved = await adminSend("put", `/admin/jovy/catalogue/categories/${sazonador.id}`, {
        image_file_id: image.id,
      })
      expect(saved.status).toBe(200)
      expect(saved.data.category.image_file_id).toBe(image.id)

      const missing = await adminSend("put", `/admin/jovy/catalogue/categories/${sazonador.id}`, {
        image_file_id: "jovy-missing.png",
      })
      expect(missing.status).toBe(400)
      expect(missing.data.message).toBe("El archivo de imagen no existe")
      // No persiste: la categoría conserva la imagen válida anterior.
      expect((await adminGet(`/admin/jovy/catalogue/categories/${sazonador.id}`)).data.category.image_file_id).toBe(
        image.id,
      )

      const notImage = await adminSend("put", `/admin/jovy/catalogue/categories/${sazonador.id}`, {
        image_file_id: text.id,
      })
      expect(notImage.status).toBe(400)
      expect(notImage.data.message).toBe("El archivo de imagen no es una imagen PNG, JPEG o WebP")
      expect((await adminGet(`/admin/jovy/catalogue/categories/${sazonador.id}`)).data.category.image_file_id).toBe(
        image.id,
      )

      const cleared = await adminSend("put", `/admin/jovy/catalogue/categories/${sazonador.id}`, {
        image_file_id: null,
      })
      expect(cleared.status).toBe(200)
      expect(cleared.data.category.image_file_id).toBeNull()
    })

    it("reordena categorías y rechaza identificadores repetidos", async () => {
      const seeded = await seedCategories()
      const categories = seeded.data.categories as Category[]
      const reversed = [...categories].reverse().map((category) => category.id)

      const reordered = await adminSend("post", "/admin/jovy/catalogue/categories/reorder", { ids: reversed })
      expect(reordered.status).toBe(200)

      const visible = await store("/store/jovy/catalogue/categories")
      expect((visible.data.categories as Category[]).map((category) => category.id)).toEqual(reversed)

      const duplicated = await adminSend("post", "/admin/jovy/catalogue/categories/reorder", {
        ids: [reversed[0], reversed[0]],
      })
      expect(duplicated.status).toBe(400)

      // La reordenación es otra vía de escritura: repara solo las filas que
      // toca si provienen de datos anteriores al invariante.
      const catalogue = getContainer().resolve(JOVY_CATALOGUE_MODULE) as {
        listCatalogueCategories: (filters: Record<string, unknown>) => Promise<Category[]>
        updateCatalogueCategories: (input: Record<string, unknown>) => Promise<unknown>
      }
      const legacy = categories[0]
      await catalogue.updateCatalogueCategories({
        id: legacy.id,
        active: true,
        coming_soon: true,
        interaction_locked: false,
      })
      expect((await adminSend("post", "/admin/jovy/catalogue/categories/reorder", { ids: reversed })).status).toBe(200)
      const [stored] = await catalogue.listCatalogueCategories({ id: legacy.id })
      expect(stored).toMatchObject({ active: false, coming_soon: true, interaction_locked: true })
    })

    it("lista familias por categoría y publica solo las activas", async () => {
      const seeded = await seedCategories()
      const sazonador = categoryByKey(seeded.data.categories as Category[], "sazonador")
      const gomitas = await createProductCategory("Gomitas", "gomitas")
      await adminSend("put", `/admin/jovy/catalogue/categories/${sazonador.id}`, {
        medusa_category_id: gomitas.id,
      })

      const created = await adminSend("post", "/admin/jovy/catalogue/families", {
        name: "Gomitas de grenetina",
        slug: "gomitas-de-grenetina",
        medusa_category_id: gomitas.id,
        sort_order: 1,
      })
      expect(created.status).toBe(201)

      const inCatalogue = await adminGet("/admin/jovy/catalogue/families", { category_key: "sazonador" })
      expect(inCatalogue.status).toBe(200)
      expect((inCatalogue.data.families as Family[]).map((family) => family.slug)).toEqual(["gomitas-de-grenetina"])
      expect((inCatalogue.data.families as Family[])[0].product_ids).toEqual([])

      // La relación familia ↔ producto vive en el Module Link; el Admin la
      // resuelve por query.graph y el Store no expone identificadores internos.
      const productService = getContainer().resolve(Modules.PRODUCT)
      const product = await productService.createProducts({ title: "Producto de familia" })
      const link = getContainer().resolve(ContainerRegistrationKeys.LINK)
      await link.create({
        [JOVY_CATALOGUE_MODULE]: { jovy_product_family_id: created.data.family.id },
        [Modules.PRODUCT]: { product_id: product.id },
      })

      const withProducts = await adminGet("/admin/jovy/catalogue/families", { category_key: "sazonador" })
      expect((withProducts.data.families as Family[])[0].product_ids).toEqual([product.id])

      // Una tarjeta sin categoría comercial no hereda familias.
      const withoutMapping = await adminGet("/admin/jovy/catalogue/families", { category_key: "chamoy" })
      expect(withoutMapping.data.families).toEqual([])

      const invalidKey = await adminGet("/admin/jovy/catalogue/families", { category_key: "no-existe" })
      expect(invalidKey.status).toBe(400)

      const duplicate = await adminSend("post", "/admin/jovy/catalogue/families", {
        name: "Otra familia",
        slug: "gomitas-de-grenetina",
      })
      expect(duplicate.status).toBe(400)

      const publicFamilies = await store("/store/jovy/catalogue/families", { category_key: "sazonador" })
      expect(publicFamilies.status).toBe(200)
      expect(publicFamilies.data.families).toEqual([
        {
          id: created.data.family.id,
          slug: "gomitas-de-grenetina",
          name: "Gomitas de grenetina",
          description: null,
          sort_order: 1,
          medusa_category_id: gomitas.id,
          card_preset: null,
        },
      ])

      await adminSend("put", `/admin/jovy/catalogue/families/${created.data.family.id}`, { active: false })
      expect((await store("/store/jovy/catalogue/families")).data.families).toEqual([])

      const removed = await adminDelete(`/admin/jovy/catalogue/families/${created.data.family.id}`)
      expect(removed.status).toBe(204)
      expect((await adminGet(`/admin/jovy/catalogue/families/${created.data.family.id}`)).status).toBe(404)
    })

    it("no expone familias vinculadas de una categoría inactiva", async () => {
      const { category, family } = await linkPublicFamily("sazonador", "categoria-inactiva")

      expect(await adminSend("put", `/admin/jovy/catalogue/categories/${category.id}`, { active: false }))
        .toMatchObject({ status: 200 })
      const response = await store("/store/jovy/catalogue/families", { category_key: category.key })

      expect(response.status).toBe(200)
      expect(response.data).toEqual({ families: [] })
      expect(response.data.families).not.toContainEqual(expect.objectContaining({ id: family.id }))
    })

    it("no expone familias vinculadas de una categoría históricamente próxima", async () => {
      const { category, family } = await linkPublicFamily("chamoy", "categoria-proximamente")
      const catalogue = getContainer().resolve(JOVY_CATALOGUE_MODULE) as {
        updateCatalogueCategories: (input: Record<string, unknown>) => Promise<unknown>
      }
      await catalogue.updateCatalogueCategories({
        id: category.id,
        active: true,
        coming_soon: true,
        interaction_locked: false,
      })

      const response = await store("/store/jovy/catalogue/families", { category_key: category.key })

      expect(response.status).toBe(200)
      expect(response.data).toEqual({ families: [] })
      expect(response.data.families).not.toContainEqual(expect.objectContaining({ id: family.id }))
    })

    it("no expone familias vinculadas de una categoría con bloqueo manual", async () => {
      const { category, family } = await linkPublicFamily("pinatero", "categoria-bloqueada")

      expect(await adminSend("put", `/admin/jovy/catalogue/categories/${category.id}`, {
        interaction_locked: true,
      })).toMatchObject({ status: 200 })
      const response = await store("/store/jovy/catalogue/families", { category_key: category.key })

      expect(response.status).toBe(200)
      expect(response.data).toEqual({ families: [] })
      expect(response.data.families).not.toContainEqual(expect.objectContaining({ id: family.id }))
    })

    it("gestiona lanzamientos y publica solo los activos", async () => {
      const missingTitle = await adminSend("post", "/admin/jovy/launches", { product_id: "prod_1" })
      expect(missingTitle.status).toBe(400)

      const missingAsset = await adminSend("post", "/admin/jovy/launches", { title: "Sin imagen ni producto" })
      expect(missingAsset.status).toBe(400)

      const missingProduct = await adminSend("post", "/admin/jovy/launches", {
        title: "Producto inexistente",
        product_id: "prod_missing",
      })
      expect(missingProduct.status).toBe(404)

      const productService = getContainer().resolve(Modules.PRODUCT)
      const product = await productService.createProducts({ title: "Producto lanzamiento" })

      const withProduct = await adminSend("post", "/admin/jovy/launches", {
        title: "Con producto",
        product_id: product.id,
        sort_order: 2,
      })
      expect(withProduct.status).toBe(201)

      const withImage = await adminSend("post", "/admin/jovy/launches", {
        title: "Con imagen",
        image_url: "https://example.test/lanzamiento.png",
        sort_order: 1,
      })
      expect(withImage.status).toBe(201)

      const inactive = await adminSend("post", "/admin/jovy/launches", {
        title: "Oculto",
        product_id: product.id,
        sort_order: 0,
        active: false,
      })
      expect(inactive.status).toBe(201)

      const adminList = await adminGet("/admin/jovy/launches")
      expect(adminList.status).toBe(200)
      expect((adminList.data.launches as Launch[]).map((launch) => launch.title)).toEqual([
        "Oculto",
        "Con imagen",
        "Con producto",
      ])

      const publicList = await store("/store/jovy/launches")
      expect(publicList.status).toBe(200)
      expect(publicList.data.settings).toEqual({ background_color: "#00AFAA" })
      expect((publicList.data.launches as Launch[]).map((launch) => launch.title)).toEqual([
        "Con imagen",
        "Con producto",
      ])
      expect((publicList.data.launches as Array<Record<string, unknown>>)[1]).toMatchObject({
        product_id: product.id,
        image_url: null,
      })
      expect(Object.keys((publicList.data.launches as Array<Record<string, unknown>>)[0]).sort()).toEqual([
        "description",
        "id",
        "image_file_id",
        "image_url",
        "product_id",
        "sort_order",
        "title",
      ])

      const settings = await adminSend("put", "/admin/jovy/launches/settings", { background_color: "#123456" })
      expect(settings.status).toBe(200)
      expect((await store("/store/jovy/launches")).data.settings).toEqual({ background_color: "#123456" })

      const invalidColor = await adminSend("put", "/admin/jovy/launches/settings", { background_color: "teal" })
      expect(invalidColor.status).toBe(400)

      const hidden = await adminSend("put", `/admin/jovy/launches/${withImage.data.launch.id}`, { active: false })
      expect(hidden.status).toBe(200)
      expect((await store("/store/jovy/launches")).data.launches).toHaveLength(1)

      const removed = await adminDelete(`/admin/jovy/launches/${withProduct.data.launch.id}`)
      expect(removed.status).toBe(204)
      expect((await adminGet(`/admin/jovy/launches/${withProduct.data.launch.id}`)).status).toBe(404)
      expect((await store("/store/jovy/launches")).data.launches).toHaveLength(0)
    })

    it("valida image_file_id de lanzamientos y permite quitarlo", async () => {
      const image = await createFile("lanzamiento.png", "image/png", PNG)
      const text = await createFile("lanzamiento.txt", "text/plain", Buffer.from("no soy una imagen", "utf8"))

      const productService = getContainer().resolve(Modules.PRODUCT)
      const product = await productService.createProducts({ title: "Producto con archivo" })

      const created = await adminSend("post", "/admin/jovy/launches", {
        title: "Con archivo",
        product_id: product.id,
        image_file_id: image.id,
      })
      expect(created.status).toBe(201)
      expect(created.data.launch.image_file_id).toBe(image.id)

      const missing = await adminSend("post", "/admin/jovy/launches", {
        title: "Archivo inexistente",
        product_id: product.id,
        image_file_id: "jovy-missing.png",
      })
      expect(missing.status).toBe(400)
      expect(missing.data.message).toBe("El archivo de imagen no existe")

      const notImage = await adminSend("post", "/admin/jovy/launches", {
        title: "Archivo que no es imagen",
        product_id: product.id,
        image_file_id: text.id,
      })
      expect(notImage.status).toBe(400)
      expect(notImage.data.message).toBe("El archivo de imagen no es una imagen PNG, JPEG o WebP")

      const listed = await adminGet("/admin/jovy/launches")
      const titles = (listed.data.launches as Launch[]).map((launch) => launch.title)
      expect(titles).toContain("Con archivo")
      expect(titles).not.toContain("Archivo inexistente")
      expect(titles).not.toContain("Archivo que no es imagen")

      const cleared = await adminSend("put", `/admin/jovy/launches/${created.data.launch.id}`, {
        image_file_id: null,
      })
      expect(cleared.status).toBe(200)
      expect(cleared.data.launch.image_file_id).toBeNull()
    })

    it("publica el mensaje corporativo por idioma sin exponer datos internos", async () => {
      const empty = await adminGet("/admin/jovy/announcements/settings")
      expect(empty.status).toBe(200)
      expect(empty.data.announcement_settings).toMatchObject({
        corporate_message_es: null,
        corporate_message_en: null,
      })

      const incomplete = await adminSend("put", "/admin/jovy/announcements/settings", {
        corporate_message_es: "Endulzamos tus momentos",
      })
      expect(incomplete.status).toBe(400)

      const tooLong = await adminSend("put", "/admin/jovy/announcements/settings", {
        corporate_message_es: "x".repeat(601),
        corporate_message_en: null,
      })
      expect(tooLong.status).toBe(400)

      const saved = await adminSend("put", "/admin/jovy/announcements/settings", {
        corporate_message_es: "Endulzamos tus momentos",
        corporate_message_en: "We sweeten your moments",
      })
      expect(saved.status).toBe(200)
      expect(saved.data.announcement_settings).toMatchObject({
        corporate_message_es: "Endulzamos tus momentos",
        corporate_message_en: "We sweeten your moments",
      })

      const publicSettings = await store("/store/jovy/announcements/settings")
      expect(publicSettings.status).toBe(200)
      expect(Object.keys(publicSettings.data.settings).sort()).toEqual([
        "corporate_message_en",
        "corporate_message_es",
        "updated_at",
      ])
      expect(publicSettings.data.settings).toMatchObject({
        corporate_message_es: "Endulzamos tus momentos",
        corporate_message_en: "We sweeten your moments",
      })

      await adminSend("put", "/admin/jovy/announcements/settings", {
        corporate_message_es: null,
        corporate_message_en: null,
      })
      expect((await store("/store/jovy/announcements/settings")).data.settings).toMatchObject({
        corporate_message_es: null,
        corporate_message_en: null,
      })
    })

    it("exige la publishable key en todas las rutas Store nuevas", async () => {
      for (const url of [
        "/store/jovy/catalogue/categories",
        "/store/jovy/catalogue/families",
        "/store/jovy/launches",
        "/store/jovy/announcements/settings",
      ]) {
        const withoutKey = await api.get(url, { validateStatus: () => true })
        expect(withoutKey.status).toBe(400)
        expect(withoutKey.data.type).toBe("not_allowed")

        const invalidKey = await store(url, undefined, "pk_invalid_key_for_tests")
        expect(invalidKey.status).toBe(400)
      }
    })
  },
})
