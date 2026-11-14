import { MedusaService } from "@medusajs/framework/utils"
import Launch from "./models/launch"
import LaunchSettings from "./models/launch-settings"

class JovyLaunchesModuleService extends MedusaService({
  Launch,
  LaunchSettings,
}) {}

export default JovyLaunchesModuleService
