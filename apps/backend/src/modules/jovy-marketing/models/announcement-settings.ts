import { model } from "@medusajs/framework/utils"

/**
 * Mensaje corporativo bajo la animación de portada. El modal promocional NO se
 * duplica aquí: sigue siendo un `jovy_marketing_banner` con slot `promo`.
 * `updated_by` es el id del usuario Admin que guardó por última vez.
 */
const AnnouncementSettings = model.define("jovy_announcement_settings", {
  id: model.id().primaryKey(),
  corporate_message_es: model.text().nullable(),
  corporate_message_en: model.text().nullable(),
  updated_by: model.text().nullable(),
})

export default AnnouncementSettings
