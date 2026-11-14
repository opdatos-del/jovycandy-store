/**
 * Reglas de admisión de multimedia de Novedades (eventos).
 *
 * El endpoint de imágenes (5 MB, PNG/JPEG/WebP) sigue siendo el único carril de
 * imagen: aquí sólo se valida el carril nuevo de vídeo/GIF, que no puede
 * apoyarse en `sharp` porque no decodifica contenedores de vídeo. La firma
 * binaria se comprueba siempre; el `Content-Type` declarado no basta.
 */
import { randomUUID } from "node:crypto"
import { mkdir, open, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolveFileUrl, type FileModuleLike } from "./media"

export const EVENT_VIDEO_MAX_BYTES = 100 * 1024 * 1024
/**
 * Margen para el boundary y las cabeceras multipart. Permite rechazar con 413
 * antes de leer el cuerpo sin depender de que el archivo real supere el límite.
 */
export const EVENT_VIDEO_MULTIPART_OVERHEAD_BYTES = 64 * 1024
/**
 * Bytes necesarios para identificar el contenedor. MP4 limita la búsqueda de
 * `compatible_brands` a 64 bytes, así que no hace falta leer el archivo entero
 * para validar la firma.
 */
export const EVENT_VIDEO_SIGNATURE_BYTES = 64

/** Directorio temporal propio del carril de vídeo; nunca `static`. */
export const EVENT_VIDEO_TEMP_DIR = join(tmpdir(), "jovy-event-video-uploads")

export async function ensureEventVideoTempDir() {
  await mkdir(EVENT_VIDEO_TEMP_DIR, { recursive: true })
  return EVENT_VIDEO_TEMP_DIR
}

export function eventVideoTempFilename() {
  return `${randomUUID()}.upload`
}

