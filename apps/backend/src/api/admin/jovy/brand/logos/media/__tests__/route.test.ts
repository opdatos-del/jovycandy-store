import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import sharp from "sharp"

import {
  detectLogoImageMime,
  JOVY_LOGO_MEDIA_MAX_BYTES,
  POST,
  validateLogoImage,
  type LogoImageMime,
} from "../route"

jest.mock("@medusajs/medusa/core-flows", () => ({
  uploadFilesWorkflow: jest.fn(),
}))

const MIME_BY_FORMAT: Record<string, LogoImageMime> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
}

let fixtures: Record<keyof typeof MIME_BY_FORMAT, Buffer>

beforeAll(async () => {
  const create = () =>
    sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 12, g: 34, b: 56, alpha: 1 } } })
  fixtures = {
    png: await create().png().toBuffer(),
    jpeg: await create().jpeg().toBuffer(),
    webp: await create().webp().toBuffer(),
    gif: await create().gif().toBuffer(),
  }
})

type FakeResponse = {
  statusCode: number
  body: unknown
  status: (code: number) => FakeResponse
  json: (body: unknown) => FakeResponse
}

function fakeResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 200,
    body: undefined,
    status(code) {
      response.statusCode = code
      return response
    },
    json(body) {
      response.body = body
      return response
    },
  }
  return response
}

function fakeRequest(files: unknown[] | Record<string, unknown[]>) {
  return {
    files,
    scope: {},
  } as unknown as AuthenticatedMedusaRequest
}

const uploaded = [{ id: "file_1", url: "http://localhost:9000/static/jovy-logo-1.png" }]
let run: jest.Mock

beforeEach(() => {
  run = jest.fn(async () => ({ result: uploaded }))
  jest.mocked(uploadFilesWorkflow).mockReset().mockReturnValue({ run } as never)
})

function asFile(buffer: Buffer, mimetype = "image/png", size = buffer.length) {
  return { originalname: "logo.png", mimetype, buffer, size }
}

describe("firma y validación de imágenes de Logos", () => {
  it("detecta PNG, JPEG, WebP y GIF por sus bytes reales", () => {
    for (const [format, mime] of Object.entries(MIME_BY_FORMAT)) {
      expect(detectLogoImageMime(fixtures[format as keyof typeof MIME_BY_FORMAT])).toBe(mime)
    }
    expect(detectLogoImageMime(Buffer.from("GIF89a", "ascii"))).toBe("image/gif")
    expect(detectLogoImageMime(Buffer.from("GIF87a", "ascii"))).toBe("image/gif")
  })

  it("acepta los cuatro formatos hasta el tamaño permitido", async () => {
    for (const [format, mime] of Object.entries(MIME_BY_FORMAT)) {
      const buffer = fixtures[format as keyof typeof MIME_BY_FORMAT]
      await expect(validateLogoImage(asFile(buffer, mime, JOVY_LOGO_MEDIA_MAX_BYTES))).resolves.toEqual({
        ok: true,
        mime,
        extension: format === "jpeg" ? "jpg" : format,
      })
    }
  })

  it("mantiene el límite histórico de 20 MB solo en este carril", () => {
    expect(JOVY_LOGO_MEDIA_MAX_BYTES).toBe(20_971_520)
  })

  it("rechaza archivos por encima de 20 MB", async () => {
    await expect(
      validateLogoImage(asFile(fixtures.png, "image/png", JOVY_LOGO_MEDIA_MAX_BYTES + 1)),
    ).resolves.toMatchObject({ ok: false, message: expect.stringContaining("20 MB") })
    await expect(
      validateLogoImage(asFile(Buffer.alloc(JOVY_LOGO_MEDIA_MAX_BYTES + 1, 1), "image/png")),
    ).resolves.toMatchObject({ ok: false, message: expect.stringContaining("20 MB") })
  })

  it("rechaza MIME declarado distinto del detectado", async () => {
    const result = await validateLogoImage(asFile(fixtures.png, "image/jpeg"))
    expect(result).toMatchObject({ ok: false })
    expect((result as { message: string }).message).toContain("no coincide")
  })

  it("rechaza SVG de forma explícita", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    expect(detectLogoImageMime(svg)).toBeNull()
    await expect(validateLogoImage(asFile(svg, "image/svg+xml"))).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining("SVG"),
    })
  })

  it("rechaza datos con firma válida que no pueden decodificarse", async () => {
    const corrupt = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("roto")])
    expect(detectLogoImageMime(corrupt)).toBe("image/png")
    await expect(validateLogoImage(asFile(corrupt))).resolves.toMatchObject({
      ok: false,
      message: "La imagen no puede decodificarse.",
    })
  })

  it("rechaza archivos vacíos y tipos que no son imagen", async () => {
    await expect(validateLogoImage(asFile(Buffer.alloc(0)))).resolves.toMatchObject({
      ok: false,
      message: "El archivo está vacío.",
    })
    await expect(validateLogoImage(asFile(Buffer.alloc(0), "image/png", 10))).resolves.toMatchObject({
      ok: false,
      message: "El archivo está vacío.",
    })
    await expect(validateLogoImage(asFile(Buffer.from("texto plano"), "text/plain"))).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining("PNG"),
    })
  })
})

