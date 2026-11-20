import fs from "node:fs"
import path from "node:path"
import {
  matchJovyRule,
  JOVY_ENDPOINT_INVENTORY,
  NATIVE_AREA_INVENTORY,
} from "../route-policy"
import { AUTHZ_RESOURCES } from "../catalog"

const ROUTES_ROOT = path.join(process.cwd(), "src/api/admin/jovy")

function routeFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return routeFiles(absolute)
    return entry.name === "route.ts" ? [absolute] : []
  })
}

function routePath(file: string) {
  const relative = path.relative(ROUTES_ROOT, file).replace(/\\/g, "/").replace(/\/route\.ts$/, "")
  return `/admin/jovy/${relative.replace(/\[([^\]]+)\]/g, ":$1")}`
}

function methodsOf(file: string) {
  const source = fs.readFileSync(file, "utf8")
  return [...source.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map(
    (match) => match[1],
  )
}

describe("inventario de endpoints Jovy", () => {
  it("clasifica todos los métodos exportados por route.ts", () => {
    const missing: string[] = []
    for (const file of routeFiles(ROUTES_ROOT)) {
      const route = routePath(file)
      const sample = route.replace(/:([^/]+)/g, "sample-id")
      for (const method of methodsOf(file)) {
        if (!matchJovyRule(method, sample)) missing.push(`${method} ${route}`)
      }
    }
    expect(missing).toEqual([])
  })

  it("no contiene reglas fantasma sin archivo o método real", () => {
    const stale: string[] = []
    for (const rule of JOVY_ENDPOINT_INVENTORY) {
      const relative = rule.path.replace("/admin/jovy/", "").replace(/:([^/]+)/g, "[$1]")
      const file = path.join(ROUTES_ROOT, `${relative}/route.ts`)
      if (!fs.existsSync(file) || !methodsOf(file).includes(rule.method)) {
        stale.push(`${rule.method} ${rule.path}`)
      }
    }
    expect(stale).toEqual([])
  })

  it("solo declara operaciones respaldadas por el catálogo", () => {
    const resources = new Map(AUTHZ_RESOURCES.map((resource) => [resource.key, resource]))
    for (const rule of JOVY_ENDPOINT_INVENTORY) {
      const access = rule.access
      if (access.type !== "permission") continue
      if (access.resource === "*") continue
      const resource = resources.get(access.resource)
      expect(resource).toBeDefined()
      expect(resource?.operations).toContain(access.operation)
      if (access.publicationFromBody) {
        expect(resource?.operations).toContain("publish")
        expect(resource?.operations).toContain("archive")
      }
    }
  })

  it("clasifica cada área nativa con un recurso real del catálogo", () => {
    const resources = new Map(AUTHZ_RESOURCES.map((resource) => [resource.key, resource]))
    const prefixes = new Set<string>()
    for (const area of NATIVE_AREA_INVENTORY) {
      const resource = resources.get(area.resource)
      expect(resource).toBeDefined()
      expect(resource?.operations.length).toBeGreaterThan(0)
      expect(area.prefix.startsWith("/admin/")).toBe(true)
      expect(area.prefix.endsWith("/")).toBe(false)
      expect(prefixes.has(area.prefix)).toBe(false)
      prefixes.add(area.prefix)
      if (area.settings) {
        expect(resource?.operations).toContain("manage_settings")
      } else {
        expect(resource?.operations).toContain("read")
      }
    }
  })
})
