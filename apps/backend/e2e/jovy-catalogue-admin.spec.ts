import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { mkdirSync } from "node:fs"
import path from "node:path"
import {
  collectPageProblems,
  openJovySection,
  waitForServer,
} from "./jovy-block2-helpers"

test.describe.configure({ timeout: 120_000, retries: 1 })

type AdminCategory = {
  id: string
  key: string
  name: string
  description: string | null
  sort_order: number
  active: boolean
  coming_soon: boolean
  interaction_locked: boolean
  image_file_id: string | null
  image_url: string | null
  medusa_category_id: string | null
}

const visualAuditDir = path.join(__dirname, "..", ".test-results", "audit-visual", "categories")

function screenshotPath(name: string) {
  mkdirSync(visualAuditDir, { recursive: true })
  return path.join(visualAuditDir, name)
}

async function listCategories(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.get("/admin/jovy/catalogue/categories", { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).categories as AdminCategory[]
}

async function categoryByKey(request: APIRequestContext, headers: Record<string, string>, key: string) {
  const categories = await listCategories(request, headers)
  const category = categories.find((item) => item.key === key)
  expect(category, `La tarjeta pública ${key} debe existir`).toBeTruthy()
  return category!
}

async function putCategory(
  request: APIRequestContext,
  headers: Record<string, string>,
  category: AdminCategory,
) {
  const data = {
    name: category.name,
    description: category.description,
    active: category.active,
    coming_soon: category.coming_soon,
    interaction_locked: category.interaction_locked,
    medusa_category_id: category.medusa_category_id,
    image_file_id: category.image_file_id,
    image_url: category.image_url,
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await request.put(`/admin/jovy/catalogue/categories/${category.id}`, { headers, data })
    if (response.status() === 200) return
    if (attempt === 2) expect(response.status(), `restaurar ${category.key}`).toBe(200)
    await waitForServer(request)
  }
}

async function restoreCategories(
  request: APIRequestContext,
  headers: Record<string, string>,
  original: AdminCategory[],
) {
  for (const category of original) await putCategory(request, headers, category)
  const reordered = await request.post("/admin/jovy/catalogue/categories/reorder", {
    headers,
    data: { ids: original.map((category) => category.id) },
  })
  expect(reordered.status()).toBe(200)
}

async function openCatalogue(page: Page, request: APIRequestContext) {
  return openJovySection(page, request, {
    label: "Categorías",
    url: /\/app\/jovy\/catalogue$/,
    heading: "Categorías del catálogo",
  })
}

async function ensureSeeded(page: Page, request: APIRequestContext, headers: Record<string, string>) {
  const categories = await listCategories(request, headers)
  if (categories.length >= 6) return categories

  await page.getByRole("button", { name: /Sembrar .*tarjetas/ }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Sembrar tarjetas" }).click()
  await expect(page.getByTestId(/^catalogue-card-/)).toHaveCount(6)
  return listCategories(request, headers)
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () => {
      const { width, viewport } = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }))
      return width <= viewport + 1
    })
    .toBe(true)
}

