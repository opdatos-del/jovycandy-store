import path from 'path'
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// La cookie de sesión debe ser Secure en producción real. El build local se
// sirve por HTTP en localhost, así que ese entorno declara ADMIN_ALLOW_HTTP=true.
// Nunca se desactiva Secure de forma implícita en producción.
const isProductionRuntime = process.env.NODE_ENV === 'production'
const allowHttpCookies = process.env.ADMIN_ALLOW_HTTP === 'true'
const secureSessionCookie = isProductionRuntime && !allowHttpCookies

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
    cookieOptions: { secure: secureSessionCookie },
  },
  admin: {
    /**
     * Alias estable para el código del Admin. El Vite de Medusa no resuelve
     * `@jovy/*`, así que las features importan `@admin/*` sin cadenas de
     * `../../..` que la regla de lint prohíbe.
     */
    vite: (config) => {
      const existing = config.resolve?.alias
      const aliases = Array.isArray(existing)
        ? existing
        : Object.entries(existing ?? {}).map(([find, replacement]) => ({
            find,
            replacement: String(replacement),
          }))

      // Solo se devuelve el override. Devolver `{...config}` hace que Medusa
      // fusione plugins duplicados y React Refresh declare `$RefreshSig$` dos veces.
      return {
        resolve: {
          ...config.resolve,
          alias: [
            ...aliases,
            { find: "@admin", replacement: path.resolve(process.cwd(), "src/admin") },
          ],
        },
      }
    },
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
