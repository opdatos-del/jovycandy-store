type RateWindow = { count: number; resetAt: number }

const windows = new Map<string, RateWindow>()
const WINDOW_MS = 10 * 60 * 1_000
const MAX_REQUESTS = 5

export type ContactSubmissionLimit =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

/**
 * Laboratory rate limit: in-memory and per process, so it resets on restart and
 * does not coordinate several instances. A shared store (or a limit at the edge)
 * is required before production.
 */
export function consumeContactSubmission(ip: string, now = Date.now()): ContactSubmissionLimit {
  for (const [key, value] of windows) if (value.resetAt <= now) windows.delete(key)
  const current = windows.get(ip)
  if (!current || current.resetAt <= now) {
    windows.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }
  if (current.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1_000) }
  }
  current.count += 1
  return { allowed: true }
}

export const contactRateLimit = { maxRequests: MAX_REQUESTS, windowMs: WINDOW_MS }
