import { model } from "@medusajs/framework/utils"

/** Configuración global de la sección de lanzamientos (singleton lógico). */
const LaunchSettings = model.define("jovy_launch_settings", {
  id: model.id().primaryKey(),
  background_color: model.text().default("#00AFAA"),
})

export default LaunchSettings
