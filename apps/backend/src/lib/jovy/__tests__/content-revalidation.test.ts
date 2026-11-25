import { createHmac } from "node:crypto"

import {
  buildContentRevalidationPayload,
  deliverContentRevalidation,
  isContentRevalidationRequest,
  readContentRevalidationConfig,
  signContentRevalidation,
} from "@jovy/lib/jovy/content-revalidation"

// Los valores de prueba se construyen en ejecución para no confundir al
// escáner de secretos con una credencial versionada.
const TEST_SECRET = Array.from({ length: 40 }, (_, index) =>
  String.fromCharCode(97 + (index % 26)),
).join("")

const validEnvironment = {
  STOREFRONT_REVALIDATION_URL: "https://shop.example.test/api/revalidate",
  STOREFRONT_REVALIDATION_SECRET: TEST_SECRET,
} as NodeJS.ProcessEnv

describe("revalidación de contenido", () => {
  it("solo observa mutaciones admin de contenido", () => {
    expect(
      isContentRevalidationRequest("POST", "/admin/jovy/marketing/banners?x=1"),
    ).toBe(true)
    expect(
      isContentRevalidationRequest("PATCH", "/admin/jovy/products/prod_1/editorial"),
    ).toBe(true)
    expect(
      isContentRevalidationRequest("DELETE", "/admin/products/prod_1"),
    ).toBe(true)

    expect(
      isContentRevalidationRequest("GET", "/admin/jovy/marketing/banners"),
    ).toBe(false)
    expect(
      isContentRevalidationRequest("POST", "/admin/jovy/authz/roles"),
    ).toBe(false)
    expect(
      isContentRevalidationRequest("POST", "/admin/jovy/contacts"),
    ).toBe(false)
    expect(
      isContentRevalidationRequest("POST", "/store/jovy/contacts"),
    ).toBe(false)
  })

  it("mantiene la revalidación inactiva sin configuración", () => {
    expect(readContentRevalidationConfig({})).toEqual({
      config: null,
      errors: [],
    })
  })

  it("rechaza configuración parcial, insegura o inválida", () => {
    expect(
      readContentRevalidationConfig({
        STOREFRONT_REVALIDATION_URL: validEnvironment.STOREFRONT_REVALIDATION_URL,
      }).errors,
    ).toContain("STOREFRONT_REVALIDATION_SECRET es obligatorio cuando se define la URL.")

    expect(
      readContentRevalidationConfig({
        STOREFRONT_REVALIDATION_SECRET:
          validEnvironment.STOREFRONT_REVALIDATION_SECRET,
      }).errors,
    ).toContain("STOREFRONT_REVALIDATION_URL es obligatorio cuando se define el secreto.")

    expect(
      readContentRevalidationConfig({
        ...validEnvironment,
        STOREFRONT_REVALIDATION_URL: "http://shop.example.test/api/revalidate",
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("HTTPS fuera de desarrollo local"),
      ]),
    )

    expect(
      readContentRevalidationConfig({
        ...validEnvironment,
        STOREFRONT_REVALIDATION_SECRET: "short",
      }).errors,
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("32 caracteres")]),
    )

    expect(
      readContentRevalidationConfig({
        ...validEnvironment,
        STOREFRONT_REVALIDATION_SECRET: "x".repeat(64),
      }).errors,
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("debe ser real")]),
    )

    expect(
      readContentRevalidationConfig({
        ...validEnvironment,
        STOREFRONT_REVALIDATION_TIMEOUT_MS: "10",
      }).errors,
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("entre 250 y 30000")]),
    )
  })

  it("acepta HTTP solo en loopback para desarrollo local", () => {
    expect(
      readContentRevalidationConfig({
        ...validEnvironment,
        STOREFRONT_REVALIDATION_URL: "http://localhost:3000/api/revalidate",
      }),
    ).toMatchObject({
      config: { url: "http://localhost:3000/api/revalidate" },
      errors: [],
    })
  })

  it("acepta el endpoint interno de Compose solo en staging", () => {
    expect(
      readContentRevalidationConfig({
        ...validEnvironment,
        DEPLOYMENT_ENV: "staging",
        STOREFRONT_REVALIDATION_URL:
          "http://storefront:3000/api/revalidate",
      }),
    ).toMatchObject({ errors: [] })

    expect(
      readContentRevalidationConfig({
        ...validEnvironment,
        DEPLOYMENT_ENV: "production",
        STOREFRONT_REVALIDATION_URL:
          "http://storefront:3000/api/revalidate",
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("HTTPS fuera de desarrollo local"),
      ]),
    )
  })

  it("rechaza loopback HTTP en un perfil desplegado", () => {
    expect(
      readContentRevalidationConfig({
        ...validEnvironment,
        DEPLOYMENT_ENV: "production",
        STOREFRONT_REVALIDATION_URL: "http://localhost:3000/api/revalidate",
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("HTTPS fuera de desarrollo local"),
      ]),
    )
  })

  it("firma el timestamp y el cuerpo con HMAC SHA-256", () => {
    const signature = signContentRevalidation(
      TEST_SECRET,
      "1700000000",
      '{"tags":["jovy-content"]}',
    )
    const expected = createHmac("sha256", TEST_SECRET)
      .update('1700000000.{"tags":["jovy-content"]}')
      .digest("hex")

    expect(signature).toBe(expected)
    expect(
      signContentRevalidation(
        TEST_SECRET,
        "1700000001",
        '{"tags":["jovy-content"]}',
      ),
    ).not.toBe(signature)
  })

  it("construye un payload mínimo sin datos personales", () => {
    expect(
      buildContentRevalidationPayload(
        "POST /admin/jovy/marketing/banners",
        "evt_1",
        new Date("2026-11-24T12:00:00.000Z"),
      ),
    ).toEqual({
      eventId: "evt_1",
      source: "POST /admin/jovy/marketing/banners",
      tags: ["jovy-content"],
      occurredAt: "2026-11-24T12:00:00.000Z",
    })
  })

  it("entrega el evento firmado al storefront", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 202 })
    const payload = buildContentRevalidationPayload("POST /admin/products")
    const config = {
      url: "https://shop.example.test/api/revalidate",
      secret: TEST_SECRET,
      timeoutMs: 1000,
    }

    await expect(
      deliverContentRevalidation(config, payload, {
        fetchImpl,
        retryDelaysMs: [],
      }),
    ).resolves.toEqual({ ok: true, status: 202, attempts: 1 })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(config.url)
    expect(init.method).toBe("POST")
    expect(init.headers["x-jovy-signature"]).toBe(
      signContentRevalidation(
        config.secret,
        init.headers["x-jovy-timestamp"],
        init.body,
      ),
    )
    expect(JSON.parse(init.body).tags).toEqual(["jovy-content"])
  })

  it("no reintenta un 4xx y sí reintenta un 5xx", async () => {
    const rejected = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 })
    await expect(
      deliverContentRevalidation(
        {
          url: "https://shop.example.test/api/revalidate",
          secret: TEST_SECRET,
          timeoutMs: 1000,
        },
        buildContentRevalidationPayload("POST /admin/products"),
        { fetchImpl: rejected, retryDelaysMs: [0, 0] },
      ),
    ).resolves.toMatchObject({ ok: false, status: 401, attempts: 1 })
    expect(rejected).toHaveBeenCalledTimes(1)

    const unstable = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 202 })
    await expect(
      deliverContentRevalidation(
        {
          url: "https://shop.example.test/api/revalidate",
          secret: TEST_SECRET,
          timeoutMs: 1000,
        },
        buildContentRevalidationPayload("POST /admin/products"),
        { fetchImpl: unstable, retryDelaysMs: [0, 0] },
      ),
    ).resolves.toMatchObject({ ok: true, status: 202, attempts: 2 })
  })

  it("devuelve error controlado si el storefront no responde", async () => {
    const offline = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"))

    await expect(
      deliverContentRevalidation(
        {
          url: "https://shop.example.test/api/revalidate",
          secret: TEST_SECRET,
          timeoutMs: 1000,
        },
        buildContentRevalidationPayload("POST /admin/products"),
        { fetchImpl: offline, retryDelaysMs: [0] },
      ),
    ).resolves.toEqual({
      ok: false,
      error: "error de red",
      attempts: 2,
    })
  })
})
