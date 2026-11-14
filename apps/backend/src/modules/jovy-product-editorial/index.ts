import { Module } from "@medusajs/framework/utils"
import JovyProductEditorialModuleService from "./service"

export const JOVY_PRODUCT_EDITORIAL_MODULE = "jovy_product_editorial"

export default Module(JOVY_PRODUCT_EDITORIAL_MODULE, {
  service: JovyProductEditorialModuleService,
})