describe("POST /admin/jovy/brand/logos/media", () => {
  it("sube el original sin transformarlo y responde 201 con id y url", async () => {
    const buffer = fixtures.png
    const response = fakeResponse()

    await POST(fakeRequest([asFile(buffer)]), response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(201)
    expect(response.body).toEqual({ file: uploaded[0] })
    const input = run.mock.calls[0][0].input
    expect(input.files).toHaveLength(1)
    expect(input.files[0]).toMatchObject({
      mimeType: "image/png",
      content: buffer.toString("base64"),
      access: "public",
    })
    expect(input.files[0].filename).toMatch(/^jovy-logo-[0-9a-f-]{36}\.png$/)
  })

  it("deriva la extensión del MIME real para cada formato aceptado", async () => {
    for (const [format, mime] of Object.entries(MIME_BY_FORMAT)) {
      const response = fakeResponse()
      await POST(fakeRequest({ files: [asFile(fixtures[format as keyof typeof MIME_BY_FORMAT], mime)] }), response as unknown as MedusaResponse)
      expect(response.statusCode).toBe(201)
      const input = run.mock.calls[run.mock.calls.length - 1][0].input
      expect(input.files[0].filename).toMatch(
        new RegExp(`^jovy-logo-[0-9a-f-]{36}\\.${format === "jpeg" ? "jpg" : format}$`),
      )
    }
  })

  it("rechaza cero o más de un archivo sin llamar al workflow", async () => {
    for (const files of [[], [asFile(fixtures.png), asFile(fixtures.png)], {}]) {
      await expect(POST(fakeRequest(files), fakeResponse() as unknown as MedusaResponse)).rejects.toMatchObject({
        type: "invalid_data",
        message: "Se requiere una sola imagen",
      })
    }
    expect(run).not.toHaveBeenCalled()
  })

  it("rechaza imágenes inválidas con MedusaError y sin llamar al workflow", async () => {
    const invalid = asFile(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), "image/svg+xml")
    await expect(POST(fakeRequest([invalid]), fakeResponse() as unknown as MedusaResponse)).rejects.toMatchObject({
      type: "invalid_data",
      message: expect.stringContaining("SVG"),
    })
    expect(run).not.toHaveBeenCalled()
  })
})

describe("aislamiento del límite general de marketing", () => {
  it("el route de marketing sigue en 5 MB", () => {
    const source = readFileSync(join(__dirname, "../../../../marketing/media/route.ts"), "utf8")
    expect(source).toContain("const MAX_FILE_SIZE = 5 * 1024 * 1024")
    expect(source).not.toContain("20 * 1024 * 1024")
    expect(source).not.toContain("20971520")
  })
})
