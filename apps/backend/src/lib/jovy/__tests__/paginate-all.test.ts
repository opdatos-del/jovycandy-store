import { paginateAll } from "@jovy/lib/jovy/paginate-all"

describe("paginateAll", () => {
  it("recupera todas las páginas, incluida la siguiente a una página llena", async () => {
    const rows = Array.from({ length: 1002 }, (_, id) => ({ id }))
    const fetchPage = jest.fn(async (take: number, skip: number) =>
      rows.slice(skip, skip + take),
    )

    expect(await paginateAll(fetchPage, 500)).toEqual(rows)
    expect(fetchPage.mock.calls).toEqual([[500, 0], [500, 500], [500, 1000]])
  })

  it("termina con una página vacía cuando el total es múltiplo del tamaño", async () => {
    const fetchPage = jest.fn(async (take: number, skip: number) =>
      [1, 2, 3, 4].slice(skip, skip + take),
    )
    expect(await paginateAll(fetchPage, 2)).toEqual([1, 2, 3, 4])
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  it("rechaza tamaños de página inválidos y propaga errores", async () => {
    await expect(paginateAll(async () => [], 0)).rejects.toThrow("El tamaño de página debe ser un entero positivo")
    await expect(paginateAll(async () => { throw new Error("fallo") })).rejects.toThrow("fallo")
  })
})
