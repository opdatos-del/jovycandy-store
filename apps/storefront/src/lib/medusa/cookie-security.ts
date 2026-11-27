import "server-only"

import { headers } from "next/headers"

export async function secureCommerceCookie() {
  return process.env.NODE_ENV === "production" ||
    (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"
}
