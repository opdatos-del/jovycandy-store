import { expect, test, type APIRequestContext } from "@playwright/test"
import { mkdirSync } from "node:fs"
import path from "node:path"
import {
  collectPageProblems,
  demoPng,
  demoValue,
  readEnvFile,
  signIn,
  waitForServer,
} from "./jovy-block2-helpers"

// El entorno local comparte el servidor de desarrollo con otras sesiones del
// repo; se amplía el tiempo y se permite un reintento para absorber reinicios.
test.describe.configure({ timeout: 180_000, retries: 1 })

const auditDir = path.join(__dirname, "..", ".test-results", "audit-visual", "products")

function screenshotPath(name: string) {
  mkdirSync(auditDir, { recursive: true })
  return path.join(auditDir, name)
}

const DEMO_THUMBNAIL = `data:image/png;base64,${demoPng.toString("base64")}`

const storeHeaders = () => ({
  "x-publishable-api-key": readEnvFile(".store.local.env").MEDUSA_PUBLISHABLE_API_KEY,
})

type CatalogueCategory = { id: string; key: string; medusa_category_id: string | null }
type Editorial = {
  id: string
  product_id: string
  gramaje: string | null
  certifications: string[]
  sort_order: number
  is_new: boolean
  editorial_status: string
  publish_issues: string[]
}

type DemoContext = {
  productId: string | null
  productCategoryId: string | null
  familyId: string | null
  catalogueCategoryId: string | null
  previousMapping: string | null
}

