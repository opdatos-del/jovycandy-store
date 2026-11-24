import { expect, test } from "@playwright/test"

import { signIn } from "./jovy-block2-helpers"

const HANDLE = "jovy-aros-manzana-verde"
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

type AdminProduct = {
  id: string
  metadata?: Record<string, unknown> | null
}

type AdminFamily = {
  id: string
  name: string
  card_preset?: string | null
  product_ids: string[]
}

test.describe("Product Card Visual Manager (Admin)", () => {
  test("gestiona producto, familia, imagen y conserva Rings", async ({ page, request }) => {
    const headers = await signIn(page, request)
    const listResponse = await request.get(`/admin/products?handle=${HANDLE}&fields=id,metadata`, {
      headers,
    })
    expect(listResponse.ok()).toBe(true)
    const list = (await listResponse.json()) as { products: AdminProduct[] }
    const product = list.products[0]
    expect(product?.id).toBeTruthy()
    const originalMetadata = product.metadata ?? {}
    const originalMode = originalMetadata.card_hover_mode
    const originalOverlay = originalMetadata.card_hover_overlay_url

    const familiesResponse = await request.get("/admin/jovy/catalogue/families", { headers })
    const families = (await familiesResponse.json()) as { families: AdminFamily[] }
    const family = families.families.find((item) => item.product_ids.includes(product.id))
    expect(family?.id).toBeTruthy()
    if (!family) throw new Error("El producto no tiene familia vinculada")
    const originalFamilyPreset = family.card_preset ?? null

    try {
      await page.goto(`/app/products/${product.id}`)
      const widget = page.getByTestId("product-card-visual-widget")
      await expect(widget).toBeVisible({ timeout: 40_000 })
      await expect(widget.getByText("Presentación visual del catálogo")).toBeVisible()

      const workspace = page.getByTestId("product-workspace-bar")
      await expect(workspace).toBeVisible()
      expect(await workspace.evaluate((node) => getComputedStyle(node).position)).toBe("fixed")

      // Los bloques técnicos nativos empiezan compactos, pero siguen siendo
      // accesibles por teclado y se pueden volver a desplegar globalmente.
      const metadata = page.locator('[data-jovy-native-section="Metadata"]')
      const metadataContent = metadata.locator("[data-jovy-native-section-content]")
      await expect(metadata).toBeVisible()
      await expect(metadataContent).toHaveJSProperty("hidden", true)
      await workspace.getByRole("button", { name: "Mostrar técnicos" }).click()
      await expect(metadataContent).toHaveJSProperty("hidden", false)
      await metadata.getByRole("button", { name: "Ocultar Metadata" }).press("Enter")
      await expect(metadataContent).toHaveJSProperty("hidden", true)

      await workspace.getByRole("button", { name: "Ocultar técnicos" }).click()
      await expect(metadataContent).toHaveJSProperty("hidden", true)

      const modeSelect = widget.getByTestId("card-visual-mode").getByRole("combobox")
      await expect(modeSelect).toBeVisible()
      await expect(widget.getByTestId("card-visual-preview").locator("..")).toHaveCSS("position", "sticky")

      // 1. Cambio a zoom, estado global sin guardar y guardado desde la barra.
      await modeSelect.click()
      await page.getByRole("option", { name: "Zoom", exact: true }).click()
      await expect(workspace.getByTestId("workspace-dirty")).toContainText("sin guardar")

      await workspace.getByRole("button", { name: "Visual", exact: true }).click()
      await expect
        .poll(async () =>
          widget.evaluate((node) => Math.round(node.getBoundingClientRect().top)),
        )
        .toBeLessThan(400)

      await workspace.getByTestId("workspace-save-all").click()
      await expect(widget.getByText("Configuración visual guardada.")).toBeVisible({ timeout: 15_000 })
      await expect(workspace.getByText("Sin cambios pendientes")).toBeVisible({ timeout: 15_000 })

      await expect
        .poll(async () => {
          const response = await request.get(`/admin/products/${product.id}?fields=id,metadata`, {
            headers,
          })
          const body = (await response.json()) as { product: AdminProduct }
          return body.product.metadata?.card_hover_mode
        })
        .toBe("zoom")

      await page.reload()
      await expect(widget).toBeVisible({ timeout: 40_000 })
      await expect(widget.getByTestId("card-visual-mode").getByRole("combobox")).toContainText("Zoom")

      // 2. Preset de familia administrable desde el producto.
      const familyBox = widget.getByTestId("card-visual-family")
      await expect(familyBox).toBeVisible()
      await familyBox.getByRole("combobox").click()
      await page.getByRole("option", { name: "Jovy Gummies · explosión", exact: true }).click()
      await familyBox.getByRole("button", { name: "Guardar familia" }).click()
      await expect(page.getByText(/Las configuraciones propias no se modificarán/)).toBeVisible()
      await page.getByRole("button", { name: "Guardar preset", exact: true }).last().click()
      await expect(
        widget.getByText("Preset de familia guardado. Aplica a los productos que lo heredan."),
      ).toBeVisible({ timeout: 15_000 })

      await expect
        .poll(async () => {
          const response = await request.get("/admin/jovy/catalogue/families", { headers })
          const body = (await response.json()) as { families: AdminFamily[] }
          return body.families.find((item) => item.id === family.id)?.card_preset
        })
        .toBe("jovy-gummies")

      // 3. Carga de imagen por el carril dedicado.
      await widget.getByTestId("card-visual-mode").getByRole("combobox").click()
      await page.getByRole("option", { name: "Cambio de imagen", exact: true }).click()
      await widget.locator('input[type="file"]').first().setInputFiles({
        name: "card-visual.png",
        mimeType: "image/png",
        buffer: TINY_PNG,
      })
      await expect(widget.getByText("Imagen cargada. Recuerda guardar los cambios.")).toBeVisible({
        timeout: 20_000,
      })
      const swapInput = widget.locator('input[placeholder="https://…"]').first()
      await expect(swapInput).toHaveValue(/\/static\/.*jovy-card-visual-.*\.png$/)

      await widget.getByTestId("card-visual-save").click()
      await expect(widget.getByText("Configuración visual guardada.")).toBeVisible({ timeout: 15_000 })
      await expect
        .poll(async () => {
          const response = await request.get(`/admin/products/${product.id}?fields=id,metadata`, {
            headers,
          })
          const body = (await response.json()) as { product: AdminProduct }
          const swap = body.product.metadata?.card_hover_swap_url
          return typeof swap === "string" ? swap : null
        })
        .toMatch(/\/static\/.*jovy-card-visual-.*\.png$/)

      // 4. Regreso a la explosión de gomitas con la misma imagen de Rings.
      await widget.getByTestId("card-visual-mode").getByRole("combobox").click()
      await page.getByRole("option", { name: "Explosión de gomitas", exact: true }).click()
      await widget.getByTestId("card-visual-save").click()
      await expect(widget.getByText("Configuración visual guardada.")).toBeVisible({ timeout: 15_000 })

      const preview = widget.getByTestId("card-visual-preview")
      await preview.hover()
      await expect(preview.locator("img")).toHaveCount(2)

      await expect
        .poll(async () => {
          const response = await request.get(`/admin/products/${product.id}?fields=id,metadata`, {
            headers,
          })
          const body = (await response.json()) as { product: AdminProduct }
          return body.product.metadata?.card_hover_overlay_url
        })
        .toBe(originalOverlay)
    } finally {
      const restore = { ...originalMetadata }
      for (const key of [
        "card_hover_enabled",
        "card_hover_mode",
        "card_hover_preset",
        "card_hover_swap_url",
        "card_hover_overlay_url",
        "card_hover_full_url",
        "card_hover_background",
        "card_hover_duration_ms",
        "card_hover_intensity",
        "card_visual_version",
      ]) {
        if (!(key in originalMetadata)) restore[key] = null
      }

      await request.post(`/admin/products/${product.id}`, {
        headers,
        data: { metadata: restore },
      })
      await request.put(`/admin/jovy/catalogue/families/${family.id}`, {
        headers,
        data: { card_preset: originalFamilyPreset },
      })

      await expect
        .poll(async () => {
          const response = await request.get(`/admin/products/${product.id}?fields=id,metadata`, {
            headers,
          })
          const body = (await response.json()) as { product: AdminProduct }
          return body.product.metadata?.card_hover_mode
        })
        .toBe(originalMode)

      await expect
        .poll(async () => {
          const response = await request.get("/admin/jovy/catalogue/families", { headers })
          const body = (await response.json()) as { families: AdminFamily[] }
          return body.families.find((item) => item.id === family.id)?.card_preset ?? null
        })
        .toBe(originalFamilyPreset)

      expect(originalMode).toBe("layered")
    }
  })
})
