import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test"
import { mkdirSync, readFileSync } from "node:fs"
import path from "node:path"

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

const galleryDir = path.join(__dirname, "..", ".test-results", "audit-visual", "gallery")
const logoDir = path.join(__dirname, "..", ".test-results", "audit-visual", "logos")

function galleryShot(name: string) {
  mkdirSync(galleryDir, { recursive: true })
  return path.join(galleryDir, name)
}

function logoShot(name: string) {
  mkdirSync(logoDir, { recursive: true })
  return path.join(logoDir, name)
}

/**
 * `usePrompt` de Medusa UI se renderiza como `alertdialog` de Radix. El título y
 * el copy de los botones vienen del componente, así que se verifican en cada acción.
 */
async function expectPrompt(page: Page, title: string) {
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("heading", { name: title, exact: true })).toBeVisible()
  return dialog
}

async function confirmPrompt(page: Page, title: string, confirmText: string) {
  const dialog = await expectPrompt(page, title)
  await dialog.getByRole("button", { name: confirmText, exact: true }).click()
  await expect(dialog).toBeHidden()
}

async function cancelPrompt(page: Page, title: string, cancelText = "Cancelar") {
  const dialog = await expectPrompt(page, title)
  await dialog.getByRole("button", { name: cancelText, exact: true }).click()
  await expect(dialog).toBeHidden()
}

/**
 * Abre el menú «Más» de un elemento y ejecuta una acción secundaria por su nombre accesible.
 *
 * El disparador queda deshabilitado mientras hay una mutación en curso (`reordering` o
 * `pendingId`), así que primero se espera a que esté habilitado y luego a que el ítem del
 * menú esté visible; sin esto el clic puede perderse bajo carga y el test cae por timeout.
 */
async function clickGalleryMoreAction(page: Page, id: string, accessibleName: string) {
  const trigger = page.getByTestId(`gallery-item-actions-${id}`)
  await expect(trigger).toBeEnabled()
  await trigger.click()
  const item = page.getByRole("menuitem", { name: accessibleName, exact: true })
  await expect(item).toBeVisible()
  await item.click()
}

