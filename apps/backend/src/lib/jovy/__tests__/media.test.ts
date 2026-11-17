import { MedusaError } from "@medusajs/framework/utils"

import { assertImageFile, imageMimeFromBuffer, resolveFileUrl } from "@jovy/lib/jovy/media"

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLfkQAAAABJRU5ErkJggg==",
  "base64",
)
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 ", "ascii"),
])
const TEXT = Buffer.from("no soy una imagen", "utf8")

function fileModule(entries: Record<string, Buffer>) {
  return {
    retrieveFile: jest.fn(async (id: string) => {
      if (!(id in entries)) throw new Error("not found")
      return { id, url: `http://localhost:9000/static/${id}` }
    }),
    getAsBuffer: jest.fn(async (id: string) => {
      const content = entries[id]
      if (!content) throw new Error("not found")
      return content
    }),
  }
}

describe("resolución de URLs del File Module", () => {
  it("degrada a null cuando el archivo no existe o no se pide", async () => {
    const files = fileModule({ "ok.png": PNG })

    expect(await resolveFileUrl(files, "ok.png")).toBe("http://localhost:9000/static/ok.png")
    expect(await resolveFileUrl(files, "missing.png")).toBeNull()
    expect(await resolveFileUrl(files, null)).toBeNull()
  })
})

describe("detección de imágenes por firma binaria", () => {
  it("reconoce PNG, JPEG y WebP", () => {
    expect(imageMimeFromBuffer(PNG)).toBe("image/png")
    expect(imageMimeFromBuffer(JPEG)).toBe("image/jpeg")
    expect(imageMimeFromBuffer(WEBP)).toBe("image/webp")
  })

  it("rechaza contenido arbitrario y archivos truncados", () => {
    expect(imageMimeFromBuffer(TEXT)).toBeNull()
    expect(imageMimeFromBuffer(Buffer.alloc(0))).toBeNull()
    expect(imageMimeFromBuffer(PNG.subarray(0, 3))).toBeNull()
  })
})

describe("validación de image_file_id antes de escribir", () => {
  it("acepta un archivo existente que es imagen", async () => {
    const files = fileModule({ "catalogo.png": PNG, "lanzamiento.jpg": JPEG, "tarjeta.webp": WEBP })

    await expect(assertImageFile(files, "catalogo.png")).resolves.toBeUndefined()
    await expect(assertImageFile(files, "lanzamiento.jpg")).resolves.toBeUndefined()
    await expect(assertImageFile(files, "tarjeta.webp")).resolves.toBeUndefined()
    expect(files.retrieveFile).toHaveBeenCalledWith("catalogo.png")
    expect(files.getAsBuffer).toHaveBeenCalledWith("catalogo.png")
  })

  it("rechaza con INVALID_DATA un id inexistente", async () => {
    const files = fileModule({ "catalogo.png": PNG })

    await expect(assertImageFile(files, "missing.png")).rejects.toMatchObject({
      type: MedusaError.Types.INVALID_DATA,
      message: "El archivo de imagen no existe",
    })
    expect(files.getAsBuffer).not.toHaveBeenCalled()
  })

  it("rechaza con INVALID_DATA un archivo que no es imagen", async () => {
    const files = fileModule({ "nota.txt": TEXT })

    await expect(assertImageFile(files, "nota.txt")).rejects.toMatchObject({
      type: MedusaError.Types.INVALID_DATA,
      message: "El archivo de imagen no es una imagen PNG, JPEG o WebP",
    })
  })
})
