import { randomUUID } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import sharp from "sharp"

type UploadedFile = { originalname: string; mimetype: string; buffer: Buffer; size: number }
type UploadedFiles = UploadedFile[] | Record<string, UploadedFile[]>

export type LogoImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif"
export type LogoImageValidation =
  | { ok: true; mime: LogoImageMime; extension: string }
  | { ok: false; message: string }

/**
 * Límite histórico de Logos (20 MB), propio de este carril. El endpoint general
 * de marketing se queda en 5 MB: las pantallas que solo muestran imágenes no
 * deben heredar el tope del recorte sin pérdida.
 */
export const JOVY_LOGO_MEDIA_MAX_BYTES = 20 * 1024 * 1024

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])

const EXPECTED_FORMAT: Record<LogoImageMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
  "image/gif": "gif",
}

const EXTENSION: Record<LogoImageMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}

/** Devuelve el MIME real por firma binaria, o `null` si el contenido no es de este contrato. */
export function detectLogoImageMime(buffer: Buffer): LogoImageMime | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return "image/png"
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_SIGNATURE)) return "image/jpeg"
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp"
  }
  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString("ascii")
    if (header === "GIF87a" || header === "GIF89a") return "image/gif"
  }
  // SVG excluido deliberadamente: servirse inline desde el mismo origen permite
  // ejecutar script (XSS). El histórico lo aceptaba; aquí es un bloqueo de seguridad.
  return null
}

/**
 * Valida antes de subir: tamaño, firma real, coincidencia con el MIME declarado
 * y decodificación con sharp. No transforma el buffer; sharp solo lee metadatos.
 */
export async function validateLogoImage(file: {
  size: number
  mimetype: string
  buffer: Buffer
}): Promise<LogoImageValidation> {
  if (file.size <= 0 || file.buffer.length === 0) {
    return { ok: false, message: "El archivo está vacío." }
  }

  if (file.size > JOVY_LOGO_MEDIA_MAX_BYTES || file.buffer.length > JOVY_LOGO_MEDIA_MAX_BYTES) {
    return { ok: false, message: "El archivo supera el límite de 20 MB." }
  }

  const detected = detectLogoImageMime(file.buffer)
  if (!detected) {
    return {
      ok: false,
      message: "Solo se aceptan imágenes PNG, JPEG, WebP o GIF. SVG y otros formatos no están permitidos.",
    }
  }
  if (file.mimetype !== detected) {
    return { ok: false, message: "El tipo declarado no coincide con el contenido real del archivo." }
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>
  try {
    metadata = await sharp(file.buffer, { failOn: "error" }).metadata()
  } catch {
    return { ok: false, message: "La imagen no puede decodificarse." }
  }
  if (!metadata.width || !metadata.height || metadata.format !== EXPECTED_FORMAT[detected]) {
    return { ok: false, message: "Formato de imagen inválido." }
  }

  return { ok: true, mime: detected, extension: EXTENSION[detected] }
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const uploadedFiles = (req as unknown as { files?: UploadedFiles }).files
  const files = Array.isArray(uploadedFiles) ? uploadedFiles : Object.values(uploadedFiles ?? {}).flat()
  if (files.length !== 1) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Se requiere una sola imagen")
  }

  const [file] = files
  const validation = await validateLogoImage(file)
  if (!validation.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, validation.message)
  }

  // El original se sube sin reencodificar: el recorte posterior necesita todos
  // los píxeles y metadatos del archivo tal como lo envió el cliente.
  const { result: uploaded } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: [
        {
          filename: `jovy-logo-${randomUUID()}.${validation.extension}`,
          mimeType: validation.mime,
          content: file.buffer.toString("base64"),
          access: "public",
        },
      ],
    },
  })

  res.status(201).json({ file: uploaded[0] })
}
