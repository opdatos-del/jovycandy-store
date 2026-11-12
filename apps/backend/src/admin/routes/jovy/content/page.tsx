import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input } from "@medusajs/ui"
import { useEffect, useState } from "react"

type ContentStatus = "draft" | "published" | "archived"

type LocalizedContent = {
  title: string
  excerpt?: string
  body?: string
}

type EditorialPage = {
  id: string
  slug: string
  status: ContentStatus
  translations: Record<"es" | "en", LocalizedContent>
  published_at: string | null
}

type PageListResponse = {
  pages: EditorialPage[]
}

const emptyPage = (): Omit<EditorialPage, "id"> => ({
  slug: "",
  status: "draft",
  published_at: null,
  translations: {
    es: { title: "", excerpt: "", body: "" },
    en: { title: "", excerpt: "", body: "" },
  },
})

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error("No se pudo completar la operación")
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

const ContentPage = () => {
  const [pages, setPages] = useState<EditorialPage[]>([])
  const [form, setForm] = useState<Omit<EditorialPage, "id">>(emptyPage)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPages = async () => {
    setIsLoading(true)
    try {
      const result = await request<PageListResponse>("/admin/jovy/content/pages")
      setPages(result.pages)
      setError(null)
    } catch {
      setError("No fue posible cargar las páginas editoriales.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPages()
  }, [])

  const updateLocale = (locale: "es" | "en", field: keyof LocalizedContent, value: string) => {
    setForm((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...current.translations[locale], [field]: value },
      },
    }))
  }

  const edit = (page: EditorialPage) => {
    setEditingId(page.id)
    setForm({
      slug: page.slug,
      status: page.status,
      published_at: page.published_at,
      translations: page.translations,
    })
    setError(null)
  }

  const reset = () => {
    setEditingId(null)
    setForm(emptyPage())
    setError(null)
  }

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      await request(editingId ? `/admin/jovy/content/pages/${editingId}` : "/admin/jovy/content/pages", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form),
      })
      reset()
      await loadPages()
    } catch {
      setError("No se pudo guardar. Verifica los campos obligatorios y la sesión administrativa.")
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async (page: EditorialPage) => {
    if (!window.confirm(`Eliminar la página “${page.translations.es.title}”?`)) {
      return
    }

    try {
      await request(`/admin/jovy/content/pages/${page.id}`, { method: "DELETE" })
      if (editingId === page.id) reset()
      await loadPages()
    } catch {
      setError("No se pudo eliminar la página.")
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Contenido Jovy</Heading>
            <p className="text-ui-fg-subtle text-sm">Páginas editoriales bilingües y su estado de publicación.</p>
          </div>
          <Button type="button" variant="secondary" onClick={reset}>Nueva página</Button>
        </div>
        <div className="p-6">
          {error && <p className="text-ui-fg-error mb-4" role="alert">{error}</p>}
          {isLoading ? (
            <p className="text-ui-fg-subtle">Cargando contenido…</p>
          ) : pages.length === 0 ? (
            <p className="text-ui-fg-subtle">Aún no hay páginas editoriales.</p>
          ) : (
            <ul className="divide-y">
              {pages.map((page) => (
                <li key={page.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-ui-fg-base font-medium">{page.translations.es.title}</p>
                    <p className="text-ui-fg-subtle text-sm">/{page.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={page.status === "published" ? "green" : page.status === "archived" ? "grey" : "orange"}>{page.status}</Badge>
                    <Button type="button" size="small" variant="secondary" onClick={() => edit(page)}>Editar</Button>
                    <Button type="button" size="small" variant="secondary" onClick={() => void remove(page)}>Eliminar</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>

      <Container className="p-6">
        <Heading level="h2" className="mb-4">{editingId ? "Editar página" : "Nueva página"}</Heading>
        <form className="flex max-w-3xl flex-col gap-y-4" onSubmit={(event) => void save(event)}>
          <label className="text-ui-fg-subtle text-sm" htmlFor="jovy-page-slug">Slug</label>
          <Input id="jovy-page-slug" required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="nosotros" />

          <label className="text-ui-fg-subtle text-sm" htmlFor="jovy-page-status">Estado</label>
          <select id="jovy-page-status" className="bg-ui-bg-field border-ui-border-base rounded-md border px-3 py-2" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ContentStatus })}>
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
          </select>

          {(["es", "en"] as const).map((locale) => (
            <fieldset key={locale} className="border-ui-border-base rounded-md border p-4">
              <legend className="text-ui-fg-base px-2 font-medium">{locale === "es" ? "Español" : "English"}</legend>
              <div className="flex flex-col gap-y-3">
                <Input required aria-label={`Título ${locale}`} value={form.translations[locale].title} onChange={(event) => updateLocale(locale, "title", event.target.value)} placeholder="Título" />
                <Input aria-label={`Resumen ${locale}`} value={form.translations[locale].excerpt ?? ""} onChange={(event) => updateLocale(locale, "excerpt", event.target.value)} placeholder="Resumen" />
                <textarea className="bg-ui-bg-field border-ui-border-base min-h-32 rounded-md border px-3 py-2" aria-label={`Contenido ${locale}`} value={form.translations[locale].body ?? ""} onChange={(event) => updateLocale(locale, "body", event.target.value)} placeholder="Contenido" />
              </div>
            </fieldset>
          ))}

          <div className="flex gap-2">
            <Button type="submit" isLoading={isSaving}>{editingId ? "Guardar cambios" : "Crear página"}</Button>
            {editingId && <Button type="button" variant="secondary" onClick={reset}>Cancelar</Button>}
          </div>
        </form>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Contenido Jovy",
})

export default ContentPage
