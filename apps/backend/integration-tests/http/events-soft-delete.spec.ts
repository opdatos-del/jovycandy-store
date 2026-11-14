import { readFileSync } from "node:fs"
import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

import { JOVY_EVENTS_MODULE } from "@jovy/modules/jovy-events"

import {
  adminHeaders,
  createAdminSession,
  createPublishableApiKey,
  storeHeaders,
} from "./utils"

jest.setTimeout(120_000)

const gif = readFileSync(path.join(__dirname, "..", "fixtures", "novelty.gif"))
const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()

function multipart(file: Buffer, filename: string, mimeType: string) {
  const boundary = `----jovy-${Date.now()}-${Math.floor(Math.random() * 10_000)}`
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return { body: Buffer.concat([head, file, tail]), contentType: `multipart/form-data; boundary=${boundary}` }
}

/**
 * El borrado de eventos debe ser lógico: la fila conserva `deleted_at`, deja de
 * aparecer en Admin y Store, y el medio compartido del File Module no se toca.
 */
medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-events-soft-delete",
  testSuite: ({ api, getContainer }) => {
    let adminToken: string
    let publishableApiKey: string

    beforeAll(async () => {
      adminToken = await createAdminSession(getContainer(), api)
      publishableApiKey = await createPublishableApiKey(getContainer())
    })

    const adminConfig = () => ({ headers: adminHeaders(adminToken), validateStatus: () => true })
    const storeConfig = () => ({ headers: storeHeaders(publishableApiKey), validateStatus: () => true })

    it("conserva deleted_at y excluye el evento de Admin y Store sin borrar el medio", async () => {
      const typeResponse = await api.post(
        "/admin/jovy/events/types",
        { code: unique("soft-delete-tipo"), name: "Tipo soft delete" },
        adminConfig(),
      )
      expect(typeResponse.status).toBe(201)
      const typeId = typeResponse.data.event_type.id as string

      const upload = multipart(gif, "novelty.gif", "image/gif")
      const uploaded = await api.post("/admin/jovy/events/media/video", upload.body, {
        ...adminConfig(),
        headers: { ...adminHeaders(adminToken), "Content-Type": upload.contentType },
      })
      expect(uploaded.status).toBe(201)
      const mediaId = uploaded.data.file.id as string

      const created = await api.post(
        "/admin/jovy/events",
        {
          title: "Evento con borrado lógico",
          title_en: "Soft deleted event",
          slug: unique("evento-soft-delete"),
          event_type_id: typeId,
          media_file_id: mediaId,
          status: "published",
          enabled: true,
          priority: 0,
          sort_order: 0,
          starts_at: minutesFromNow(-60),
          ends_at: minutesFromNow(60),
        },
        adminConfig(),
      )
      expect(created.status).toBe(201)
      const eventId = created.data.event.id as string

      const adminBefore = await api.get("/admin/jovy/events", adminConfig())
      expect(adminBefore.status).toBe(200)
      expect((adminBefore.data.events as Array<{ id: string }>).map((event) => event.id)).toContain(eventId)
      const storeBefore = await api.get("/store/jovy/events", storeConfig())
      expect(storeBefore.status).toBe(200)
      expect((storeBefore.data.events as Array<{ id: string }>).map((event) => event.id)).toContain(eventId)

      const removed = await api.delete(`/admin/jovy/events/${eventId}`, adminConfig())
      expect(removed.status).toBe(204)

      const adminAfter = await api.get("/admin/jovy/events", adminConfig())
      expect((adminAfter.data.events as Array<{ id: string }>).map((event) => event.id)).not.toContain(eventId)
      expect((await api.get(`/admin/jovy/events/${eventId}`, adminConfig())).status).toBe(404)

      const storeAfter = await api.get("/store/jovy/events", storeConfig())
      expect((storeAfter.data.events as Array<{ id: string }>).map((event) => event.id)).not.toContain(eventId)

      const service = getContainer().resolve(JOVY_EVENTS_MODULE)
      expect(await service.listJovyEvents({ id: eventId })).toHaveLength(0)
      const [deleted] = (await service.listJovyEvents(
        { id: eventId },
        { withDeleted: true },
      )) as Array<{ id: string; deleted_at: Date | null }>
      expect(deleted).toMatchObject({ id: eventId })
      expect(deleted.deleted_at).toBeTruthy()

      // El evento y el archivo son entidades separadas: borrar el evento no
      // elimina un medio que puede estar referenciado en otra parte.
      const fileModule = getContainer().resolve(Modules.FILE)
      await expect(fileModule.retrieveFile(mediaId)).resolves.toMatchObject({ id: mediaId })
    })
  },
})
