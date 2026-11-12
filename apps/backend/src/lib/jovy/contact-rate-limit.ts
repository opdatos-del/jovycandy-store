type RateWindow = { count: number; resetAt: number }

const windows = new Map<string, RateWindow>()
const WINDOW_MS = 10 * 60 * 1_000
const MAX_REQUESTS = 5

export function consumeContactSubmission(ip: string, now = Date.now()) {
  for (const [key, value] of windows) if (value.resetAt <= now) windows.delete(key)
  const current = windows.get(ip)
  if (!current || current.resetAt <= now) {
    windows.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (current.count >= MAX_REQUESTS) return false
  current.count += 1
  return true
}

export const contactRateLimit = { maxRequests: MAX_REQUESTS, windowMs: WINDOW_MS }
