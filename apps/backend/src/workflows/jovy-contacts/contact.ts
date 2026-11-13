import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { contactAuditMetadata } from "@jovy/lib/jovy/audit"
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

type AdminContactInput = { id: string; status?: "pending" | "handled"; admin_notes?: string | null; actor_id: string | null }

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

const updateContactStep = createStep("update-contact", async (input: AdminContactInput, { container }) => {
  const service = container.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const [current] = await service.listJovyContactRequests({ id: input.id })
  if (!current) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Solicitud no encontrada")
  const updates: Record<string, unknown> = { id: current.id }
  const actions: Array<"status" | "note"> = []

  if (input.status !== undefined && input.status !== current.status) {
    updates.status = input.status
    updates.handled_at = input.status === "handled" ? new Date() : null
    updates.handled_by = input.status === "handled" ? input.actor_id : null
    actions.push("status")
  }
  if (input.admin_notes !== undefined && input.admin_notes !== current.admin_notes) {
    updates.admin_notes = input.admin_notes
    actions.push("note")
  }
  const contact = Object.keys(updates).length === 1 ? current : await service.updateJovyContactRequests(updates)
  for (const action of actions) {
    await service.createJovyContactAuditLogs({
      actor_id: input.actor_id,
      contact_request_id: contact.id,
      action,
      metadata: contactAuditMetadata(action, contact),
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
