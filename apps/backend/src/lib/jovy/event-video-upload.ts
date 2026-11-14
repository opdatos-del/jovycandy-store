import multer from "multer"
import {
  ensureEventVideoTempDir,
  EVENT_VIDEO_MAX_BYTES,
  EVENT_VIDEO_TEMP_DIR,
  eventVideoTempFilename,
} from "./events-media"

/**
 * `diskStorage` escribe el multipart directamente en un directorio temporal del
 * sistema operativo. No se usa `memoryStorage`: un cuerpo de 100 MB en memoria
 * se multiplica con cada solicitud concurrente.
 *
 * El factory acepta un límite menor sólo para pruebas reales de
 * `LIMIT_FILE_SIZE`; el middleware de producción usa `EVENT_VIDEO_MAX_BYTES`.
 */
export function createEventVideoUpload(maxBytes = EVENT_VIDEO_MAX_BYTES) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        ensureEventVideoTempDir()
          .then((directory) => callback(null, directory))
          .catch((error: Error) => callback(error, EVENT_VIDEO_TEMP_DIR))
      },
      filename: (_req, _file, callback) => callback(null, eventVideoTempFilename()),
    }),
    limits: { files: 1, fileSize: maxBytes },
  })
}
