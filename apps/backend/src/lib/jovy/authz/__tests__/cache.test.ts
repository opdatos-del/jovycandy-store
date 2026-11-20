import { invalidateAuthzCache, readAuthzCache, writeAuthzCache } from "../cache"
import type { AuthzSnapshot } from "../permissions"

function snapshot(userId: string): AuthzSnapshot {
  return {
    userId,
    roles: [],
    permissions: [],
    wildcard: false,
    can: () => false,
  }
}

describe("caché de permisos", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    invalidateAuthzCache()
  })

  afterEach(() => {
    jest.useRealTimers()
    invalidateAuthzCache()
  })

  it("sirve el snapshot dentro del TTL y lo descarta al expirar", () => {
    const snapshotA = snapshot("user_a")
    writeAuthzCache("user_a", snapshotA)
    expect(readAuthzCache("user_a")).toBe(snapshotA)

    jest.advanceTimersByTime(14_999)
    expect(readAuthzCache("user_a")).toBe(snapshotA)

    jest.advanceTimersByTime(1)
    expect(readAuthzCache("user_a")).toBeNull()
  })

  it("invalida un usuario sin afectar a los demás", () => {
    writeAuthzCache("user_a", snapshot("user_a"))
    writeAuthzCache("user_b", snapshot("user_b"))
    invalidateAuthzCache("user_a")
    expect(readAuthzCache("user_a")).toBeNull()
    expect(readAuthzCache("user_b")).not.toBeNull()
  })

  it("invalida toda la caché en cambios de rol", () => {
    writeAuthzCache("user_a", snapshot("user_a"))
    writeAuthzCache("user_b", snapshot("user_b"))
    invalidateAuthzCache()
    expect(readAuthzCache("user_a")).toBeNull()
    expect(readAuthzCache("user_b")).toBeNull()
  })
})
