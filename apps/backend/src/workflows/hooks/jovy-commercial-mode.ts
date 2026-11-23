import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
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
let warnedValidationError = false

function buildDeps(container: HookContainer): CommercialModeDeps {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as { warn?: (message: string) => void }
  return {
    query: container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph,
    editorialService: container.resolve(JOVY_PRODUCT_EDITORIAL_MODULE) as CommercialModeDeps["editorialService"],
    onMissingTable: (error: unknown) => {
      // Un solo aviso por proceso, sin SQL ni mensajes largos del driver.
      if (warnedMissingEditorialTable) return
      warnedMissingEditorialTable = true
      logger?.warn?.(
        `jovy-commercial-mode: tabla editorial no disponible (${isEditorialTableMissing(error) ? "sin migrar" : "error"}); la compra queda bloqueada`,
      )
    },
    onValidationError: () => {
      // El error original no se propaga al cliente ni se registra con detalles.
      if (warnedValidationError) return
      warnedValidationError = true
      logger?.warn?.("jovy-commercial-mode: fallo al validar la modalidad; la compra queda bloqueada")
    },
  }
}

async function assertAllowed(data: unknown, container: HookContainer) {
  const allowed = await assertVariantsSellable(data, buildDeps(container))
  if (allowed !== true) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "La compra no está disponible temporalmente.",
    )
  }
}

addToCartWorkflow.hooks.validate(async (data, { container }) => {
  await assertAllowed(data, container)
})

updateLineItemInCartWorkflow.hooks.validate(async (data, { container }) => {
  await assertAllowed(data, container)
})

completeCartWorkflow.hooks.validate(async (data, { container }) => {
  await assertAllowed(data, container)
})
