import { MedusaService } from "@medusajs/framework/utils"
import { CustomerNotice } from "./models/customer-notice"
import { CommunicationPreference } from "./models/communication-preference"
import { Wishlist } from "./models/wishlist"
import { WishlistItem } from "./models/wishlist-item"

export default class CustomerSpaceService extends MedusaService({
  JovyWishlist: Wishlist,
  JovyWishlistItem: WishlistItem,
  JovyCustomerNotice: CustomerNotice,
  JovyCommunicationPreference: CommunicationPreference,
}) {}