test("muestra seis tarjetas y edita estado en formulario separado con confirmación", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const problems = collectPageProblems(page)
  const headers = await openCatalogue(page, request)
  let original: AdminCategory[] = []

  try {
    original = await ensureSeeded(page, request, headers)
    const chamoy = original.find((category) => category.key === "chamoy")!
    const normalized = await request.put(`/admin/jovy/catalogue/categories/${chamoy.id}`, {
      headers,
      data: { active: true, coming_soon: false, interaction_locked: false, image_file_id: null, image_url: null },
    })
    expect(normalized.status()).toBe(200)
    await page.reload()

    await expect(page.getByTestId(/^catalogue-card-/)).toHaveCount(6)
    await expect(page.getByRole("heading", { name: "Categorías del catálogo", level: 1 })).toBeVisible()
    // El bloque «Resumen de categorías» y el panel de clave de dos columnas se
    // retiraron como ruido visual. La clave sigue verificándose: ahora vive en
    // la línea meta compacta junto al acceso, y los datos comerciales se pliegan.
    const chamoyCard = page.getByTestId("catalogue-card-chamoy")
    const chamoyMeta = chamoyCard.locator(".jovy-card-meta")
    await expect(chamoyMeta).toContainText("chamoy")
    await expect(chamoyMeta).toContainText("Disponible")
    const chamoyDetails = chamoyCard.locator("details.jovy-card-details")
    await expect(chamoyDetails).not.toHaveAttribute("open", "")
    await expect(chamoyCard.getByText("Categoría comercial")).not.toBeVisible()
    // Sin imagen la tarjeta no reserva el bloque gris roto del placeholder.
    await expect(page.getByTestId("catalogue-card-chamoy").locator("img")).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: screenshotPath("desktop-list.png"), fullPage: true })

    await page.getByTestId("catalogue-card-chamoy").getByRole("button", { name: /^Editar/ }).click()
    const form = page.getByTestId("catalogue-category-form")
    await expect(form).toBeVisible()
    await expect(page.getByTestId(/^catalogue-card-/)).toHaveCount(0)
    await expect(form.getByLabel("Clave pública")).toHaveValue("chamoy")
    await expect(form.getByLabel("Clave pública")).toHaveAttribute("readonly", "")
    await expect(form.getByLabel("Categoría comercial de Medusa")).toBeVisible()
    await expect(form.getByLabel(/Imagen opcional/)).toBeVisible()

    const content = form.locator("form > section").first()
    const configuration = form.locator("form > aside")
    const [contentBox, configurationBox] = await Promise.all([content.boundingBox(), configuration.boundingBox()])
    expect(contentBox, "La columna de contenido debe tener geometría visible").not.toBeNull()
    expect(configurationBox, "La columna de configuración debe tener geometría visible").not.toBeNull()
    if (!contentBox || !configurationBox) throw new Error("No se pudo medir el formulario de categoría")

    const desktopGap = configurationBox.x - (contentBox.x + contentBox.width)
    const desktopRatio = contentBox.width / configurationBox.width
    expect(configurationBox.x, "Configuración debe estar a la derecha del contenido").toBeGreaterThan(contentBox.x)
    expect(configurationBox.y, "Ambas columnas deben iniciar en la misma fila").toBeCloseTo(contentBox.y, 0)
    expect(desktopGap, "Las columnas deben quedar contiguas").toBeGreaterThanOrEqual(0)
    expect(desktopGap, "Las columnas deben separarse solo por el gap del grid").toBeLessThanOrEqual(24)
    expect(desktopRatio, "El grid desktop debe conservar proporción aproximada 8/4").toBeGreaterThanOrEqual(1.9)
    expect(desktopRatio, "El grid desktop debe conservar proporción aproximada 8/4").toBeLessThanOrEqual(2.2)

    const newName = `DEMO Chamoy UI ${Date.now()}`
    await form.getByLabel("Nombre").fill(newName)
    await form.getByLabel("Descripción").fill(`Descripción ${newName}`)
    await form.getByRole("switch", { name: "Próximamente" }).click()
    await expect(form.getByRole("switch", { name: "Activa" })).toBeDisabled()
    await expect(form.getByText(/Regla aplicada: Próximamente/)).toBeVisible()

    await form.getByRole("button", { name: "Guardar cambios" }).click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText("Confirmar cambio de estado")).toBeVisible()
    await dialog.getByRole("button", { name: "Seguir editando" }).click()
    await expect(dialog).toHaveCount(0)
    await expect(form.getByLabel("Nombre")).toHaveValue(newName)
    await expect(await categoryByKey(request, headers, "chamoy")).toMatchObject({
      name: chamoy.name,
      active: true,
      coming_soon: false,
    })

    await form.getByRole("button", { name: "Guardar cambios" }).click()
    await dialog.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(page.getByTestId("catalogue-card-chamoy").getByRole("heading", { name: newName })).toBeVisible()

    const persisted = await categoryByKey(request, headers, "chamoy")
    expect(persisted).toMatchObject({
      name: newName,
      active: false,
      coming_soon: true,
      interaction_locked: true,
    })

    await page.reload()
    await expect(page.getByTestId("catalogue-card-chamoy").getByRole("heading", { name: newName })).toBeVisible()
    await expect(page.getByTestId("catalogue-card-chamoy").getByText("Próximamente", { exact: true })).toBeVisible()

    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.getByTestId(/^catalogue-card-/)).toHaveCount(6)
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: screenshotPath("mobile-list.png"), fullPage: true })
    await page.getByTestId("catalogue-card-chamoy").getByRole("button", { name: /^Editar/ }).click()
    await expect(form).toBeVisible()
    const mobileContent = form.locator("form > section").first()
    const mobileConfiguration = form.locator("form > aside")
    const [mobileContentBox, mobileConfigurationBox] = await Promise.all([
      mobileContent.boundingBox(),
      mobileConfiguration.boundingBox(),
    ])
    expect(mobileContentBox, "El contenido móvil debe tener geometría visible").not.toBeNull()
    expect(mobileConfigurationBox, "La configuración móvil debe tener geometría visible").not.toBeNull()
    if (!mobileContentBox || !mobileConfigurationBox) {
      throw new Error("No se pudo medir el formulario móvil de categoría")
    }

    expect(mobileConfigurationBox.y, "Configuración debe apilarse debajo del contenido").toBeGreaterThan(
      mobileContentBox.y + mobileContentBox.height,
    )
    expect(mobileConfigurationBox.x, "Las columnas apiladas deben alinear su inicio").toBeCloseTo(mobileContentBox.x, 0)
    expect(mobileConfigurationBox.width, "Las columnas apiladas deben usar el mismo ancho").toBeCloseTo(
      mobileContentBox.width,
      0,
    )
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: screenshotPath("mobile-form.png"), fullPage: true })

    expect(problems).toEqual([])
  } finally {
    if (original.length > 0) await restoreCategories(request, headers, original)
  }
})

