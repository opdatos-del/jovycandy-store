import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  CONTACT_TYPES,
  type ContactType,
} from "./catalog"
import { contactResource, getAuthz } from "./permissions"

export type ContactOperation = "read" | "update" | "delete" | "restore" | "export"

export function allowedContactTypes(req: MedusaRequest, operation: ContactOperation) {
  const authz = getAuthz(req)
  if (!authz) return [] as ContactType[]
  return CONTACT_TYPES.filter((type) => authz.can(contactResource(type), operation))
}

export function canAllContactTypes(req: MedusaRequest, operation: ContactOperation) {
  return allowedContactTypes(req, operation).length === CONTACT_TYPES.length
}

/**
 * Validación del handler, no solo del middleware: si llega un tipo no autorizado
 * se detiene con 403 antes de consultar. Sin tipo, la vista consolidada exige
 * permiso sobre las cuatro bandejas.
 */
export function assertContactQueryAccess(
  req: MedusaRequest,
  res: MedusaResponse,
  operation: ContactOperation,
  requested: ContactType | undefined,
) {
  if (requested) {
    if (allowedContactTypes(req, operation).includes(requested)) return true
    res.status(403).json({ type: "not_allowed", message: "No autorizado para esta operación." })
    return false
  }
  if (canAllContactTypes(req, operation)) return true
  res.status(403).json({ type: "not_allowed", message: "No autorizado para esta operación." })
  return false
}

/**
 * Para operaciones por ID el tipo real se lee de la fila. Se responde 404, no
 * 403, para no revelar la existencia de solicitudes de otra bandeja.
 */
export function assertContactRecordAccess(
  req: MedusaRequest,
  res: MedusaResponse,
  contactType: string | null | undefined,
  operation: ContactOperation,
) {
  const authz = getAuthz(req)
  if (authz && contactType && authz.can(contactResource(contactType as ContactType), operation)) {
    return true
  }
  res.status(404).json({ message: "Solicitud no encontrada" })
  return false
}
