import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import type JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"

import { createPublishableApiKey, storeHeaders } from "./utils"

jest.setTimeout(120_000)

const CONTACT = {
  first_name: "Rate",
  last_name: "Limit",
  email: "rate.limit@example.test",
  message: "Solicitud para probar el límite por IP.",
  contact_type: "customer-service",
}

/**
 * The limiter is in-process module state, so each Jest file gets a fresh map.
 * This suite owns every Store submission of its process to keep the count
 * deterministic: exactly five accepted submissions and one rejected.
 */
medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-contacts-rate-limit",
  testSuite: ({ api, getContainer }) => {
    let publishableApiKey: string

    beforeAll(async () => {
      publishableApiKey = await createPublishableApiKey(getContainer())
    })

    it("limita a cinco envíos por IP y anuncia cuándo reintentar", async () => {
      const submit = () =>
        api.post("/store/jovy/contacts", CONTACT, {
          headers: storeHeaders(publishableApiKey),
          validateStatus: () => true,
        })

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const accepted = await submit()
        expect(accepted.status).toBe(202)
        expect(accepted.data).toEqual({ accepted: true })
      }

      const limited = await submit()

      expect(limited.status).toBe(429)
      expect(limited.data).toEqual({ message: "No se puede procesar la solicitud en este momento" })
      const retryAfter = Number(limited.headers["retry-after"])
      expect(Number.isInteger(retryAfter)).toBe(true)
      expect(retryAfter).toBeGreaterThan(0)
      expect(retryAfter).toBeLessThanOrEqual(10 * 60)

      const contactsService = getContainer().resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
      const [, count] = await contactsService.listAndCountJovyContactRequests({})
      expect(count).toBe(5)
    })
  },
})
