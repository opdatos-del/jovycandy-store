import { Module } from "@medusajs/framework/utils"
import JovyMarketingModuleService from "./service"

export const JOVY_MARKETING_MODULE = "jovy_marketing"

export default Module(JOVY_MARKETING_MODULE, {
  service: JovyMarketingModuleService,
})