async function login(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
  const admin = values(".admin.local.env")
  await page.goto("/app/login")
  const email = page.getByPlaceholder("Email")
  // El Admin en desarrollo recompila al arrancar; un reload resuelve el chunk pendiente.
  try {
    await expect(email).toBeVisible({ timeout: 30_000 })
  } catch {
    await page.reload()
    await expect(email).toBeVisible({ timeout: 30_000 })
  }
  await email.fill(admin.MEDUSA_ADMIN_EMAIL)
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

type Headers = Record<string, string>
type GalleryRow = {
  id: string
  title: string | null
  status: "draft" | "published" | "archived"
  enabled: boolean
  sort_order: number
  starts_at: string | null
  ends_at: string | null
  media_url: string | null
}

async function listGallery(request: APIRequestContext, headers: Headers): Promise<GalleryRow[]> {
  const response = await request.get("/admin/jovy/brand/gallery", { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).items as GalleryRow[]
}

async function uploadMedia(request: APIRequestContext, headers: Headers, name: string) {
  const response = await request.post("/admin/jovy/marketing/media", {
    headers,
    multipart: { files: { name, mimeType: "image/png", buffer: png } },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).file.id as string
}

async function createGalleryItem(
  request: APIRequestContext,
  headers: Headers,
  input: { title: string; sortOrder: number; status?: GalleryRow["status"] },
): Promise<GalleryRow> {
  const mediaFileId = await uploadMedia(request, headers, `${input.title}.png`)
  const response = await request.post("/admin/jovy/brand/gallery", {
    headers,
    data: {
      title: input.title,
      description: null,
      media_file_id: mediaFileId,
      status: input.status ?? "draft",
      enabled: true,
      sort_order: input.sortOrder,
      starts_at: null,
      ends_at: null,
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).item as GalleryRow
}

async function deleteGalleryItem(request: APIRequestContext, headers: Headers, id: string) {
  const response = await request.delete(`/admin/jovy/brand/gallery/${id}`, { headers })
  if (![204, 404].includes(response.status())) {
    console.error(`No se pudo limpiar el elemento de galería ${id}: HTTP ${response.status()}`)
  }
}

async function setGalleryStatus(
  request: APIRequestContext,
  headers: Headers,
  id: string,
  status: GalleryRow["status"],
) {
  const response = await request.put(`/admin/jovy/brand/gallery/${id}`, { headers, data: { status } })
  return response.status()
}

/**
 * El cupo es de simultaneidad. Para que el contador sea determinista, las pruebas
 * de cupo suspenden temporalmente lo ya publicado y lo restauran al terminar.
 */
async function suspendPublished(request: APIRequestContext, headers: Headers) {
  const items = await listGallery(request, headers)
  const published = items.filter((item) => item.status === "published")
  for (const item of published) {
    expect(await setGalleryStatus(request, headers, item.id, "archived")).toBe(200)
  }
  return published.map((item) => item.id)
}

async function restorePublished(request: APIRequestContext, headers: Headers, ids: string[]) {
  for (const id of ids) {
    try {
      const item = (await listGallery(request, headers)).find((entry) => entry.id === id)
      if (item?.status === "archived") {
        const status = await setGalleryStatus(request, headers, id, "published")
        if (status !== 200) console.error(`No se pudo restaurar la galería ${id}: HTTP ${status}`)
      }
    } catch (error) {
      console.error(`No se pudo restaurar la galería ${id}: ${error instanceof Error ? error.message : error}`)
    }
  }
}

test("Galería: carga múltiple, previews, contador, lightbox y responsive", async ({ page, request }) => {
  const runId = `e2e-gallery-upload-${Date.now()}`
  const pageErrors: string[] = []
  const ids: string[] = []
  let headers: Headers | undefined
  let suspended: string[] = []

  try {
    headers = await login(page, request)
    page.on("pageerror", (error) => pageErrors.push(error.message))
    suspended = await suspendPublished(request, headers)

    await page.goto("/app/jovy/brand")
    await expect(page.getByRole("heading", { name: "Elementos de galería" })).toBeVisible()
    await expect(page.getByTestId("gallery-upload-quota")).toContainText("Visibles ahora: 0 de 4")
    await expect(page.getByTestId("gallery-quota-now")).toHaveText("0 de 4")

    const nameA = `${runId}-a.png`
    const nameB = `${runId}-b.png`
    const titleA = `${runId}-a`
    const titleB = `${runId}-b`

    await page.getByLabel("Archivos de galería").setInputFiles([
      { name: nameA, mimeType: "image/png", buffer: png },
      { name: nameB, mimeType: "image/png", buffer: png },
    ])
    await expect(page.getByAltText(`Vista previa de ${nameA}`)).toBeVisible()
    await expect(page.getByAltText(`Vista previa de ${nameB}`)).toBeVisible()

    // Cancelar la confirmación de carga no crea registros ni pierde la selección.
    await page.getByRole("button", { name: "Subir 2 imágenes" }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("alertdialog")).toBeHidden()
    const afterCancel = await listGallery(request, headers)
    expect(afterCancel.some((item) => item.title === titleA || item.title === titleB)).toBe(false)
    await expect(page.getByAltText(`Vista previa de ${nameA}`)).toBeVisible()

    // La carga múltiple exige confirmación y sube los archivos uno por uno.
    await page.getByRole("button", { name: "Subir 2 imágenes" }).click()
    await page.getByRole("button", { name: "Subir imágenes", exact: true }).click()
    await expect(page.getByTestId("gallery-upload-panel").getByText("Creada", { exact: true }))
      .toHaveCount(2, { timeout: 30_000 })

    const listed = await listGallery(request, headers)
    const itemA = listed.find((item) => item.title === titleA)
    const itemB = listed.find((item) => item.title === titleB)
    expect(itemA).toBeTruthy()
    expect(itemB).toBeTruthy()
    expect(itemA?.status).toBe("draft")
    expect(itemA?.media_url).toBeTruthy()
    ids.push(itemA!.id, itemB!.id)

    await expect(page.getByTestId("gallery-items").getByText(titleA, { exact: true })).toBeVisible()
    await expect(page.getByTestId("gallery-items").getByText(titleB, { exact: true })).toBeVisible()
    // Los borradores no consumen el cupo de simultaneidad.
    await expect(page.getByTestId("gallery-quota-now")).toHaveText("0 de 4")

    await page.getByRole("button", { name: `Editar ${titleA}` }).click()
    await expect(page.getByRole("heading", { name: "Editar elemento" })).toBeVisible()
    await page.getByLabel("Estado galería").selectOption("published")
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(page.getByTestId("gallery-quota-now")).toHaveText("1 de 4")
    await expect(page.getByTestId("gallery-upload-quota")).toContainText("Visibles ahora: 1 de 4")

    const trigger = page.getByRole("button", { name: `Ampliar ${titleA}` })
    await trigger.click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(page.getByRole("button", { name: "Cerrar vista ampliada" })).toBeFocused()
    await page.screenshot({ path: galleryShot("gallery-lightbox-1440.png") })
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole("heading", { name: "Cargar imágenes" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: galleryShot("gallery-upload-1440.png"), fullPage: true })
    await page.getByRole("heading", { name: "Elementos de galería" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: galleryShot("gallery-list-1440.png"), fullPage: true })
    await page.setViewportSize({ width: 375, height: 812 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole("heading", { name: "Cargar imágenes" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: galleryShot("gallery-upload-375.png"), fullPage: true })
    await page.getByRole("heading", { name: "Elementos de galería" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: galleryShot("gallery-list-375.png"), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })

    expect(pageErrors).toEqual([])
  } finally {
    if (headers) {
      for (const id of ids) await deleteGalleryItem(request, headers, id)
      await restorePublished(request, headers, suspended)
    }
  }
})

test("Galería: orden con persistencia y eliminación con confirmación", async ({ page, request }) => {
  // La prueba encadena login, creación de elementos, reordenamiento persistido, dos
  // aperturas de menú, eliminación y capturas en dos viewports. Son varias operaciones de
  // red y un Admin en desarrollo, así que 60 s no alcanzan bajo la carga de la suite completa.
  test.setTimeout(90_000)

  const runId = `e2e-gallery-order-${Date.now()}`
  const pageErrors: string[] = []
  const ids: string[] = []
  let headers: Headers | undefined

  try {
    headers = await login(page, request)
    page.on("pageerror", (error) => pageErrors.push(error.message))
    const existing = await listGallery(request, headers)
    const base = existing.reduce((next, item) => Math.max(next, item.sort_order + 1), 0)
    const titleA = `${runId}-a`
    const titleB = `${runId}-b`
    const itemA = await createGalleryItem(request, headers, { title: titleA, sortOrder: base })
    const itemB = await createGalleryItem(request, headers, { title: titleB, sortOrder: base + 1 })
    ids.push(itemA.id, itemB.id)

    await page.goto("/app/jovy/brand")
    await expect(page.getByTestId("gallery-items").getByText(titleA, { exact: true })).toBeVisible()

    // Cancelar la confirmación de reorden no cambia el orden persistido.
    await page.getByRole("button", { name: `Subir ${titleB}` }).click()
    await expect(page.getByRole("heading", { name: "Cambiar orden de la galería" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("heading", { name: "Cambiar orden de la galería" })).toBeHidden()
    let current = await listGallery(request, headers)
    expect(current.find((item) => item.id === itemA.id)?.sort_order).toBe(base)
    expect(current.find((item) => item.id === itemB.id)?.sort_order).toBe(base + 1)

    await page.getByRole("button", { name: `Subir ${titleB}` }).click()
    await page.getByRole("button", { name: "Cambiar orden" }).click()
    await expect.poll(async () => {
      const items = await listGallery(request, headers!)
      return (items.find((item) => item.id === itemB.id)?.sort_order ?? base + 1)
        < (items.find((item) => item.id === itemA.id)?.sort_order ?? base)
    }).toBe(true)
    await expect.poll(async () => {
      const rows = await page.getByTestId("gallery-items").getByRole("listitem").allInnerTexts()
      const indexA = rows.findIndex((row) => row.includes(titleA))
      const indexB = rows.findIndex((row) => row.includes(titleB))
      return indexA >= 0 && indexB >= 0 && indexB < indexA
    }).toBe(true)

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole("heading", { name: "Elementos de galería" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: galleryShot("gallery-order-1440.png"), fullPage: true })

    // Cancelar el borrado mantiene el registro.
    await clickGalleryMoreAction(page, itemA.id, `Eliminar ${titleA}`)
    await expect(page.getByRole("heading", { name: "Eliminar elemento de galería" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("heading", { name: "Eliminar elemento de galería" })).toBeHidden()
    current = await listGallery(request, headers)
    expect(current.some((item) => item.id === itemA.id)).toBe(true)

    await clickGalleryMoreAction(page, itemA.id, `Eliminar ${titleA}`)
    await page.getByRole("button", { name: "Eliminar elemento" }).click()
    await expect(page.getByText("Elemento eliminado.", { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect.poll(async () => {
      const items = await listGallery(request, headers!)
      return items.some((item) => item.id === itemA.id)
    }, { timeout: 15_000 }).toBe(false)
    ids.splice(ids.indexOf(itemA.id), 1)

    await page.setViewportSize({ width: 375, height: 812 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole("heading", { name: "Elementos de galería" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: galleryShot("gallery-order-375.png"), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })

    expect(pageErrors).toEqual([])
  } finally {
    if (headers) {
      for (const id of ids) await deleteGalleryItem(request, headers, id)
    }
  }
})

test("Galería: límite de cuatro simultáneos y error de backend legible", async ({ page, request }) => {
  const runId = `e2e-gallery-quota-${Date.now()}`
  const pageErrors: string[] = []
  const ids: string[] = []
  let headers: Headers | undefined
  let suspended: string[] = []

  try {
    headers = await login(page, request)
    page.on("pageerror", (error) => pageErrors.push(error.message))
    suspended = await suspendPublished(request, headers)
    const existing = await listGallery(request, headers)
    const base = existing.reduce((next, item) => Math.max(next, item.sort_order + 1), 0)
    const titles = Array.from({ length: 5 }, (_, index) => `${runId}-${index + 1}`)
    for (const [index, title] of titles.entries()) {
      const item = await createGalleryItem(request, headers, { title, sortOrder: base + index })
      ids.push(item.id)
    }

    await page.goto("/app/jovy/brand")
    await expect(page.getByTestId("gallery-upload-quota")).toContainText("Visibles ahora: 0 de 4")
    await expect(page.getByTestId("gallery-quota-now")).toHaveText("0 de 4")

    for (const title of titles.slice(0, 4)) {
      await page.getByRole("button", { name: `Publicar ${title}` }).click()
      await expect.poll(async () => {
        const items = await listGallery(request, headers!)
        return items.find((item) => item.title === title)?.status
      }).toBe("published")
    }

    await expect(page.getByTestId("gallery-quota-now")).toHaveText("4 de 4")
    await expect(page.getByTestId("gallery-upload-quota")).toContainText("Visibles ahora: 4 de 4")

    // El quinto elemento solapa con los cuatro publicados: el backend rechaza y la UI lo muestra.
    await page.getByRole("button", { name: `Publicar ${titles[4]}` }).click()
    await expect(page.getByTestId("gallery-action-error")).toContainText("cuatro elementos activos publicados")
    await expect.poll(async () => {
      const items = await listGallery(request, headers!)
      return items.find((item) => item.title === titles[4])?.status
    }).toBe("draft")

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole("heading", { name: "Cargar imágenes" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: galleryShot("gallery-quota-1440.png"), fullPage: true })
    await page.getByRole("heading", { name: "Elementos de galería" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: galleryShot("gallery-quota-error-1440.png"), fullPage: true })
    await page.setViewportSize({ width: 375, height: 812 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole("heading", { name: "Elementos de galería" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: galleryShot("gallery-quota-375.png"), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })

    expect(pageErrors).toEqual([])
  } finally {
    if (headers) {
      for (const id of ids) await deleteGalleryItem(request, headers, id)
      await restorePublished(request, headers, suspended)
    }
  }
})

test("administra logo y recorte no destructivo", async ({ page, request }) => {
  const store = values(".store.local.env")
  const runId = `e2e-brand-logo-${Date.now()}`
  let headers: Record<string, string> | undefined
  let logoId = ""
  const pageErrors: string[] = []

  try {
    headers = await login(page, request)
    page.on("pageerror", (error) => pageErrors.push(error.message))
    await page.goto("/app/jovy/logos")
    await expect(page.getByRole("heading", { name: "Logos", exact: true, level: 1 })).toBeVisible()
    await page.getByRole("button", { name: "Nuevo logo" }).click()
    const formPanel = page.getByTestId("jovy-logo-form-panel")
    await expect(formPanel.getByRole("heading", { name: "Nuevo logo", exact: true })).toBeVisible()
    await page.getByLabel("Slug logo").fill(runId)
    await page.getByLabel("Nombre logo").fill(`Logo DEMO ${runId}`)
    await page.getByLabel("Texto alternativo logo").fill("Logo de prueba")
    // El límite de 20 MB se valida en cliente antes de llamar al backend.
    await page.getByLabel("Archivo de logo").setInputFiles({
      name: "logo-grande.png",
      mimeType: "image/png",
      buffer: Buffer.concat([png, Buffer.alloc(21 * 1024 * 1024)]),
    })
    await expect(page.getByRole("alert")).toContainText("excede 20 MB")
    await expect(page.getByAltText("Logo de prueba")).toHaveCount(0)
    await page.getByLabel("Archivo de logo").setInputFiles({ name: "logo-demo.png", mimeType: "image/png", buffer: png })
    await expect(page.getByAltText("Logo de prueba")).toBeVisible()

    const cropSummary = formPanel.getByTestId("logo-crop-summary")
    const openCrop = formPanel.getByTestId("logo-crop-open")
    const modal = page.getByTestId("logo-crop-modal")
    await expect(cropSummary).toContainText("zoom 1.00×")

    const setZoom = async (dialog: Locator, target: number) => {
      const slider = dialog.getByTestId("logo-crop-zoom-slider")
      await slider.focus()
      const steps = Math.round((target - Number(await slider.inputValue())) / 0.05)
      for (let step = 0; step < Math.abs(steps); step += 1) {
        await slider.press(steps > 0 ? "ArrowRight" : "ArrowLeft")
      }
    }
    const dragCanvas = async (dialog: Locator) => {
      const box = await dialog.getByTestId("logo-crop-canvas").boundingBox()
      expect(box).not.toBeNull()
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 + 12)
        await page.mouse.up()
      }
    }

    await openCrop.click()
    await expect(modal).toBeVisible()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(modal.getByRole("heading", { name: "Ajustar imagen", exact: true })).toBeVisible()
    await expect(modal.getByText("Vista previa del recorte", { exact: true })).toBeVisible()
    await expect(modal.getByText("Recomendado: 75%", { exact: true })).toBeVisible()
    await expect(modal.getByText("Arrastra la imagen para mover · rueda para zoom · doble clic = 100%", { exact: true })).toBeVisible()
    await expect(modal.getByTestId("logo-crop-help-panel")).toBeVisible()
    for (const section of ["Vista previa", "Zoom", "Consejos", "Botones"]) {
      await expect(modal.getByTestId("logo-crop-help-panel").getByText(section, { exact: true })).toBeVisible()
    }
    await expect.poll(() => modal.evaluate((node) => node.contains(document.activeElement))).toBe(true)
    await expect(modal.getByTestId("logo-crop-undo")).toBeDisabled()
    await expect(modal.getByTestId("logo-crop-grid-toggle")).toHaveAttribute("aria-pressed", "true")

    await modal.getByTestId("logo-crop-help-toggle").click()
    await expect(modal.getByTestId("logo-crop-help-panel")).toBeHidden()
    await modal.getByTestId("logo-crop-help-toggle").click()
    await expect(modal.getByTestId("logo-crop-help-panel")).toBeVisible()
    const originalToggle = modal.getByTestId("logo-crop-original-toggle")
    await originalToggle.click()
    await expect(originalToggle).toHaveAttribute("aria-pressed", "true")
    await originalToggle.click()
    await expect(originalToggle).toHaveAttribute("aria-pressed", "false")

    await setZoom(modal, 1.25)
    await expect(modal.getByTestId("logo-crop-zoom-value")).toHaveText("1.25×")
    await expect(modal.getByTestId("logo-crop-zoom-percent")).toHaveText("125%")
    await dragCanvas(modal)
    expect(await modal.getByTestId("logo-crop-offset").innerText()).not.toContain("x: 0%")
    await expect(modal.getByTestId("logo-crop-undo")).toBeEnabled()
    await modal.getByTestId("logo-crop-undo").click()
    await expect(modal.getByTestId("logo-crop-offset")).toHaveText("x: 0% · y: 0%")
    await expect(modal.getByTestId("logo-crop-zoom-value")).toHaveText("1.25×")
    await modal.getByTestId("logo-crop-reset").click()
    await expect(modal).toBeVisible()
    await expect(modal.getByTestId("logo-crop-zoom-value")).toHaveText("1.00×")

    // Cancelar descarta el borrador: el crop del formulario permanece intacto.
    await modal.getByTestId("logo-crop-cancel").click()
    await expect(modal).toBeHidden()
    await expect(openCrop).toBeFocused()
    await expect(cropSummary).toContainText("zoom 1.00×")
    await expect(cropSummary).toContainText("x: 0% · y: 0%")

    await openCrop.click()
    await expect(modal.getByTestId("logo-crop-zoom-value")).toHaveText("1.00×")
    // Escape también cierra sin aplicar y devuelve el foco al disparador.
    await page.keyboard.press("Escape")
    await expect(modal).toBeHidden()
    await expect(openCrop).toBeFocused()

    await openCrop.click()
    await setZoom(modal, 1.25)
    await dragCanvas(modal)
    await modal.getByTestId("logo-crop-apply").click()
    await expect(modal).toBeHidden()
    await expect(cropSummary).toContainText("zoom 1.25×")
    await expect(cropSummary).not.toContainText("x: 0% · y: 0%")

    await formPanel.getByRole("button", { name: "Crear logo" }).click()
    await confirmPrompt(page, "Crear logo", "Crear logo")
    await expect(page.getByText(`Logo DEMO ${runId}`)).toBeVisible()

    const listed = await request.get("/admin/jovy/brand/logos", { headers })
    const created = (await listed.json()).logos.find((logo: { slug: string }) => logo.slug === runId)
    expect(created).toBeTruthy()
    logoId = created.id
    // La relación canónica es family_ids; no se envía CSV libre.
    expect(created.families).toBeNull()
    expect(created.family_ids).toEqual([])
    expect(created.crop.zoom).toBe(1.25)
    expect(Math.abs(created.crop.offset_x) + Math.abs(created.crop.offset_y)).toBeGreaterThan(0)

    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect.poll(async () => (await page.getByTestId("jovy-logo-grid").evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length))).toBe(4)
    await page.screenshot({ path: ".test-results/audit-visual/logos/list-1440.png", fullPage: true })
    await page.setViewportSize({ width: 375, height: 812 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: ".test-results/audit-visual/logos/list-375.png", fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })

    // Recargar y editar comprueba que el crop se hidrata desde el backend.
    await page.reload()
    await expect(page.getByTestId("jovy-logo-grid")).toBeVisible()
    const reloadedRow = page.locator("article").filter({ hasText: `Logo DEMO ${runId}` })
    await reloadedRow.getByRole("button", { name: "Editar" }).click()
    const editPanel = page.getByTestId("jovy-logo-form-panel")
    await expect(editPanel.getByRole("heading", { name: "Editar logo", exact: true })).toBeVisible()
    await expect(editPanel.getByTestId("logo-crop-summary")).toContainText("zoom 1.25×")
    await editPanel.getByTestId("logo-crop-open").click()
    const persistedModal = page.getByTestId("logo-crop-modal")
    await expect(persistedModal.getByTestId("logo-crop-zoom-value")).toHaveText("1.25×")
    await persistedModal.getByTestId("logo-crop-cancel").click()
    await expect(persistedModal).toBeHidden()

    const editSummary = editPanel.getByTestId("logo-crop-summary")
    await expect(editSummary).toContainText("zoom 1.25×")
    await editPanel.getByTestId("logo-crop-open").click()
    const editModal = page.getByTestId("logo-crop-modal")
    await expect(editModal.getByTestId("logo-crop-zoom-value")).toHaveText("1.25×")
    await editModal.getByTestId("logo-crop-reset").click()
    await expect(editModal).toBeVisible()
    await expect(editModal.getByTestId("logo-crop-zoom-value")).toHaveText("1.00×")
    await expect(editModal.getByTestId("logo-crop-offset")).toHaveText("x: 0% · y: 0%")
    await editModal.getByTestId("logo-crop-apply").click()
    await expect(editModal).toBeHidden()
    await expect(editSummary).toContainText("zoom 1.00×")

    // Cancelar la confirmación de guardado conserva el recorte persistido.
    await editPanel.getByRole("button", { name: "Guardar cambios" }).click()
    await cancelPrompt(page, "Guardar cambios del logo", "Seguir editando")
    await expect(editSummary).toContainText("zoom 1.00×")
    const afterCancel = await request.get(`/admin/jovy/brand/logos/${logoId}`, { headers })
    expect((await afterCancel.json()).logo.crop).toEqual(created.crop)

    const savedLogo = page.waitForResponse((response) =>
      response.url().includes(`/admin/jovy/brand/logos/${logoId}`)
      && response.request().method() === "PUT"
      && response.ok())
    await editPanel.getByRole("button", { name: "Guardar cambios" }).click()
    await confirmPrompt(page, "Guardar cambios del logo", "Guardar cambios")
    await savedLogo
    const saved = await request.get(`/admin/jovy/brand/logos/${logoId}`, { headers })
    expect((await saved.json()).logo.crop).toEqual({ zoom: 1, offset_x: 0, offset_y: 0 })

    const editedRow = page.locator("article").filter({ hasText: `Logo DEMO ${runId}` })
    await editedRow.getByRole("button", { name: "Desactivar" }).click()
    await confirmPrompt(page, "Desactivar logo", "Desactivar logo")
    // El clic sólo despacha la mutación; se consulta la Store API hasta que el logo deja de exponerse.
    await expect.poll(async () => {
      const response = await request.get("/store/jovy/brand/logos", {
        headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY },
      })
      expect(response.status()).toBe(200)
      return (await response.json()).logos.some((logo: { id: string }) => logo.id === logoId)
    }).toBe(false)
    await page.reload()
    await expect(page.locator("article").filter({ hasText: `Logo DEMO ${runId}` }).getByText("Inactivo")).toBeVisible()
    await page.locator("article").filter({ hasText: `Logo DEMO ${runId}` }).getByRole("button", { name: "Activar" }).click()
    await confirmPrompt(page, "Activar logo", "Activar logo")
    await expect.poll(async () => (await (await request.get(`/admin/jovy/brand/logos/${logoId}`, { headers })).json()).logo.enabled).toBe(true)

    // Cancelar confirmación no persiste eliminación.
    const activeRow = page.locator("article").filter({ hasText: `Logo DEMO ${runId}` })
    await activeRow.getByRole("button", { name: "Eliminar" }).click()
    await cancelPrompt(page, "Eliminar logo", "Cancelar")
    await expect(activeRow).toBeVisible()
    const kept = await request.get(`/admin/jovy/brand/logos/${logoId}`, { headers })
    expect(kept.status()).toBe(200)
    expect((await kept.json()).logo.id).toBe(logoId)
    expect(pageErrors).toEqual([])
  } finally {
    if (logoId && headers) {
      const response = await request.delete(`/admin/jovy/brand/logos/${logoId}`, { headers })
      if (![204, 404].includes(response.status())) console.error(`No se pudo limpiar Logo DEMO: HTTP ${response.status()}`)
    }
  }
})

type LogoRow = {
  id: string
  slug: string
  name: string
  enabled: boolean
  family_ids: string[]
}

async function listLogos(request: APIRequestContext, headers: Headers): Promise<LogoRow[]> {
  const response = await request.get("/admin/jovy/brand/logos", { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).logos as LogoRow[]
}

test("filtra logos por texto, categoría y estado sin alterar el orden global", async ({ page, request }) => {
  const runId = `e2e-logo-filter-${Date.now()}`
  const headers = await login(page, request)
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))

  const logoIds: string[] = []
  const familyIds: string[] = []
  const productCategoryIds: string[] = []
  const restore: Array<{ id: string; medusa_category_id: string | null }> = []

  const nameA = `${runId}-sazonador`
  const nameB = `${runId}-inactivo`

  try {
    const seeded = await request.post("/admin/jovy/catalogue/categories/seed", { headers })
    expect(seeded.status()).toBe(200)
    const categoriesResponse = await request.get("/admin/jovy/catalogue/categories", { headers })
    expect(categoriesResponse.status()).toBe(200)
    const categories = (await categoriesResponse.json()).categories as Array<{
      id: string
      key: string
      medusa_category_id: string | null
    }>
    const sazonador = categories.find((category) => category.key === "sazonador")
    const chamoy = categories.find((category) => category.key === "chamoy")
    expect(sazonador, "La categoría sazonador debe existir tras el seed").toBeTruthy()
    expect(chamoy, "La categoría chamoy debe existir tras el seed").toBeTruthy()
    restore.push(
      { id: sazonador!.id, medusa_category_id: sazonador!.medusa_category_id },
      { id: chamoy!.id, medusa_category_id: chamoy!.medusa_category_id },
    )

    const productCategories: string[] = []
    for (const [index, label] of ["Sazonador filtros", "Chamoy filtros"].entries()) {
      const created = await request.post("/admin/product-categories", {
        headers,
        data: { name: `${label} ${runId}`, handle: `${runId}-pc-${index}`, is_active: true, is_internal: false },
      })
      expect(created.status()).toBe(200)
      productCategories.push((await created.json()).product_category.id)
    }
    productCategoryIds.push(...productCategories)

    for (const [index, category] of [sazonador!, chamoy!].entries()) {
      const linked = await request.put(`/admin/jovy/catalogue/categories/${category.id}`, {
        headers,
        data: { medusa_category_id: productCategories[index] },
      })
      expect(linked.status()).toBe(200)
    }

    const families: string[] = []
    for (const [index, categoryId] of productCategories.entries()) {
      const family = await request.post("/admin/jovy/catalogue/families", {
        headers,
        data: {
          name: `Familia filtros ${index} ${runId}`,
          slug: `familia-filtros-${index}-${runId}`,
          medusa_category_id: categoryId,
          sort_order: index,
        },
      })
      expect(family.status()).toBe(201)
      families.push((await family.json()).family.id)
    }
    familyIds.push(...families)

    const mediaFileId = await uploadMedia(request, headers, `${runId}.png`)
    for (const input of [
      { slug: `${runId}-sazonador`, name: nameA, family_ids: [families[0]], enabled: true },
      { slug: `${runId}-inactivo`, name: nameB, family_ids: [families[0], families[1]], enabled: false },
    ]) {
      const created = await request.post("/admin/jovy/brand/logos", {
        headers,
        data: { ...input, alt: input.name, media_file_id: mediaFileId, crop: null, sort_order: 0 },
      })
      expect(created.status()).toBe(201)
      logoIds.push((await created.json()).logo.id)
    }

    const before = await listLogos(request, headers)
    const total = before.length
    const active = before.filter((logo) => logo.enabled).length
    const orderBefore = before.map((logo) => logo.id)

    await page.goto("/app/jovy/logos")
    await expect(page.getByRole("heading", { name: "Logos", exact: true, level: 1 })).toBeVisible()
    await expect(page.getByTestId("logo-stat-total")).toHaveText(`Total: ${total}`)
    await expect(page.getByTestId("logo-stat-active")).toHaveText(`Activos: ${active}`)
    await expect(page.getByTestId("logo-stat-filtered")).toHaveText(`Filtrados: ${total}`)

    const cardA = page.locator("article").filter({ hasText: nameA })
    const cardB = page.locator("article").filter({ hasText: nameB })

    // Texto: nombre, slug y family_id acotan la cuadrícula sin tocar el orden.
    await page.getByLabel("Buscar logos").fill(runId)
    await expect(page.getByTestId("logo-stat-filtered")).toHaveText("Filtrados: 2")
    await expect(cardA).toBeVisible()
    await expect(cardB).toBeVisible()
    await expect(page.locator("article")).toHaveCount(2)

    // Categoría derivada de las familias canónicas: ambas pertenecen a sazonador.
    await page.getByLabel("Filtrar logos por categoría").selectOption("sazonador")
    await expect(page.getByTestId("logo-stat-filtered")).toHaveText("Filtrados: 2")

    // Estado: el inactivo queda solo y el activo desaparece.
    await page.getByLabel("Filtrar logos por estado").selectOption("inactive")
    await expect(page.getByTestId("logo-stat-filtered")).toHaveText("Filtrados: 1")
    await expect(cardB).toBeVisible()
    await expect(cardA).toHaveCount(0)

    // Categoría chamoy: solo el logo que también tiene esa familia.
    await page.getByLabel("Filtrar logos por categoría").selectOption("chamoy")
    await expect(cardB).toBeVisible()
    await page.getByLabel("Filtrar logos por estado").selectOption("active")
    await expect(page.getByTestId("logo-stat-filtered")).toHaveText("Filtrados: 0")
    await expect(page.getByText("No hay logos con esos filtros", { exact: true })).toBeVisible()

    await page.getByLabel("Buscar logos").fill("sin-coincidencias-en-el-catalogo")
    await page.getByLabel("Filtrar logos por estado").selectOption("all")
    await expect(page.getByTestId("logo-stat-filtered")).toHaveText("Filtrados: 0")

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({ path: logoShot("filter-1440.png"), fullPage: true })

    // Limpiar filtros restaura la cuadrícula completa y no reordena nada.
    await page.locator('[data-testid="jovy-logos-panel"]').getByRole("button", { name: "Limpiar filtros" }).first().click()
    await expect(page.getByLabel("Buscar logos")).toHaveValue("")
    await expect(page.getByLabel("Filtrar logos por categoría")).toHaveValue("")
    await expect(page.getByLabel("Filtrar logos por estado")).toHaveValue("all")
    await expect(page.getByTestId("logo-stat-filtered")).toHaveText(`Filtrados: ${total}`)
    await expect(cardA).toBeVisible()
    await expect(cardB).toBeVisible()
    await expect(page.locator("article")).toHaveCount(total)

    const orderAfter = (await listLogos(request, headers)).map((logo) => logo.id)
    expect(orderAfter).toEqual(orderBefore)
    expect(pageErrors).toEqual([])
  } finally {
    for (const id of logoIds) {
      const response = await request.delete(`/admin/jovy/brand/logos/${id}`, { headers })
      if (![204, 404].includes(response.status())) console.error(`No se pudo limpiar el logo ${id}: HTTP ${response.status()}`)
    }
    for (const id of familyIds) {
      const response = await request.delete(`/admin/jovy/catalogue/families/${id}`, { headers })
      if (![204, 404].includes(response.status())) console.error(`No se pudo limpiar la familia ${id}: HTTP ${response.status()}`)
    }
    for (const category of restore) {
      await request.put(`/admin/jovy/catalogue/categories/${category.id}`, {
        headers,
        data: { medusa_category_id: category.medusa_category_id },
      })
    }
    for (const id of productCategoryIds) {
      const response = await request.delete(`/admin/product-categories/${id}`, { headers })
      if (![200, 204, 404].includes(response.status())) console.error(`No se pudo limpiar la categoría ${id}: HTTP ${response.status()}`)
    }
  }
})
