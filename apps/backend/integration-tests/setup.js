const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

/**
 * `@medusajs/test-utils` connects with DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD and
 * creates a throwaway database per suite, so the development database is never
 * touched. When those variables are missing, reuse the local DATABASE_URL
 * credentials instead of committing a password in a test file.
 */
function deriveDatabaseCredentials() {
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
