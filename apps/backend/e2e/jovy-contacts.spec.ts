import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"

function values(file: string) {
  return Object.fromEntries(readFileSync(file, "utf8").trim().split("\n").map((line) => {
    const index = line.indexOf("=")
    return [line.slice(0, index), line.slice(index + 1)]
  }))
}

test("recibe Contactos públicamente y permite seguimiento privado sin exponer PII", async ({ page, request }) => {
  const admin = values(".admin.local.env")
  const store = values(".store.local.env")
  const runId = `e2e-contact-${Date.now()}`
  const email = `${runId}@example.test`
  // Medusa trusts the first proxy hop, so a per-run forwarded address isolates
  // the in-memory window without changing the real five-per-ten-minutes limit.
  const clientIp = `198.51.100.${(Date.now() % 250) + 1}`
  const payload = {
    first_name: "Demo",
    last_name: "Contact",
    email,
    phone: "+520000000000",
    country: "MX",
    city: "Laboratorio",
    postal_code: "00000",
    contact_type: "customer-service",
    message: "Solicitud DEMO temporal para validar privacidad.",
  }
  let token = ""
  let contactId = ""

  try {
    const storeHeaders = {
      "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY,
      "x-forwarded-for": clientIp,
    }
    expect((await request.get("/admin/jovy/contacts")).status()).toBe(401)
    expect([404, 405]).toContain((await request.get("/store/jovy/contacts", { headers: storeHeaders })).status())
    const invalid = await request.post("/store/jovy/contacts", { headers: storeHeaders, data: { contact_type: "customer-service" } })
    expect(invalid.status()).toBe(400)

    const accepted = await request.post("/store/jovy/contacts", { headers: storeHeaders, data: payload })
    expect(accepted.status()).toBe(202)
    expect(await accepted.json()).toEqual({ accepted: true })
    const honeypot = await request.post("/store/jovy/contacts", { headers: storeHeaders, data: { ...payload, email: `bot-${email}`, website: "https://spam.invalid" } })
    expect(honeypot.status()).toBe(202)

    await page.goto("/app/login")
    await page.getByPlaceholder("Email").fill(admin.MEDUSA_ADMIN_EMAIL)
    await page.getByPlaceholder("Password").fill(admin.MEDUSA_ADMIN_PASSWORD)
    await Promise.all([
      page.waitForURL(/\/app(?!\/login)/),
      page.getByRole("button", { name: "Continue with Email" }).click(),
    ])
    const auth = await request.post("/auth/user/emailpass", { data: { email: admin.MEDUSA_ADMIN_EMAIL, password: admin.MEDUSA_ADMIN_PASSWORD } })
    expect(auth.status()).toBe(200)
    token = (await auth.json()).token
    const headers = { Authorization: `Bearer ${token}` }

    const listed = await request.get(`/admin/jovy/contacts?q=${encodeURIComponent(email)}`, { headers })
    expect(listed.status()).toBe(200)
    const contacts = (await listed.json()).contacts
    expect(contacts).toHaveLength(1)
    contactId = contacts[0].id
    expect(contacts[0].email).toBe(email)

    await page.goto("/app/jovy/contacts")
    await expect(page.getByRole("heading", { name: "Contactos" })).toBeVisible()
    await page.getByLabel("Buscar contacto").fill(email)
    await page.getByRole("button", { name: "Buscar" }).click()
    await page.getByRole("button", { name: "Ver seguimiento" }).click()
    await page.getByLabel("Estado de seguimiento").selectOption("handled")
    await page.getByLabel("Notas administrativas").fill("Seguimiento DEMO cerrado.")
    await page.getByRole("button", { name: "Guardar seguimiento" }).click()
    // La recarga posterior limpia el mensaje de éxito casi al instante; se verifica el estado persistente en la lista.
    await expect(page.getByText("atendido", { exact: true })).toBeVisible()

    const detail = await request.get(`/admin/jovy/contacts/${contactId}`, { headers })
    const contact = (await detail.json()).contact
    expect(contact.status).toBe("handled")
    expect(contact.handled_by).toBeTruthy()
    const audit = await request.get(`/admin/jovy/contacts/${contactId}/audit`, { headers })
    const audits = (await audit.json()).audit_logs
    expect(JSON.stringify(audits)).not.toContain(payload.message)
    expect(JSON.stringify(audits)).not.toContain(email)

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await request.post("/store/jovy/contacts", {
        headers: storeHeaders,
        data: { ...payload, email: `limit-${attempt}-${email}`, website: "https://spam.invalid" },
      })
      expect(response.status()).toBe(202)
    }
    const limited = await request.post("/store/jovy/contacts", { headers: storeHeaders, data: { ...payload, email: `limited-${email}`, website: "https://spam.invalid" } })
    expect(limited.status()).toBe(429)
  } finally {
    if (contactId && token) {
      const response = await request.delete(`/admin/jovy/contacts/${contactId}`, { headers: { Authorization: `Bearer ${token}` } })
      if (![204, 404].includes(response.status())) console.error(`No se pudo limpiar Contacto DEMO: HTTP ${response.status()}`)
    }
  }
})
