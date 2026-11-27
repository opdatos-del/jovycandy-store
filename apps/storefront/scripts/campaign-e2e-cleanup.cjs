"use strict"
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs")

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Separa el resultado de Playwright del resultado de limpieza.
 *
 * - Un fallo de Playwright no se disfraza de limpieza correcta.
 * - Un fallo al detener PostgreSQL, backend o storefront deja la ejecución como
 *   fallida y conserva el directorio para inspección.
 * - Solo se elimina la raíz cuando Playwright y todos los pasos de limpieza
 *   terminaron correctamente.
 */
async function finalizeCampaignRun({
  playwrightPassed,
  root,
  steps = [],
  evidence = {},
  saveEvidence,
  updateEvidence,
}) {
  const cleanupErrors = []
  const stepResults = {}

  for (const step of steps) {
    try {
      stepResults[step.name] = (await step.run()) ?? { ok: true }
    } catch (error) {
      cleanupErrors.push({ step: step.name, message: messageOf(error) })
      stepResults[step.name] = { ok: false, error: messageOf(error) }
    }
  }

  let cleanupPassed = cleanupErrors.length === 0
  const baseEvidence = {
    ...evidence,
    ...stepResults,
    playwright: playwrightPassed ? "passed" : "failed",
    cleanup: cleanupPassed ? "passed" : "failed",
    cleanupErrors,
  }

  let reportSaved = false
  try {
    await saveEvidence({ ...baseEvidence, overall: "pending", rootRemoved: false })
    reportSaved = true
  } catch (error) {
    cleanupErrors.push({ step: "evidence", message: messageOf(error) })
    cleanupPassed = false
  }

  let rootRemoved = false
  if (playwrightPassed && cleanupPassed) {
    try {
      fs.rmSync(root, { recursive: true, force: false })
      rootRemoved = !fs.existsSync(root)
      if (!rootRemoved) {
        cleanupErrors.push({ step: "root", message: "El directorio efímero sigue existiendo." })
        cleanupPassed = false
      }
    } catch (error) {
      cleanupErrors.push({ step: "root", message: messageOf(error) })
      cleanupPassed = false
    }
  }

  const overall = playwrightPassed && cleanupPassed
  const finalEvidence = {
    ...baseEvidence,
    cleanup: cleanupPassed ? "passed" : "failed",
    overall: overall ? "passed" : "failed",
    cleanupErrors,
    rootRemoved,
  }

  if (reportSaved) {
    try {
      await updateEvidence(finalEvidence)
    } catch {
      // La evidencia inicial ya existe; no se oculta el fallo de actualización.
    }
  }

  return {
    overall,
    cleanupPassed,
    rootRemoved,
    cleanupErrors,
    evidence: finalEvidence,
    reportSaved,
  }
}

module.exports = { finalizeCampaignRun }
