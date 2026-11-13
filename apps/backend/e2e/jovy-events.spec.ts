import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import sharp from "sharp"

function values(file: string) { return Object.fromEntries(readFileSync(file, "utf8").trim().split("\n").map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)] })) }
const admin = values(".admin.local.env")
const store = values(".store.local.env")
const storeHeaders = { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY }
const unique = (prefix: string) => `${prefix}-${Date.now()}`
const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000)

async function apiHeaders(request: APIRequestContext) {
  const auth = await request.post("/auth/user/emailpass", { data: { email: admin.MEDUSA_ADMIN_EMAIL, password: admin.MEDUSA_ADMIN_PASSWORD } })
  expect(auth.status()).toBe(200)
  return { Authorization: `Bearer ${(await auth.json()).token}` }
}

async function signIn(page: Page, request: APIRequestContext) {
  await page.goto("/app/login")
  await page.getByPlaceholder("Email").fill(admin.MEDUSA_ADMIN_EMAIL)
  await page.getByPlaceholder("Password").fill(admin.MEDUSA_ADMIN_PASSWORD)
  await Promise.all([page.waitForURL(/\/app(?!\/login)/), page.getByRole("button", { name: "Continue with Email" }).click()])
  return apiHeaders(request)
}

async function image(format: "png" | "jpeg") {
  const pipeline = sharp({ create: { width: 20, height: 14, channels: 3, background: { r: 240, g: 40, b: 90 } } })
  return format === "png" ? pipeline.png().toBuffer() : pipeline.jpeg().toBuffer()
}

async function createType(request: APIRequestContext, headers: Record<string, string>, name: string, code = unique("e2e-tipo")) {
  const response = await request.post("/admin/jovy/events/types", { headers, data: { code, name } })
  expect(response.status()).toBe(201)
  return (await response.json()).event_type as { id: string; code: string; name: string }
}

function eventInput(title: string, extra: Record<string, unknown> = {}) {
  return { title, slug: unique("e2e-evento"), description: "Evento de prueba", status: "draft", enabled: true, priority: 0, sort_order: 0, ...extra }
}

async function createEvent(request: APIRequestContext, headers: Record<string, string>, input: Record<string, unknown>) {
  const response = await request.post("/admin/jovy/events", { headers, data: input })
  expect(response.status()).toBe(201)
  return (await response.json()).event as { id: string; slug: string; title: string }
}

const storeEvents = async (request: APIRequestContext) =>
  (await (await request.get("/store/jovy/events", { headers: storeHeaders })).json()).events as Array<Record<string, unknown> & { id: string; title: string }>

async function cleanup(request: APIRequestContext, headers: Record<string, string>) {
  const [eventsResponse, typesResponse] = await Promise.all([
    request.get("/admin/jovy/events", { headers }),
    request.get("/admin/jovy/events/types", { headers }),
  ])
  const events = eventsResponse.ok() ? (await eventsResponse.json()).events as Array<{ id: string; slug: string }> : []
  for (const event of events.filter((item) => item.slug.startsWith("e2e-evento"))) await request.delete(`/admin/jovy/events/${event.id}`, { headers })
  const types = typesResponse.ok() ? (await typesResponse.json()).event_types as Array<{ id: string; code: string }> : []
  for (const type of types.filter((item) => item.code.startsWith("e2e-tipo"))) await request.delete(`/admin/jovy/events/types/${type.id}`, { headers })
}

