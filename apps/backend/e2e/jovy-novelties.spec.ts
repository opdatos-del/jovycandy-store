import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { mkdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { collectPageProblems, demoValue, readEnvFile, signIn, waitForServer } from "./jovy-block2-helpers"

/**
 * Novedades administra el carrusel horizontal real de Store. La spec usa un
 * WebM verdadero para comprobar la firma binaria, la vista previa reproducible
 * y el `media_type` que deriva el backend.
 */
test.describe.configure({ timeout: 180_000, retries: 1 })

const webmFixture = path.join(__dirname, "fixtures", "novelty.webm")
const auditDir = path.join(__dirname, "..", ".test-results", "audit-visual", "novelties")

function screenshot(name: string) {
  mkdirSync(auditDir, { recursive: true })
  return path.join(auditDir, name)
}

type AdminEvent = {
  id: string
  title: string
  title_en: string | null
  slug: string
  status: string
  enabled: boolean
  media_file_id: string | null
  media_type: string | null
  priority: number
}

const storeHeaders = () => ({
  "x-publishable-api-key": readEnvFile(".store.local.env").MEDUSA_PUBLISHABLE_API_KEY,
})

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000)

const localInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

/**
 * Vite puede avisar de un segundo `createRoot` al aplicar HMR sobre el shell del
 * Admin durante una recarga. Es ruido de desarrollo conocido y no proviene de la
 * pantalla; cualquier otro error de consola o `pageerror` sigue fallando.
 */
const unexpectedProblems = (problems: string[]) =>
  problems.filter((problem) => !problem.includes("ReactDOMClient.createRoot() on a container"))

