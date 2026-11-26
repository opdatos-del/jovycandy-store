import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"

const CONCURRENCY = 4

type ManifestMedia = {
  url: string
  source_path: string
  status: "verified" | "unavailable"
  sha256: string | null
}

async function mapLimited<T, R>(
  values: T[],
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++
        results[index] = await mapper(values[index])
      }
    }),
  )
  return results
}

async function main() {
  const manifest = JSON.parse(
    await readFile(
      path.join(path.dirname(process.argv[1]), "manifest.json"),
      "utf8",
    ),
  )
  if (!Array.isArray(manifest?.media)) {
    throw new Error("El manifiesto no contiene medios verificables")
  }
  const media = manifest.media as ManifestMedia[]
  const invalid = media.filter(
    (asset) =>
      typeof asset.url !== "string" ||
      (asset.status === "verified" && !/^[a-f0-9]{64}$/.test(asset.sha256 ?? "")),
  )
  if (invalid.length) {
    throw new Error(`El manifiesto tiene ${invalid.length} medios con URL o hash inválido`)
  }
  const assets = [...new Map(
    media
      .filter((asset) => asset.status === "verified" && asset.sha256)
      .map((asset) => [asset.sha256!, asset]),
  ).values()]

  const failures = (await mapLimited(assets, async (asset) => {
    try {
      const response = await fetch(asset.url, {
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) return `${asset.source_path}: HTTP ${response.status}`
      const hash = createHash("sha256")
        .update(Buffer.from(await response.arrayBuffer()))
        .digest("hex")
      return hash === asset.sha256
        ? null
        : `${asset.source_path}: SHA-256 no coincide`
    } catch (error) {
      return `${asset.source_path}: ${error instanceof Error ? error.name : "error"}`
    }
  })).filter((failure): failure is string => Boolean(failure))

  if (failures.length) {
    throw new Error(
      `Falló verificación remota de ${failures.length}/${assets.length} medios:\n${failures.join("\n")}`,
    )
  }
  console.log(`Medios históricos verificados: ${assets.length}`)
}

void main()
