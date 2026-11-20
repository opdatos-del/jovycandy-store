import { Module } from "@medusajs/framework/utils"
import JovyAuthzModuleService from "./service"

export const JOVY_AUTHZ_MODULE = "jovy_authz"

export default Module(JOVY_AUTHZ_MODULE, {
  service: JovyAuthzModuleService,
})
