import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"

/**
 * Mensaje corporativo bajo la animación. El modal promocional no se expone
 * aquí: se sigue consumiendo en `/store/jovy/marketing/banners/promo`.
 * Nunca se publica `updated_by` ni `deleted_at`.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_MARKETING_MODULE)
  const [settings] = await service.listAnnouncementSettings({}, { take: 1 })
  res.json({
    settings: {
      corporate_message_es: settings?.corporate_message_es ?? null,
      corporate_message_en: settings?.corporate_message_en ?? null,
      updated_at: settings?.updated_at ?? null,
    },
  })
}
