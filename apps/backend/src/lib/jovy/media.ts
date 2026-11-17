import { MedusaError } from "@medusajs/framework/utils"

/**
 * El File Module local devuelve `url` absoluta. Un archivo borrado del disco no
 * debe exponer un error de almacenamiento: las rutas Store degradan a `null`.
 * Se usa sólo desde los módulos de presentación nuevos; el CMS existente ya
 * tiene su propia resolución inline y no se refactoriza aquí.
 */
export type FileModuleLike = {
  retrieveFile: (id: string) => Promise<{ url: string }>
}

/**
 * El File Module no expone el MIME en `retrieveFile` (sólo `id` y `url`), así
 * que la firma binaria es la única comprobación real de que el archivo es una
 * imagen. `getAsBuffer` forma parte del contrato público del módulo desde 2.8.
 */
export type ImageFileLookup = FileModuleLike & {
  getAsBuffer: (id: string) => Promise<Buffer>
}

export async function resolveFileUrl(files: FileModuleLike, fileId?: string | null) {
  if (!fileId) return null
  try {
    return (await files.retrieveFile(fileId)).url
  } catch {
    return null
  }
}

/** Firmas de los formatos que aceptan las pantallas de presentación. */
export function imageMimeFromBuffer(buffer: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg"
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp"
  }
  return null
}

/**
 * Valida una referencia de imagen antes de persistirla: el id debe existir en
 * el File Module y su contenido debe ser PNG, JPEG o WebP. Ambas condiciones se
 * responden como `INVALID_DATA` porque el problema está en el cuerpo editado,
 * no en la ruta: el Admin corrige el id o vuelve a subir la imagen.
 */
export async function assertImageFile(files: ImageFileLookup, fileId: string): Promise<void> {
  try {
    await files.retrieveFile(fileId)
  } catch {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "El archivo de imagen no existe")
  }

  let buffer: Buffer
  try {
    buffer = await files.getAsBuffer(fileId)
  } catch {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "No se pudo leer el archivo de imagen")
  }

  if (!imageMimeFromBuffer(buffer)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "El archivo de imagen no es una imagen PNG, JPEG o WebP")
  }
}