test("valida publicación, vigencia y estado cancelado de los eventos en Store", async ({ request }) => {
  const headers = await apiHeaders(request)
  try {
    await cleanup(request, headers)
    expect((await request.get("/admin/jovy/events")).status()).toBe(401)

    const invalidPayloads = [
      {},
      { title: "Evento DEMO" },
      { title: "Evento DEMO", slug: "Evento DEMO" },
      { ...eventInput("Evento DEMO"), status: "pending" },
      { ...eventInput("Evento DEMO"), priority: 1_001 },
      { ...eventInput("Evento DEMO"), starts_at: "2026-12-02T00:00:00.000Z", ends_at: "2026-12-01T00:00:00.000Z" },
    ]
    for (const payload of invalidPayloads) {
      expect((await request.post("/admin/jovy/events", { headers, data: payload })).status()).toBe(400)
    }

    const draft = await createEvent(request, headers, eventInput("Evento borrador"))
    const blocked = await request.put(`/admin/jovy/events/${draft.id}`, { headers, data: { status: "published" } })
    expect(blocked.status()).toBe(400)
    expect((await blocked.json()).message).toContain("título en inglés")
    expect((await blocked.json()).message).toContain("tipo de evento")
    expect((await blocked.json()).message).toContain("fecha de inicio")

    expect((await request.post("/admin/jovy/events", { headers, data: eventInput("Evento tipo inválido", { status: "published", title_en: "Invalid type event", event_type_id: "jevtt_missing", starts_at: minutesFromNow(-30).toISOString() }) })).status()).toBe(404)

    const type = await createType(request, headers, "Feria E2E")
    const publishable = { title_en: "Valid event title", event_type_id: type.id, status: "published" }
    const current = await createEvent(request, headers, eventInput("Evento vigente", { ...publishable, starts_at: minutesFromNow(-60).toISOString(), ends_at: minutesFromNow(60).toISOString() }))
    const future = await createEvent(request, headers, eventInput("Evento futuro", { ...publishable, starts_at: minutesFromNow(120).toISOString(), ends_at: minutesFromNow(180).toISOString() }))
    const past = await createEvent(request, headers, eventInput("Evento pasado", { ...publishable, starts_at: minutesFromNow(-180).toISOString(), ends_at: minutesFromNow(-120).toISOString() }))
    const cancelled = await createEvent(request, headers, eventInput("Evento cancelado", { ...publishable, starts_at: minutesFromNow(-60).toISOString(), ends_at: minutesFromNow(60).toISOString() }))
    const disabled = await createEvent(request, headers, eventInput("Evento deshabilitado", { ...publishable, enabled: false, starts_at: minutesFromNow(-60).toISOString(), ends_at: minutesFromNow(60).toISOString() }))

    expect((await request.put(`/admin/jovy/events/${cancelled.id}`, { headers, data: { status: "cancelled" } })).status()).toBe(200)

    let visible = await storeEvents(request)
    expect(visible.map((event) => event.id)).toContain(current.id)
    expect(visible.map((event) => event.id)).not.toContain(future.id)
    expect(visible.map((event) => event.id)).not.toContain(past.id)
    expect(visible.map((event) => event.id)).not.toContain(cancelled.id)
    expect(visible.map((event) => event.id)).not.toContain(disabled.id)
    expect(visible.find((event) => event.id === current.id)?.title_en).toBe("Valid event title")

    visible = await storeEvents(request)
    expect(visible.map((event) => event.id)).not.toContain(cancelled.id)

    expect((await request.put(`/admin/jovy/events/${future.id}`, { headers, data: { starts_at: minutesFromNow(-30).toISOString(), ends_at: minutesFromNow(30).toISOString() } })).status()).toBe(200)
    expect((await storeEvents(request)).map((event) => event.id)).toContain(future.id)

    expect((await request.put(`/admin/jovy/events/${current.id}`, { headers, data: { status: "archived" } })).status()).toBe(200)
    expect((await storeEvents(request)).map((event) => event.id)).not.toContain(current.id)
  } finally {
    await cleanup(request, headers)
  }
})

