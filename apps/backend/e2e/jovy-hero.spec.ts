import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"

function values(file: string) { return Object.fromEntries(readFileSync(file, "utf8").trim().split("\n").map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)] })) }

test("administra Hero DEMO desde Marketing Jovy", async ({ page, request }) => {
  const admin = values(".admin.local.env"); const store = values(".store.local.env"); const id = `e2e-hero-${Date.now()}`; let token = ""; let heroId = ""
  try {
    await page.goto("/app/login"); await page.getByPlaceholder("Email").fill(admin.MEDUSA_ADMIN_EMAIL); await page.getByPlaceholder("Password").fill(admin.MEDUSA_ADMIN_PASSWORD); await Promise.all([page.waitForURL(/\/app(?!\/login)/), page.getByRole("button", { name: "Continue with Email" }).click()])
    const auth = await request.post("/auth/user/emailpass", { data: { email: admin.MEDUSA_ADMIN_EMAIL, password: admin.MEDUSA_ADMIN_PASSWORD } }); token = (await auth.json()).token; const headers = { Authorization: `Bearer ${token}` }
    expect((await request.get("/admin/jovy/marketing/hero")).status()).toBe(401)
    await page.goto("/app/jovy/marketing"); await expect(page.getByRole("heading", { name: "Hero corporativo" })).toBeVisible()
    await page.getByLabel("Hero título es").fill(`Hero DEMO ${id}`); await page.getByLabel("Hero título en").fill(`DEMO Hero ${id}`); await page.getByLabel("CTA Hero").fill("/tienda"); await page.getByRole("button", { name: "Crear Hero" }).click()
    await expect(page.getByText(`Hero DEMO ${id}`)).toBeVisible()
    const list = await request.get("/admin/jovy/marketing/hero", { headers }); const created = (await list.json()).hero_items.find((item: { translations: { es: { title: string } } }) => item.translations.es.title === `Hero DEMO ${id}`); heroId = created.id
    const published = await request.put(`/admin/jovy/marketing/hero/${heroId}`, { headers, data: { status: "published" } }); expect(published.status()).toBe(200)
    expect((await request.get("/store/jovy/marketing/hero", { headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY } })).status()).toBe(200)
    await page.screenshot({ path: "test-results/jovy-hero.png", fullPage: true })
    const archived = await request.put(`/admin/jovy/marketing/hero/${heroId}`, { headers, data: { status: "archived" } }); expect(archived.status()).toBe(200)
    const publicItems = await (await request.get("/store/jovy/marketing/hero", { headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY } })).json(); expect(publicItems.hero_items.some((item: { id: string }) => item.id === heroId)).toBe(false)
  } finally { if (heroId) await request.delete(`/admin/jovy/marketing/hero/${heroId}`, { headers: { Authorization: `Bearer ${token}` } }) }
})