test("desmarcar Próximamente reactiva la categoría y libera la interacción", async ({ page, request }) => {
  const problems = collectPageProblems(page)
  const headers = await openCatalogue(page, request)
  let original: AdminCategory[] = []

  try {
    original = await ensureSeeded(page, request, headers)
    const chamoy = original.find((category) => category.key === "chamoy")!
    const normalized = await request.put(`/admin/jovy/catalogue/categories/${chamoy.id}`, {
      headers,
      data: { active: true, coming_soon: false, interaction_locked: false },
    })
    expect(normalized.status()).toBe(200)
    await page.reload()

    const card = page.getByTestId("catalogue-card-chamoy")
    const form = page.getByTestId("catalogue-category-form")
    const dialog = page.getByRole("alertdialog")
    const comingSoonSwitch = form.getByRole("switch", { name: "Próximamente" })
    const activeSwitch = form.getByRole("switch", { name: "Activa" })
    const lockedSwitch = form.getByRole("switch", { name: "Interacción bloqueada" })

    // Marcar Próximamente: se guarda inactiva y bloqueada.
    await card.getByRole("button", { name: /^Editar/ }).click()
    await expect(form).toBeVisible()
    await comingSoonSwitch.click()
    await expect(activeSwitch).not.toBeChecked()
    await expect(activeSwitch).toBeDisabled()
    await expect(lockedSwitch).toBeChecked()
    await form.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(card.getByText("Próximamente", { exact: true })).toBeVisible()

    expect(await categoryByKey(request, headers, "chamoy")).toMatchObject({
      active: false,
      coming_soon: true,
      interaction_locked: true,
    })

    await page.reload()
    await expect(card.getByText("Próximamente", { exact: true })).toBeVisible()
    await expect(card.getByText("Bloqueado", { exact: true })).toBeVisible()

    // Desmarcar Próximamente: activa y libre aunque la sesión previa quedó bloqueada.
    await card.getByRole("button", { name: /^Editar/ }).click()
    await expect(form).toBeVisible()
    await expect(comingSoonSwitch).toBeChecked()
    await expect(lockedSwitch).toBeChecked()
    await comingSoonSwitch.click()
    await expect(comingSoonSwitch).not.toBeChecked()
    await expect(activeSwitch).toBeEnabled()
    await expect(activeSwitch).toBeChecked()
    await expect(lockedSwitch).toBeEnabled()
    await expect(lockedSwitch).not.toBeChecked()

    await form.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/interacción libre/)).toBeVisible()
    await dialog.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(card.getByText("Activa", { exact: true })).toBeVisible()
    await expect(card.getByText("Disponible", { exact: true })).toBeVisible()

    expect(await categoryByKey(request, headers, "chamoy")).toMatchObject({
      active: true,
      coming_soon: false,
      interaction_locked: false,
    })

    await page.reload()
    await expect(card.getByText("Activa", { exact: true })).toBeVisible()
    await expect(card.getByText("Disponible", { exact: true })).toBeVisible()

    // Un bloqueo manual sin Próximamente se conserva al guardar.
    await card.getByRole("button", { name: /^Editar/ }).click()
    await expect(form).toBeVisible()
    await expect(lockedSwitch).not.toBeChecked()
    await lockedSwitch.click()
    await expect(lockedSwitch).toBeChecked()
    await expect(activeSwitch).toBeChecked()
    await form.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(card.getByText("Bloqueado", { exact: true })).toBeVisible()
    await expect(card.getByText("Activa", { exact: true })).toBeVisible()

    expect(await categoryByKey(request, headers, "chamoy")).toMatchObject({
      active: true,
      coming_soon: false,
      interaction_locked: true,
    })

    expect(problems).toEqual([])
  } finally {
    if (original.length > 0) await restoreCategories(request, headers, original)
  }
})

