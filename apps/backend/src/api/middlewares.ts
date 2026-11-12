import { authenticate, configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import multer from "multer"

const jovyImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
})

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      matcher: '/admin/jovy/*',
      middlewares: [authenticate('user', ['session', 'bearer', 'api-key'])],
    },
    {
      method: ["POST"],
      matcher: "/admin/jovy/marketing/media",
      middlewares: [
        // Multer is the official Medusa mechanism for multipart API routes.
        jovyImageUpload.array("files", 1),
      ],
    },
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
  ],
})
