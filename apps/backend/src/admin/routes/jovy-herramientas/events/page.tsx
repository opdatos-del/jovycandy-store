import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Calendar } from "@medusajs/icons"
import { EventsPage } from "@admin/features/events/components/events-page"

/**
 * La ruta sólo registra el acceso; la agenda vive en
 * `@admin/features/events`.
 */
export const config = defineRouteConfig({ label: "Eventos Jovy", icon: Calendar, rank: 3, permissions: "jovy_events:read" })

export default EventsPage