async function adminEvents(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.get("/admin/jovy/events", { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).events as AdminEvent[]
}

async function adminEvent(request: APIRequestContext, headers: Record<string, string>, id: string) {
  return (await adminEvents(request, headers)).find((event) => event.id === id)
}

async function storeEvent(request: APIRequestContext, id: string) {
  const response = await request.get("/store/jovy/events", { headers: storeHeaders() })
  expect(response.status()).toBe(200)
  return ((await response.json()).events as Array<{ id: string; media_type: string | null }>).find(
    (event) => event.id === id,
  )
}

/** La limpieza no debe convertir un reinicio del servidor en un fallo de UI. */
async function bestEffortDelete(request: APIRequestContext, headers: Record<string, string>, path: string) {
  try {
    await request.delete(path, { headers })
  } catch {
    // Los restos se eliminan al inicio de la siguiente ejecución.
  }
}

async function createType(request: APIRequestContext, headers: Record<string, string>, name: string) {
  const response = await request.post("/admin/jovy/events/types", {
    headers,
    data: { code: `demo-tipo-${Date.now()}`, name },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).event_type as { id: string }
}

/** Limpia restos de ejecuciones interrumpidas antes de capturar la bandeja. */
async function removeStaleDemoNovelties(request: APIRequestContext, headers: Record<string, string>) {
  const stale = (await adminEvents(request, headers)).filter((event) => event.slug.startsWith("demo-novedad"))
  for (const event of stale) await request.delete(`/admin/jovy/events/${event.id}`, { headers })
}

async function openNovelties(page: Page, request: APIRequestContext) {
  await waitForServer(request)
  await page.goto("/app/jovy")
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible()
  await page
    .getByRole("navigation")
    .first()
    .getByRole("link", { name: "Novedades", exact: true })
    .click()
  await expect(page).toHaveURL(/\/app\/jovy\/novelties$/)
  await expect(page.getByRole("heading", { name: "Novedades", level: 1 })).toBeVisible()
}

async function answerPrompt(page: Page, title: string, action: string) {
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(title, { exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: action, exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

/**
 * `medusa develop` puede reiniciarse si otra sesión toca el repositorio. El
 * helper compartido ya espera `/health`, pero un reinicio puede ocurrir justo
 * entre esa espera y el primer render del login; se reintenta el acceso.
 */
async function robustSignIn(page: Page, request: APIRequestContext) {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await signIn(page, request)
    } catch (error) {
      lastError = error
      await page.waitForTimeout(3_000)
    }
  }
  throw lastError
}

test("administra el carrusel de Novedades con WebM real, publicación, archivo y evento exacto", async ({
  page,
  request,
}) => {
  const problems = collectPageProblems(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  const headers = await robustSignIn(page, request)

  const title = demoValue("Novedad DEMO")
  const slug = `demo-novedad-${Date.now()}`
  let typeId = ""
  let eventId = ""

  try {
    await removeStaleDemoNovelties(request, headers)
    typeId = (await createType(request, headers, demoValue("Tipo novedad"))).id

    await openNovelties(page, request)
    await expect(page.getByLabel("Buscar novedad")).toBeVisible()
    await expect(page.getByLabel("Tipo de medio")).toBeVisible()
    await expect(page.getByLabel("Actividad")).toBeVisible()

    await page.getByRole("button", { name: "Nueva novedad" }).first().click()
    const form = page.getByTestId("novelty-form")
    await expect(form).toBeVisible()
    await expect(page.getByRole("heading", { name: "Nueva novedad", exact: true })).toBeVisible()

    await form.getByLabel("Título en español").fill(title)
    await form.getByLabel("Título en inglés").fill("Demo novelty EN")
    await form.getByLabel("Slug público").fill(slug)
    await form.getByLabel("Descripción").fill("Novedad creada por E2E")
    await form.getByLabel("Tipo de evento").selectOption(typeId)
    await form.getByLabel("Inicio de vigencia").fill(localInput(minutesFromNow(-60)))
    await form.getByLabel("Fin de vigencia").fill(localInput(minutesFromNow(60)))
    await form.getByLabel("Prioridad", { exact: true }).fill("7")

    await form.getByLabel("Multimedia de la novedad").setInputFiles(webmFixture)
    const formPreview = form.getByTestId("novelty-form-preview")
    await expect(formPreview).toBeVisible()
    await expect(formPreview).toHaveAttribute("controls", "")
    await page.screenshot({ path: screenshot("01-editor-nueva-con-webm.png"), fullPage: true })
    await page.locator("#novelty-editor").screenshot({ path: screenshot("01b-editor-completo.png") })

    await form.getByRole("button", { name: "Crear novedad" }).click()
    await expect(page.getByTestId("novelty-form")).toHaveCount(0)

    await expect
      .poll(async () => (await adminEvents(request, headers)).find((event) => event.title === title)?.id)
      .toBeTruthy()
    eventId = (await adminEvents(request, headers)).find((event) => event.title === title)!.id

    const card = page.getByTestId(`novelty-card-${eventId}`)
    await expect(card.getByRole("heading", { name: title, level: 3 })).toBeVisible()
    await expect(card.getByTestId(`novelty-preview-${eventId}`)).toBeVisible()
    await expect(card.getByText("Borrador", { exact: true })).toBeVisible()
    await expect(card.getByTestId(`novelty-store-state-${eventId}`)).toHaveText("Fuera de Store")
    await page.screenshot({ path: screenshot("02-desktop-grid-borrador.png"), fullPage: true })
    await card.screenshot({ path: screenshot("02b-card-borrador.png") })

    await card.getByLabel(`Prioridad de ${title}`).fill("9")
    await card.getByRole("button", { name: "Guardar orden" }).click()
    await expect.poll(async () => (await adminEvent(request, headers, eventId))?.priority).toBe(9)

    await page.reload()
    await expect(page.getByRole("heading", { name: "Novedades", level: 1 })).toBeVisible()
    const persistedCard = page.getByTestId(`novelty-card-${eventId}`)
    await expect(persistedCard.getByTestId(`novelty-preview-${eventId}`)).toBeVisible()
    await expect(persistedCard.getByText("video", { exact: true })).toBeVisible()
    await expect(persistedCard.getByLabel(`Prioridad de ${title}`)).toHaveValue("9")

    await persistedCard.getByRole("button", { name: "Editar novedad" }).click()
    const editor = page.getByTestId("novelty-form")
    await expect(page.getByRole("heading", { name: "Editar novedad", exact: true })).toBeVisible()
    await expect(editor.getByLabel("Título en inglés")).toHaveValue("Demo novelty EN")
    await editor.getByLabel("Título en inglés").fill("Demo novelty edited")
    await editor.getByLabel("Descripción").fill("Descripción editada por E2E")
    await page.screenshot({ path: screenshot("03-editor-edicion.png"), fullPage: true })
    await editor.getByRole("button", { name: "Guardar novedad" }).click()
    await expect(page.getByTestId("novelty-form")).toHaveCount(0)
    await expect
      .poll(async () => (await adminEvent(request, headers, eventId))?.title_en)
      .toBe("Demo novelty edited")

    await page.getByTestId(`novelty-card-${eventId}`).getByRole("button", { name: "Publicar" }).click()
    await answerPrompt(page, "Publicar novedad", "Publicar")
    await expect.poll(async () => (await storeEvent(request, eventId))?.media_type).toBe("video")
    const publishedCard = page.getByTestId(`novelty-card-${eventId}`)
    await expect(publishedCard.getByText("Publicado", { exact: true })).toBeVisible()
    await expect(publishedCard.getByTestId(`novelty-store-state-${eventId}`)).toHaveText("En Store")
    await page.screenshot({ path: screenshot("04-publicada-en-store.png"), fullPage: true })

    await page.getByLabel("Buscar novedad").fill("no-existe-en-el-carrusel")
    await expect(page.getByRole("heading", { name: "Ninguna novedad coincide" })).toBeVisible()
    await page.getByRole("button", { name: "Limpiar filtros" }).first().click()
    await expect(page.getByTestId(`novelty-card-${eventId}`)).toBeVisible()

    await page.getByLabel("Estado").selectOption("published")
    await page.getByLabel("Tipo de medio").selectOption("video")
    await expect(page.getByTestId(`novelty-card-${eventId}`)).toBeVisible()
    await page.getByLabel("Estado").selectOption("draft")
    await expect(page.getByTestId(`novelty-card-${eventId}`)).toHaveCount(0)
    await page.getByLabel("Estado").selectOption("all")
    await page.getByLabel("Tipo de medio").selectOption("all")

    await page.getByTestId(`novelty-card-${eventId}`).getByRole("button", { name: "Archivar" }).click()
    await answerPrompt(page, "Archivar novedad", "Archivar")
    await expect.poll(async () => (await storeEvent(request, eventId)) === undefined).toBe(true)
    const archivedCard = page.getByTestId(`novelty-card-${eventId}`)
    await expect(archivedCard.getByText("Archivado", { exact: true })).toBeVisible()
    await expect(archivedCard.getByTestId(`novelty-store-state-${eventId}`)).toHaveText("Fuera de Store")

    await page.getByLabel("Estado").selectOption("archived")
    await page.getByLabel("Tipo de medio").selectOption("video")
    await expect(page.getByTestId(`novelty-card-${eventId}`)).toBeVisible()
    await page.screenshot({ path: screenshot("05-archivada-con-filtros.png"), fullPage: true })

    await page.getByRole("button", { name: "Limpiar filtros" }).first().click()
    await page
      .getByTestId(`novelty-card-${eventId}`)
      .getByRole("link", { name: "Editar este evento" })
      .click()
    await expect(page).toHaveURL(/\/app\/jovy\/events\?event=/)
    await expect.poll(() => new URL(page.url()).searchParams.get("event")).toBe(eventId)
    await expect(page.getByRole("heading", { name: "Editar evento" })).toBeVisible()
    await expect(page.getByLabel("Título evento")).toHaveValue(title)
    await expect(page.getByRole("link", { name: "Gestionar multimedia en Novedades" })).toBeVisible()
    await expect(page.locator('#event-editor video[aria-label="Vista previa evento"]')).toBeVisible()
    await page.screenshot({ path: screenshot("06-evento-exacto-desde-novedades.png"), fullPage: true })
    await page.locator("#event-editor").screenshot({ path: screenshot("06b-evento-exacto-formulario.png") })

    await page.getByRole("link", { name: "Gestionar multimedia en Novedades" }).click()
    await expect(page).toHaveURL(/\/app\/jovy\/novelties$/)
    const removalCard = page.getByTestId(`novelty-card-${eventId}`)
    await expect(removalCard).toBeVisible()

    await removalCard.getByRole("button", { name: "Retirar medio" }).click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog.getByText("Retirar multimedia", { exact: true })).toBeVisible()
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(removalCard.getByTestId(`novelty-preview-${eventId}`)).toBeVisible()
    expect((await adminEvent(request, headers, eventId))?.media_file_id).toBeTruthy()
    await page.screenshot({ path: screenshot("07-retiro-cancelado-sin-persistir.png"), fullPage: true })

    await removalCard.getByRole("button", { name: "Retirar medio" }).click()
    await answerPrompt(page, "Retirar multimedia", "Retirar medio")
    await expect.poll(async () => (await adminEvent(request, headers, eventId))?.media_file_id).toBeNull()
    await expect(removalCard.getByText("sin medio", { exact: true })).toBeVisible()
    await expect(removalCard.getByTestId(`novelty-preview-${eventId}`)).toHaveCount(0)

    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    await expect(page.getByRole("heading", { name: "Novedades", level: 1 })).toBeVisible()
    await expect(page.getByTestId(`novelty-card-${eventId}`)).toBeVisible()
    await expect
      .poll(async () => {
        const { width, viewport } = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        }))
        return width <= viewport + 1
      })
      .toBe(true)
    await page.screenshot({ path: screenshot("08-mobile-375.png"), fullPage: true })
    await page.getByTestId(`novelty-card-${eventId}`).screenshot({ path: screenshot("08b-mobile-card.png") })

    expect(unexpectedProblems(problems)).toEqual([])
  } finally {
    if (eventId) await bestEffortDelete(request, headers, `/admin/jovy/events/${eventId}`)
    try {
      const leftovers = (await adminEvents(request, headers)).filter((event) => event.slug === slug)
      for (const event of leftovers) await bestEffortDelete(request, headers, `/admin/jovy/events/${event.id}`)
    } catch {
      // El arranque de la siguiente ejecución limpia los slugs DEMO restantes.
    }
    if (typeId) await bestEffortDelete(request, headers, `/admin/jovy/events/types/${typeId}`)
  }
})

