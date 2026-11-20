import type { AuthzSnapshot } from "@jovy/lib/jovy/authz/permissions"

type CacheEntry = { expires: number; snapshot: AuthzSnapshot }

const CACHE_TTL_MS = 15_000
const cache = new Map<string, CacheEntry>()

export function readAuthzCache(userId: string) {
  const entry = cache.get(userId)
  if (!entry) return null
  if (entry.expires <= Date.now()) {
    cache.delete(userId)
    return null
  }
  return entry.snapshot
}

export function writeAuthzCache(userId: string, snapshot: AuthzSnapshot) {
  cache.set(userId, { expires: Date.now() + CACHE_TTL_MS, snapshot })
}

export function invalidateAuthzCache(userId?: string) {
  if (userId) cache.delete(userId)
  else cache.clear()
}
