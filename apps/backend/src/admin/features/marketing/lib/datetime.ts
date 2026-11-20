/**
 * Convierte una fecha ISO al valor que acepta `datetime-local` y viceversa.
 * Se hace en hora local porque el Admin captura la programación en la zona del
 * navegador y la API guarda siempre ISO.
 */
export const toDateTimeLocal = (value: string | null) => {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export const toIso = (value: string) => (value ? new Date(value).toISOString() : null)
