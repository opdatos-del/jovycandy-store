import type { MedusaRequest } from "@medusajs/framework/http"
import { AUTHZ_RESOURCES, CONTACT_TYPE_RESOURCE, CONTACT_TYPES, type ContactType } from "./catalog"

export type AuthzSnapshot = {
  userId: string
  roles: string[]
  permissions: string[]
  wildcard: boolean
  /** Permisos efectivos ya resueltos para comprobaciones sin repetir regex. */
  can: (resource: string, operation: string) => boolean
}

export type AuthzDenial = {
  status: 401 | 403 | 404
  message: string
}

export function permissionKey(resource: string, operation: string) {
  return `${resource}:${operation}`
}

/**
 * Un permiso concedido puede ser exacto, por recurso (`recurso:*`), por
 * operación (`*:operacion`) o global (`*:*`). La denegación explícita siempre
 * gana sobre cualquier concesión.
 */
export function permissionAllows(
  allow: ReadonlySet<string>,
  deny: ReadonlySet<string>,
  resource: string,
  operation: string,
) {
  const exact = permissionKey(resource, operation)
  if (
    deny.has("*:*") ||
    deny.has(exact) ||
    deny.has(permissionKey(resource, "*")) ||
    deny.has(permissionKey("*", operation))
  ) {
    return false
  }
  return (
    allow.has("*:*") ||
    allow.has(exact) ||
    allow.has(permissionKey(resource, "*")) ||
    allow.has(permissionKey("*", operation))
  )
}

export function toPermissionSet(values: Array<{ resource: string; operation: string }>) {
  return new Set(values.map((value) => permissionKey(value.resource, value.operation)))
}

/**
 * Permisos concretos que quedan tras aplicar denegaciones. Si hay wildcard y no
 * existe ninguna denegación se conserva `*:*`; si existe al menos una, se
 * expande el catálogo para no anunciar permisos anulados.
 */
export function effectivePermissionKeys(allow: ReadonlySet<string>, deny: ReadonlySet<string>) {
  if (allow.has("*:*") && deny.size === 0) return ["*:*"]
  const keys: string[] = []
  for (const resource of AUTHZ_RESOURCES) {
    for (const operation of resource.operations) {
      if (permissionAllows(allow, deny, resource.key, operation)) {
        keys.push(permissionKey(resource.key, operation))
      }
    }
  }
  return keys.sort()
}

export function isGlobalAdmin(allow: ReadonlySet<string>, deny: ReadonlySet<string>) {
  return allow.has("*:*") && deny.size === 0
}

export function contactResource(contactType: ContactType) {
  return CONTACT_TYPE_RESOURCE[contactType]
}

export function isContactType(value: unknown): value is ContactType {
  return typeof value === "string" && (CONTACT_TYPES as string[]).includes(value)
}

type RequestWithAuthz = MedusaRequest & { jovy_authz?: AuthzSnapshot }

export function getAuthz(request: MedusaRequest): AuthzSnapshot | null {
  return (request as RequestWithAuthz).jovy_authz ?? null
}

/**
 * El guard de rutas deja pasar las operaciones por ID para que el handler
 * resuelva el tipo real del registro. Esta función aplica la decisión con el
 * tipo ya leído y oculta la existencia de registros de otra bandeja.
 */
export function canAccessContact(
  authz: AuthzSnapshot | null,
  contactType: string | null | undefined,
  operation: "read" | "update" | "delete" | "restore" | "export",
) {
  if (!authz || !isContactType(contactType)) return false
  return authz.can(contactResource(contactType), operation)
}

export const CONTACT_ACCESS_DENIED: AuthzDenial = {
  status: 404,
  message: "Solicitud no encontrada",
}

export const FORBIDDEN: AuthzDenial = {
  status: 403,
  message: "No autorizado para esta operación.",
}

export const UNAUTHORIZED: AuthzDenial = {
  status: 401,
  message: "Sesión no válida.",
}
