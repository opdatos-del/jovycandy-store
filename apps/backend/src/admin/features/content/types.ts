/**
 * Tipos y valores iniciales de las páginas editoriales bilingües. El contrato
 * HTTP es el mismo que ya consumía la ruta de Contenido Jovy.
 */

export type ContentStatus = "draft" | "published" | "archived"

export type LocalizedContent = {
  title: string
  excerpt?: string
  body?: string
}

export type EditorialPage = {
  id: string
  slug: string
  status: ContentStatus
  translations: Record<"es" | "en", LocalizedContent>
  published_at: string | null
}

export type PageListResponse = {
  pages: EditorialPage[]
}

/** Formulario de alta/edición; `id` y `published_at` los administra el backend. */
export type PageDraft = Omit<EditorialPage, "id">

export const emptyPage = (): PageDraft => ({
  slug: "",
  status: "draft",
  published_at: null,
  translations: {
    es: { title: "", excerpt: "", body: "" },
    en: { title: "", excerpt: "", body: "" },
  },
})
