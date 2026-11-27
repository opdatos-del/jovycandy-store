import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { JOVY_CUSTOMER_SPACE_MODULE } from "@jovy/modules/jovy-customer-space"
import type CustomerSpaceService from "@jovy/modules/jovy-customer-space/service"

type OrderNotice = { orderId: string; kind: "order_placed" | "order_canceled" }

const persistOrderNotice = createStep("persist-order-notice", async (input: OrderNotice, { container }) => {
  const { orderId, kind } = input
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [order] } = await query.graph({
    entity: "order",
    fields: ["customer_id", "customer.has_account"],
    filters: { id: orderId },
  })
  if (!order?.customer_id || !order.customer?.has_account) return
  const customerId = order.customer_id
  const service: CustomerSpaceService = container.resolve(JOVY_CUSTOMER_SPACE_MODULE)
  const lock = container.resolve(Modules.LOCKING)
  const key = `${kind}:${orderId}`
  await lock.execute(`jovy:notice:${key}`, async () => {
    const [existing] = await service.listJovyCustomerNotices({ event_key: key }, { take: 1 })
    if (!existing) await service.createJovyCustomerNotices({
      customer_id: customerId, order_id: orderId, event_key: key, kind,
    })
  })
})

export const recordOrderNotice = createWorkflow("record-order-notice", function (input: OrderNotice) {
  persistOrderNotice(input)
})

type ReadNotice = { customerId: string; id: string }
const applyNoticeRead = createStep("apply-notice-read", async (input: ReadNotice, { container }) => {
  const service: CustomerSpaceService = container.resolve(JOVY_CUSTOMER_SPACE_MODULE)
  const [notice] = await service.listJovyCustomerNotices({ customer_id: input.customerId, id: input.id }, { take: 1 })
  if (!notice) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Notificación no encontrada.")
  if (!notice.read_at) await service.updateJovyCustomerNotices({ id: notice.id, read_at: new Date() })
  return new StepResponse({ id: notice.id })
})

export const markCustomerNoticeRead = createWorkflow("mark-customer-notice-read", function (input: ReadNotice) {
  return new WorkflowResponse(applyNoticeRead(input))
})

type SetMarketing = { customerId: string; enabled: boolean }
const persistMarketingEmail = createStep("persist-marketing-email", async (input: SetMarketing, { container }) => {
  const service: CustomerSpaceService = container.resolve(JOVY_CUSTOMER_SPACE_MODULE)
  const lock = container.resolve(Modules.LOCKING)
  await lock.execute(`jovy:marketing-consent:${input.customerId}`, async () => {
    const [record] = await service.listJovyCommunicationPreferences({ customer_id: input.customerId }, { take: 1 })
    if (record?.marketing_email === input.enabled) return
    const changes = { marketing_email: input.enabled, consent_at: input.enabled ? new Date() : null }
    if (record) await service.updateJovyCommunicationPreferences({ id: record.id, ...changes })
    else if (input.enabled) await service.createJovyCommunicationPreferences({ customer_id: input.customerId, ...changes })
  })
  return new StepResponse({ marketingEmail: input.enabled })
})

export const setCustomerMarketingEmail = createWorkflow("set-customer-marketing-email", function (input: SetMarketing) {
  return new WorkflowResponse(persistMarketingEmail(input))
})
