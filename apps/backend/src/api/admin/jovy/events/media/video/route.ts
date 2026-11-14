import { readFile } from "node:fs/promises"
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import {
  removeEventVideoTempFile,
  validateEventMediaFile,
} from "@jovy/lib/jovy/events-media"

type UploadedFile = {
  originalname: string
  mimetype: string
  size: number
  path: string
}
type UploadedFiles = UploadedFile[] | Record<string, UploadedFile[]>

/**
 * Carril de vídeo/GIF de Novedades. Es independiente del endpoint de imágenes
 * (5 MB, PNG/JPEG/WebP) para no relajar la validación de las pantallas que sólo
 * muestran imágenes. Devuelve el `media_type` ya derivado para que el Admin no
 * tenga que reinterpretar la extensión.
 *
 * `multer.diskStorage` deja el archivo en un directorio temporal. Aquí se lee
 * sólo la cabecera para validar la firma y después una única vez como base64
 * para el File Module. El temporal se elimina en `finally`, incluso si la
 * validación o la subida fallan; el middleware también lo limpia al cerrar la
 * respuesta si esta ruta no llega a ejecutarse.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const uploadedFiles = (req as unknown as { files?: UploadedFiles }).files
  const files = Array.isArray(uploadedFiles) ? uploadedFiles : Object.values(uploadedFiles ?? {}).flat()
  if (files.length !== 1) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Se requiere un solo vídeo MP4/WebM o GIF")
  }

  const [file] = files
  try {
    const validation = await validateEventMediaFile(file)

    // 413 no es un tipo de error de Medusa: se responde de forma explícita para
    // que el cliente distinga "no cabe" de "no es un formato permitido".
    if (!validation.ok) {
      if (validation.status === 413) {
        res.status(413).json({ type: "invalid_data", message: validation.message })
        return
      }
      throw new MedusaError(MedusaError.Types.INVALID_DATA, validation.message)
    }

    const extension =
      validation.mime === "video/mp4" ? "mp4" : validation.mime === "video/webm" ? "webm" : "gif"

    // `readFile` con encoding devuelve la cadena base64 directamente: no se
    // conserva un buffer completo adicional del archivo.
    let content: string | null = await readFile(file.path, "base64")

    try {
      const { result: uploaded } = await uploadFilesWorkflow(req.scope).run({
        input: {
          files: [
            {
              filename: `jovy-event-${crypto.randomUUID()}.${extension}`,
              mimeType: validation.mime,
              content,
              access: "public",
            },
          ],
        },
      })

      res.status(201).json({ file: uploaded[0], media_type: validation.media_type })
    } finally {
      // Libera la referencia de la cadena base64 en cuanto el File Module ya la
      // consumió; el temporal no depende de ella.
      content = null
    }
  } finally {
    await removeEventVideoTempFile(file.path)
  }
}
