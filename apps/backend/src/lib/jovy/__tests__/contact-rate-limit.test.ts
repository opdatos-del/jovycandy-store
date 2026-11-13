import { contactRateLimit, consumeContactSubmission } from "@jovy/lib/jovy/contact-rate-limit"

const START = Date.parse("2026-11-12T12:00:00.000Z")

describe("límite de envíos por IP", () => {
  it("permite cinco envíos por ventana de diez minutos", () => {
    const ip = "203.0.113.1"
    for (let attempt = 0; attempt < contactRateLimit.maxRequests; attempt += 1) {
      expect(consumeContactSubmission(ip, START + attempt).allowed).toBe(true)
    }

    const blocked = consumeContactSubmission(ip, START + contactRateLimit.maxRequests)
    expect(blocked.allowed).toBe(false)
    if (!blocked.allowed) {
      // El resto de la ventana de diez minutos, redondeado hacia arriba en segundos.
      expect(blocked.retryAfterSeconds).toBe(600)
    }
  })

  it("informa los segundos que faltan para reiniciar la ventana", () => {
    const ip = "203.0.113.2"
    for (let attempt = 0; attempt < contactRateLimit.maxRequests; attempt += 1) {
      consumeContactSubmission(ip, START)
    }

    const blocked = consumeContactSubmission(ip, START + 90_000)
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 510 })
  })

  it("vuelve a permitir envíos cuando la ventana expira", () => {
    const ip = "203.0.113.3"
    for (let attempt = 0; attempt < contactRateLimit.maxRequests; attempt += 1) consumeContactSubmission(ip, START)
    expect(consumeContactSubmission(ip, START).allowed).toBe(false)

    expect(consumeContactSubmission(ip, START + contactRateLimit.windowMs).allowed).toBe(true)
  })

  it("cuenta cada IP por separado", () => {
    const blockedIp = "203.0.113.4"
    for (let attempt = 0; attempt < contactRateLimit.maxRequests; attempt += 1) consumeContactSubmission(blockedIp, START)

    expect(consumeContactSubmission(blockedIp, START).allowed).toBe(false)
    expect(consumeContactSubmission("203.0.113.5", START).allowed).toBe(true)
  })
})
