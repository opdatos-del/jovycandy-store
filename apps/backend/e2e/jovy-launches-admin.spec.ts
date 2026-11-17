import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { mkdirSync } from "node:fs"
import path from "node:path"
import {
  collectPageProblems,
  demoPng,
  demoValue,
  openJovySection,
  readEnvFile,
} from "./jovy-block2-helpers"

// El entorno local comparte el servidor de desarrollo con otras sesiones del
// repo; se amplía el tiempo y se permite un reintento para absorber reinicios.
test.describe.configure({ timeout: 120_000, retries: 1 })

type AdminLaunch = {
  id: string
  product_id: string | null
  title: string
  description: string | null
  image_file_id: string | null
  image_url: string | null
  image_resolved_url: string | null
  sort_order: number
  active: boolean
}

const storeHeaders = () => ({
  "x-publishable-api-key": readEnvFile(".store.local.env").MEDUSA_PUBLISHABLE_API_KEY,
})

const launchesAuditDir = path.join(__dirname, "..", ".test-results", "audit-visual", "launches")

function launchesScreenshotPath(name: string) {
  mkdirSync(launchesAuditDir, { recursive: true })
  return path.join(launchesAuditDir, name)
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth }))
  expect(dimensions.scrollWidth, "La vista no debe desbordar horizontalmente").toBeLessThanOrEqual(dimensions.width)
}

