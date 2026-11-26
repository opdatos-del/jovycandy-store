import { MedusaError } from "@medusajs/framework/utils"

/** Lee todas las páginas; el llamador debe proporcionar un orden estable. */
export async function paginateAll<T>(
  fetchPage: (take: number, skip: number) => Promise<T[]>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "El tamaño de página debe ser un entero positivo")
  }

  const rows: T[] = []
  for (;;) {
    const page = await fetchPage(pageSize, rows.length)
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}
