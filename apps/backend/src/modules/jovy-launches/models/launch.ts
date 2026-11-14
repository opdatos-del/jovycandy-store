import { model } from "@medusajs/framework/utils"

/**
 * Slide de "Nuevos lanzamientos", independiente del Hero genérico. `product_id`
 * es un id del Product Module y no se copia ningún dato comercial. La imagen
 * puede venir del File Module (`image_file_id`) o de una URL externa HTTPS
 * (`image_url`); la primera tiene prioridad al resolver el contrato Store.
 */
const Launch = model
  .define("jovy_launch", {
    id: model.id().primaryKey(),
    product_id: model.text().nullable(),
    title: model.text(),
    description: model.text().nullable(),
    image_file_id: model.text().nullable(),
    image_url: model.text().nullable(),
    sort_order: model.number().default(0),
    active: model.boolean().default(true),
  })
  .indexes([{ on: ["active", "sort_order"] }])

export default Launch