async function listLaunches(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.get("/admin/jovy/launches", { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).launches as AdminLaunch[]
}

async function settingsColor(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.get("/admin/jovy/launches/settings", { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).launch_settings.background_color as string
}

async function ownOrder(request: APIRequestContext, headers: Record<string, string>, ownIds: string[]) {
  return (await listLaunches(request, headers))
    .filter((launch) => ownIds.includes(launch.id))
    .map((launch) => launch.id)
}

async function cleanupDemoLaunches(request: APIRequestContext, headers: Record<string, string>) {
  const launches = await listLaunches(request, headers)
  for (const launch of launches.filter((item) => item.title.startsWith("DEMO"))) {
    await request.delete(`/admin/jovy/launches/${launch.id}`, { headers })
  }
}

async function openLaunches(page: Page, request: APIRequestContext) {
  return openJovySection(page, request, {
    label: "Nuevos Lanzamientos",
    url: /\/app\/jovy\/launches$/,
    heading: "Nuevos lanzamientos",
  })
}

test("gestiona lanzamientos con producto, imagen, orden, visibilidad y color persistente", async ({
  page,
  request,
}) => {
  const problems = collectPageProblems(page)
  const headers = await openLaunches(page, request)
  const originalColor = await settingsColor(request, headers)
  const createdIds: string[] = []

  try {
    await cleanupDemoLaunches(request, headers)
    await page.setViewportSize({ width: 1440, height: 960 })

    const products = await request.get("/admin/products?limit=100&fields=id,title,status", { headers })
    expect(products.status()).toBe(200)
    const product = ((await products.json()).products as Array<{ id: string; title: string; status?: string }>).find(
      (item) => item.status === "published",
    )
    expect(product, "Se requiere al menos un producto Medusa para probar el buscador").toBeTruthy()
    if (!product) throw new Error("No hay un producto publicado para probar el buscador")

    await page.screenshot({ path: launchesScreenshotPath("desktop-list-empty.png"), fullPage: true })

    // 1. Lanzamiento asociado a un producto mediante el buscador, desde el modal.
    await page.getByRole("button", { name: "Nuevo Slide" }).click()
    const createDialog = page.getByRole("dialog")
    await expect(createDialog).toBeVisible()
    await expect(createDialog.getByRole("heading", { name: "Nuevo Lanzamiento" })).toBeVisible()
    await expect(createDialog.getByText("Orden: — · arrastra en lista para reordenar")).toBeVisible()
    await expect(createDialog.getByRole("switch", { name: "Activo" })).toBeChecked()
    await page.screenshot({ path: launchesScreenshotPath("modal-nuevo-1440.png") })
    const firstTitle = demoValue("Lanzamiento producto")
    await createDialog.getByLabel("Título").fill(firstTitle)
    await createDialog.getByRole("button", { name: "Opciones adicionales" }).click()
    await createDialog.getByLabel("Descripción").fill("Lanzamiento creado por la suite E2E.")
    await createDialog.getByLabel("Producto publicado de Medusa (buscador)").fill(product.title)
    await createDialog
      .getByRole("button", { name: `Seleccionar ${product.title}` })
      .first()
      .click()
    await createDialog.getByRole("button", { name: "Crear", exact: true }).click()
    await expect(page.getByText(firstTitle).first()).toBeVisible()

    const first = (await listLaunches(request, headers)).find((launch) => launch.title === firstTitle)
    expect(first).toBeTruthy()
    expect(first!.product_id).toBe(product.id)
    createdIds.push(first!.id)

    // 2. Lanzamiento con imagen propia (sin producto) para cubrir la otra vía.
    await page.getByRole("button", { name: "Nuevo Slide" }).click()
    const imageDialog = page.getByRole("dialog")
    const secondTitle = demoValue("Lanzamiento imagen")
    await imageDialog.getByLabel("Título").fill(secondTitle)
    await imageDialog.getByLabel(/Imagen propia \(PNG/).setInputFiles({
      name: "demo-lanzamiento.png",
      mimeType: "image/png",
      buffer: demoPng,
    })
    await expect(imageDialog.getByRole("img", { name: `Vista previa de ${secondTitle}` })).toBeVisible()
    await page.screenshot({ path: launchesScreenshotPath("desktop-form-image-preview.png"), fullPage: true })
    await imageDialog.getByRole("button", { name: "Crear", exact: true }).click()
    await expect(page.getByText(secondTitle).first()).toBeVisible()

    const second = (await listLaunches(request, headers)).find((launch) => launch.title === secondTitle)
    expect(second).toBeTruthy()
    expect(second!.image_file_id).toBeTruthy()
    createdIds.push(second!.id)

    await page.reload()
    await expect(page.getByTestId(`launch-item-${first!.id}`)).toContainText(firstTitle)
    await expect(page.getByTestId(`launch-item-${second!.id}`)).toContainText(secondTitle)
    await expect(page.getByTestId(`launch-item-${second!.id}`).locator("img")).toHaveCount(1)

    // 3. Edición persistente del título.
    const editedTitle = `${firstTitle} editado`
    const editButton = page.getByTestId(`launch-item-${first!.id}`).getByRole("button", { name: /^Editar/ })
    await editButton.click()
    const editDialog = page.getByRole("dialog")
    await expect(editDialog.getByRole("heading", { name: "Editar Lanzamiento" })).toBeVisible()
    await editDialog.getByLabel("Título").fill(editedTitle)
    await editDialog.getByRole("button", { name: "Guardar", exact: true }).click()
    await expect(page.getByTestId(`launch-item-${first!.id}`)).toContainText(editedTitle)
    expect((await listLaunches(request, headers)).find((launch) => launch.id === first!.id)?.title).toBe(
      editedTitle,
    )

    // 3b. El modal es role=dialog: Escape y Cancelar cierran sin persistir cambios.
    const persistedTitle = editedTitle
    await editButton.click()
    const unsavedDialog = page.getByRole("dialog")
    await expect(unsavedDialog).toBeVisible()
    await unsavedDialog.getByLabel("Título").fill("CAMBIO NO GUARDADO")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(editButton).toBeFocused()
    expect((await listLaunches(request, headers)).find((launch) => launch.id === first!.id)?.title).toBe(
      persistedTitle,
    )
    await expect(page.getByTestId(`launch-item-${first!.id}`)).toContainText(persistedTitle)

    await editButton.click()
    await page.getByRole("dialog").getByLabel("Título").fill("OTRO CAMBIO NO GUARDADO")
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect((await listLaunches(request, headers)).find((launch) => launch.id === first!.id)?.title).toBe(
      persistedTitle,
    )

    // 4. Reordenamiento visible en la API.
    await page.getByTestId(`launch-item-${second!.id}`).getByRole("button", { name: /^Subir/ }).click()
    await expect.poll(async () => ownOrder(request, headers, createdIds)).toEqual([second!.id, first!.id])

    // 5. Desactivar oculta el lanzamiento en Store; reactivar lo publica de nuevo.
    await page.getByTestId(`launch-item-${first!.id}`).getByRole("button", { name: "Desactivar" }).click()
    await expect(page.getByTestId(`launch-item-${first!.id}`).getByText("Inactivo")).toBeVisible()
    expect((await listLaunches(request, headers)).find((launch) => launch.id === first!.id)?.active).toBe(false)

    const hiddenStore = await request.get("/store/jovy/launches", { headers: storeHeaders() })
    expect(hiddenStore.status()).toBe(200)
    expect(((await hiddenStore.json()).launches as AdminLaunch[]).map((launch) => launch.id)).not.toContain(
      first!.id,
    )

    await page.getByTestId(`launch-item-${first!.id}`).getByRole("button", { name: "Activar" }).click()
    await expect(page.getByTestId(`launch-item-${first!.id}`).getByText("Activo")).toBeVisible()

    // 6. Preset histórico y hexadecimal: ambos pasan por confirmación y persisten.
    await page.getByRole("button", { name: "Usar color #FF7A00" }).click()
    await expect(page.getByLabel("Color hexadecimal")).toHaveValue("#FF7A00")
    await page.getByRole("button", { name: "Guardar color" }).click()
    const colorDialog = page.getByRole("alertdialog")
    await expect(colorDialog.getByRole("heading", { name: "Guardar color global" })).toBeVisible()
    await colorDialog.getByRole("button", { name: "Guardar color" }).click()
    await expect(page.getByText(/Valor persistido:/)).toContainText("#FF7A00")
    expect(await settingsColor(request, headers)).toBe("#FF7A00")

    await page.getByLabel("Color hexadecimal").fill("#123456")
    await page.getByRole("button", { name: "Guardar color" }).click()
    await colorDialog.getByRole("button", { name: "Guardar color" }).click()
    await expect(page.getByText(/Valor persistido:/)).toContainText("#123456")
    expect(await settingsColor(request, headers)).toBe("#123456")

    await page.reload()
    await expect(page.getByLabel("Color hexadecimal")).toHaveValue("#123456")
    expect(await settingsColor(request, headers)).toBe("#123456")
    await page.screenshot({ path: launchesScreenshotPath("desktop-list-cards.png"), fullPage: true })

    // 7. Cancelar no borra; confirmar sí usa el prompt accesible de Medusa.
    await page.getByTestId(`launch-item-${second!.id}`).getByRole("button", { name: "Eliminar" }).click()
    const deleteDialog = page.getByRole("alertdialog")
    await expect(deleteDialog.getByRole("heading", { name: "Eliminar lanzamiento" })).toBeVisible()
    await deleteDialog.getByRole("button", { name: "Cancelar" }).click()
    await expect(page.getByTestId(`launch-item-${second!.id}`)).toBeVisible()

    await page.getByTestId(`launch-item-${second!.id}`).getByRole("button", { name: "Eliminar" }).click()
    await deleteDialog.getByRole("button", { name: "Eliminar lanzamiento" }).click()
    await expect(page.getByTestId(`launch-item-${second!.id}`)).toHaveCount(0)
    expect((await listLaunches(request, headers)).map((launch) => launch.id)).not.toContain(second!.id)

    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.getByTestId(`launch-item-${first!.id}`)).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: launchesScreenshotPath("mobile-list.png"), fullPage: true })

    expect(problems).toEqual([])
  } finally {
    await cleanupDemoLaunches(request, headers)
    await request.put("/admin/jovy/launches/settings", {
      headers,
      data: { background_color: originalColor },
    })
  }
})

test("rechaza un color hexadecimal inválido sin persistirlo", async ({ page, request }) => {
  const problems = collectPageProblems(page)
  const headers = await openJovySection(page, request, {
    label: "Nuevos Lanzamientos",
    url: /\/app\/jovy\/launches$/,
    heading: "Nuevos lanzamientos",
  })
  const originalColor = await settingsColor(request, headers)

  try {
    await page.getByLabel("Color hexadecimal").fill("teal")
    await expect(page.getByRole("button", { name: "Guardar color" })).toBeDisabled()
    await expect(page.getByText("Usa un color hexadecimal #RGB o #RRGGBB.")).toBeVisible()
    expect(await settingsColor(request, headers)).toBe(originalColor)

    expect(problems).toEqual([])
  } finally {
    await request.put("/admin/jovy/launches/settings", {
      headers,
      data: { background_color: originalColor },
    })
  }
})
