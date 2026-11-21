import es from "./locales/es"
import en from "./locales/en"

export const locales = ["es", "en"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "es"

export type Dictionary = typeof es

const dictionaries: Record<Locale, Dictionary> = {
  es,
  en: en as unknown as Dictionary,
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale]
}

export function localePath(locale: Locale, path = "") {
  const normalized = path.startsWith("/") ? path : path ? `/${path}` : ""
  return `/${locale}${normalized}`
}
