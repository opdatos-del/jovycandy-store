import { z } from "@medusajs/framework/zod"

/** Mensaje corporativo bajo la animación de portada, editable por idioma. */
const corporateMessage = z.string().trim().min(2).max(600)

/**
 * PUT de reemplazo completo: ambos idiomas viajan siempre (o `null` para
 * ocultarlos) y así el Admin no depende del orden de escrituras parciales.
 */
export const announcementSettingsSchema = z.object({
  corporate_message_es: corporateMessage.nullable(),
  corporate_message_en: corporateMessage.nullable(),
})

export type AnnouncementSettingsInput = z.infer<typeof announcementSettingsSchema>