async function editorialFor(request: APIRequestContext, headers: Record<string, string>, productId: string) {
  const response = await request.get(`/admin/jovy/products/${productId}/editorial`, { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).editorial as Editorial
}

async function editorialsFor(request: APIRequestContext, headers: Record<string, string>, productId: string) {
  const response = await request.get(`/admin/jovy/products/editorial?product_id=${encodeURIComponent(productId)}`, { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).products as Editorial[]
}

/** Crea el escenario publicable DEMO con datos reales del Admin API. */
async function createDemoScenario(request: APIRequestContext, headers: Record<string, string>, context: DemoContext) {
  const stamp = Date.now()
  const seeded = await request.post("/admin/jovy/catalogue/categories/seed", { headers })
  expect(seeded.status()).toBe(200)
  const categories = (await seeded.json()).categories as CatalogueCategory[]

  const catalogueCategory = categories.find((category) => category.key === "chamoy")!
  context.catalogueCategoryId = catalogueCategory.id
  context.previousMapping = catalogueCategory.medusa_category_id

  const createdCategory = await request.post("/admin/product-categories", {
    headers,
    data: {
      name: `DEMO Categoría editorial ${stamp}`,
      handle: `demo-editorial-${stamp}`,
      is_active: true,
      is_internal: false,
    },
  })
  expect(createdCategory.status()).toBe(200)
  context.productCategoryId = (await createdCategory.json()).product_category.id

  // El vínculo tarjeta ↔ categoría comercial es la fuente de la categoría de
  // presentación; se restaura al final para no alterar el catálogo compartido.
  const linked = await request.put(`/admin/jovy/catalogue/categories/${catalogueCategory.id}`, {
    headers,
    data: { medusa_category_id: context.productCategoryId },
  })
  expect(linked.status()).toBe(200)

  const family = await request.post("/admin/jovy/catalogue/families", {
    headers,
    data: {
      name: `DEMO Familia editorial ${stamp}`,
      slug: `demo-editorial-${stamp}`,
      medusa_category_id: context.productCategoryId,
      sort_order: 0,
    },
  })
  expect(family.status()).toBe(201)
  context.familyId = (await family.json()).family.id

  const product = await request.post("/admin/products", {
    headers,
    data: {
      title: demoValue("Producto editorial"),
      thumbnail: DEMO_THUMBNAIL,
      // Store exige además que el producto comercial esté `published`; la
      // ficha editorial conserva su propio estado `draft` hasta publicarla.
      status: "published",
      categories: [{ id: context.productCategoryId }],
      // Medusa exige al menos una opción para crear un producto; no se crean
      // variantes porque esta prueba no toca precio, stock ni SKU.
      options: [{ title: "Presentación", values: ["Única"] }],
    },
  })
  const productBody = await product.json().catch(() => null)
  expect(product.status(), JSON.stringify(productBody)).toBe(200)
  context.productId = productBody.product.id
}

async function cleanupDemoScenario(request: APIRequestContext, headers: Record<string, string>, context: DemoContext) {
  if (context.productId) {
    await request.delete(`/admin/jovy/products/${context.productId}/editorial`, { headers })
    await request.delete(`/admin/products/${context.productId}`, { headers })
  }
  if (context.familyId) {
    await request.delete(`/admin/jovy/catalogue/families/${context.familyId}`, { headers })
  }
  if (context.catalogueCategoryId) {
    // Se restaura el valor exacto que tenía la tarjeta; si apuntaba a una
    // categoría comercial ya eliminada, el backend responde 404 y el valor
    // original queda intacto (no se inventa un reemplazo).
    await request.put(`/admin/jovy/catalogue/categories/${context.catalogueCategoryId}`, {
      headers,
      data: { medusa_category_id: context.previousMapping },
    })
  }
  if (context.productCategoryId) {
    await request.delete(`/admin/product-categories/${context.productCategoryId}`, { headers })
  }
}

test("recorre listado, editor editorial y Store sin duplicar el producto comercial", async ({ page, request }) => {
  // El primer render del widget resuelve la ficha por el listado filtrado: un
  // producto sin ficha responde 200 con `products: []`, así que la visita al
  // detalle no debe producir ningún 404 de `/editorial` ni `pageerror`.
  const problems = collectPageProblems(page)
  const editorialNotFound: string[] = []
  page.on("response", (response) => {
    if (response.status() !== 404) return
    const { pathname } = new URL(response.url())
    if (/^\/admin\/jovy\/products\/[^/]+\/editorial$/.test(pathname)) editorialNotFound.push(pathname)
  })
  const headers = await signIn(page, request)
  await waitForServer(request)

  const context: DemoContext = {
    productId: null,
    productCategoryId: null,
    familyId: null,
    catalogueCategoryId: null,
    previousMapping: null,
  }

  try {
    await createDemoScenario(request, headers, context)
    const productId = context.productId!

    await page.goto(`/app/products/${productId}`)
    const widget = page.getByTestId("product-editorial-widget")
    await expect(widget).toBeVisible({ timeout: 60_000 })
    await expect(widget.getByRole("heading", { name: "Editor editorial Jovy", level: 2 })).toBeVisible()
    await expect(widget.getByText(/Aún no hay ficha editorial/)).toBeVisible()
    await expect(widget.getByText("Para publicar falta:", { exact: false })).toHaveCount(0)
    await widget.scrollIntoViewIfNeeded()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({ path: screenshotPath("01-editor-sin-ficha-1440.png") })

    // Gramaje, certificaciones, novedad y orden.
    const gramaje = demoValue("250 g")
    await widget.getByLabel("Gramaje", { exact: true }).fill(gramaje)
    await widget.getByRole("checkbox", { name: "SGS" }).check()
    await widget.getByRole("checkbox", { name: "OU Kosher" }).check()
    await widget.getByRole("switch", { name: "Novedad" }).click()
    await widget.getByLabel("Orden", { exact: true }).fill("3")
    await widget.scrollIntoViewIfNeeded()
    await page.screenshot({ path: screenshotPath("02-editor-editando-1440.png") })

    // Cancelar no crea la ficha ni persiste cambios locales.
    await widget.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(page.getByText("SKU, precio, stock, variantes e imágenes del producto comercial nativo no se modifican.")).toBeVisible()
    await page.getByRole("button", { name: "Cancelar", exact: true }).last().click()
    await expect(widget.getByText(/Aún no hay ficha editorial/)).toBeVisible()
    expect(await editorialsFor(request, headers, productId)).toEqual([])

    // Confirmar sí crea y persiste la ficha editorial.
    await widget.getByRole("button", { name: "Guardar cambios" }).click()
    await page.getByRole("button", { name: "Guardar ficha", exact: true }).last().click()
    await expect(page.getByText("Ficha editorial guardada.")).toBeVisible({ timeout: 15_000 })

    let editorial = await editorialFor(request, headers, productId)
    expect(editorial).toMatchObject({
      gramaje,
      certifications: ["SGS", "OU Kosher"],
      sort_order: 3,
      is_new: true,
      editorial_status: "draft",
    })
    expect(editorial.publish_issues).toEqual([])

    // Persistencia real tras recargar.
    await page.reload()
    const reloaded = page.getByTestId("product-editorial-widget")
    await expect(reloaded.getByLabel("Gramaje", { exact: true })).toHaveValue(gramaje, { timeout: 30_000 })
    await expect(reloaded.getByRole("checkbox", { name: "SGS" })).toBeChecked()
    await expect(reloaded.getByRole("checkbox", { name: "OU Kosher" })).toBeChecked()
    await expect(reloaded.getByRole("checkbox", { name: "Halal" })).not.toBeChecked()
    await expect(reloaded.getByRole("switch", { name: "Novedad" })).toBeChecked()
    await expect(reloaded.getByLabel("Orden", { exact: true })).toHaveValue("3")
    await reloaded.scrollIntoViewIfNeeded()
    await page.screenshot({ path: screenshotPath("03-editor-persistido-1440.png") })

    // Publicar: el gate usa datos reales de Medusa (categoría, familia, título, imagen).
    const publishedStore = await request.get("/store/jovy/products", { headers: storeHeaders() })
    expect(publishedStore.status()).toBe(200)
    expect(
      ((await publishedStore.json()).products as Array<{ product: { id: string } }>).map(
        (item) => item.product.id,
      ),
    ).not.toContain(productId)

    // El listado mantiene la composición visual histórica: tarjetas densas,
    // filtros y búsqueda. Ambos enlaces dejan inequívoco que el editor vive en
    // el detalle nativo, sin crear una copia comercial.
    await page.goto("/app/jovy/products")
    await expect(page.getByRole("heading", { name: "Productos editoriales", level: 1 })).toBeVisible({ timeout: 45_000 })
    await page.getByLabel("Estado editorial").selectOption("draft")
    await page.getByLabel("Buscar en fichas cargadas").fill("Producto editorial")
    const row = page.getByTestId(`editorial-product-${productId}`)
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row.getByRole("link", { name: /Editar ficha editorial/ })).toHaveAttribute("href", `/app/products/${productId}`)
    await expect(row.getByRole("link", { name: /Abrir producto comercial/ })).toHaveAttribute("href", `/app/products/${productId}`)
    await expect(row.getByText("Novedad", { exact: true })).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({ path: screenshotPath("04-listado-1440.png"), fullPage: true })
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(row).toBeVisible()
    await page.screenshot({ path: screenshotPath("05-listado-375.png"), fullPage: true })

    await row.getByRole("link", { name: /Editar ficha editorial/ }).click()
    await expect(page).toHaveURL(`/app/products/${productId}`)
    const editorFromList = page.getByTestId("product-editorial-widget")
    await expect(editorFromList.getByLabel("Gramaje", { exact: true })).toHaveValue(gramaje, { timeout: 30_000 })

    await editorFromList.getByRole("button", { name: "Publicar en Store" }).click()
    await page.getByRole("button", { name: "Publicar en Store", exact: true }).last().click()
    await expect(editorFromList.getByTestId("editorial-status-badge")).toHaveText("Publicado", { timeout: 15_000 })
    await expect(editorFromList.getByTestId("editorial-status-badge")).toHaveText("Publicado", { timeout: 15_000 })

    editorial = await editorialFor(request, headers, productId)
    expect(editorial.editorial_status).toBe("published")

    const storeAfterPublish = await request.get("/store/jovy/products", { headers: storeHeaders() })
    const storeProducts = (await storeAfterPublish.json()).products as Array<{
      product: { id: string; title: string; thumbnail: string | null }
      gramaje: string | null
      certifications: string[]
      is_new: boolean
      sort_order: number
    }>
    const published = storeProducts.find((item) => item.product.id === productId)
    expect(published).toBeTruthy()
    expect(published).toMatchObject({
      gramaje,
      certifications: ["SGS", "OU Kosher"],
      is_new: true,
      sort_order: 3,
    })
    expect(published!.product.thumbnail).toBe(DEMO_THUMBNAIL)
    await editorFromList.scrollIntoViewIfNeeded()
    await page.screenshot({ path: screenshotPath("06-editor-publicado-375.png") })

    // Archivar: deja de ser público sin borrar nada.
    await page.setViewportSize({ width: 1440, height: 1000 })
    const archivedWidget = editorFromList
    await expect(archivedWidget.getByRole("button", { name: "Archivar ficha" })).toBeVisible({ timeout: 45_000 })
    await archivedWidget.getByRole("button", { name: "Archivar ficha" }).click()
    await page.getByRole("button", { name: "Archivar ficha", exact: true }).last().click()
    await expect(archivedWidget.getByTestId("editorial-status-badge")).toHaveText("Archivado", { timeout: 15_000 })

    expect((await editorialFor(request, headers, productId)).editorial_status).toBe("archived")
    const storeAfterArchive = await request.get("/store/jovy/products", { headers: storeHeaders() })
    expect(
      ((await storeAfterArchive.json()).products as Array<{ product: { id: string } }>).map(
        (item) => item.product.id,
      ),
    ).not.toContain(productId)
    await archivedWidget.scrollIntoViewIfNeeded()
    await page.screenshot({ path: screenshotPath("07-editor-archivado-1440.png") })

    // Cancelar la restauración conserva el archivado también en API.
    await archivedWidget.getByRole("button", { name: "Restaurar a borrador" }).click()
    await expect(page.getByText("La ficha editorial volverá a borrador y dejará de aparecer en Store.")).toBeVisible()
    await page.getByRole("button", { name: "Cancelar", exact: true }).last().click()
    await expect(archivedWidget.getByTestId("editorial-status-badge")).toHaveText("Archivado")
    expect((await editorialFor(request, headers, productId)).editorial_status).toBe("archived")

    // Confirmar devuelve la ficha a borrador y Store la sigue excluyendo;
    // restauración no recrea ni toca el producto comercial.
    await archivedWidget.getByRole("button", { name: "Restaurar a borrador" }).click()
    await page.getByRole("button", { name: "Restaurar a borrador", exact: true }).last().click()
    await expect(archivedWidget.getByTestId("editorial-status-badge")).toHaveText("Borrador", { timeout: 15_000 })
    expect((await editorialFor(request, headers, productId)).editorial_status).toBe("draft")
    const storeAfterRestore = await request.get("/store/jovy/products", { headers: storeHeaders() })
    expect(((await storeAfterRestore.json()).products as Array<{ product: { id: string } }>).map((item) => item.product.id)).not.toContain(productId)

    expect(problems).toEqual([])
    expect(editorialNotFound).toEqual([])
  } finally {
    await cleanupDemoScenario(request, headers, context)
    const storeAfterCleanup = await request.get("/store/jovy/products", { headers: storeHeaders() })
    if (storeAfterCleanup.ok() && context.productId) {
      const remaining = ((await storeAfterCleanup.json()).products as Array<{ product: { id: string } }>).map(
        (item) => item.product.id,
      )
      expect(remaining).not.toContain(context.productId)
    }
  }
})
