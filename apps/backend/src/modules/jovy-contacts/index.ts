import { Module } from "@medusajs/framework/utils"
import JovyContactsModuleService from "./service"

export const JOVY_CONTACTS_MODULE = "jovy_contacts"
export default Module(JOVY_CONTACTS_MODULE, { service: JovyContactsModuleService })
