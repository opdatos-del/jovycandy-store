import {
  permissionAllows,
  permissionKey,
  toPermissionSet,
} from "../permissions"

describe("resolución de permisos", () => {
  it("combina roles por unión", () => {
    const allow = toPermissionSet([
      { resource: "jovy_contacts_national", operation: "read" },
      { resource: "jovy_contacts_international", operation: "read" },
    ])
    const deny = new Set<string>()
    expect(permissionAllows(allow, deny, "jovy_contacts_national", "read")).toBe(true)
    expect(permissionAllows(allow, deny, "jovy_contacts_international", "read")).toBe(true)
    expect(permissionAllows(allow, deny, "jovy_contacts_catalogue", "read")).toBe(false)
  })

  it("exige operaciones separadas", () => {
    const allow = toPermissionSet([{ resource: "jovy_logos", operation: "read" }])
    expect(permissionAllows(allow, new Set(), "jovy_logos", "export")).toBe(false)
    expect(permissionAllows(allow, new Set(), "jovy_logos", "delete")).toBe(false)
  })

  it("aplica deny por encima de cualquier concesión", () => {
    const allow = toPermissionSet([{ resource: "*", operation: "*" }])
    const deny = toPermissionSet([{ resource: "jovy_contacts_national", operation: "export" }])
    expect(permissionAllows(allow, deny, "jovy_contacts_national", "export")).toBe(false)
    expect(permissionAllows(allow, deny, "jovy_contacts_national", "read")).toBe(true)
  })

  it("soporta comodines de recurso y operación", () => {
    expect(
      permissionAllows(new Set(["jovy_contacts_national:*"]), new Set(), "jovy_contacts_national", "delete"),
    ).toBe(true)
    expect(
      permissionAllows(new Set(["*:read"]), new Set(), "jovy_dashboard", "read"),
    ).toBe(true)
    expect(permissionKey("jovy_dashboard", "read")).toBe("jovy_dashboard:read")
  })
})
