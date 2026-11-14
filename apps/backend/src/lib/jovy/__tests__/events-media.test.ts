import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  acquireEventVideoUploadLock,
  consumeEventVideoUpload,
  detectEventVideoMime,
  EVENT_VIDEO_MAX_BYTES,
  EVENT_VIDEO_MULTIPART_OVERHEAD_BYTES,
  eventMediaTypeFromMime,
  eventMediaTypeFromUrl,
  eventVideoRateLimit,
  exceedsEventVideoUploadLimit,
  isEventVideoUploadLocked,
  releaseEventVideoUploadLock,
  resolveEventMedia,
  validateEventMediaFile,
  validateEventMediaUpload,
} from "@jovy/lib/jovy/events-media"

function mp4(brand: string, compatible: string[] = []) {
  const boxSize = 16 + compatible.length * 4
  const header = Buffer.alloc(boxSize)
  header.writeUInt32BE(boxSize, 0)
  header.write("ftyp", 4, "ascii")
  header.write(brand, 8, "ascii")
  header.writeUInt32BE(0, 12)
  compatible.forEach((entry, index) => header.write(entry, 16 + index * 4, "ascii"))
  return Buffer.concat([header, Buffer.alloc(8)])
}

const gif = Buffer.concat([Buffer.from("GIF89a", "ascii"), Buffer.alloc(10)])
const webm = Buffer.concat([
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
  Buffer.from([0x42, 0x86, 0x81, 0x01]),
  Buffer.from("webm", "ascii"),
  Buffer.alloc(16),
])

