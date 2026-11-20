import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
    // El Admin se sirve por HTTP en local (localhost:9000). En producción,
    // Express marca la cookie de sesión como Secure y express-session no la
    // envía fuera de HTTPS, lo que deja /admin/* en 401 tras el login. Detrás
    // de HTTPS, cambiar a `{ secure: true }`.
    cookieOptions: { secure: false },
  },
  modules: [
    {
      resolve: "./src/modules/jovy-content",
    },
    {
      resolve: "./src/modules/jovy-marketing",
    },
    {
      resolve: "./src/modules/jovy-events",
    },
    {
      resolve: "./src/modules/jovy-brand",
    },
    {
      resolve: "./src/modules/jovy-contacts",
    },
    {
      resolve: "./src/modules/jovy-catalogue",
    },
    {
      resolve: "./src/modules/jovy-launches",
    },
    {
      resolve: "./src/modules/jovy-product-editorial",
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/locking-postgres",
            id: "locking-postgres",
            is_default: true,
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: "static",
              // El puerto del servidor cambia en E2E (PORT=9001). Sin esta
              // variable las URLs subidas apuntarían siempre a 9000.
              backend_url:
                process.env.FILE_BACKEND_URL ??
                `http://localhost:${process.env.PORT ?? 9000}/static`,
            },
          },
        ],
      },
    },
  ],
})
