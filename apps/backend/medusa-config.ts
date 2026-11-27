import path from 'path'
import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { resolveRuntimeConfiguration } from './src/lib/jovy/runtime-configuration'
import { assertRuntimePreflight } from './src/lib/jovy/runtime-preflight'
import { stripeSandboxModule } from './src/lib/jovy/stripe-sandbox'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const runtime = resolveRuntimeConfiguration()
const stripeSandbox = stripeSandboxModule(process.env, runtime.deploymentEnvironment)

// El build local/CI no debe exigir infraestructura desplegada. En cualquier
// otro comando se ejecuta el preflight, incluso si NODE_ENV=production pero
// DEPLOYMENT_ENV se omitió por error.
const isBuild =
  process.env.npm_lifecycle_event === "build" ||
  process.env.MEDUSA_BUILD === "true"
if (!isBuild) {
  assertRuntimePreflight(runtime)
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    workerMode: runtime.workerMode,
    // Redis de sesiones es independiente del caching/event bus de Medusa.
    redisUrl: runtime.sessionRedisUrl,
    redisPrefix: process.env.SESSION_REDIS_PREFIX,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
    cookieOptions: { secure: runtime.secureSessionCookie },
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
    ...(stripeSandbox ? [stripeSandbox] : []),
    { resolve: "./src/modules/jovy-customer-space" },
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
      resolve: "./src/modules/jovy-authz",
    },
    ...(runtime.redis.enabled
      ? [
          {
            resolve: "@medusajs/medusa/caching",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/caching-redis",
                  id: "caching-redis",
                  is_default: true,
                  options: { redisUrl: runtime.redis.cacheUrl },
                },
              ],
            },
          },
          {
            resolve: "@medusajs/medusa/event-bus-redis",
            options: { redisUrl: runtime.redis.eventsUrl },
          },
          {
            resolve: "@medusajs/medusa/workflow-engine-redis",
            options: { redis: { redisUrl: runtime.redis.workflowUrl } },
          },
          {
            resolve: "@medusajs/medusa/locking",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/locking-redis",
                  id: "locking-redis",
                  is_default: true,
                  options: { redisUrl: runtime.redis.lockingUrl },
                },
              ],
            },
          },
        ]
      : [
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
        ]),
    ...(runtime.file.provider === "s3"
      ? [
          {
            resolve: "@medusajs/medusa/file",
            options: {
              providers: [
                {
                  resolve: "@medusajs/medusa/file-s3",
                  id: "s3",
                  options: {
                    file_url: runtime.file.fileUrl,
                    access_key_id: runtime.file.accessKeyId,
                    secret_access_key: runtime.file.secretAccessKey,
                    region: runtime.file.region,
                    bucket: runtime.file.bucket,
                    endpoint: runtime.file.endpoint,
                  },
                },
              ],
            },
          },
        ]
      : [
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
        ]),
  ],
})
