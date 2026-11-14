import { MedusaService } from "@medusajs/framework/utils"
import ProductEditorial from "./models/product-editorial"

class JovyProductEditorialModuleService extends MedusaService({
  ProductEditorial,
}) {}

export default JovyProductEditorialModuleService
