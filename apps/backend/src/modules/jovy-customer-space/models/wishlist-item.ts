import { model } from "@medusajs/framework/utils"
import { Wishlist } from "./wishlist"

export const WishlistItem = model.define("jovy_wishlist_item", {
  id: model.id({ prefix: "jwli" }).primaryKey(),
  product_variant_id: model.text(),
  wishlist: model.belongsTo(() => Wishlist, { mappedBy: "items" }),
}).indexes([{ on: ["wishlist_id", "product_variant_id"], unique: true }])
