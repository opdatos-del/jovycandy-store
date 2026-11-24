import { saveWorkspaceBlocks, type WorkspaceBlock } from "../product-workspace"

function block(
  id: string,
  dirty: boolean,
  save: WorkspaceBlock["save"],
): WorkspaceBlock {
  return { id, label: id, dirty, saving: false, save }
}

describe("guardado coordinado del espacio de producto", () => {
  it("informa éxito y fallo por bloque sin omitir los cambios pendientes", async () => {
    const saved = jest.fn().mockResolvedValue(true)
    const failed = jest.fn().mockResolvedValue(false)
    const untouched = jest.fn().mockResolvedValue(true)

    await expect(
      saveWorkspaceBlocks([
        block("editorial", true, saved),
        block("visual", true, failed),
        block("native", false, untouched),
      ]),
    ).resolves.toEqual({ saved: ["editorial"], failed: ["visual"] })

    expect(saved).toHaveBeenCalledTimes(1)
    expect(failed).toHaveBeenCalledTimes(1)
    expect(untouched).not.toHaveBeenCalled()
  })

  it("marca como fallido un bloque que lanza y continúa con los siguientes", async () => {
    const rejected = jest.fn().mockRejectedValue(new Error("red caída"))
    const saved = jest.fn().mockResolvedValue(true)

    await expect(
      saveWorkspaceBlocks([block("editorial", true, rejected), block("visual", true, saved)]),
    ).resolves.toEqual({ saved: ["visual"], failed: ["editorial"] })
  })
})
