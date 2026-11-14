/**
 * El File Module local devuelve `url` absoluta. Un archivo borrado del disco no
 * debe exponer un error de almacenamiento: las rutas Store degradan a `null`.
 * Se usa sólo desde los módulos de presentación nuevos; el CMS existente ya
 * tiene su propia resolución inline y no se refactoriza aquí.
 */
export type FileModuleLike = {
  retrieveFile: (id: string) => Promise<{ url: string }>
}

export async function resolveFileUrl(files: FileModuleLike, fileId?: string | null) {
  if (!fileId) return null
  try {
    return (await files.retrieveFile(fileId)).url
  } catch {
    return null
  }
}
