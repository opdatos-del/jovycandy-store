import { updateInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

const STOCK_LOCATION_NAME = "Jovy México Laboratorio"
const LAB_LOCATION_METADATA_KEY = "jovy_lab_stock_location"
const RESTORE_AVAILABLE_QUANTITY = 50
const CONFIRMATION = "restore-lab-stock"

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
    pagination?: { take: number; skip: number }
  }) => Promise<{ data: Array<Record<string, any>> }>
}

type LockingService = {
  execute: <T>(
    keys: string | string[],
    job: (signal?: AbortSignal) => Promise<T>,
    args?: { timeout?: number; expire?: number },
  ) => Promise<T>
}

/**
 * Reposición explícita de laboratorio. No la ejecuta el seed.
 *
 *   $env:CONFIRM_RESTORE_LAB_STOCK="restore-lab-stock"
 *   pnpm --dir apps/backend exec medusa exec ./src/scripts/restore-lab-inventory.ts
 *
 * Deja 50 unidades disponibles por variante, preservando reservas activas.
 * Bloquea la ubicación y cada inventory item con el mismo locking module que
 * usan las reservas para evitar calcular un absoluto con una reserva obsoleta.
 */
export default async function restoreLabInventory({ container }: ExecArgs) {
  if (process.env.CONFIRM_RESTORE_LAB_STOCK !== CONFIRMATION) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Operación protegida. Define CONFIRM_RESTORE_LAB_STOCK=${CONFIRMATION} para continuar.`,
    )
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const locking = container.resolve(Modules.LOCKING) as LockingService
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "metadata"],
    pagination: { take: 1000, skip: 0 },
  })
  const location = locations.find(
    (row) =>
      row.metadata?.[LAB_LOCATION_METADATA_KEY] === true ||
      row.name === STOCK_LOCATION_NAME,
  )
  const locationId = location?.id ? String(location.id) : null
  if (!locationId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No existe la ubicación ${STOCK_LOCATION_NAME}`,
    )
  }

  const { data } = await query.graph({
    entity: "inventory_level",
    fields: [
      "id",
      "inventory_item_id",
      "location_id",
      "inventory_item.sku",
    ],
    filters: { location_id: locationId },
    pagination: { take: 1000, skip: 0 },
  })
  const levels = data.filter((level) =>
    String(level.inventory_item?.sku ?? "").startsWith("JOVY-MX-"),
  )

  if (!levels.length) {
    logger.info("[lab-inventory] no hay niveles del catálogo migrado que restaurar")
    return
  }

  await locking.execute(
    `jovy:inventory:restore:${locationId}`,
    async () => {
      for (const level of levels) {
        const inventoryItemId = String(level.inventory_item_id)
        await locking.execute(
          inventoryItemId,
          async () => {
            const { data: refreshed } = await query.graph({
              entity: "inventory_level",
              fields: ["id", "reserved_quantity"],
              filters: { id: level.id },
            })
            const current = refreshed[0]
            if (!current?.id) return

            await updateInventoryLevelsWorkflow(container).run({
              input: {
                updates: [
                  {
                    id: String(current.id),
                    inventory_item_id: inventoryItemId,
                    location_id: locationId,
                    stocked_quantity:
                      Number(current.reserved_quantity ?? 0) +
                      RESTORE_AVAILABLE_QUANTITY,
                  },
                ],
              },
            })
          },
          { timeout: 30, expire: 60 },
        )
      }
    },
    { timeout: 300, expire: 600 },
  )

  logger.info(
    `[lab-inventory] ${levels.length} variantes restauradas a ${RESTORE_AVAILABLE_QUANTITY} unidades disponibles`,
  )
}