test("alterna Próximamente desde la tarjeta con confirmación cancelable y persistente", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const problems = collectPageProblems(page)
  const headers = await openCatalogue(page, request)
  let original: AdminCategory[] = []

  try {
    original = await ensureSeeded(page, request, headers)
    const chamoy = original.find((category) => category.key === "chamoy")!
    const normalized = await request.put(`/admin/jovy/catalogue/categories/${chamoy.id}`, {
      headers,
      data: { active: true, coming_soon: false, interaction_locked: false },
    })
    expect(normalized.status()).toBe(200)
    await page.reload()

    const card = page.getByTestId("catalogue-card-chamoy")
    const switchCard = card.getByRole("switch", { name: "Próximamente" })
    const dialog = page.getByRole("alertdialog")
    await expect(switchCard).not.toBeChecked()
    await expect(card.getByText("Activa", { exact: true })).toBeVisible()
    await expect(card.getByText("Disponible", { exact: true })).toBeVisible()

    // Cancelar la confirmación deja el estado y la persistencia intactos.
    await switchCard.click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText("Marcar como Próximamente")).toBeVisible()
    await dialog.getByRole("button", { name: "Cancelar" }).click()
    await expect(dialog).toHaveCount(0)
    await expect(switchCard).not.toBeChecked()
    expect(await categoryByKey(request, headers, "chamoy")).toMatchObject({
      active: true,
      coming_soon: false,
      interaction_locked: false,
    })

    // Confirmar aplica la regla histórica y se conserva tras recargar.
    await switchCard.click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole("button", { name: "Confirmar" }).click()
    await expect(dialog).toHaveCount(0)
    await expect(switchCard).toBeChecked()
    await expect(card.getByText("Próximamente", { exact: true })).toBeVisible()
    await expect(card.getByText("Bloqueado", { exact: true })).toBeVisible()

    expect(await categoryByKey(request, headers, "chamoy")).toMatchObject({
      active: false,
      coming_soon: true,
      interaction_locked: true,
    })

    await page.reload()
    const reloaded = page.getByTestId("catalogue-card-chamoy")
    await expect(reloaded.getByRole("switch", { name: "Próximamente" })).toBeChecked()
    await expect(reloaded.getByText("Próximamente", { exact: true })).toBeVisible()
    await expect(reloaded.getByText("Bloqueado", { exact: true })).toBeVisible()
    await expect(reloaded.getByText("SÍ", { exact: true })).toBeVisible()
    await page.screenshot({ path: screenshotPath("coming-soon-switch.png"), fullPage: true })

    expect(problems).toEqual([])
  } finally {
    if (original.length > 0) await restoreCategories(request, headers, original)
  }
})

test("vincula categoría comercial, cancela formulario y conserva reordenamiento", async ({ page, request }) => {
  const problems = collectPageProblems(page)
  const headers = await openCatalogue(page, request)
  let original: AdminCategory[] = []
  let temporaryCategoryId: string | null = null

  try {
    original = await ensureSeeded(page, request, headers)
    const stamp = Date.now()
    const created = await request.post("/admin/product-categories", {
      headers,
      data: {
        name: `DEMO Comercial ${stamp}`,
        handle: `demo-comercial-${stamp}`,
        is_active: true,
        is_internal: false,
      },
    })
    expect(created.status()).toBe(200)
    temporaryCategoryId = (await created.json()).product_category.id

    const chamoy = page.getByTestId("catalogue-card-chamoy")
    await chamoy.getByRole("button", { name: /^Editar/ }).click()
    const form = page.getByTestId("catalogue-category-form")
    await form.getByLabel("Categoría comercial de Medusa").selectOption(temporaryCategoryId)
    await form.getByRole("button", { name: "Guardar cambios" }).click()
    // El dato comercial vive en <details> cerrado por defecto: se abre el
    // resumen para verificar el mismo valor sin debilitar la aserción.
    await chamoy.locator("details.jovy-card-details summary").click()
    await expect(chamoy.getByText(`DEMO Comercial ${stamp}`)).toBeVisible()
    expect((await categoryByKey(request, headers, "chamoy")).medusa_category_id).toBe(temporaryCategoryId)

    await chamoy.getByRole("button", { name: /^Editar/ }).click()
    await form.getByLabel("Nombre").fill(`DEMO sin guardar ${stamp}`)
    await form.getByRole("button", { name: "Cancelar" }).click()
    await expect(chamoy).toBeVisible()
    await expect(chamoy.getByRole("heading", { name: `DEMO sin guardar ${stamp}` })).toHaveCount(0)

    const keys = original.map((category) => category.key)
    const expected = [...keys]
    ;[expected[0], expected[1]] = [expected[1], expected[0]]
    await page.getByTestId(`catalogue-card-${keys[1]}`).getByRole("button", { name: /^Subir/ }).click()
    await expect.poll(async () => (await listCategories(request, headers)).map((category) => category.key)).toEqual(expected)

    expect(problems).toEqual([])
  } finally {
    if (original.length > 0) await restoreCategories(request, headers, original)
    if (temporaryCategoryId) await request.delete(`/admin/product-categories/${temporaryCategoryId}`, { headers })
  }
})
