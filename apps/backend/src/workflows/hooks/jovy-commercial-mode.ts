import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  addToCartWorkflow,
  completeCartWorkflow,
  updateLineItemInCartWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  assertVariantsSellable,
  isEditorialTableMissing,
  type CommercialModeDeps,
} from "@jovy/lib/jovy/commercial-mode"
import type { QueryGraph } from "@jovy/lib/jovy/product-editorial-graph"
import { JOVY_PRODUCT_EDITORIAL_MODULE } from "@jovy/modules/jovy-product-editorial"

/**
 * Registro de los hooks `validate` del carrito. Medusa importa los archivos de
 * `src/workflows/hooks` al cargar los workflows, así que basta con el efecto de
 * importar este módulo: no se registra nada en `medusa-config.ts`.
 *
 * Ocultar el botón "Comprar" no es una medida de seguridad; la modalidad se
 * comprueba aquí, en servidor, al añadir/actualizar/completar el carrito.
 */

type HookContainer = { resolve: (key: string) => unknown }

let warnedMissingEditorialTable = false

function buildDeps(container: HookContainer): CommercialModeDeps {
  return {
    query: container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph,
    editorialService: container.resolve(JOVY_PRODUCT_EDITORIAL_MODULE) as CommercialModeDeps["editorialService"],
    onMissingTable: (error: unknown) => {
      // Un solo aviso por proceso, sin SQL ni mensajes largos del driver.
      if (warnedMissingEditorialTable) return
      warnedMissingEditorialTable = true
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as { warn?: (message: string) => void }
      logger?.warn?.(
        `jovy-commercial-mode: tabla editorial no disponible (${isEditorialTableMissing(error) ? "sin migrar" : "error"}); se omite la validación de modalidad`,
      )
    },
  }
}

addToCartWorkflow.hooks.validate(async (data, { container }) => {
  await assertVariantsSellable(data, buildDeps(container))
})

updateLineItemInCartWorkflow.hooks.validate(async (data, { container }) => {
  await assertVariantsSellable(data, buildDeps(container))
})

completeCartWorkflow.hooks.validate(async (data, { container }) => {
  await assertVariantsSellable(data, buildDeps(container))
})
