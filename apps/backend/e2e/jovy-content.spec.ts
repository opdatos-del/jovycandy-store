import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"

type Credentials = { email: string; password: string }

type ManagedPage = { id: string; slug: string }

type AuditLog = { action: string }

function readLocalValues(file: string) {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const separator = line.indexOf("=")
        return [line.slice(0, separator), line.slice(separator + 1)]
      }),
  )
}

function readLocalCredentials(): Credentials {
  if (process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD) {
    return {
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
    }
  }

  const values = readLocalValues(".admin.local.env")
  return { email: values.MEDUSA_ADMIN_EMAIL, password: values.MEDUSA_ADMIN_PASSWORD }
}

test("administra el ciclo de vida completo de una página DEMO", async ({ page, request }) => {
  const credentials = readLocalCredentials()
  const store = readLocalValues(".store.local.env")
  const runId = `e2e-content-demo-${Date.now()}`
  const managed: ManagedPage[] = []
  let token = ""

  try {
    await page.goto("/app/login")
    await page.getByPlaceholder("Email").fill(credentials.email)
    await page.getByPlaceholder("Password").fill(credentials.password)
    await Promise.all([
      page.waitForURL(/\/app(?!\/login)/),
      page.getByRole("button", { name: "Continue with Email" }).click(),
    ])

    const auth = await request.post("/auth/user/emailpass", { data: credentials })
    expect(auth.status()).toBe(200)
    token = (await auth.json()).token
    expect(token).toBeTruthy()

    await page.goto("/app/jovy/content")
    await expect(page.getByRole("heading", { name: "Contenido Jovy" })).toBeVisible()
    await page.getByRole("button", { name: "Nueva página" }).click()
    await page.getByRole("button", { name: "Crear página" }).click()
    expect(await page.locator("#jovy-page-slug").evaluate((input) => (input as HTMLInputElement).validationMessage)).not.toBe("")

    await page.locator("#jovy-page-slug").fill(runId)
    await page.getByLabel("Título es").fill("Página DEMO E2E")
    await page.getByLabel("Título en").fill("DEMO E2E page")
    await page.getByRole("button", { name: "Crear página" }).click()
    const pageRow = page.locator("li").filter({ hasText: runId })
    await expect(pageRow).toContainText("Página DEMO E2E")

    const headers = { Authorization: `Bearer ${token}` }
    const listed = await request.get("/admin/jovy/content/pages", { headers })
    const pages = (await listed.json()).pages as ManagedPage[]
    const created = pages.find((item) => item.slug === runId)
    expect(created).toBeTruthy()
    managed.push(created!)

    const duplicate = await request.post("/admin/jovy/content/pages", {
      headers,
      data: {
        slug: runId,
        status: "draft",
        translations: { es: { title: "Duplicado DEMO" }, en: { title: "Duplicate DEMO" } },
      },
    })
    expect(duplicate.status()).toBeGreaterThanOrEqual(400)

    await pageRow.getByRole("button", { name: "Editar" }).click()
    await page.getByLabel("Título es").fill("Página DEMO publicada")
    await page.locator("#jovy-page-status").selectOption("published")
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(pageRow).toContainText("Página DEMO publicada")
    await expect(pageRow).toContainText("published")

    const publicPublished = await request.get(`/store/jovy/content/pages/${runId}`, {
      headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY },
    })
    expect(publicPublished.status()).toBe(200)

    await pageRow.getByRole("button", { name: "Editar" }).click()
    await page.locator("#jovy-page-status").selectOption("archived")
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(pageRow).toContainText("archived")

    const publicArchived = await request.get(`/store/jovy/content/pages/${runId}`, {
      headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY },
    })
    expect(publicArchived.status()).toBe(404)

    const audit = await request.get(`/admin/jovy/content/pages/${created!.id}/audit`, { headers })
    expect(audit.status()).toBe(200)
    expect((await audit.json()).audit_logs.map((entry: AuditLog) => entry.action)).toEqual([
      "create",
      "publish",
      "archive",
    ])

    page.once("dialog", (dialog) => dialog.accept())
    await pageRow.getByRole("button", { name: "Eliminar" }).click()
    await expect(pageRow).toHaveCount(0)

    const deletedAudit = await request.get(`/admin/jovy/content/pages/${created!.id}/audit`, { headers })
    expect(deletedAudit.status()).toBe(200)
    expect((await deletedAudit.json()).audit_logs.map((entry: AuditLog) => entry.action)).toEqual([
      "create",
      "publish",
      "archive",
      "delete",
    ])
    await page.screenshot({ path: "test-results/jovy-content-lifecycle.png", fullPage: true })
  } finally {
    for (const item of managed) {
      const response = await request.delete(`/admin/jovy/content/pages/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (![204, 404].includes(response.status())) {
        console.error(`No se pudo limpiar el fixture E2E ${item.slug} (${item.id}): HTTP ${response.status()}`)
      }
    }
  }
})
