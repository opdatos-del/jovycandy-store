import { Module } from "@medusajs/framework/utils"
import JovyBrandModuleService from "./service"
export const JOVY_BRAND_MODULE = "jovy_brand"
export default Module(JOVY_BRAND_MODULE, { service: JovyBrandModuleService })
