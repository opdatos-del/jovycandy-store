import { model } from "@medusajs/framework/utils"
import { WishlistItem } from "./wishlist-item"

export const Wishlist = model.define("jovy_wishlist", {
  id: model.id({ prefix: "jwl" }).primaryKey(),
  customer_id: model.text(),
  name: model.text().nullable(),
  items: model.hasMany(() => WishlistItem, { mappedBy: "wishlist" }),
}).indexes([
  { on: ["customer_id"] },
  { on: ["customer_id"], unique: true, where: "name is null AND deleted_at is null", name: "IDX_jovy_wishlist_favorites" },
])
