import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  classifyStoredOfficialMedia,
  localMediaFileExists,
  staticMediaPath,
} from "../official-catalog-media"

describe("medios del catálogo oficial", () => {
  it("acepta sólo rutas existentes bajo static y rechaza traversal", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "jovy-media-"))
    const image = path.join(directory, "catalog", "packshot.webp")
    fs.mkdirSync(path.dirname(image), { recursive: true })
    fs.writeFileSync(image, "image")

    expect(staticMediaPath("/static/catalog/packshot.webp", directory)).toBe(image)
    expect(staticMediaPath("/static/../secret.webp", directory)).toBeNull()
    expect(staticMediaPath("/static/catalog", directory)).not.toBeNull()
    expect(staticMediaPath("/static/", directory)).toBeNull()
    expect(staticMediaPath("/static/%E0%A4%A", directory)).toBeNull()
    await expect(
      localMediaFileExists("/static/catalog/packshot.webp", directory),
    ).resolves.toBe(true)
    await expect(
      localMediaFileExists("/static/catalog/missing.webp", directory),
    ).resolves.toBe(false)
    await expect(
      localMediaFileExists("/static/../secret.webp", directory),
    ).resolves.toBe(false)
    expect(classifyStoredOfficialMedia("/static/catalog/missing.webp", false)).toBe(
      "local-missing",
    )
    expect(classifyStoredOfficialMedia("https://files.test/image.webp", false)).toBe(
      "official-fallback",
    )
  })
})
