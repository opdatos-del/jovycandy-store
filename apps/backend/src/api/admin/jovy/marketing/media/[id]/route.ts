import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fileModule = req.scope.resolve(Modules.FILE)

  try {
    const file = await fileModule.retrieveFile(req.params.id)
    res.json({ file: { id: file.id, url: file.url } })
  } catch {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Archivo no encontrado")
  }
}
