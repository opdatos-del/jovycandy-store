import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"

// La primera navegación compila el bundle del Admin en `medusa develop`; el
// presupuesto por defecto de 60 s no alcanza en frío.
test.setTimeout(180_000)

function values(file: string) {
  return Object.fromEntries(readFileSync(file, "utf8").trim().split("\n").map((line) => {
    const index = line.indexOf("=")
    return [line.slice(0, index), line.slice(index + 1)]
  }))
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLfkQAAAABJRU5ErkJggg==",
  "base64",
)

type Family = { id: string; slug: string; name: string }

async function login(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
  const admin = values(".admin.local.env")
  await page.goto("/app/login")
  await page.getByPlaceholder("Email").fill(admin.MEDUSA_ADMIN_EMAIL)
  await page.getByPlaceholder("Password").fill(admin.MEDUSA_ADMIN_PASSWORD)
  await Promise.all([
    page.waitForURL(/\/app(?!\/login)/),
    page.getByRole("button", { name: "Continue with Email" }).click(),
  ])
  const auth = await request.post("/auth/user/emailpass", {
    data: { email: admin.MEDUSA_ADMIN_EMAIL, password: admin.MEDUSA_ADMIN_PASSWORD },
  })
  expect(auth.status()).toBe(200)
  return { Authorization: `Bearer ${(await auth.json()).token}` }
}

/** `usePrompt` de Medusa UI se renderiza como `alertdialog` de Radix. */
async function confirmPrompt(page: Page, title: string, confirmText: string) {
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("heading", { name: title, exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: confirmText, exact: true }).click()
  await expect(dialog).toBeHidden()
}

