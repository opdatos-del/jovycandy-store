import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { contactAuditMetadata, type ContactAuditAction } from "@jovy/lib/jovy/audit"
import {
  contactEditableFields,
  normalizeOptionalText,
  type ContactEditableField,
} from "@jovy/lib/jovy/contacts"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"

type PublicContactInput = {
  first_name: string
  last_name?: string | null
  email: string
  phone?: string | null
  country?: string | null
  city?: string | null
  postal_code?: string | null
  message: string
  contact_type: "national-sales" | "international-sales" | "customer-service" | "catalogue"
}

type AdminContactInput = {
  id: string
  status?: "pending" | "handled"
  admin_notes?: string | null
  actor_id: string | null
} & Partial<Record<ContactEditableField, string | null>>

/** Text columns that accept `null`; empty strings are normalized before comparing. */
const nullableEditableFields = new Set<ContactEditableField>([
  "last_name",
  "phone",
  "country",
  "city",
  "postal_code",
])

const createContactStep = createStep("create-contact", async (input: PublicContactInput, { container }) => {
  const service = container.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const contact = await service.createJovyContactRequests({ ...input, status: "pending" })
  await service.createJovyContactAuditLogs({
    actor_id: null,
    contact_request_id: contact.id,
    action: "create",
    metadata: contactAuditMetadata("create", contact),
  })
  return new StepResponse(contact, contact.id)
})

export const createContactWorkflow = createWorkflow(
  "create-contact",
  (input: PublicContactInput) => new WorkflowResponse(createContactStep(input)),
)

type AuditEntry = { action: ContactAuditAction; metadata?: ReturnType<typeof contactAuditMetadata> }

const updateContactStep = createStep("update-contact", async (input: AdminContactInput, { container }) => {
  const service = container.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const [current] = await service.listJovyContactRequests({ id: input.id })
  if (!current) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Solicitud no encontrada")

  const updates: Record<string, unknown> = { id: current.id }
  const audits: AuditEntry[] = []

  const changedFields: string[] = []
  for (const field of contactEditableFields) {
    if (input[field] === undefined) continue
    const next = nullableEditableFields.has(field)
      ? normalizeOptionalText(input[field])
      : input[field]
    const previous = current[field] ?? null
    if (next === previous) continue
    updates[field] = next
    changedFields.push(field)
  }
  if (changedFields.length > 0) {
    audits.push({ action: "update", metadata: contactAuditMetadata("update", current, changedFields) })
  }

  if (input.status !== undefined && input.status !== current.status) {
    updates.status = input.status
    updates.handled_at = input.status === "handled" ? new Date() : null
    updates.handled_by = input.status === "handled" ? input.actor_id : null
    audits.push({ action: "status", metadata: contactAuditMetadata("status", { status: input.status }) })
  }
  if (input.admin_notes !== undefined && input.admin_notes !== current.admin_notes) {
    updates.admin_notes = input.admin_notes
    audits.push({ action: "note", metadata: contactAuditMetadata("note", current) })
  }

  const contact = Object.keys(updates).length === 1 ? current : await service.updateJovyContactRequests(updates)
  for (const audit of audits) {
    await service.createJovyContactAuditLogs({
      actor_id: input.actor_id,
      contact_request_id: contact.id,
      action: audit.action,
      metadata: audit.metadata,
    })
  }
  return new StepResponse(contact, contact.id)
})

export const updateContactWorkflow = createWorkflow(
  "update-contact",
  (input: AdminContactInput) => new WorkflowResponse(updateContactStep(input)),
)

const deleteContactStep = createStep("delete-contact", async (input: { id: string; actor_id: string | null }, { container }) => {
  const service = container.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const [contact] = await service.listJovyContactRequests({ id: input.id })
  if (!contact) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Solicitud no encontrada")
  // Logical deletion: the row (and its audit trail) survives for the retention policy.
  await service.softDeleteJovyContactRequests(contact.id)
  await service.createJovyContactAuditLogs({ actor_id: input.actor_id, contact_request_id: contact.id, action: "delete", metadata: contactAuditMetadata("delete", contact) })
  return new StepResponse({ id: contact.id })
})

export const deleteContactWorkflow = createWorkflow(
  "delete-contact",
  (input: { id: string; actor_id: string | null }) => new WorkflowResponse(deleteContactStep(input)),
)

const restoreContactStep = createStep("restore-contact", async (input: { id: string; actor_id: string | null }, { container }) => {
  const service = container.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const [current] = await service.listJovyContactRequests({ id: input.id }, { withDeleted: true })
  if (!current) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Solicitud no encontrada")
  // Idempotent: restoring a live request returns it unchanged and writes no audit.
  if (!current.deleted_at) return new StepResponse(current, current.id)

  await service.restoreJovyContactRequests(current.id)
  const [contact] = await service.listJovyContactRequests({ id: current.id })
  await service.createJovyContactAuditLogs({
    actor_id: input.actor_id,
    contact_request_id: current.id,
    action: "restore",
    metadata: contactAuditMetadata("restore", contact ?? current),
  })
  return new StepResponse(contact ?? current, current.id)
})

export const restoreContactWorkflow = createWorkflow(
  "restore-contact",
  (input: { id: string; actor_id: string | null }) => new WorkflowResponse(restoreContactStep(input)),
)
