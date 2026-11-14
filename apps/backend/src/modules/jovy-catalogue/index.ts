import { Module } from "@medusajs/framework/utils"
import JovyCatalogueModuleService from "./service"

export const JOVY_CATALOGUE_MODULE = "jovy_catalogue"

export default Module(JOVY_CATALOGUE_MODULE, {
  service: JovyCatalogueModuleService,
})
