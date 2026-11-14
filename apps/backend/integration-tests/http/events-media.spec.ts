import { readFileSync } from "node:fs"
import { readdir, rm } from "node:fs/promises"
import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

import {
  EVENT_VIDEO_MAX_BYTES,
  EVENT_VIDEO_MULTIPART_OVERHEAD_BYTES,
  EVENT_VIDEO_TEMP_DIR,
} from "@jovy/lib/jovy/events-media"

import {
  adminHeaders,
  createAdminSession,
  createPublishableApiKey,
  storeHeaders,
} from "./utils"

jest.setTimeout(120_000)

const FIXTURES = path.join(__dirname, "..", "fixtures")
const mp4 = readFileSync(path.join(FIXTURES, "novelty.mp4"))
const gif = readFileSync(path.join(FIXTURES, "novelty.gif"))

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`

/**
 * Construye el multipart a mano: el runner usa axios con `FormData` nativo y
 * así se controla exactamente el `Content-Length` declarado en la prueba de
 * tamaño sin depender de la serialización del cliente.
 */
function multipart(
  file: Buffer,
  filename: string,
  mimeType: string,
  options: { field?: string; boundary?: string } = {},
) {
  const boundary = options.boundary ?? `----jovy-${Date.now()}-${Math.floor(Math.random() * 10_000)}`
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${options.field ?? "files"}"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return { body: Buffer.concat([head, file, tail]), contentType: `multipart/form-data; boundary=${boundary}` }
}

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-events-media",
  testSuite: ({ api, getContainer }) => {
    let adminToken: string
    let publishableApiKey: string

    beforeAll(async () => {
      adminToken = await createAdminSession(getContainer(), api)
      publishableApiKey = await createPublishableApiKey(getContainer())
    })

    afterAll(async () => {
      await rm(EVENT_VIDEO_TEMP_DIR, { recursive: true, force: true })
    })

    const tempUploads = async () => {
      try {
        return await readdir(EVENT_VIDEO_TEMP_DIR)
      } catch {
        return []
      }
    }

    const expectNoTempUploads = async () => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if ((await tempUploads()).length === 0) return
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      expect(await tempUploads()).toEqual([])
    }

    const upload = (
      file: Buffer,
      filename: string,
      mimeType: string,
      contentLength?: number,
      authenticated = true,
    ) => {
      const { body, contentType } = multipart(file, filename, mimeType)
      return api.post("/admin/jovy/events/media/video", body, {
        headers: {
          ...(authenticated ? adminHeaders(adminToken) : {}),
          "Content-Type": contentType,
          // Evita reutilizar una conexión cuyo cuerpo quedó incompleto en la
          // prueba de tamaño declarado.
          Connection: "close",
          ...(contentLength ? { "Content-Length": String(contentLength) } : {}),
        },
        validateStatus: () => true,
      })
    }

    const createType = async () => {
      const response = await api.post(
        "/admin/jovy/events/types",
        { code: unique("media-tipo"), name: "Feria multimedia" },
        { headers: adminHeaders(adminToken), validateStatus: () => true },
      )
      expect(response.status).toBe(201)
      return response.data.event_type as { id: string }
    }

    const createEvent = async (input: Record<string, unknown>) => {
      const response = await api.post(
        "/admin/jovy/events",
        {
          status: "published",
          enabled: true,
          priority: 0,
          sort_order: 0,
          title_en: "Novelty event",
          starts_at: minutesFromNow(-60),
          ends_at: minutesFromNow(60),
          ...input,
        },
        { headers: adminHeaders(adminToken), validateStatus: () => true },
      )
      expect(response.status).toBe(201)
      return response.data.event as { id: string; media_file_id: string | null }
    }

    const storeEvents = async () => {
      const response = await api.get("/store/jovy/events", {
        headers: storeHeaders(publishableApiKey),
        validateStatus: () => true,
      })
      expect(response.status).toBe(200)
      return response.data.events as Array<Record<string, unknown> & { id: string }>
    }

    it("exige sesión de administrador en el carril de vídeo", async () => {
      const response = await upload(mp4, "novelty.mp4", "video/mp4", undefined, false)

      expect(response.status).toBe(401)
    })

    it("rechaza SVG, firmas falsas y MIME declarado distinto del real", async () => {
      const svg = await upload(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'),
        "novelty.svg",
        "image/svg+xml",
      )
      expect(svg.status).toBe(400)
      expect(svg.data.message).toContain("SVG")

      const png = await upload(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
        "fake.mp4",
        "video/mp4",
      )
      expect(png.status).toBe(400)
      expect(png.data.message).toContain("MP4/WebM o GIF")

      const mismatch = await upload(gif, "novelty.gif", "video/mp4")
      expect(mismatch.status).toBe(400)
      expect(mismatch.data.message).toContain("no coincide")

      // Los archivos rechazados por contenido tampoco dejan temporales.
      await expectNoTempUploads()
    })

    it("acepta MP4 y GIF reales, publica media_type y archivar excluye el evento", async () => {
      const videoUpload = await upload(mp4, "novelty.mp4", "video/mp4")
      expect(videoUpload.status).toBe(201)
      expect(videoUpload.data.media_type).toBe("video")
      expect(videoUpload.data.file.url).toContain(".mp4")

      const gifUpload = await upload(gif, "novelty.gif", "image/gif")
      expect(gifUpload.status).toBe(201)
      expect(gifUpload.data.media_type).toBe("gif")
      expect(gifUpload.data.file.url).toContain(".gif")

      const type = await createType()
      const event = await createEvent({
        title: "Evento con vídeo",
        slug: unique("evento-video"),
        event_type_id: type.id,
        media_file_id: videoUpload.data.file.id,
      })

      const published = (await storeEvents()).find((item) => item.id === event.id)
      expect(published).toMatchObject({
        id: event.id,
        media_file_id: videoUpload.data.file.id,
        media_url: videoUpload.data.file.url,
        media_type: "video",
      })

      // El Admin resuelve URL y tipo en la misma lectura de la bandeja.
      const adminList = await api.get("/admin/jovy/events", {
        headers: adminHeaders(adminToken),
        validateStatus: () => true,
      })
      expect(adminList.status).toBe(200)
      expect((adminList.data.events as Array<Record<string, unknown>>).find((item) => item.id === event.id)).toMatchObject({
        media_url: videoUpload.data.file.url,
        media_type: "video",
      })

      const archived = await api.put(
        `/admin/jovy/events/${event.id}`,
        { status: "archived" },
        { headers: adminHeaders(adminToken), validateStatus: () => true },
      )
      expect(archived.status).toBe(200)
      expect((await storeEvents()).map((item) => item.id)).not.toContain(event.id)

      await expectNoTempUploads()
    })

    it("mantiene los eventos sin medio identificables con media_type nulo", async () => {
      const type = await createType()
      const withoutMedia = await createEvent({
        title: "Evento sin medio",
        slug: unique("evento-sin-medio"),
        event_type_id: type.id,
      })

      const visible = (await storeEvents()).find((item) => item.id === withoutMedia.id)
      expect(visible).toBeDefined()
      expect(visible).toMatchObject({ media_file_id: null, media_url: null, media_type: null })
    })

    it("responde 429 a una segunda subida de vídeo simultánea", async () => {
      const [first, second] = await Promise.all([
        upload(mp4, "novelty.mp4", "video/mp4"),
        upload(mp4, "novelty.mp4", "video/mp4"),
      ])

      expect([first.status, second.status].sort()).toEqual([201, 429])
      const limited = [first, second].find((response) => response.status === 429)!
      expect(limited.data.message).toContain("subida de vídeo en curso")

      await expectNoTempUploads()
    })

    it("dispara LIMIT_FILE_SIZE con un cuerpo real mayor a 100 MB", async () => {
      // El archivo supera el tope, pero el cuerpo completo (archivo + boundary)
      // queda por debajo de tope + margen: así no responde la guardia de
      // `Content-Length` y el rechazo lo produce `multer` al escribir a disco.
      const oversized = Buffer.alloc(EVENT_VIDEO_MAX_BYTES + 1_024, 0x61)
      const response = await upload(oversized, "oversized.mp4", "video/mp4")

      expect(response.status).toBe(413)
      expect(response.data.message).toBe("El archivo supera el límite de 100 MB.")
      await expectNoTempUploads()
    }, 180_000)

    // Se ejecuta al final: el cuerpo declarado deja la conexión a medias y no
    // debe condicionar los envíos reales de los demás casos.
    it("responde 413 cuando el cuerpo declarado supera 100 MB", async () => {
      const response = await upload(
        Buffer.from("x"),
        "oversized.mp4",
        "video/mp4",
        EVENT_VIDEO_MAX_BYTES + EVENT_VIDEO_MULTIPART_OVERHEAD_BYTES + 1,
      )

      expect(response.status).toBe(413)
      expect(response.data.message).toBe("El archivo supera el límite de 100 MB.")
    })
  },
})
