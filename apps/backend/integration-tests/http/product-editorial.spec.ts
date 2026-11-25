import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

import {
  createAdminSession,
  adminHeaders,
  createPublishableApiKey,
  storeHeaders,
} from "./utils"

jest.setTimeout(120_000)

type Editorial = {
  id: string
  product_id: string
  gramaje: string | null
  certifications: string[]
  sort_order: number
  is_new: boolean
  editorial_status: string
  published_at: string | null
  publish_issues: string[]
  product: { id: string; title: string; handle: string | null; thumbnail: string | null } | null
  product_missing: boolean
  family: { id: string; slug: string; name: string } | null
  category_keys: string[]
}

type StoreProduct = {
  id: string
  product: { id: string; title: string; handle: string | null; thumbnail: string | null }
  product_status: string
  gramaje: string | null
  certifications: string[]
  is_new: boolean
  sort_order: number
  family: { id: string; slug: string; name: string } | null
  category_keys: string[]
}

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-product-editorial",
  testSuite: ({ api, getContainer }) => {
    let adminToken: string
    let publishableApiKey: string
    let stamp = 0

    beforeAll(async () => {
      publishableApiKey = await createPublishableApiKey(getContainer())
      adminToken = await createAdminSession(getContainer(), api)
    })

    const adminConfig = () => ({ headers: adminHeaders(adminToken), validateStatus: () => true })
    const adminGet = (url: string, params?: Record<string, unknown>) => api.get(url, { ...adminConfig(), params })
    const adminSend = (method: "post" | "put" | "delete", url: string, body?: unknown) =>
      method === "delete" ? api.delete(url, adminConfig()) : api[method](url, body, adminConfig())
    const store = (url: string, params?: Record<string, unknown>, key = publishableApiKey) =>
      api.get(url, { headers: storeHeaders(key), params, validateStatus: () => true })

    const unique = (prefix: string) => {
      stamp += 1
      return `${prefix}-${stamp}`
    }

    const seedCategories = async () => {
      const response = await adminSend("post", "/admin/jovy/catalogue/categories/seed")
      expect(response.status).toBe(200)
      return response.data.categories as Array<{ id: string; key: string; medusa_category_id: string | null }>
    }

    /**
     * Escenario publicable mínimo: tarjeta de presentación mapeada a una
     * categoría comercial, familia derivada de esa categoría y producto con
     * título e imagen principal. No se crea ningún Module Link manual: la
     * familia se resuelve por la categoría, igual que en `sync-jovy-catalogue`.
     */
    const createPresentationSetup = async () => {
      const categories = await seedCategories()
      const key = unique("editorial")
      const productService = getContainer().resolve(Modules.PRODUCT)
      const commercial = await productService.createProductCategories({
        name: `Categoría ${key}`,
        handle: key,
        is_active: true,
      })

      const chamoy = categories.find((category) => category.key === "chamoy")!
      const linked = await adminSend("put", `/admin/jovy/catalogue/categories/${chamoy.id}`, {
        medusa_category_id: commercial.id,
      })
      expect(linked.status).toBe(200)

      const family = await adminSend("post", "/admin/jovy/catalogue/families", {
        name: `Familia ${key}`,
        slug: key,
        medusa_category_id: commercial.id,
        sort_order: 0,
      })
      expect(family.status).toBe(201)

      const product = await productService.createProducts({
        title: `Producto ${key}`,
        thumbnail: "https://example.test/editorial.png",
        status: "published",
        category_ids: [commercial.id],
      })

      return {
        categories,
        categoryId: chamoy.id,
        commercialCategoryId: commercial.id,
        familyId: family.data.family.id as string,
        familySlug: key,
        product,
      }
    }

    const publishedPayload = { editorial_status: "published" }

    it("exige sesión de administrador en las rutas editoriales y publishable key en Store", async () => {
      const editorials = [
        ["get", "/admin/jovy/products/prod_1/editorial"],
        ["put", "/admin/jovy/products/prod_1/editorial"],
        ["delete", "/admin/jovy/products/prod_1/editorial"],
        ["post", "/admin/jovy/products/prod_1/editorial/restore"],
        ["get", "/admin/jovy/products/editorial"],
      ] as const

      for (const [method, url] of editorials) {
        const response =
          method === "get"
            ? await api.get(url, { validateStatus: () => true })
            : method === "delete"
              ? await api.delete(url, { validateStatus: () => true })
              : await api[method](url, {}, { validateStatus: () => true })
        expect(response.status).toBe(401)
      }

      const withoutKey = await api.get("/store/jovy/products", { validateStatus: () => true })
      expect(withoutKey.status).toBe(400)
      expect(withoutKey.data.type).toBe("not_allowed")

      const invalidKey = await store("/store/jovy/products", undefined, "pk_invalid_key_for_tests")
      expect(invalidKey.status).toBe(400)
    })

    it("responde 404 sin ficha y no la crea implícitamente", async () => {
      const productService = getContainer().resolve(Modules.PRODUCT)
      const product = await productService.createProducts({ title: "Producto sin ficha" })

      const missing = await adminGet(`/admin/jovy/products/${product.id}/editorial`)
      expect(missing.status).toBe(404)
      expect(missing.data.message).toBe("El producto no tiene ficha editorial")

      const list = await adminGet("/admin/jovy/products/editorial")
      expect(list.status).toBe(200)
      expect(list.data.products).toEqual([])

      // El widget resuelve «sin ficha» por el listado filtrado: 200 con lista
      // vacía en lugar del 404 del detalle por producto.
      const byProduct = await adminGet("/admin/jovy/products/editorial", { product_id: product.id })
      expect(byProduct.status).toBe(200)
      expect(byProduct.data.products).toEqual([])
    })

    it("valida gramaje, certificaciones, estado y producto comercial en la escritura", async () => {
      const { product } = await createPresentationSetup()

      const longGramaje = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, {
        gramaje: "x".repeat(51),
      })
      expect(longGramaje.status).toBe(400)
      expect(longGramaje.data.message).toBe("La ficha editorial no es válida")

      const unknownCertification = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, {
        certifications: ["Orgánico"],
      })
      expect(unknownCertification.status).toBe(400)

      const duplicatedCertification = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, {
        certifications: ["SGS", "SGS"],
      })
      expect(duplicatedCertification.status).toBe(400)

      const invalidStatus = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, {
        editorial_status: "live",
      })
      expect(invalidStatus.status).toBe(400)

      const unknownField = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, { price: 10 })
      expect(unknownField.status).toBe(400)

      const unknownProduct = await adminSend("put", "/admin/jovy/products/prod_missing/editorial", {
        gramaje: "250 g",
      })
      expect(unknownProduct.status).toBe(404)
      expect(unknownProduct.data.message).toBe("Producto comercial no encontrado")

      expect((await adminGet("/admin/jovy/products/editorial")).data.products).toEqual([])
    })

    it("hace upsert de una sola ficha y conserva el producto comercial como referencia", async () => {
      const { product, familyId } = await createPresentationSetup()

      const created = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, {
        gramaje: "  250 g ",
        certifications: ["SGS", "Halal"],
        sort_order: 4,
        is_new: true,
      })
      expect(created.status).toBe(200)
      expect(created.data.deleted).toBe(false)
      expect(created.data.editorial).toMatchObject({
        product_id: product.id,
        gramaje: "250 g",
        certifications: ["SGS", "Halal"],
        sort_order: 4,
        is_new: true,
        editorial_status: "draft",
        published_at: null,
        product_missing: false,
        family: { id: familyId, name: expect.any(String) },
        category_keys: ["chamoy"],
      })
      expect(created.data.editorial.product).toEqual({
        id: product.id,
        title: product.title,
        handle: product.handle,
        thumbnail: "https://example.test/editorial.png",
        official_catalog_complete: false,
        official_catalog_size: null,
      })
      // La ficha no copia datos comerciales sensibles ni de inventario.
      expect(Object.keys(created.data.editorial)).not.toContain("price")
      expect(Object.keys(created.data.editorial)).not.toContain("sku")

      const updated = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, { sort_order: 7 })
      expect(updated.status).toBe(200)
      expect(updated.data.editorial).toMatchObject({
        id: created.data.editorial.id,
        gramaje: "250 g",
        certifications: ["SGS", "Halal"],
        sort_order: 7,
        is_new: true,
      })

      const cleared = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, { gramaje: "" })
      expect(cleared.data.editorial.gramaje).toBeNull()

      const stored = await adminGet(`/admin/jovy/products/${product.id}/editorial`)
      expect(stored.status).toBe(200)
      expect(stored.data.editorial.id).toBe(created.data.editorial.id)
      expect(stored.data.editorial.publish_issues).toEqual([])

      expect((await adminGet("/admin/jovy/products/editorial")).data.products).toHaveLength(1)

      const byProduct = await adminGet("/admin/jovy/products/editorial", { product_id: product.id })
      expect(byProduct.status).toBe(200)
      expect(byProduct.data.products).toHaveLength(1)
      expect(byProduct.data.products[0]).toMatchObject({
        id: created.data.editorial.id,
        product_id: product.id,
        deleted: false,
      })
    })

    it("publica con la regla histórica, ordena por sort_order y oculta al archivar", async () => {
      const setup = await createPresentationSetup()
      const productService = getContainer().resolve(Modules.PRODUCT)
      // Mismo producto comercial de referencia, sin imagen principal: el gate de
      // publicación debe rechazarlo con datos reales de Medusa.
      const withoutImage = await productService.createProducts({
        title: "Producto sin imagen",
        category_ids: [setup.commercialCategoryId],
      })

      const blocked = await adminSend("put", `/admin/jovy/products/${withoutImage.id}/editorial`, publishedPayload)
      expect(blocked.status).toBe(400)
      expect(blocked.data.message).toContain("No se puede publicar el producto. Falta: imagen principal")

      const published = await adminSend("put", `/admin/jovy/products/${setup.product.id}/editorial`, {
        gramaje: "250 g",
        certifications: ["OU Kosher"],
        sort_order: 2,
        is_new: true,
        ...publishedPayload,
      })
      expect(published.status).toBe(200)
      expect(published.data.editorial).toMatchObject({ editorial_status: "published" })
      expect(published.data.editorial.published_at).toBeTruthy()

      // El producto sin imagen no se puede publicar aunque se le asigne orden.
      const stillBlocked = await adminSend("put", `/admin/jovy/products/${withoutImage.id}/editorial`, {
        sort_order: 1,
        ...publishedPayload,
      })
      expect(stillBlocked.status).toBe(400)

      const list = await adminGet("/admin/jovy/products/editorial", { status: "published" })
      expect(list.status).toBe(200)
      expect(list.data.products.map((item: Editorial) => item.product_id)).toEqual([setup.product.id])

      const storeList = await store("/store/jovy/products")
      expect(storeList.status).toBe(200)
      const storeProducts = storeList.data.products as StoreProduct[]
      expect(storeProducts).toHaveLength(1)
      expect(storeProducts[0]).toMatchObject({
        product: {
          id: setup.product.id,
          title: setup.product.title,
          handle: setup.product.handle,
          thumbnail: "https://example.test/editorial.png",
        },
        gramaje: "250 g",
        certifications: ["OU Kosher"],
        is_new: true,
        sort_order: 2,
        family: { id: setup.familyId },
        category_keys: ["chamoy"],
      })
      expect(Object.keys(storeProducts[0])).not.toContain("editorial_status")
      expect(Object.keys(storeProducts[0])).not.toContain("sellable_requirements")
      expect(Object.keys(storeProducts[0].product)).toEqual([
        "id",
        "title",
        "handle",
        "thumbnail",
        "official_catalog_complete",
        "official_catalog_size",
      ])

      const archived = await adminSend("put", `/admin/jovy/products/${setup.product.id}/editorial`, {
        editorial_status: "archived",
      })
      expect(archived.status).toBe(200)
      expect(archived.data.editorial.published_at).toBeNull()
      expect((await store("/store/jovy/products")).data.products).toEqual([])
      expect((await adminGet("/admin/jovy/products/editorial", { status: "archived" })).data.products).toHaveLength(1)
    })

    it("conserva published_at mientras la ficha siga publicada", async () => {
      const { product } = await createPresentationSetup()

      const first = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, publishedPayload)
      expect(first.status).toBe(200)
      const original = first.data.editorial.published_at as string
      expect(original).toBeTruthy()

      // Un guardado parcial no reescribe la fecha.
      await new Promise((resolve) => setTimeout(resolve, 10))
      const saved = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, { sort_order: 5 })
      expect(saved.status).toBe(200)
      expect(saved.data.editorial.published_at).toBe(original)

      // Reenviar el mismo estado tampoco la mueve.
      const republished = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, publishedPayload)
      expect(republished.data.editorial.published_at).toBe(original)

      const archived = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, {
        editorial_status: "archived",
      })
      expect(archived.data.editorial.published_at).toBeNull()

      const restored = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, publishedPayload)
      expect(restored.data.editorial.published_at).toBeTruthy()
      expect(new Date(restored.data.editorial.published_at).getTime()).toBeGreaterThan(new Date(original).getTime())
    })

    it("oculta de Store las fichas cuyo producto comercial no está published", async () => {
      const setup = await createPresentationSetup()
      const draftProduct = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts({
          title: "Producto comercial en borrador",
          thumbnail: "https://example.test/borrador.png",
          status: "draft",
          category_ids: [setup.commercialCategoryId],
        })

      await adminSend("put", `/admin/jovy/products/${setup.product.id}/editorial`, publishedPayload)
      await adminSend("put", `/admin/jovy/products/${draftProduct.id}/editorial`, publishedPayload)

      const visible = (await store("/store/jovy/products")).data.products as StoreProduct[]
      expect(visible.map((item) => item.product.id)).toEqual([setup.product.id])
      expect(visible[0].product_status).toBe("published")

      // Publicar el producto comercial lo incorpora sin tocar la ficha.
      await getContainer().resolve(Modules.PRODUCT).updateProducts(draftProduct.id, { status: "published" })

      const afterPublish = (await store("/store/jovy/products")).data.products as StoreProduct[]
      expect(afterPublish.map((item) => item.product.id).sort()).toEqual(
        [setup.product.id, draftProduct.id].sort(),
      )
    })

    it("filtra el listado y Store por categoría, familia y estado", async () => {
      const setup = await createPresentationSetup()

      await adminSend("put", `/admin/jovy/products/${setup.product.id}/editorial`, {
        sort_order: 0,
        ...publishedPayload,
      })

      for (const url of ["/admin/jovy/products/editorial", "/store/jovy/products"]) {
        const byCategory = await (url.startsWith("/store") ? store : adminGet)(url, { category_key: "chamoy" })
        expect(byCategory.status).toBe(200)
        expect(byCategory.data.products).toHaveLength(1)

        // La familia se acepta por id canónico o por slug histórico.
        for (const family of [setup.familyId, setup.familySlug]) {
          const byFamily = await (url.startsWith("/store") ? store : adminGet)(url, { family_id: family })
          expect(byFamily.status).toBe(200)
          expect(byFamily.data.products).toHaveLength(1)
        }

        // Admin distingue payload inválido (400) de recurso inexistente (404);
        // Store responde 404 en ambos casos para no filtrar el catálogo interno.
        const unknownCategory = await (url.startsWith("/store") ? store : adminGet)(url, { category_key: "no-existe" })
        expect(unknownCategory.status).toBe(url.startsWith("/store") ? 404 : 400)

        const unknownFamily = await (url.startsWith("/store") ? store : adminGet)(url, { family_id: "no-existe" })
        expect(unknownFamily.status).toBe(404)

        const otherCategory = await (url.startsWith("/store") ? store : adminGet)(url, { category_key: "pinatero" })
        expect(otherCategory.status).toBe(200)
        expect(otherCategory.data.products).toEqual([])
      }

      const invalidStatus = await adminGet("/admin/jovy/products/editorial", { status: "live" })
      expect(invalidStatus.status).toBe(400)

      const invalidCategory = await adminGet("/admin/jovy/products/editorial", { category_key: "no-existe" })
      expect(invalidCategory.status).toBe(400)

      const invalidProduct = await adminGet("/admin/jovy/products/editorial", { product_id: "" })
      expect(invalidProduct.status).toBe(400)
    })

    it("elimina solo la ficha editorial, la restaura y valida el producto comercial", async () => {
      const { product } = await createPresentationSetup()
      await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, {
        gramaje: "500 g",
        certifications: ["SGS"],
      })

      const removed = await adminSend("delete", `/admin/jovy/products/${product.id}/editorial`)
      expect(removed.status).toBe(204)

      const deleted = await adminGet(`/admin/jovy/products/${product.id}/editorial`)
      expect(deleted.status).toBe(200)
      expect(deleted.data.deleted).toBe(true)
      expect(deleted.data.editorial.gramaje).toBe("500 g")
      expect((await adminGet("/admin/jovy/products/editorial")).data.products).toEqual([])

      // La ficha borrada sigue visible al resolver su producto, para restaurar.
      const deletedByProduct = await adminGet("/admin/jovy/products/editorial", { product_id: product.id })
      expect(deletedByProduct.status).toBe(200)
      expect(deletedByProduct.data.products).toHaveLength(1)
      expect(deletedByProduct.data.products[0]).toMatchObject({ product_id: product.id, deleted: true })

      const blockedSave = await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, { gramaje: "1 kg" })
      expect(blockedSave.status).toBe(400)
      expect(blockedSave.data.message).toBe("La ficha editorial está eliminada; restáurala antes de guardarla")

      const secondDelete = await adminSend("delete", `/admin/jovy/products/${product.id}/editorial`)
      expect(secondDelete.status).toBe(404)

      const restored = await adminSend("post", `/admin/jovy/products/${product.id}/editorial/restore`)
      expect(restored.status).toBe(200)
      expect(restored.data.deleted).toBe(false)
      expect(restored.data.editorial).toMatchObject({ gramaje: "500 g", certifications: ["SGS"] })

      const afterRestore = await adminGet(`/admin/jovy/products/${product.id}/editorial`)
      expect(afterRestore.data.deleted).toBe(false)

      const restoredByProduct = await adminGet("/admin/jovy/products/editorial", { product_id: product.id })
      expect(restoredByProduct.data.products[0]).toMatchObject({ product_id: product.id, deleted: false })

      const productService = getContainer().resolve(Modules.PRODUCT)
      const withoutEditorial = await productService.createProducts({ title: "Producto restaurado sin ficha" })
      const missingEditorial = await adminSend("post", `/admin/jovy/products/${withoutEditorial.id}/editorial/restore`)
      expect(missingEditorial.status).toBe(404)
      expect(missingEditorial.data.message).toBe("El producto no tiene ficha editorial")

      const unknownProduct = await adminSend("post", "/admin/jovy/products/prod_missing/editorial/restore")
      expect(unknownProduct.status).toBe(404)
      expect(unknownProduct.data.message).toBe("Producto comercial no encontrado")
    })

    it("excluye de Store la ficha cuyo producto comercial ya no existe", async () => {
      const { product } = await createPresentationSetup()
      await adminSend("put", `/admin/jovy/products/${product.id}/editorial`, publishedPayload)
      expect((await store("/store/jovy/products")).data.products).toHaveLength(1)

      const productService = getContainer().resolve(Modules.PRODUCT)
      await productService.deleteProducts([product.id])

      const list = await adminGet("/admin/jovy/products/editorial")
      expect(list.status).toBe(200)
      expect(list.data.products[0]).toMatchObject({ product_missing: true, product: null })

      expect((await store("/store/jovy/products")).data.products).toEqual([])
    })

    it("ordena Store por sort_order con desempate determinista", async () => {
      const setup = await createPresentationSetup()
      const sameCategoryProduct = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts({
          title: "Producto hermano",
          thumbnail: "https://example.test/hermano.png",
          status: "published",
          category_ids: [setup.commercialCategoryId],
        })

      await adminSend("put", `/admin/jovy/products/${setup.product.id}/editorial`, {
        sort_order: 1,
        ...publishedPayload,
      })
      await adminSend("put", `/admin/jovy/products/${sameCategoryProduct.id}/editorial`, {
        sort_order: 0,
        ...publishedPayload,
      })

      const storeProducts = (await store("/store/jovy/products")).data.products as StoreProduct[]
      expect(storeProducts.map((item) => item.product.id)).toEqual([sameCategoryProduct.id, setup.product.id])
      expect(storeProducts.map((item) => item.sort_order)).toEqual([0, 1])
    })
  },
})
