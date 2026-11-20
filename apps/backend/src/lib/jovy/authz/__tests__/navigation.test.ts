import { permissionAllows, type AuthzSnapshot } from "../permissions"
import { visibleNavigation } from "../navigation"

function snapshot(grants: string[]): AuthzSnapshot {
  const allow = new Set(grants)
  return {
    userId: "user_nav",
    roles: [],
    permissions: grants,
    wildcard: allow.has("*:*"),
    can: (resource, operation) => permissionAllows(allow, new Set(), resource, operation),
  }
}

describe("navegación derivada de permisos", () => {
  it("muestra solo la bandeja nacional al rol de ventas", () => {
    const groups = visibleNavigation(snapshot(["jovy_contacts_national:read"]))
    expect(groups.map((group) => group.id)).toEqual(["jovy"])
    const labels = groups[0].items.map((item) => item.label)
    expect(labels).toEqual(["Ventas Nacionales"])
  })

  it("muestra grupos nativos solo con su lectura", () => {
    const groups = visibleNavigation(snapshot(["medusa_products:read"]))
    const medusa = groups.find((group) => group.id === "medusa")
    expect(medusa?.items.map((item) => item.label)).toEqual(["Productos"])
    expect(groups.some((group) => group.id === "jovy")).toBe(false)
  })

  it("oculta grupos sin hijos visibles", () => {
    const groups = visibleNavigation(snapshot([]))
    expect(groups).toEqual([])
  })

  it("un superadministrador ve todos los grupos", () => {
    const groups = visibleNavigation(snapshot(["*:*"]))
    expect(groups.map((group) => group.id)).toEqual(["medusa", "jovy", "jovy-tools", "settings"])
  })
})
