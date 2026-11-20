import {
  AdminApiError,
  adminRequest,
  downloadAdminFile,
} from "../admin-api"

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

function mockFetch(response: Response) {
  const calls: RequestInit[] = []
  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init ?? {})
    return response
  }) as typeof fetch
  return calls
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

describe("adminRequest", () => {
  it("conserva cabeceras de un Headers y añade JSON al cuerpo", async () => {
    const calls = mockFetch(jsonResponse({ ok: true }))
    const headers = new Headers({ Accept: "application/json", "X-Test": "1" })

    await adminRequest("/admin/test", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Jovy" }),
    })

    const sent = new Headers(calls[0].headers)
    expect(sent.get("accept")).toBe("application/json")
    expect(sent.get("x-test")).toBe("1")
    expect(sent.get("content-type")).toBe("application/json")
    expect(calls[0].credentials).toBe("include")
  })

  it("no fuerza JSON en FormData y conserva Content-Type explícito", async () => {
    const calls = mockFetch(jsonResponse({ file: { id: "file_1" } }, 201))
    const form = new FormData()
    form.append("files", new Blob(["x"], { type: "image/png" }), "logo.png")

    await adminRequest("/admin/upload", { method: "POST", body: form })

    const sent = new Headers(calls[0].headers)
    expect(sent.has("content-type")).toBe(false)

    const callsTwo = mockFetch(jsonResponse({ ok: true }))
    await adminRequest("/admin/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hola",
    })
    expect(new Headers(callsTwo[0].headers).get("content-type")).toBe("text/plain")
  })

  it("acepta cabeceras como pares y respeta credentials explícitas", async () => {
    const calls = mockFetch(jsonResponse({ ok: true }))
    await adminRequest("/admin/test", {
      credentials: "omit",
      headers: [["X-Pair", "yes"]],
    })

    expect(new Headers(calls[0].headers).get("x-pair")).toBe("yes")
    expect(calls[0].credentials).toBe("omit")
  })

  it("devuelve undefined en 204", async () => {
    mockFetch(new Response(null, { status: 204 }))
    await expect(adminRequest("/admin/test")).resolves.toBeUndefined()
  })

  it("convierte errores de Medusa en AdminApiError con status", async () => {
    mockFetch(
      jsonResponse(
        { errors: { fieldErrors: { email: ["El email no es válido"] } } },
        400,
      ),
    )

    await expect(adminRequest("/admin/test")).rejects.toMatchObject({
      name: "AdminApiError",
      status: 400,
      message: "El email no es válido",
    })
  })
})

describe("downloadAdminFile", () => {
  it("lee nombre, filas y hojas de las cabeceras", async () => {
    mockFetch(
      new Response(new Blob(["PK"]), {
        status: 200,
        headers: {
          "Content-Disposition": 'attachment; filename="solicitudes.xlsx"',
          "X-Export-Count": "12",
          "X-Export-Sheets": "4",
        },
      }),
    )

    const download = await downloadAdminFile("/admin/export", "fallback.xlsx")
    expect(download.fileName).toBe("solicitudes.xlsx")
    expect(download.count).toBe(12)
    expect(download.sheets).toBe(4)
  })

  it("propaga el error HTTP como AdminApiError", async () => {
    mockFetch(jsonResponse({ message: "Rango inválido" }, 400))
    await expect(downloadAdminFile("/admin/export", "fallback.csv")).rejects.toBeInstanceOf(
      AdminApiError,
    )
  })
})
