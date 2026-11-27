import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { recordOrderNotice } from "@jovy/workflows/jovy-customer-space/notices"

export default async function customerOrderNotice({ event, container }: SubscriberArgs<{ id: string }>) {
  if (!event.data?.id) return
  if (event.name !== "order.placed" && event.name !== "order.canceled") return
  await recordOrderNotice(container).run({ input: {
    orderId: event.data.id,
    kind: event.name === "order.placed" ? "order_placed" : "order_canceled",
  } })
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.canceled"],
  context: { subscriberId: "jovy-customer-order-notice" },
}
