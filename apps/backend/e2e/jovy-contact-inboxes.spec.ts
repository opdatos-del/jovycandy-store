import { expect, test, type APIRequestContext, type Download, type Page } from "@playwright/test"
import ExcelJS from "exceljs"
import { mkdirSync, readFileSync } from "node:fs"
import path from "node:path"

function readEnv(file: string) {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const index = line.indexOf("=")
        return [line.slice(0, index), line.slice(index + 1)]
      }),
  )
}

const admin = readEnv(".admin.local.env")
const store = readEnv(".store.local.env")
const screenshotDir = path.join(__dirname, "..", ".test-results", "audit-visual", "contacts")

function screenshot(name: string) {
  mkdirSync(screenshotDir, { recursive: true })
  return path.join(screenshotDir, name)
}

// La primera petición compila el bundle del Admin en desarrollo.
test.setTimeout(300_000)

const INBOXES = [
  { type: "national-sales", label: "Ventas Nacionales", path: "/app/jovy/contacts-national-sales" },
  { type: "international-sales", label: "Ventas Internacionales", path: "/app/jovy/contacts-international-sales" },
  { type: "customer-service", label: "Atención al Cliente", path: "/app/jovy/contacts-customer-service" },
  { type: "catalogue", label: "Catálogo — Solicitudes", path: "/app/jovy/contacts-catalogue" },
] as const

type Inbox = (typeof INBOXES)[number]
type Fixture = {
  type: Inbox["type"]
  first_name: string
  last_name: string
  email: string
  phone: string
  country: string
  city: string
  postal_code: string
  message: string
}

