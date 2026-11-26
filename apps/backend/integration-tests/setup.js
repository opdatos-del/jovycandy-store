if (process.env.TEST_TYPE.startsWith("integration:")) {
  require("./ephemeral-postgres.cjs").assertLocalIntegrationEnvironment(process.env)
}

const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

/**
 * El launcher efímero fija DB_* y DATABASE_URL antes de cargar Jest. Nunca se
 * derivan credenciales locales para integración: sin launcher, Jest falla antes
 * de importar @medusajs/test-utils.
 */
function deriveDatabaseCredentials() {
  if (process.env.TEST_TYPE.startsWith("integration:")) return
  if (process.env.DB_HOST || process.env.DB_USERNAME) return
  if (!process.env.DATABASE_URL) return
  try {
    const url = new URL(process.env.DATABASE_URL)
    // `@medusajs/test-utils` forces SSL whenever the test client URL does not
    // contain "localhost", and a local PostgreSQL usually has no TLS listener.
    // Loopback IPs are normalized so the throwaway test databases connect the
    // same way the development database does.
    const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "[::1]"
    process.env.DB_HOST = process.env.DB_HOST ?? (isLoopback ? "localhost" : url.hostname)
    process.env.DB_PORT = process.env.DB_PORT ?? (url.port || "5432")
    process.env.DB_USERNAME = process.env.DB_USERNAME ?? decodeURIComponent(url.username)
    process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? decodeURIComponent(url.password)
  } catch {
    // Leave the test-utils defaults untouched; the suite will report the connection error.
  }
}

deriveDatabaseCredentials()

// El suite HTTP crea su propio administrador de pruebas. El bootstrap por
// variables de entorno ya no existe: cada suite asigna el rol superadmin con
// `assignBootstrapSuperadmin` antes de ejecutar peticiones.
// `JOVY_AUTHZ_BOOTSTRAP_EMAILS` se borra explícitamente para que un `.env`
// local no reactive privilegios durante las pruebas.
delete process.env.JOVY_AUTHZ_BOOTSTRAP_EMAILS
