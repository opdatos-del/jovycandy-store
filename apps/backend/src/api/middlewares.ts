import {
  authenticate,
  configureStoreSearch,
  defineMiddlewares,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http'
import multer from "multer"
import { createEventVideoUpload } from "@jovy/lib/jovy/event-video-upload"
import {
  acquireEventVideoUploadLock,
  consumeEventVideoUpload,
  exceedsEventVideoUploadLimit,
  releaseEventVideoUploadLock,
  removeEventVideoTempFile,
} from "@jovy/lib/jovy/events-media"

const jovyImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
})

// El carril de vídeo/GIF escribe a disco y tiene su propio límite (100 MB). No
// comparte el de imágenes para no relajar las pantallas que sólo admiten
// PNG/JPEG/WebP.
const jovyEventVideoUpload = createEventVideoUpload()

type VideoFile = { path?: string }
// `authenticate` de Medusa escribe el actor en `auth_context`; `auth` no existe
// en la solicitud y usarlo como clave compartía el rate limit por IP.
type RequestWithAuthContext = MedusaRequest & { auth_context?: { actor_id?: string | null } }

function uploadedVideoFiles(req: MedusaRequest) {
  const files = (req as unknown as { files?: VideoFile[] | Record<string, VideoFile[]> }).files
  if (!files) return []
  return Array.isArray(files) ? files : Object.values(files).flat()
}

function cleanupVideoTempFiles(req: MedusaRequest) {
  return Promise.all(
    uploadedVideoFiles(req)
      .map((file) => file.path)
      .filter((filePath): filePath is string => Boolean(filePath))
      .map((filePath) => removeEventVideoTempFile(filePath)),
  )
}

/**
 * Traduce los errores de `multer` a respuestas JSON explícitas: 413 cuando el
 * archivo excede 100 MB y 400 cuando el formulario no trae exactamente un
 * archivo. La comprobación de `Content-Length` responde antes de leer el cuerpo.
 *
 * Además aplica un rate limit por usuario/IP y un lock en proceso: una subida
 * de 100 MB a la vez. El lock se libera al terminar la respuesta y los archivos
 * temporales se eliminan tanto en éxito como en error o aborto del cliente.
 */
function jovyEventVideoMedia(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const declared = req.headers["content-length"]

  if (exceedsEventVideoUploadLimit(Array.isArray(declared) ? declared[0] : declared)) {
    res.status(413).json({ type: "invalid_data", message: "El archivo supera el límite de 100 MB." })
    return
  }

  const actorId = (req as RequestWithAuthContext).auth_context?.actor_id
  const rateKey = actorId ? `user:${actorId}` : `ip:${req.ip ?? "unknown"}`
  const rate = consumeEventVideoUpload(rateKey)
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds))
    res.status(429).json({
      type: "invalid_data",
      message: "Demasiadas subidas de vídeo; intenta de nuevo más tarde.",
    })
    return
  }

  const lockToken = acquireEventVideoUploadLock()
  if (!lockToken) {
    res.status(429).json({
      type: "invalid_data",
      message: "Ya hay una subida de vídeo en curso; espera a que termine.",
    })
    return
  }

  const release = () => releaseEventVideoUploadLock(lockToken)
  const cleanup = () => void cleanupVideoTempFiles(req)
  // `finish` cubre la respuesta normal y `close` el aborto del cliente. Ambos
  // son idempotentes (`force` y token), así que no importa que se disparen dos.
  res.once("finish", release)
  res.once("close", release)
  res.once("finish", cleanup)
  res.once("close", cleanup)

  jovyEventVideoUpload.array("files", 1)(req as never, res as never, (error: unknown) => {
    if (!error) {
      next()
      return
    }

    void cleanup()
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE"
      res.status(tooLarge ? 413 : 400).json({
        type: "invalid_data",
        message: tooLarge
          ? "El archivo supera el límite de 100 MB."
          : "Se requiere un solo vídeo MP4/WebM o GIF",
      })
      return
    }

    next(error)
  })
}

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      matcher: '/admin/jovy/*',
      middlewares: [authenticate('user', ['session', 'bearer', 'api-key'])],
    },
    {
      method: ["POST"],
      matcher: "/admin/jovy/marketing/media",
      middlewares: [
        // Multer is the official Medusa mechanism for multipart API routes.
        jovyImageUpload.array("files", 1),
      ],
    },
    {
      method: ["POST"],
      matcher: "/admin/jovy/events/media/video",
      middlewares: [jovyEventVideoMedia],
    },
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
  ],
})