async function signIn(page: Page, request: APIRequestContext) {
  await page.goto("/app/login")
  const email = page.getByPlaceholder("Email")
  try {
    await expect(email).toBeVisible({ timeout: 15_000 })
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

/** Cada creación usa una IP reenviada distinta para no agotar el límite de 5. */
function intakeHeaders(index: number) {
  const seed = Math.floor(Date.now() / 1000) % 200
  return {
    "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY,
    "x-forwarded-for": `198.51.101.${((seed + index * 7) % 200) + 20}`,
  }
}

async function inboxContacts(
  request: APIRequestContext,
  headers: Record<string, string>,
  runId: string,
  status?: string,
) {
  const params = new URLSearchParams({ q: runId, limit: "50" })
  if (status) params.set("status", status)
  const response = await request.get(`/admin/jovy/contacts?${params.toString()}`, { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).contacts as Array<{
    id: string
    email: string
    first_name: string
    last_name: string | null
    city: string | null
    postal_code: string | null
    phone: string | null
    status: string
    deleted_at: string | null
  }>
}

async function contactCounts(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.get("/admin/jovy/contacts/counts", { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).counts as Record<
    Inbox["type"],
    { pending: number; handled: number; deleted: number; total: number }
  >
}

async function contactById(
  request: APIRequestContext,
  headers: Record<string, string>,
  id: string,
) {  const response = await request.get(`/admin/jovy/contacts/${id}`, { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).contact as {
    email: string
    city: string | null
    phone: string | null
    postal_code: string | null
    status: string
    deleted_at: string | null
  }
}

const rows = (page: Page) => page.locator('tbody tr[data-testid^="contact-row-"]')

/**
 * Las notificaciones de Medusa se apilan arriba a la derecha y pueden tapar los
 * botones de exportación. Se cierran antes de cada descarga para que el clic
 * llegue al botón real.
 */
async function dismissNotifications(page: Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll<HTMLButtonElement>('[aria-label*="Notifications"] button, [data-radix-toast-viewport] button')
      .forEach((button) => button.click())
  })
  await expect(page.locator('[aria-label*="Notifications"] button, [data-radix-toast-viewport] button'))
    .toHaveCount(0, { timeout: 3_000 })
    .catch(() => undefined)
}

async function readDownloadedWorkbook(download: Download) {
  const filePath = await download.path()
  expect(filePath).not.toBeNull()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(readFileSync(filePath!) as unknown as ArrayBuffer)
  return workbook
}

async function search(page: Page, value: string) {
  await page.getByLabel("Buscar").fill(value)
  await page.getByRole("button", { name: "Buscar", exact: true }).click()
}

async function openTab(page: Page, label: string) {
  await page.getByRole("tab", { name: new RegExp(`^${label}`) }).click()
}

async function expectTabCount(page: Page, label: string, count: number) {
  await expect(page.getByRole("tab", { name: new RegExp(`^${label}`) })).toContainText(`(${count})`)
}

function fixtures(runId: string): Fixture[] {
  const national: Fixture[] = Array.from({ length: 12 }, (_, index) => ({
    type: "national-sales" as const,
    first_name: `Demo Nacional ${index + 1}`,
    last_name: runId,
    email: `${runId}-n${index}@example.test`,
    phone: index === 2 ? `+5255${runId.replace(/\D/g, "").slice(-8)}` : `+5233${String(10_000_000 + index).padStart(8, "0")}`,
    country: "MX",
    city: index === 0 ? `Zapopan ${runId}` : "Guadalajara",
    postal_code: index === 1 ? `Z9${runId}` : "44100",
    message: `Solicitud DEMO ${runId} para la bandeja Ventas nacionales ${index + 1}.`,
  }))

  return [
    ...national,
    {
      type: "international-sales",
      first_name: "Demo Internacional",
      last_name: runId,
      email: `${runId}-i0@example.test`,
      phone: "+34911222333",
      country: "ES",
      city: "Madrid",
      postal_code: "28001",
      message: `Solicitud DEMO ${runId} para Ventas internacionales.`,
    },
    {
      type: "customer-service",
      first_name: "Demo Servicio",
      last_name: runId,
      email: `${runId}-s0@example.test`,
      phone: "+52811222333",
      country: "MX",
      city: "Monterrey",
      postal_code: "64000",
      message: `Solicitud DEMO ${runId} para Atención al cliente.`,
    },
    {
      type: "catalogue",
      first_name: "Demo Catálogo",
      last_name: runId,
      email: `${runId}-c0@example.test`,
      phone: "+57301122333",
      country: "CO",
      city: "Bogotá",
      postal_code: "110111",
      message: `Solicitud DEMO ${runId} para Catálogo.`,
    },
  ]
}

/**
 * Limpia restos de corridas interrumpidas. El teléfono y el CP de los fixtures
 * se repiten entre corridas, así que una corrida abortada contaminaría la
 * búsqueda y los conteos de la siguiente.
 */
async function removeStaleDemoContacts(request: APIRequestContext, headers: Record<string, string>) {
  for (let page = 0; page < 20; page += 1) {
    const response = await request.get("/admin/jovy/contacts?q=demo-contactos-&limit=50", { headers })
    if (response.status() !== 200) return
    const { contacts } = (await response.json()) as { contacts: Array<{ id: string }> }
    if (contacts.length === 0) return
    for (const contact of contacts) {
      await request.delete(`/admin/jovy/contacts/${contact.id}`, { headers })
    }
  }
}

test("replica las bandejas históricas con filtros, modales, papelera y exportación", async ({ page, request }) => {
  const problems: string[] = []
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`))
  page.on("console", (message) => {
    if (message.type() !== "error") return
    // Aviso conocido de Vite al recargar el shell del Admin en desarrollo.
    if (message.text().includes("ReactDOMClient.createRoot() on a container")) return
    problems.push(`console.error: ${message.text()}`)
  })

  const runId = `demo-contactos-${Date.now()}`
  const data = fixtures(runId)
  let headers: Record<string, string> = {}
  const createdIds = new Set<string>()

  try {
    headers = await signIn(page, request)
    await removeStaleDemoContacts(request, headers)

    // Contadores y búsqueda cerrada a las cuatro bandejas.
    expect((await request.get("/admin/jovy/contacts/counts")).status()).toBe(401)
    expect((await request.get("/admin/jovy/contacts?contact_type=mayoreo", { headers })).status()).toBe(400)

    for (const [index, fixture] of data.entries()) {
      const { type, ...fields } = fixture
      const response = await request.post("/store/jovy/contacts", {
        headers: intakeHeaders(index),
        data: { ...fields, contact_type: type },
      })
      expect(response.status(), `No se pudo crear ${fixture.type} ${index}`).toBe(202)
    }

    const seeded = await inboxContacts(request, headers, runId)
    expect(seeded).toHaveLength(data.length)
    seeded.forEach((contact) => createdIds.add(contact.id))

    // Menú lateral: una entrada visible por bandeja, sin stubs anidados.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(INBOXES[0].path)
    await expect(page.getByRole("heading", { name: INBOXES[0].label, exact: true, level: 1 })).toBeVisible()
    for (const inbox of INBOXES) {
      const link = page.getByRole("link", { name: inbox.label, exact: true })
      await expect(link).toHaveCount(1)
      await expect(link).toHaveAttribute("href", inbox.path)
      await expect(link).toBeVisible()
    }
    await expect(page.locator('a[href^="/app/jovy/contacts/"]')).toHaveCount(0)
    await page.screenshot({ path: screenshot("sidebar.png") })

    for (const inbox of INBOXES) {
      await page.getByRole("link", { name: inbox.label, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${inbox.path}$`))
      await expect(page.getByRole("heading", { name: inbox.label, exact: true, level: 1 })).toBeVisible()
    }

    // Columnas históricas exactas, con la fecha y la hora en la misma celda.
    await page.goto(INBOXES[0].path)
    await expect(page.getByRole("heading", { name: "Ventas Nacionales", exact: true, level: 1 })).toBeVisible()
    expect(await page.locator("thead th").allInnerTexts()).toEqual([
      "Fecha",
      "Cliente",
      "Contacto",
      "Ubicación",
      "Mensaje",
      "Acciones",
    ])
    await expect(page.getByRole("tab", { name: /^Nuevo/ })).toHaveAttribute("aria-selected", "true")

    const countsAfterSeed = await contactCounts(request, headers)

    // Cada bandeja consulta solo su tipo y sus pestañas muestran los conteos reales.
    for (const inbox of INBOXES) {
      await page.goto(inbox.path)
      await expect(page.getByRole("heading", { name: inbox.label, exact: true, level: 1 })).toBeVisible()
      const count = countsAfterSeed[inbox.type]
      await expectTabCount(page, "Todos", count.pending + count.handled)
      await expectTabCount(page, "Nuevo", count.pending)
      await expectTabCount(page, "Atendidos", count.handled)
      await expectTabCount(page, "Papelera", count.deleted)

      await search(page, runId)
      const expected = inbox.type === "national-sales" ? 12 : 1
      await expect(rows(page)).toHaveCount(expected)
      const text = await page.locator("tbody").innerText()
      for (const other of data.filter((candidate) => candidate.type !== inbox.type)) {
        expect(text, `La bandeja ${inbox.label} no debe mostrar ${other.email}`).not.toContain(other.email)
      }
    }

    // Búsqueda por teléfono, ciudad y CP en la bandeja nacional.
    const national = data.filter((fixture) => fixture.type === "national-sales")
    await page.goto(INBOXES[0].path)
    await openTab(page, "Todos")

    await search(page, national[2].phone.replace(/\D/g, ""))
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText(national[2].email)

    await page.getByRole("button", { name: "Limpiar", exact: true }).click()
    await search(page, runId)
    await expect(rows(page)).toHaveCount(12)

    await search(page, national[0].city)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText(national[0].email)

    await page.getByRole("button", { name: "Limpiar", exact: true }).click()
    await search(page, runId)
    await expect(rows(page)).toHaveCount(12)

    await search(page, national[1].postal_code)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText(national[1].email)

    await page.getByRole("button", { name: "Limpiar", exact: true }).click()
    await search(page, runId)
    await expect(rows(page)).toHaveCount(12)

    // Rango de fechas: ayer y hoy incluyen las 12; un rango histórico no deja filas.
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    await page.getByLabel("Desde").fill(yesterday)
    await page.getByLabel("Hasta").fill(today)
    await page.getByRole("button", { name: "Buscar", exact: true }).click()
    await expect(rows(page)).toHaveCount(12)

    await page.getByLabel("Desde").fill("2000-01-01")
    await page.getByLabel("Hasta").fill("2000-01-02")
    await page.getByRole("button", { name: "Buscar", exact: true }).click()
    await expect(rows(page)).toHaveCount(0)
    await expect(page.getByText("Sin resultados", { exact: true })).toBeVisible()
    await expect(page.getByText("No hay solicitudes para los filtros seleccionados.", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Limpiar", exact: true }).click()
    await search(page, runId)
    await expect(rows(page)).toHaveCount(12)

    // Paginación numerada con tamaños 10/20/50.
    await page.getByLabel("Por página").selectOption("10")
    await expect(page.getByText(/12 solicitudes · Página 1 de 2/)).toBeVisible()
    await expect(rows(page)).toHaveCount(10)
    await page.getByRole("button", { name: "Página 2", exact: true }).click()
    await expect(page.getByText(/12 solicitudes · Página 2 de 2/)).toBeVisible()
    await expect(rows(page)).toHaveCount(2)

    await page.getByLabel("Por página").selectOption("20")
    await expect(page.getByText(/12 solicitudes · Página 1 de 1/)).toBeVisible()
    await expect(rows(page)).toHaveCount(12)
    await page.getByLabel("Por página").selectOption("50")
    await expect(rows(page)).toHaveCount(12)
    await page.getByLabel("Por página").selectOption("20")
    await expect(rows(page)).toHaveCount(12)

    // Detalle en modal accesible: id, estado, datos completos, notas y auditoría.
    const detailTarget = seeded.find((contact) => contact.email === national[0].email)!
    const detailRow = rows(page).filter({ hasText: detailTarget.email })
    await detailRow.getByRole("button", { name: "Ver más", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await expect(
      dialog.getByRole("heading", {
        name: `Solicitud de ${detailTarget.first_name} ${detailTarget.last_name}`,
      }),
    ).toBeVisible()
    await expect(dialog.getByText(`#${detailTarget.id}`, { exact: true })).toBeVisible()
    await expect(dialog.getByText("Pendiente", { exact: true })).toBeVisible()
    await expect(dialog.getByText(detailTarget.email, { exact: true })).toBeVisible()
    await expect(dialog.getByText(`${detailTarget.city}, MX`, { exact: true })).toBeVisible()
    await expect(dialog.getByText(detailTarget.postal_code!, { exact: true })).toBeVisible()
    await expect(dialog.getByText(`Solicitud DEMO ${runId} para la bandeja Ventas nacionales 1.`)).toBeVisible()
    await expect(dialog.getByText("Alta", { exact: true }).first()).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    await expect(detailRow.getByRole("button", { name: "Ver más", exact: true })).toBeFocused()

    // Edición: validación, cancelación sin mutación y persistencia.
    const editTarget = national[0]
    const editRow = rows(page).filter({ hasText: editTarget.email })
    await editRow.getByRole("button", { name: "Editar", exact: true }).click()
    const editDialog = page.getByRole("dialog")
    await expect(editDialog.getByRole("heading", { name: "Editar solicitud" })).toBeVisible()
    await expect(editDialog.getByText(`#${seeded.find((contact) => contact.email === editTarget.email)!.id}`)).toBeVisible()
    await expect(editDialog.getByLabel("Mensaje original no editable")).toHaveValue(editTarget.message)

    await editDialog.getByLabel("Email").fill("sin-arroba")
    await editDialog.getByLabel("Teléfono").fill("12ab")
    await editDialog.getByLabel("Código postal").fill("***")
    await editDialog.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(editDialog.getByText("Usa un email válido, por ejemplo nombre@dominio.com.")).toBeVisible()
    await expect(editDialog.getByText("Usa entre 7 y 15 dígitos; se admiten +, espacios, puntos y guiones.")).toBeVisible()
    await expect(editDialog.getByText("Usa hasta 30 letras o números; se admiten espacios y guiones.")).toBeVisible()

    const editId = seeded.find((contact) => contact.email === editTarget.email)!.id
    expect((await contactById(request, headers, editId)).email).toBe(editTarget.email)

    await editDialog.getByLabel("Ciudad").fill("Ciudad Cancelada")
    await editDialog.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(editDialog).toHaveCount(0)
    expect((await contactById(request, headers, editId)).city).toBe(editTarget.city)

    await rows(page).filter({ hasText: editTarget.email }).getByRole("button", { name: "Editar", exact: true }).click()
    const newEmail = `${runId}-editada@example.test`
    await page.getByRole("dialog").getByLabel("Email").fill(newEmail)
    await page.getByRole("dialog").getByLabel("Ciudad").fill("Ciudad Editada")
    await page.getByRole("dialog").getByLabel("Teléfono").fill("+523300001234")
    await page.getByRole("dialog").getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect.poll(async () => (await contactById(request, headers, editId)).email).toBe(newEmail)

    const edited = await contactById(request, headers, editId)
    expect(edited.city).toBe("Ciudad Editada")
    expect(edited.phone).toBe("+523300001234")

    // Atender y volver pendiente, con conteos reales en las pestañas.
    const statusTarget = national[1]
    const statusId = seeded.find((contact) => contact.email === statusTarget.email)!.id
    const beforeStatus = await contactCounts(request, headers)
    await search(page, runId)
    await openTab(page, "Nuevo")
    const statusRow = rows(page).filter({ hasText: statusTarget.email })
    await statusRow.getByRole("button", { name: "Marcar atendido", exact: true }).click()
    await expect(statusRow).toHaveCount(0)
    await expect.poll(async () => (await contactById(request, headers, statusId)).status).toBe("handled")

    const afterHandled = await contactCounts(request, headers)
    expect(afterHandled["national-sales"].handled).toBe(beforeStatus["national-sales"].handled + 1)
    expect(afterHandled["national-sales"].pending).toBe(beforeStatus["national-sales"].pending - 1)

    await openTab(page, "Atendidos")
    const handledRow = rows(page).filter({ hasText: statusTarget.email })
    await expect(handledRow).toHaveCount(1)
    await expect(handledRow.getByText("Atendido", { exact: true })).toBeVisible()
    await handledRow.getByRole("button", { name: "Marcar pendiente", exact: true }).click()
    await expect(handledRow).toHaveCount(0)
    await expect.poll(async () => (await contactById(request, headers, statusId)).status).toBe("pending")

    await openTab(page, "Nuevo")
    await expect(rows(page).filter({ hasText: statusTarget.email })).toHaveCount(1)

    // Eliminación suave, papelera y restauración, con confirmación Medusa.
    const trashTarget = national[2]
    const trashId = seeded.find((contact) => contact.email === trashTarget.email)!.id
    const liveRow = rows(page).filter({ hasText: trashTarget.email })
    await liveRow.getByRole("button", { name: "Eliminar", exact: true }).click()
    const deletePrompt = page.getByRole("alertdialog")
    await expect(deletePrompt.getByText("Eliminar solicitud", { exact: true })).toBeVisible()
    await deletePrompt.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(deletePrompt).toHaveCount(0)
    await expect(liveRow).toHaveCount(1)
    await contactById(request, headers, trashId)

    await liveRow.getByRole("button", { name: "Eliminar", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar", exact: true }).click()
    await expect(liveRow).toHaveCount(0)
    await expect.poll(async () => (await inboxContacts(request, headers, runId, "deleted")).some((contact) => contact.id === trashId)).toBe(true)

    await openTab(page, "Papelera")
    const deletedRow = rows(page).filter({ hasText: trashTarget.email })
    await expect(deletedRow).toHaveCount(1)
    await expect(deletedRow.getByText("Eliminado", { exact: true })).toBeVisible()
    await expect(deletedRow.locator("td").nth(1)).toHaveCSS("text-decoration-line", "line-through")

    await deletedRow.getByRole("button", { name: "Restaurar", exact: true }).click()
    const restorePrompt = page.getByRole("alertdialog")
    await expect(restorePrompt.getByText("Restaurar solicitud", { exact: true })).toBeVisible()
    await restorePrompt.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(deletedRow).toHaveCount(1)

    await deletedRow.getByRole("button", { name: "Restaurar", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Restaurar", exact: true }).click()
    await expect(deletedRow).toHaveCount(0)
    await expect.poll(async () => (await contactById(request, headers, trashId)).deleted_at).toBeNull()

    await openTab(page, "Nuevo")
    await expect(rows(page).filter({ hasText: trashTarget.email })).toHaveCount(1)

    // Auditorías consecutivas: la respuesta retrasada de A no debe pintarse
    // bajo el título de B ni reemplazar su historial.
    await openTab(page, "Todos")
    await search(page, runId)
    const staleTarget = national[3]
    const staleId = seeded.find((contact) => contact.email === staleTarget.email)!.id
    let releaseStale: (() => void) | undefined
    const staleGate = new Promise<void>((resolve) => {
      releaseStale = resolve
    })
    const staleAuditPattern = `**/admin/jovy/contacts/${staleId}/audit`
    await page.route(staleAuditPattern, async (route) => {
      await staleGate
      await route.continue()
    })

    try {
      await rows(page)
        .filter({ hasText: staleTarget.email })
        .getByRole("button", { name: "Auditoría", exact: true })
        .click()
      const auditDialog = page.getByRole("dialog")
      await expect(auditDialog.getByText(`#${staleId}`)).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(auditDialog).toHaveCount(0)

      await rows(page)
        .filter({ hasText: statusTarget.email })
        .getByRole("button", { name: "Auditoría", exact: true })
        .click()
      await expect(auditDialog.getByText(`#${statusId}`)).toBeVisible()
      await expect(auditDialog.getByText("Cambio de estado", { exact: true }).first()).toBeVisible()

      const staleResponse = page.waitForResponse(staleAuditPattern)
      releaseStale?.()
      await staleResponse

      await expect(auditDialog.getByText(`#${statusId}`)).toBeVisible()
      await expect(auditDialog.getByText("Cambio de estado", { exact: true }).first()).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(auditDialog).toHaveCount(0)
    } finally {
      releaseStale?.()
      await page.unroute(staleAuditPattern)
    }

    // Exportación CSV de la bandeja activa con los filtros aplicados.
    await openTab(page, "Todos")
    await expect(rows(page)).toHaveCount(12)
    await dismissNotifications(page)
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar CSV", exact: true }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^solicitudes-national-sales-\d{4}-\d{2}-\d{2}\.csv$/)
    const csvPath = await download.path()
    expect(csvPath).not.toBeNull()
    const csv = readFileSync(csvPath!, "utf8")
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.replace(/^\ufeff/, "").trimEnd().split("\r\n")
    expect(lines[0]).toBe("ID,Tipo,Nombre,Apellido,Email,Teléfono,País,Ciudad,CP,Mensaje,Creado")
    expect(lines).toHaveLength(13)
    for (const line of lines.slice(1)) {
      expect(line).toContain("Ventas Nacional")
      expect(line).toContain(runId)
      expect(line).not.toContain("Ventas Exportación")
      expect(line).not.toContain("Atención a clientes")
    }
    await expect(page.getByText(/CSV exportado: 12 solicitudes de Ventas nacionales\./).first()).toBeVisible()

    // Exportación Excel de la misma bandeja: una hoja y las mismas columnas.
    await dismissNotifications(page)
    const [xlsxDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar Excel", exact: true }).click(),
    ])
    expect(xlsxDownload.suggestedFilename()).toMatch(/^solicitudes-national-sales-\d{4}-\d{2}-\d{2}\.xlsx$/)
    const inboxWorkbook = await readDownloadedWorkbook(xlsxDownload)
    expect(inboxWorkbook.worksheets.map((sheet) => sheet.name)).toEqual(["Ventas Nacional"])
    const inboxSheet = inboxWorkbook.getWorksheet("Ventas Nacional")!
    expect(inboxSheet.rowCount).toBe(13)
    expect(inboxSheet.getRow(1).getCell(1).value).toBe("ID")
    expect(inboxSheet.getRow(1).getCell(11).value).toBe("Creado")
    expect(inboxSheet.getColumn(10).values.join(" ")).toContain(runId)
    await expect(page.getByText(/Excel exportado: 12 solicitudes de Ventas nacionales\./).first()).toBeVisible()

    // Consolidado: una hoja por bandeja y los mismos filtros de la vista.
    await page.goto("/app/jovy-herramientas/contacts")
    await expect(page.getByRole("heading", { name: "Contactos", exact: true, level: 1 })).toBeVisible()
    await search(page, runId)
    await openTab(page, "Todos")
    await expect(rows(page)).toHaveCount(15)
    await dismissNotifications(page)
    const [consolidatedDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar todo (Excel)", exact: true }).click(),
    ])
    expect(consolidatedDownload.suggestedFilename()).toMatch(/^solicitudes-consolidado-\d{4}-\d{2}-\d{2}\.xlsx$/)
    const consolidated = await readDownloadedWorkbook(consolidatedDownload)
    expect(consolidated.worksheets.map((sheet) => sheet.name)).toEqual([
      "Ventas Nacional",
      "Ventas Exportación",
      "Atención a clientes",
      "Catálogo",
    ])
    expect(consolidated.getWorksheet("Ventas Nacional")!.rowCount).toBe(13)
    expect(consolidated.getWorksheet("Ventas Exportación")!.rowCount).toBe(2)
    expect(consolidated.getWorksheet("Atención a clientes")!.rowCount).toBe(2)
    expect(consolidated.getWorksheet("Catálogo")!.rowCount).toBe(2)
    expect(consolidated.getWorksheet("Catálogo")!.getColumn(10).values.join(" ")).toContain(runId)
    await expect(
      page.getByText(/Excel consolidado: 15 solicitudes en 4 bandejas\./).first(),
    ).toBeVisible()
    await page.goto("/app/jovy/contacts-national-sales")
    await expect(page.getByRole("heading", { name: "Ventas Nacionales", exact: true, level: 1 })).toBeVisible()

    // Persistencia tras recarga.
    await page.reload()
    await expect(page.getByRole("heading", { name: "Ventas Nacionales", exact: true, level: 1 })).toBeVisible()
    await search(page, runId)
    await expect(rows(page)).toHaveCount(12)
    await expect(page.locator("tbody")).toContainText(newEmail)
    await expect(page.locator("tbody")).toContainText("Ciudad Editada")

    // Capturas 1440 y 375 con scroll horizontal real, no tarjetas.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: screenshot("1440-nacional.png"), fullPage: true })

    await page.setViewportSize({ width: 375, height: 812 })
    const metrics = await page.getByTestId("contacts-table-scroll").evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }))
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
    await page.screenshot({ path: screenshot("375-nacional.png"), fullPage: true })

    await rows(page).first().getByRole("button", { name: "Ver más", exact: true }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.screenshot({ path: screenshot("375-detalle.png"), fullPage: true })
    await page.keyboard.press("Escape")
    await page.setViewportSize({ width: 1440, height: 900 })

    expect(problems).toEqual([])
  } finally {
    if (Object.keys(headers).length > 0) {
      for (const status of [undefined, "deleted"]) {
        try {
          const leftovers = await inboxContacts(request, headers, runId, status)
          leftovers.forEach((contact) => createdIds.add(contact.id))
        } catch {
          // La limpieza no debe ocultar el fallo original.
        }
      }
      for (const id of createdIds) {
        try {
          const response = await request.delete(`/admin/jovy/contacts/${id}`, { headers })
          if (![204, 404].includes(response.status())) {
            console.error(`No se pudo limpiar el contacto DEMO ${id}: HTTP ${response.status()}`)
          }
        } catch (error) {
          console.error(`No se pudo limpiar el contacto DEMO ${id}: ${error instanceof Error ? error.message : error}`)
        }
      }
    }
  }
})
