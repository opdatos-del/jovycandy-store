import type { MedusaRequest } from "@medusajs/framework/http"
import {
  evaluateJovyAccess,
  evaluateNativeAccess,
  isAuthenticatedShellRead,
  isPublicShellRead,
  matchJovyRule,
} from "../route-policy"
import {
  effectivePermissionKeys,
  isGlobalAdmin,
  permissionAllows,
  type AuthzSnapshot,
} from "../permissions"

function snapshot(grants: string[], denies: string[] = []): AuthzSnapshot {
  const allow = new Set(grants)
  const deny = new Set(denies)
  return {
    userId: "user_test",
    roles: [],
    permissions: effectivePermissionKeys(allow, deny),
    wildcard: isGlobalAdmin(allow, deny),
    can: (resource, operation) => permissionAllows(allow, deny, resource, operation),
  }
}

function request(input: { method?: string; query?: Record<string, unknown>; body?: unknown }) {
  return {
    method: input.method ?? "GET",
    query: input.query ?? {},
    body: input.body ?? {},
  } as unknown as MedusaRequest
}

function jovy(method: string, path: string, reqInput: Parameters<typeof request>[0] = {}) {
  const rule = matchJovyRule(method, path)
  if (!rule) throw new Error(`Sin regla para ${method} ${path}`)
  return evaluateJovyAccess(request({ method, ...reqInput }), snapshotInput, rule)
}

let snapshotInput = snapshot([])

describe("reglas de endpoints Jovy", () => {
  it("aísla las bandejas de contactos por query", () => {
    snapshotInput = snapshot(["jovy_contacts_national:read"])
    expect(jovy("GET", "/admin/jovy/contacts", { query: { contact_type: "national-sales" } }).allowed).toBe(true)
    expect(jovy("GET", "/admin/jovy/contacts", { query: { contact_type: "international-sales" } }).allowed).toBe(false)
    expect(jovy("GET", "/admin/jovy/contacts").allowed).toBe(false)
    expect(jovy("GET", "/admin/jovy/contacts/counts").allowed).toBe(false)
  })

  it("no implica export desde read y exige todas las bandejas para el consolidado", () => {
    snapshotInput = snapshot(["jovy_contacts_national:read"])
    expect(
      jovy("GET", "/admin/jovy/contacts/export", { query: { contact_type: "national-sales" } }).allowed,
    ).toBe(false)

    snapshotInput = snapshot([
      "jovy_contacts_national:export",
      "jovy_contacts_international:export",
    ])
    expect(
      jovy("GET", "/admin/jovy/contacts/export-all", {
        query: { contact_types: "national-sales,international-sales" },
      }).allowed,
    ).toBe(true)
    expect(
      jovy("GET", "/admin/jovy/contacts/export-all", { query: {} }).allowed,
    ).toBe(false)
  })

  it("deriva los accesos por ID al handler", () => {
    snapshotInput = snapshot([])
    expect(jovy("GET", "/admin/jovy/contacts/contact_demo").allowed).toBe(true)
    expect(jovy("PUT", "/admin/jovy/contacts/contact_demo").allowed).toBe(true)
    expect(jovy("POST", "/admin/jovy/contacts/contact_demo/restore").allowed).toBe(true)
  })

  it("separa update de publish y archive", () => {
    snapshotInput = snapshot(["jovy_content:update"])
    expect(
      jovy("PUT", "/admin/jovy/content/pages/page_demo", {
        body: { status: "published" },
      }).allowed,
    ).toBe(false)
    expect(
      jovy("PUT", "/admin/jovy/content/pages/page_demo", { body: { status: "draft" } }).allowed,
    ).toBe(true)

    snapshotInput = snapshot(["jovy_content:update", "jovy_content:publish"])
    expect(
      jovy("PUT", "/admin/jovy/content/pages/page_demo", {
        body: { status: "published" },
      }).allowed,
    ).toBe(true)
    expect(
      jovy("PUT", "/admin/jovy/content/pages/page_demo", {
        body: { status: "archived" },
      }).allowed,
    ).toBe(false)
  })

  it("deniega Jovy sin regla o sin permiso", () => {
    snapshotInput = snapshot([])
    expect(jovy("GET", "/admin/jovy/dashboard").allowed).toBe(false)
    expect(matchJovyRule("GET", "/admin/jovy/no-existe")).toBeNull()
  })

  it("permite /authz/me a cualquier usuario autenticado", () => {
    snapshotInput = snapshot([])
    expect(jovy("GET", "/admin/jovy/authz/me").allowed).toBe(true)
    expect(jovy("GET", "/admin/jovy/authz/roles").allowed).toBe(false)
  })
})

