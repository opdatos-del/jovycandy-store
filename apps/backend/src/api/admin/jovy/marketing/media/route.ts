import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import sharp from "sharp"

type UploadedFile = { originalname: string; mimetype: string; buffer: Buffer; size: number }
type UploadedFiles = UploadedFile[] | Record<string, UploadedFile[]>
const MAX_FILE_SIZE = 5 * 1024 * 1024

function detectMime(buffer: Buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg"
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp"
  return null
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const uploadedFiles = (req as unknown as { files?: UploadedFiles }).files
  const files = Array.isArray(uploadedFiles) ? uploadedFiles : Object.values(uploadedFiles ?? {}).flat()
  if (files.length !== 1) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Se requiere una sola imagen")
  const [file] = files
  const actualMime = detectMime(file.buffer)
  if (file.size > MAX_FILE_SIZE || !actualMime || actualMime !== file.mimetype) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Solo se aceptan imágenes PNG, JPEG o WebP de hasta 5 MB")
  }
  try {
    const metadata = await sharp(file.buffer, { failOn: "error" }).metadata()
    if (!metadata.width || !metadata.height || metadata.format !== actualMime.slice(6)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Formato de imagen inválido")
  } catch {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "La imagen no puede decodificarse")
  }

  const extension = actualMime === "image/png" ? "png" : actualMime === "image/jpeg" ? "jpg" : "webp"
  const { result: uploaded } = await uploadFilesWorkflow(req.scope).run({
    input: { files: [{ filename: `jovy-marketing-${crypto.randomUUID()}.${extension}`, mimeType: actualMime, content: file.buffer.toString("base64"), access: "public" }] },
  })
  res.status(201).json({ file: uploaded[0] })
}