test("gestiona tipos de evento desde Admin y protege los tipos en uso", async ({ page, request }) => {
  const typeName = unique("Tipo E2E")
  const editedName = `${typeName} editado`
  const headers = await signIn(page, request)
  let typeCode = ""

  try {
    await cleanup(request, headers)
    page.on("dialog", (dialog) => void dialog.accept())

    await page.goto("/app/jovy/events")
    await expect(page.getByRole("heading", { name: "Eventos" }).first()).toBeVisible()

    await page.getByLabel("Código tipo evento").fill(typeCode = unique("e2e-tipo"))
    await page.getByLabel("Nombre tipo evento").fill(typeName)
    await page.getByLabel("Descripción tipo evento").fill("Tipo creado por E2E")
    await page.getByRole("button", { name: "Crear tipo" }).click()
    await expect(page.locator("li").filter({ hasText: typeName }).first()).toBeVisible()

    await page.locator("li").filter({ hasText: typeName }).getByRole("button", { name: "Editar tipo" }).click()
    await page.getByLabel("Nombre tipo evento").fill(editedName)
    await page.getByRole("button", { name: "Guardar tipo" }).click()
    await expect(page.locator("li").filter({ hasText: editedName }).first()).toBeVisible()

    const removableName = unique("Tipo removible")
    await page.getByLabel("Código tipo evento").fill(unique("e2e-tipo"))
    await page.getByLabel("Nombre tipo evento").fill(removableName)
    await page.getByRole("button", { name: "Crear tipo" }).click()
    await expect(page.locator("li").filter({ hasText: removableName }).first()).toBeVisible()
    await page.locator("li").filter({ hasText: removableName }).getByRole("button", { name: "Eliminar tipo" }).click()
    await expect(page.locator("li").filter({ hasText: removableName })).toHaveCount(0)

    const types = (await (await request.get("/admin/jovy/events/types", { headers })).json()).event_types
    const inUse = types.find((type: { code: string }) => type.code === typeCode)
    await createEvent(request, headers, eventInput("Evento que usa tipo", { event_type_id: inUse.id }))

    await page.locator("li").filter({ hasText: editedName }).getByRole("button", { name: "Eliminar tipo" }).click()
    await expect(page.getByRole("alert")).toContainText("está en uso")
    await expect(page.locator("li").filter({ hasText: editedName }).first()).toBeVisible()
    await page.screenshot({ path: ".test-results/jovy-events-types.png", fullPage: true })
  } finally {
    await cleanup(request, headers)
  }
})

test("reordena sólo dentro de la misma prioridad y la prioridad domina la Store", async ({ page, request }) => {
  const titleA = unique("Evento prioridad A")
  const titleB = unique("Evento prioridad B")
  const titleC = unique("Evento prioridad C")
  const headers = await signIn(page, request)
  let ids: Record<string, string> = {}

  try {
    await cleanup(request, headers)
    const type = await createType(request, headers, unique("Tipo prioridad"))
    const publishable = { title_en: "Priority event", event_type_id: type.id, status: "published" }
    const a = await createEvent(request, headers, eventInput(titleA, { ...publishable, priority: 5, starts_at: minutesFromNow(-90).toISOString(), ends_at: minutesFromNow(90).toISOString() }))
    const b = await createEvent(request, headers, eventInput(titleB, { ...publishable, priority: 5, starts_at: minutesFromNow(-80).toISOString(), ends_at: minutesFromNow(90).toISOString() }))
    const c = await createEvent(request, headers, eventInput(titleC, { ...publishable, priority: 10, starts_at: minutesFromNow(-70).toISOString(), ends_at: minutesFromNow(90).toISOString() }))
    ids = { a: a.id, b: b.id, c: c.id }

    await page.goto("/app/jovy/events")
    await expect(page.getByRole("heading", { name: "Eventos" }).first()).toBeVisible()

    const rowA = page.locator("li").filter({ hasText: titleA })
    const rowB = page.locator("li").filter({ hasText: titleB })
    const rowC = page.locator("li").filter({ hasText: titleC })

    // Arrows stop at the priority boundary instead of performing a no-op swap.
    await expect(rowC.getByRole("button", { name: "Subir" })).toBeDisabled()
    await expect(rowC.getByRole("button", { name: "Bajar" })).toBeDisabled()
    await expect(rowA.getByRole("button", { name: "Subir" })).toBeDisabled()
    await expect(rowB.getByRole("button", { name: "Bajar" })).toBeDisabled()
    await expect(rowB.getByRole("button", { name: "Subir" })).toBeEnabled()

    const ownOrder = async () => (await storeEvents(request))
      .filter((event) => [ids.a, ids.b, ids.c].includes(event.id))
      .map((event) => event.id)

    expect(await ownOrder()).toEqual([c.id, a.id, b.id])

    await rowB.getByRole("button", { name: "Subir" }).click()
    await expect.poll(ownOrder).toEqual([c.id, b.id, a.id])

    // A raw reorder that leaves C last by sort_order cannot cross its priority.
    expect((await request.post("/admin/jovy/events/reorder", { headers, data: { ids: [b.id, a.id, c.id] } })).status()).toBe(204)
    await expect.poll(ownOrder).toEqual([c.id, b.id, a.id])

    await page.screenshot({ path: ".test-results/jovy-events-priorities.png", fullPage: true })
  } finally {
    await cleanup(request, headers)
  }
})

