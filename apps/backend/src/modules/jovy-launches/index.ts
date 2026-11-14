import { Module } from "@medusajs/framework/utils"
import JovyLaunchesModuleService from "./service"

export const JOVY_LAUNCHES_MODULE = "jovy_launches"

export default Module(JOVY_LAUNCHES_MODULE, {
  service: JovyLaunchesModuleService,
})
