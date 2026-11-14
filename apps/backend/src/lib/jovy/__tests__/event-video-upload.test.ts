import http from "node:http"
import { rm } from "node:fs/promises"
import multer from "multer"
import { createEventVideoUpload } from "@jovy/lib/jovy/event-video-upload"
import { EVENT_VIDEO_TEMP_DIR } from "@jovy/lib/jovy/events-media"

type UploadResult = { status: number; error?: unknown }

/**
 * Ejecuta el middleware real de `multer` contra un servidor HTTP local. El
 * cuerpo se envía completo: no se simula `Content-Length`, así que el límite se
 * dispara por el flujo real del multipart (`LIMIT_FILE_SIZE`).
 */
function sendMultipart(
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: (error?: unknown) => void,
  ) => void,
  body: Buffer,
  contentType: string,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let failure: unknown
      handler(req, res, (error?: unknown) => {
        failure = error
        res.statusCode =
          error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
            ? 413
            : error
              ? 500
              : 204
        res.end()
      })
      res.once("finish", () => server.close(() => resolve({ status: res.statusCode, error: failure })))
    })

    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close()
        reject(new Error("No se pudo abrir el servidor de prueba"))
        return
      }

      const request = http.request(
        {
          host: "127.0.0.1",
          port: address.port,
          method: "POST",
          path: "/",
          headers: { "content-type": contentType, "content-length": body.length },
        },
        (response) => response.resume(),
      )
      request.once("error", (error) => {
        server.close()
        reject(error)
      })
      request.end(body)
    })
  })
}

function multipartBody(boundary: string, file: Buffer) {
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="video.mp4"\r\n` +
      `Content-Type: video/mp4\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return Buffer.concat([head, file, tail])
}

describe("middleware de subida de vídeo con diskStorage", () => {
  beforeEach(async () => {
    await rm(EVENT_VIDEO_TEMP_DIR, { recursive: true, force: true })
  })

  afterAll(async () => {
    await rm(EVENT_VIDEO_TEMP_DIR, { recursive: true, force: true })
  })

  it("produce LIMIT_FILE_SIZE con un cuerpo real mayor que el límite", async () => {
    const maxBytes = 256
    const upload = createEventVideoUpload(maxBytes)
    const boundary = `----jovy-test-${Date.now()}`
    const body = multipartBody(boundary, Buffer.alloc(maxBytes + 1_024, 0x61))

    const result = await sendMultipart(
      (req, res, next) => upload.array("files", 1)(req as never, res as never, next),
      body,
      `multipart/form-data; boundary=${boundary}`,
    )

    expect(result.status).toBe(413)
    expect(result.error).toBeInstanceOf(multer.MulterError)
    expect((result.error as multer.MulterError).code).toBe("LIMIT_FILE_SIZE")
  }, 30_000)

  it("acepta un archivo por debajo del límite y lo escribe en el directorio temporal", async () => {
    const maxBytes = 4_096
    const upload = createEventVideoUpload(maxBytes)
    const boundary = `----jovy-test-${Date.now()}`
    const body = multipartBody(boundary, Buffer.from("GIF89a-contenido"))

    const result = await sendMultipart(
      (req, res, next) => upload.array("files", 1)(req as never, res as never, next),
      body,
      `multipart/form-data; boundary=${boundary}`,
    )

    expect(result.status).toBe(204)
    expect(result.error).toBeUndefined()
  }, 30_000)
})