test("vincula un logo a familias reales filtradas por categoría y las sirve en Store", async ({ page, request }) => {
  const store = values(".store.local.env")
  const runId = `e2e-familias-${Date.now()}`
  const headers = await login(page, request)
  const admin = { headers }
  const pageErrors: string[] = []
  let logoId = ""
  let productCategoryId = ""
  let categoryId = ""
  let families: Family[] = []

  page.on("pageerror", (error) => pageErrors.push(error.message))

  const storeLogos = (family: string) =>
    request.get(`/store/jovy/brand/logos?family=${encodeURIComponent(family)}`, {
      headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY },
    })

  try {
    // Preparación por API: una tarjeta de catálogo ligada a una Product Category
    // real y tres familias vigentes en esa categoría.
    await request.post("/admin/jovy/catalogue/categories/seed", admin)
    const categoryList = await (await request.get("/admin/jovy/catalogue/categories", admin)).json()
    categoryId = categoryList.categories.find((category: { key: string }) => category.key === "sazonador").id

    const productCategory = await request.post("/admin/product-categories", {
      ...admin,
      data: { name: `Sazonador ${runId}`, handle: `sazonador-${runId}`, is_active: true },
    })
    expect(productCategory.status()).toBe(200)
    productCategoryId = (await productCategory.json()).product_category.id

    const linkedCategory = await request.put(`/admin/jovy/catalogue/categories/${categoryId}`, {
      ...admin,
      data: { medusa_category_id: productCategoryId },
    })
    expect(linkedCategory.status()).toBe(200)

    const names = [`Chamoy ${runId}`, `Piñatero ${runId}`, `Dulces ${runId}`]
    const slugs = [`chamoy-${runId}`, `pinatero-${runId}`, `dulces-${runId}`]
    families = []
    for (const [index, name] of names.entries()) {
      const response = await request.post("/admin/jovy/catalogue/families", {
        ...admin,
        data: { name, slug: slugs[index], medusa_category_id: productCategoryId, sort_order: index },
      })
      expect(response.status()).toBe(201)
      families.push((await response.json()).family)
    }

    await page.goto("/app/jovy/brand")
    await page.getByRole("button", { name: "Logos" }).click()
    await expect(page.getByRole("heading", { name: "Logos", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Nuevo logo" }).click()

    await page.getByLabel("Slug logo").fill(`logo-${runId}`)
    await page.getByLabel("Nombre logo").fill(`Logo ${runId}`)
    await page.getByLabel("Archivo de logo").setInputFiles({ name: "logo-familias.png", mimeType: "image/png", buffer: png })
    await expect(page.getByAltText(`Logo ${runId}`)).toBeVisible()
    const zoom = page.getByLabel("Zoom logo")
    await zoom.focus()
    for (let step = 0; step < 5; step += 1) await zoom.press("ArrowRight")

    // El selector de categoría filtra las familias con el endpoint del catálogo.
    await page.getByLabel("Categoría de familias").selectOption("sazonador")
    await expect(page.getByLabel(`Familia ${names[0]}`)).toBeVisible()
    await expect(page.getByLabel(`Familia ${names[2]}`)).toBeVisible()
    await page.getByLabel(`Familia ${names[0]}`).check()
    await page.getByLabel(`Familia ${names[1]}`).check()
    await page.getByLabel(`Familia ${names[2]}`).uncheck()
    await page.getByTestId("jovy-logo-form-panel").getByRole("button", { name: "Crear logo" }).click()
    await confirmPrompt(page, "Crear logo", "Crear logo")
    await expect(page.getByText(`Logo ${runId}`)).toBeVisible()

    const listed = await request.get("/admin/jovy/brand/logos", admin)
    const created = (await listed.json()).logos.find((logo: { slug: string }) => logo.slug === `logo-${runId}`)
    expect(created).toBeTruthy()
    logoId = created.id
    expect(created.family_ids.sort()).toEqual([families[0].id, families[1].id].sort())
    expect(created.family_labels).toHaveLength(2)
    expect(created.crop).toEqual({ zoom: 1.25, offset_x: 0, offset_y: 0 })

    // Persistencia tras recargar: la selección real vuelve marcada.
    await page.reload()
    await page.getByRole("button", { name: "Logos" }).click()
    const row = page.locator("article").filter({ hasText: `Logo ${runId}` })
    await row.getByRole("button", { name: "Editar" }).click()
    await expect(page.getByLabel(`Familia ${names[0]}`)).toBeChecked()
    await expect(page.getByLabel(`Familia ${names[1]}`)).toBeChecked()
    await expect(page.getByLabel(`Familia ${names[2]}`)).not.toBeChecked()
    await expect(page.getByLabel("Zoom logo")).toHaveValue("1.25")
    await page.screenshot({ path: ".test-results/audit-visual/logos/families-edit.png", fullPage: true })

    // Store: el logo aparece para las familias asociadas (id o slug) y no para otra.
    for (const family of [families[0].id, families[1].id, families[0].slug]) {
      await expect.poll(async () => {
        const response = await storeLogos(family)
        expect(response.status()).toBe(200)
        return (await response.json()).logos.some((logo: { id: string }) => logo.id === logoId)
      }).toBe(true)
    }
    await expect.poll(async () => {
      const response = await storeLogos(families[2].id)
      return (await response.json()).logos.some((logo: { id: string }) => logo.id === logoId)
    }).toBe(false)

    expect(pageErrors).toEqual([])
  } finally {
    if (logoId) {
      const response = await request.delete(`/admin/jovy/brand/logos/${logoId}`, admin)
      if (![204, 404].includes(response.status())) console.error(`No se pudo limpiar el logo: HTTP ${response.status()}`)
    }
    for (const family of families) {
      const response = await request.delete(`/admin/jovy/catalogue/families/${family.id}`, admin)
      if (![204, 404].includes(response.status())) console.error(`No se pudo limpiar la familia: HTTP ${response.status()}`)
    }
    if (categoryId) await request.put(`/admin/jovy/catalogue/categories/${categoryId}`, { ...admin, data: { medusa_category_id: null } })
    if (productCategoryId) {
      const response = await request.delete(`/admin/product-categories/${productCategoryId}`, admin)
      if (![200, 204, 404].includes(response.status())) console.error(`No se pudo limpiar la categoría: HTTP ${response.status()}`)
    }
  }
})
