import fs from "node:fs"
import path from "node:path"

/**
 * Reglas arquitectónicas del Admin. Se ejecutan como prueba unitaria para que
 * una violación falle la validación sin añadir otra herramienta al stack.
 */

const ADMIN_ROOT = path.join(process.cwd(), "src/admin")
const SOURCE_EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"]

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(absolute)
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [absolute] : []
  })
}

function isTestFile(file: string) {
  return file.includes(`${path.sep}__tests__${path.sep}`)
}

function resolveAdminFile(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@admin/")
    ? path.join(ADMIN_ROOT, specifier.slice("@admin/".length))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : null
  if (!base) return null

  const candidates = [base, ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`)]
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null
}

function importsOf(source: string): string[] {
  const specifiers: string[] = []
  const pattern = /(?:from\s+|import\s*\()\s*["']([^"']+)["']/g
  for (const match of source.matchAll(pattern)) specifiers.push(match[1])
  return specifiers
}

function featureOf(file: string): string | null {
  const relative = path.relative(ADMIN_ROOT, file).split(path.sep).join("/")
  return /^features\/([^/]+)\//.exec(relative)?.[1] ?? null
}

function relativeAdmin(file: string): string {
  return path.relative(ADMIN_ROOT, file).split(path.sep).join("/")
}

const files = walk(ADMIN_ROOT).filter((file) => !isTestFile(file))
const sources = new Map(files.map((file) => [file, fs.readFileSync(file, "utf8")]))
const graph = new Map<string, string[]>()

describe("arquitectura del Admin", () => {
  it("shared no depende de features ni de rutas", () => {
    const violations: string[] = []
    for (const file of files) {
      const relative = relativeAdmin(file)
      if (!relative.startsWith("shared/")) continue
      for (const specifier of importsOf(sources.get(file)!)) {
        const target = resolveAdminFile(file, specifier)
        const targetRelative = target ? relativeAdmin(target) : specifier
        if (
          targetRelative.startsWith("features/") ||
          targetRelative.startsWith("routes/") ||
          specifier.startsWith("@admin/features/") ||
          specifier.startsWith("@admin/routes/")
        ) {
          violations.push(`${relative} -> ${specifier}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it("una feature no importa componentes privados de otra feature", () => {
    const violations: string[] = []
    for (const file of files) {
      const owner = featureOf(file)
      if (!owner) continue
      for (const specifier of importsOf(sources.get(file)!)) {
        const target = resolveAdminFile(file, specifier)
        const targetOwner = target ? featureOf(target) : null
        if (targetOwner && targetOwner !== owner) {
          violations.push(`${relativeAdmin(file)} -> ${specifier}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it("una feature no importa rutas administrativas", () => {
    const violations: string[] = []
    for (const file of files) {
      if (!featureOf(file)) continue
      for (const specifier of importsOf(sources.get(file)!)) {
        const target = resolveAdminFile(file, specifier)
        const targetRelative = target ? relativeAdmin(target) : specifier
        if (targetRelative.startsWith("routes/") || specifier.startsWith("@admin/routes/")) {
          violations.push(`${relativeAdmin(file)} -> ${specifier}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it("el Admin no importa módulos, workflows ni rutas del backend", () => {
    const violations: string[] = []
    for (const file of files) {
      for (const specifier of importsOf(sources.get(file)!)) {
        const target = resolveAdminFile(file, specifier)
        const targetRelative = target ? path.relative(process.cwd(), target).split(path.sep).join("/") : ""
        if (
          specifier.startsWith("@jovy/modules/") ||
          specifier.startsWith("@jovy/workflows/") ||
          specifier.startsWith("@jovy/api/") ||
          targetRelative.startsWith("src/modules/") ||
          targetRelative.startsWith("src/workflows/") ||
          targetRelative.startsWith("src/api/")
        ) {
          violations.push(`${relativeAdmin(file)} -> ${specifier}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it("solo el cliente común usa fetch directamente", () => {
    const violations = files
      .filter((file) => relativeAdmin(file) !== "shared/lib/admin-api.ts")
      .filter((file) => /(^|[^.\w])fetch\s*\(/.test(sources.get(file)!))
      .map(relativeAdmin)
    expect(violations).toEqual([])
  })

  it("las rutas registradas no hacen fetching ni manejan estado de servidor", () => {
    const violations: string[] = []
    for (const file of files) {
      const relative = relativeAdmin(file)
      if (!relative.startsWith("routes/") || !relative.endsWith("/page.tsx")) continue
      const source = sources.get(file)!
      for (const forbidden of ["fetch(", "adminRequest", "useState(", "useEffect("]) {
        if (source.includes(forbidden)) violations.push(`${relative} contiene ${forbidden}`)
      }
    }
    expect(violations).toEqual([])
  })

  it("no existen ciclos de imports en el Admin", () => {
    for (const file of files) {
      graph.set(
        file,
        importsOf(sources.get(file)!)
          .map((specifier) => resolveAdminFile(file, specifier))
          .filter((target): target is string => Boolean(target)),
      )
    }

    const visiting = new Set<string>()
    const visited = new Set<string>()
    const cycles: string[] = []

    const visit = (file: string, trail: string[]) => {
      if (visiting.has(file)) {
        cycles.push([...trail, file].map(relativeAdmin).join(" -> "))
        return
      }
      if (visited.has(file)) return
      visiting.add(file)
      for (const target of graph.get(file) ?? []) visit(target, [...trail, file])
      visiting.delete(file)
      visited.add(file)
    }

    for (const file of files) visit(file, [])
    expect(cycles).toEqual([])
  })
})
