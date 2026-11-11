import { Module } from "@medusajs/framework/utils"
import JovyContentModuleService from "./service"

export const JOVY_CONTENT_MODULE = "jovy_content"

export default Module(JOVY_CONTENT_MODULE, {
  service: JovyContentModuleService,
})