/** Lee solo la cabecera; el resto del archivo no se copia a memoria. */
export async function readEventMediaHeader(filePath: string) {
  const handle = await open(filePath, "r")
  try {
    const buffer = Buffer.alloc(EVENT_VIDEO_SIGNATURE_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, EVENT_VIDEO_SIGNATURE_BYTES, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

export async function removeEventVideoTempFile(filePath?: string | null) {
  if (!filePath) return
  await rm(filePath, { force: true }).catch(() => {
    // La limpieza es best effort: un archivo ya eliminado o bloqueado no debe
    // convertir un error de subida en un error secundario.
  })
}

export type EventMediaType = "image" | "gif" | "video"
export type EventVideoMime = "video/mp4" | "video/webm" | "image/gif"

/**
 * Marcas `ftyp` habituales de MP4/M4V. Se excluyen a propósito marcas de imagen
 * (HEIC/AVIF) y `qt  ` (QuickTime), que no forman parte de este contrato.
 */
const MP4_BRANDS = new Set([
  "isom",
  "iso2",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "avc1",
  "M4V ",
  "M4VH",
  "M4VP",
  "dash",
  "msdh",
  "msix",
  "mmp4",
  "MSNV",
  "XAVC",
  "NDAS",
])

const ascii = (buffer: Buffer, start: number, end: number) =>
  buffer.subarray(start, end).toString("ascii")

function isMp4(buffer: Buffer) {
  if (buffer.length < 16 || ascii(buffer, 4, 8) !== "ftyp") return false

  const boxSize = buffer.readUInt32BE(0)
  if (boxSize !== 0 && boxSize < 12) return false

  if (MP4_BRANDS.has(ascii(buffer, 8, 12))) return true

  // Algunos codificadores ponen una marca menor en `major_brand` y la familia
  // MP4 en `compatible_brands`; se revisan ambas dentro del propio box `ftyp`.
  const limit = Math.min(boxSize === 0 ? buffer.length : boxSize, buffer.length, 64)
  for (let offset = 16; offset + 4 <= limit; offset += 4) {
    if (MP4_BRANDS.has(ascii(buffer, offset, offset + 4))) return true
  }

  return false
}

function isWebm(buffer: Buffer) {
  // Cabecera EBML: 0x1A 0x45 0xDF 0xA3. El DocType "webm" aparece en los
  // primeros bytes; comprobarlo evita aceptar otros contenedores EBML.
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return false
  }
  return buffer.subarray(0, 64).toString("latin1").includes("webm")
}

function isGif(buffer: Buffer) {
  if (buffer.length < 6) return false
  const header = ascii(buffer, 0, 6)
  return header === "GIF87a" || header === "GIF89a"
}

/** Devuelve el MIME real del archivo, o `null` si no es MP4, WebM ni GIF. */
export function detectEventVideoMime(buffer: Buffer): EventVideoMime | null {
  if (isGif(buffer)) return "image/gif"
  if (isWebm(buffer)) return "video/webm"
  if (isMp4(buffer)) return "video/mp4"
  return null
}

export function eventMediaTypeFromMime(mime: string): EventMediaType | null {
  if (mime === "image/gif") return "gif"
  if (mime === "video/mp4" || mime === "video/webm") return "video"
  return null
}

/**
 * Deriva el tipo desde la URL pública del File Module. El módulo de archivos
 * sólo persiste `id` y `url`, así que la extensión es la señal disponible.
 * Se incluyen las extensiones históricas (`mov`, `m4v`, `ogg`) para archivos
 * heredados; las nuevas cargas sólo aceptan MP4/WebM/GIF.
 */
export function eventMediaTypeFromUrl(url?: string | null): EventMediaType | null {
  if (!url) return null

  const extension = /\.([a-z0-9]+)$/i.exec(url.split(/[?#]/)[0])?.[1]?.toLowerCase()
  if (!extension) return null

  if (extension === "gif") return "gif"
  if (["mp4", "webm", "mov", "m4v", "ogg", "ogv"].includes(extension)) return "video"
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return "image"
  return null
}

export type EventMediaValidation =
  | { ok: true; mime: EventVideoMime; media_type: EventMediaType }
  | { ok: false; status: 400 | 413; message: string }

function validateEventMediaSignature(file: {
  size: number
  mimetype: string
  signature: Buffer
}): EventMediaValidation {
  if (file.size <= 0) {
    return { ok: false, status: 400, message: "El archivo está vacío." }
  }

  if (file.size > EVENT_VIDEO_MAX_BYTES) {
    return { ok: false, status: 413, message: "El archivo supera el límite de 100 MB." }
  }

  const detected = detectEventVideoMime(file.signature)
  if (!detected) {
    return {
      ok: false,
      status: 400,
      message: "Solo se aceptan vídeos MP4/WebM o GIF. SVG y otros formatos no están permitidos.",
    }
  }

  if (file.mimetype !== detected) {
    return {
      ok: false,
      status: 400,
      message: "El tipo declarado no coincide con el contenido real del archivo.",
    }
  }

  return { ok: true, mime: detected, media_type: eventMediaTypeFromMime(detected)! }
}

/**
 * Valida el archivo antes de tocar el File Module. `size` es el tamaño real
 * reportado por `multer`; `mimetype` es sólo lo que declaró el cliente. La
 * firma se busca en el buffer recibido (pruebas de la regla pura).
 */
export function validateEventMediaUpload(file: {
  size: number
  mimetype: string
  buffer: Buffer
}): EventMediaValidation {
  return validateEventMediaSignature({
    size: file.size,
    mimetype: file.mimetype,
    signature: file.buffer.subarray(0, EVENT_VIDEO_SIGNATURE_BYTES),
  })
}

/**
 * Variante para `multer.diskStorage`: lee únicamente la cabecera del archivo
 * temporal y no mantiene el cuerpo completo en memoria durante la validación.
 */
export async function validateEventMediaFile(file: {
  size: number
  mimetype: string
  path: string
}): Promise<EventMediaValidation> {
  if (file.size <= 0) {
    return { ok: false, status: 400, message: "El archivo está vacío." }
  }

  if (file.size > EVENT_VIDEO_MAX_BYTES) {
    return { ok: false, status: 413, message: "El archivo supera el límite de 100 MB." }
  }

  let signature: Buffer
  try {
    signature = await readEventMediaHeader(file.path)
  } catch {
    return { ok: false, status: 400, message: "No se pudo leer el archivo temporal." }
  }

  return validateEventMediaSignature({ size: file.size, mimetype: file.mimetype, signature })
}

/** Guardia previa a `multer`: evita leer cuerpos declarados por encima del tope. */
export function exceedsEventVideoUploadLimit(contentLength: number | string | undefined) {
  const declared = Number(contentLength ?? 0)
  return Number.isFinite(declared) && declared > EVENT_VIDEO_MAX_BYTES + EVENT_VIDEO_MULTIPART_OVERHEAD_BYTES
}

/**
 * Lock en proceso del carril de vídeo. El File Module recibe base64 y una
 * subida de 100 MB no debe multiplicarse por solicitudes concurrentes. Es un
 * límite de instancia, no distribuido: con varias réplicas cada una tendría su
 * propio lock.
 */
let activeVideoUploadToken: string | null = null

export function acquireEventVideoUploadLock(token: string = randomUUID()): string | null {
  if (activeVideoUploadToken) return null
  activeVideoUploadToken = token
  return token
}

export function releaseEventVideoUploadLock(token?: string | null) {
  if (token && activeVideoUploadToken === token) activeVideoUploadToken = null
}

export function isEventVideoUploadLocked() {
  return activeVideoUploadToken !== null
}

type RateWindow = { count: number; resetAt: number }

const videoWindows = new Map<string, RateWindow>()
const VIDEO_WINDOW_MS = 10 * 60 * 1_000
const VIDEO_MAX_REQUESTS = 20

export type EventVideoRateLimit =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

/**
 * Rate limit de laboratorio por usuario/IP, en memoria y por proceso. Se
 * mantiene deliberadamente simple; un despliegue real necesita un almacén
 * compartido o el límite en el borde.
 */
export function consumeEventVideoUpload(key: string, now = Date.now()): EventVideoRateLimit {
  for (const [entry, value] of videoWindows) if (value.resetAt <= now) videoWindows.delete(entry)
  const current = videoWindows.get(key)
  if (!current || current.resetAt <= now) {
    videoWindows.set(key, { count: 1, resetAt: now + VIDEO_WINDOW_MS })
    return { allowed: true }
  }
  if (current.count >= VIDEO_MAX_REQUESTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1_000) }
  }
  current.count += 1
  return { allowed: true }
}

export const eventVideoRateLimit = { maxRequests: VIDEO_MAX_REQUESTS, windowMs: VIDEO_WINDOW_MS }

/** Resuelve URL y tipo en una sola lectura del File Module. */
export async function resolveEventMedia(files: FileModuleLike, fileId?: string | null) {
  const media_url = await resolveFileUrl(files, fileId)
  return { media_url, media_type: eventMediaTypeFromUrl(media_url) }
}
