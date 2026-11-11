import { authenticate, configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      matcher: '/admin/jovy/*',
      middlewares: [authenticate('user', ['session', 'bearer', 'api-key'])],
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
