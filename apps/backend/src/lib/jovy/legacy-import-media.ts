import { stat } from "node:fs/promises"
import path from "node:path"

export type LegacyMediaState =
  | "local-valid"
  | "local-missing"
  | "remote-valid"
  | "source-fallback"

/** Convierte únicamente URLs bajo `/static/` a rutas seguras del provider local. */
export function staticMediaPath(
  url: string,
  staticDirectory = path.resolve(process.cwd(), "static"),
): string | null {
  let pathname: string
  try {
    pathname = new URL(url, "http://jovy-local.invalid").pathname
  } catch {
    return null
  }
  const marker = "/static/"
  const index = pathname.indexOf(marker)
  if (index < 0) return null

  const root = path.resolve(staticDirectory)
  const relative = pathname.slice(index + marker.length)
  if (!relative) return null
  try {
    const target = path.resolve(root, decodeURIComponent(relative))
    return target === root || !target.startsWith(`${root}${path.sep}`) ? null : target
  } catch {
    return null
  }
}

/** Un archivo local sólo es reutilizable si existe y es un archivo regular. */
export async function localMediaFileExists(
  url: string,
  staticDirectory?: string,
): Promise<boolean> {
  const localPath = staticMediaPath(url, staticDirectory)
  if (!localPath) return false
  try {
    return (await stat(localPath)).isFile()
  } catch {
    return false
  }
}

export function classifyStoredLegacyMedia(
  url: string | undefined,
  isAvailable: boolean,
): LegacyMediaState {
  if (!url) return "source-fallback"
  if (staticMediaPath(url)) return isAvailable ? "local-valid" : "local-missing"
  return isAvailable ? "remote-valid" : "source-fallback"
}
