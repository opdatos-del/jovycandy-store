import { Module } from "@medusajs/framework/utils"
import CustomerSpaceService from "./service"

export const JOVY_CUSTOMER_SPACE_MODULE = "jovyCustomerSpace"
export default Module(JOVY_CUSTOMER_SPACE_MODULE, { service: CustomerSpaceService })
