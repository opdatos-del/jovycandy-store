import { Module } from "@medusajs/framework/utils"
import JovyEventsModuleService from "./service"

export const JOVY_EVENTS_MODULE = "jovy_events"

export default Module(JOVY_EVENTS_MODULE, { service: JovyEventsModuleService })