test("administra eventos: validación de publicación, multimedia y reordenamiento", async ({ page, request }) => {
  const title = unique("Evento UI E2E")
  const headers = await signIn(page, request)
  let eventId = ""
  let secondEventId = ""

  try {
    await cleanup(request, headers)
    const type = await createType(request, headers, unique("Tipo UI"))

    await page.goto("/app/jovy/events")
    await expect(page.getByRole("heading", { name: "Eventos" }).first()).toBeVisible()

    await page.getByLabel("Título evento").fill(title)
    await page.getByLabel("Slug evento").fill(unique("e2e-evento-ui"))
    await page.getByRole("button", { name: "Crear evento" }).click()
    await expect(page.getByText(title)).toBeVisible()

    const row = page.locator("li").filter({ hasText: title })
    await row.getByRole("button", { name: "Publicar" }).click()
    await expect(page.getByRole("alert")).toContainText("No se puede publicar")
    await expect(row.getByText("draft")).toBeVisible()

    await row.getByRole("button", { name: "Editar" }).click()
    await page.getByLabel("Título EN evento").fill("UI event title")
    await page.getByLabel("Tipo evento", { exact: true }).selectOption(type.id)
    await page.getByLabel("Inicio evento").fill(localInput(minutesFromNow(-60)))
    await page.getByLabel("Fin evento").fill(localInput(minutesFromNow(60)))
    await page.getByLabel("Estado evento").selectOption("published")
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect.poll(async () => (await storeEvents(request)).some((event) => event.title === title)).toBe(true)

    const events = (await (await request.get("/admin/jovy/events", { headers })).json()).events
    eventId = events.find((event: { title: string }) => event.title === title).id

    await page.locator("li").filter({ hasText: title }).getByRole("button", { name: "Editar" }).click()
    await page.locator("#event-media").setInputFiles({ name: "evento.png", mimeType: "image/png", buffer: await image("png") })
    await expect(page.getByAltText("Vista previa evento")).toBeVisible()
    await page.getByRole("button", { name: "Guardar cambios" }).click()

    await expect.poll(async () => (await storeEvents(request)).find((event) => event.id === eventId)?.media_url).toContain("/static/")
    const pngUrl = (await storeEvents(request)).find((event) => event.id === eventId)?.media_url as string
    expect(pngUrl).toContain("/static/")

    await page.locator("li").filter({ hasText: title }).getByRole("button", { name: "Editar" }).click()
    await expect(page.getByAltText("Vista previa evento")).toBeVisible()
    await page.locator("#event-media").setInputFiles({ name: "evento.jpg", mimeType: "image/jpeg", buffer: await image("jpeg") })
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect.poll(async () => (await storeEvents(request)).find((event) => event.id === eventId)?.media_url).not.toBe(pngUrl)
    const jpegUrl = (await storeEvents(request)).find((event) => event.id === eventId)?.media_url as string
    expect(jpegUrl).toContain("/static/")

    await page.locator("li").filter({ hasText: title }).getByRole("button", { name: "Editar" }).click()
    await expect(page.getByAltText("Vista previa evento")).toBeVisible()
    await page.getByRole("button", { name: "Quitar imagen del evento" }).click()
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect.poll(async () => (await storeEvents(request)).find((event) => event.id === eventId)?.media_url).toBeNull()

    const second = await createEvent(request, headers, eventInput("Evento secundario UI", {
      title_en: "Second UI event",
      event_type_id: type.id,
      status: "published",
      starts_at: minutesFromNow(-30).toISOString(),
      ends_at: minutesFromNow(90).toISOString(),
    }))
    secondEventId = second.id

    await page.reload()
    await page.locator("li").filter({ hasText: "Evento secundario UI" }).getByRole("button", { name: "Subir" }).click()
    await expect.poll(async () => {
      const visible = await storeEvents(request)
      return visible.findIndex((event) => event.id === secondEventId) < visible.findIndex((event) => event.id === eventId)
    }).toBe(true)

    const storeOrder = (await storeEvents(request)).map((event) => event.id)
    expect(storeOrder.indexOf(secondEventId)).toBeGreaterThanOrEqual(0)
    expect(storeOrder.indexOf(eventId)).toBeGreaterThanOrEqual(0)
    await page.screenshot({ path: ".test-results/jovy-events-admin.png", fullPage: true })
  } finally {
    if (eventId) await request.delete(`/admin/jovy/events/${eventId}`, { headers })
    if (secondEventId) await request.delete(`/admin/jovy/events/${secondEventId}`, { headers })
    await cleanup(request, headers)
  }
})
