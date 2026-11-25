import "server-only"

/** URL pública canónica; `SITE_URL` permite cambiarla sin reconstruir la imagen. */
export const SITE_URL = (
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000"
).replace(/\/$/, "")
