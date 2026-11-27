"use strict"

/**
 * `next dev` agrega el distDir temporal a `tsconfig.json`. El runner restaura
 * el archivo sin pisar cambios hechos por otro proceso: solo elimina las
 * entradas del distDir de campaña y conserva cualquier otro campo.
 */

function parseTsconfig(text) {
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("tsconfig no contiene un objeto")
  }
  return parsed
}

function normalizeForCompare(value) {
  return JSON.stringify(value)
}

function stripCampaignEntries(config, distDir) {
  const include = Array.isArray(config.include) ? config.include : []
  const prefix = `${distDir.replace(/\\/g, "/")}/`
  return {
    ...config,
    include: include.filter(
      (entry) => typeof entry !== "string" || !entry.replace(/\\/g, "/").startsWith(prefix),
    ),
  }
}

/**
 * Devuelve el contenido que debe escribirse y si se conservaron cambios
 * ajenos a Next.
 */
function restoreTsconfig(originalText, currentText, distDir) {
  const original = parseTsconfig(originalText)
  const current = parseTsconfig(currentText)
  const withoutCampaign = stripCampaignEntries(current, distDir)

  if (normalizeForCompare(withoutCampaign) === normalizeForCompare(original)) {
    return { text: originalText, externalChanges: false }
  }

  return {
    text: `${JSON.stringify(withoutCampaign, null, 2)}\n`,
    externalChanges: true,
  }
}

module.exports = { restoreTsconfig, stripCampaignEntries }