describe("firma binaria de la multimedia de Novedades", () => {
  it("reconoce GIF, MP4 y WebM por sus magic bytes", () => {
    expect(detectEventVideoMime(gif)).toBe("image/gif")
    expect(detectEventVideoMime(mp4("isom"))).toBe("video/mp4")
    expect(detectEventVideoMime(webm)).toBe("video/webm")
  })

  it("acepta MP4 con la familia declarada en compatible_brands", () => {
    expect(detectEventVideoMime(mp4("mif1", ["mp42"]))).toBe("video/mp4")
  })

  it("rechaza SVG, PNG y contenedores ftyp ajenos al contrato", () => {
    expect(detectEventVideoMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull()
    expect(detectEventVideoMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull()
    expect(detectEventVideoMime(mp4("heic"))).toBeNull()
    expect(detectEventVideoMime(mp4("qt  "))).toBeNull()
    expect(detectEventVideoMime(Buffer.from("GIF8"))).toBeNull()
  })

  it("exige coincidencia entre el MIME declarado y el contenido", () => {
    expect(validateEventMediaUpload({ size: gif.length, mimetype: "image/gif", buffer: gif })).toEqual({
      ok: true,
      mime: "image/gif",
      media_type: "gif",
    })
    expect(validateEventMediaUpload({ size: webm.length, mimetype: "video/webm", buffer: webm })).toMatchObject({
      ok: true,
      media_type: "video",
    })

    const mismatched = validateEventMediaUpload({ size: gif.length, mimetype: "video/mp4", buffer: gif })
    expect(mismatched).toMatchObject({ ok: false, status: 400 })
    expect((mismatched as { message: string }).message).toContain("no coincide")
  })

  it("rechaza archivos vacíos, desconocidos y mayores a 100 MB", () => {
    expect(validateEventMediaUpload({ size: 0, mimetype: "video/mp4", buffer: Buffer.alloc(0) })).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(validateEventMediaUpload({ size: 4, mimetype: "image/gif", buffer: Buffer.from("nope") })).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(
      validateEventMediaUpload({ size: EVENT_VIDEO_MAX_BYTES + 1, mimetype: "video/mp4", buffer: mp4("isom") }),
    ).toEqual({
      ok: false,
      status: 413,
      message: "El archivo supera el límite de 100 MB.",
    })
  })

  it("responde 413 sólo cuando el cuerpo declarado excede el tope más el margen multipart", () => {
    expect(EVENT_VIDEO_MAX_BYTES).toBe(100 * 1024 * 1024)
    expect(exceedsEventVideoUploadLimit(EVENT_VIDEO_MAX_BYTES + EVENT_VIDEO_MULTIPART_OVERHEAD_BYTES)).toBe(false)
    expect(exceedsEventVideoUploadLimit(String(EVENT_VIDEO_MAX_BYTES + EVENT_VIDEO_MULTIPART_OVERHEAD_BYTES + 1))).toBe(true)
    expect(exceedsEventVideoUploadLimit(undefined)).toBe(false)
    expect(exceedsEventVideoUploadLimit("not-a-number")).toBe(false)
  })

  it("valida el archivo temporal leyendo sólo su cabecera", async () => {
    const directory = await mkdtemp(join(tmpdir(), "jovy-media-"))
    try {
      const goodPath = join(directory, "event.mp4")
      const good = mp4("isom")
      await writeFile(goodPath, good)
      await expect(
        validateEventMediaFile({ size: good.length, mimetype: "video/mp4", path: goodPath }),
      ).resolves.toEqual({ ok: true, mime: "video/mp4", media_type: "video" })

      // El tamaño se comprueba antes de abrir el archivo: no hace falta crear
      // 100 MB reales para el caso 413.
      await expect(
        validateEventMediaFile({ size: EVENT_VIDEO_MAX_BYTES + 1, mimetype: "video/mp4", path: goodPath }),
      ).resolves.toEqual({
        ok: false,
        status: 413,
        message: "El archivo supera el límite de 100 MB.",
      })

      const fakePath = join(directory, "fake.mp4")
      await writeFile(fakePath, Buffer.from("no es un vídeo"))
      await expect(
        validateEventMediaFile({ size: 14, mimetype: "video/mp4", path: fakePath }),
      ).resolves.toMatchObject({ ok: false, status: 400 })

      await expect(
        validateEventMediaFile({ size: 10, mimetype: "video/mp4", path: join(directory, "missing.mp4") }),
      ).resolves.toEqual({ ok: false, status: 400, message: "No se pudo leer el archivo temporal." })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

describe("lock y rate limit del carril de vídeo", () => {
  it("permite una sola subida concurrente y libera con el token correcto", () => {
    const token = acquireEventVideoUploadLock("test-token")
    expect(token).toBe("test-token")
    expect(isEventVideoUploadLocked()).toBe(true)
    expect(acquireEventVideoUploadLock("otro-token")).toBeNull()

    releaseEventVideoUploadLock("token-incorrecto")
    expect(isEventVideoUploadLocked()).toBe(true)

    releaseEventVideoUploadLock(token)
    expect(isEventVideoUploadLocked()).toBe(false)
    expect(acquireEventVideoUploadLock("nuevo-token")).toBe("nuevo-token")
    releaseEventVideoUploadLock("nuevo-token")
  })

  it("limita intentos por clave y reinicia al expirar la ventana", () => {
    const key = `user:${Date.now()}-${Math.random()}`
    const start = Date.parse("2026-11-13T10:00:00.000Z")
    for (let attempt = 0; attempt < eventVideoRateLimit.maxRequests; attempt += 1) {
      expect(consumeEventVideoUpload(key, start + attempt).allowed).toBe(true)
    }

    expect(consumeEventVideoUpload(key, start + eventVideoRateLimit.maxRequests)).toEqual({
      allowed: false,
      retryAfterSeconds: 600,
    })
    expect(consumeEventVideoUpload(key, start + eventVideoRateLimit.windowMs).allowed).toBe(true)
    expect(consumeEventVideoUpload(`${key}-otra`, start).allowed).toBe(true)
  })
})

describe("derivación de media_type", () => {
  it("traduce el MIME validado al tipo de presentación", () => {
    expect(eventMediaTypeFromMime("image/gif")).toBe("gif")
    expect(eventMediaTypeFromMime("video/mp4")).toBe("video")
    expect(eventMediaTypeFromMime("video/webm")).toBe("video")
    expect(eventMediaTypeFromMime("image/png")).toBeNull()
  })

  it("deriva el tipo desde la URL pública, incluidas extensiones históricas", () => {
    const base = "http://localhost:9000/static/1731-jovy-event-abc"
    expect(eventMediaTypeFromUrl(`${base}.mp4`)).toBe("video")
    expect(eventMediaTypeFromUrl(`${base}.webm`)).toBe("video")
    expect(eventMediaTypeFromUrl(`${base}.mov`)).toBe("video")
    expect(eventMediaTypeFromUrl(`${base}.m4v`)).toBe("video")
    expect(eventMediaTypeFromUrl(`${base}.ogg`)).toBe("video")
    expect(eventMediaTypeFromUrl(`${base}.gif`)).toBe("gif")
    expect(eventMediaTypeFromUrl(`${base}.png`)).toBe("image")
    expect(eventMediaTypeFromUrl(`${base}.JPG`)).toBe("image")
    expect(eventMediaTypeFromUrl(`${base}.webp?v=2`)).toBe("image")
    expect(eventMediaTypeFromUrl(`${base}.avif`)).toBeNull()
    expect(eventMediaTypeFromUrl(null)).toBeNull()
  })

  it("resuelve URL y tipo juntos y degrada a null si el archivo ya no existe", async () => {
    const files = {
      retrieveFile: jest.fn(async (id: string) => {
        if (id === "missing") throw new Error("not found")
        return { url: "http://localhost:9000/static/event.mp4" }
      }),
    }

    await expect(resolveEventMedia(files, "file_1")).resolves.toEqual({
      media_url: "http://localhost:9000/static/event.mp4",
      media_type: "video",
    })
    await expect(resolveEventMedia(files, "missing")).resolves.toEqual({
      media_url: null,
      media_type: null,
    })
    await expect(resolveEventMedia(files, null)).resolves.toEqual({ media_url: null, media_type: null })
    expect(files.retrieveFile).toHaveBeenCalledTimes(2)
  })
})