describe("cobertura nativa", () => {
  it("permite solo lecturas mínimas del shell", () => {
    const restricted = snapshot([])
    expect(evaluateNativeAccess("GET", "/admin/users/me", restricted).allowed).toBe(true)
    expect(evaluateNativeAccess("GET", "/admin/notifications", restricted).allowed).toBe(true)
    expect(evaluateNativeAccess("POST", "/admin/users/me", restricted).allowed).toBe(false)
  })

  it("exige permisos medusa_* por área y método", () => {
    const products = snapshot(["medusa_products:read"])
    expect(evaluateNativeAccess("GET", "/admin/products", products).allowed).toBe(true)
    expect(evaluateNativeAccess("POST", "/admin/products", products).allowed).toBe(false)
    expect(evaluateNativeAccess("GET", "/admin/users", products).allowed).toBe(false)
    expect(evaluateNativeAccess("GET", "/admin/desconocido", products).allowed).toBe(false)
  })

  it("normaliza barra final, query y HEAD sin abrir rutas", () => {
    const products = snapshot(["medusa_products:read"])
    expect(evaluateNativeAccess("GET", "/admin/products/", products).allowed).toBe(true)
    expect(evaluateNativeAccess("GET", "/admin/products?limit=1", products).allowed).toBe(true)
    expect(evaluateNativeAccess("HEAD", "/admin/products", products).allowed).toBe(true)
    expect(evaluateNativeAccess("HEAD", "/admin/users", products).allowed).toBe(false)
    expect(evaluateNativeAccess("GET", "/admin/products/../users", products).allowed).toBe(false)
  })

  it("solo feature-flags es lectura pública del shell", () => {
    expect(isPublicShellRead("GET", "/admin/feature-flags")).toBe(true)
    expect(isPublicShellRead("GET", "/admin/stores")).toBe(false)
    expect(isPublicShellRead("POST", "/admin/feature-flags")).toBe(false)

    expect(isAuthenticatedShellRead("GET", "/admin/users/me")).toBe(true)
    expect(isAuthenticatedShellRead("GET", "/admin/stores")).toBe(true)
    expect(isAuthenticatedShellRead("GET", "/admin/stores/store_123")).toBe(true)
    expect(isAuthenticatedShellRead("GET", "/admin/stores/store_123/currencies")).toBe(false)
    expect(isAuthenticatedShellRead("POST", "/admin/stores")).toBe(false)
    expect(isAuthenticatedShellRead("GET", "/admin/feature-flags")).toBe(false)
  })

  it("una denegación anula el wildcard también en rutas nativas", () => {
    const denied = snapshot(["*:*"], ["medusa_users:manage_settings"])
    expect(denied.wildcard).toBe(false)
    expect(evaluateNativeAccess("POST", "/admin/users", denied).allowed).toBe(false)
    expect(evaluateNativeAccess("GET", "/admin/products", denied).allowed).toBe(true)
    expect(evaluateNativeAccess("GET", "/admin/desconocido", denied).allowed).toBe(false)
    expect(denied.permissions).not.toContain("medusa_users:manage_settings")
    expect(denied.permissions).not.toContain("*:*")
  })

  it("el rol global conserva acceso nativo", () => {
    const superadmin = snapshot(["*:*"])
    expect(evaluateNativeAccess("POST", "/admin/users", superadmin).allowed).toBe(true)
    expect(evaluateNativeAccess("GET", "/admin/desconocido", superadmin).allowed).toBe(true)
  })
})