test("muestra el borrador como borrador y cancela el retiro de multimedia sin persistir", async ({
  page,
  request,
}) => {
  const problems = collectPageProblems(page)
  const headers = await robustSignIn(page, request)

  const title = demoValue("Novedad borrador DEMO")
  const slug = `demo-novedad-borrador-${Date.now()}`
  let typeId = ""
  let eventId = ""

  try {
    await removeStaleDemoNovelties(request, headers)
    typeId = (await createType(request, headers, demoValue("Tipo borrador"))).id

    const upload = await request.post("/admin/jovy/events/media/video", {
      headers,
      multipart: {
        files: {
          name: "novedad.webm",
          mimeType: "video/webm",
          buffer: readFileSync(webmFixture),
        },
      },
    })
    expect(upload.status()).toBe(201)
    const uploaded = (await upload.json()) as { file: { id: string }; media_type: string }
    expect(uploaded.media_type).toBe("video")

    const created = await request.post("/admin/jovy/events", {
      headers,
      data: {
        title,
        title_en: "Draft novelty",
        slug,
        description: "Borrador con multimedia",
        status: "draft",
        enabled: true,
        priority: 3,
        sort_order: 0,
        event_type_id: typeId,
        starts_at: minutesFromNow(-30).toISOString(),
        ends_at: minutesFromNow(90).toISOString(),
        media_file_id: uploaded.file.id,
      },
    })
    expect(created.status()).toBe(201)
    eventId = (await created.json()).event.id as string

    await openNovelties(page, request)
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.getByRole("heading", { name: "Novedades", level: 1 })).toBeVisible()
    const card = page.getByTestId(`novelty-card-${eventId}`)
    await expect(card.getByRole("heading", { name: title, level: 3 })).toBeVisible()
    await expect(card.getByText("Borrador", { exact: true })).toBeVisible()
    await expect(card.getByTestId(`novelty-store-state-${eventId}`)).toHaveText("Fuera de Store")
    await expect(card.getByText("Borrador: no se publica", { exact: true })).toBeVisible()
    await expect(card.getByTestId(`novelty-preview-${eventId}`)).toBeVisible()
    await page.screenshot({ path: screenshot("09-mobile-borrador.png"), fullPage: true })
    await card.screenshot({ path: screenshot("09b-mobile-borrador-card.png") })

    await card.getByRole("button", { name: "Retirar medio" }).click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog.getByText("Retirar multimedia", { exact: true })).toBeVisible()
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(dialog).toHaveCount(0)

    await expect(card.getByTestId(`novelty-preview-${eventId}`)).toBeVisible()
    expect((await adminEvent(request, headers, eventId))?.media_file_id).toBe(uploaded.file.id)
    await page.screenshot({ path: screenshot("10-mobile-retiro-cancelado.png"), fullPage: true })

    expect(unexpectedProblems(problems)).toEqual([])
  } finally {
    if (eventId) await bestEffortDelete(request, headers, `/admin/jovy/events/${eventId}`)
    if (typeId) await bestEffortDelete(request, headers, `/admin/jovy/events/types/${typeId}`)
  }
})
