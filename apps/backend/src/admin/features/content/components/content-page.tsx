import { Badge, Button, Container, Heading, Input } from "@medusajs/ui"
import { useContent } from "../hooks/use-content"
import type { ContentStatus, LocalizedContent } from "../types"

/**
 * Pantalla de Contenido Jovy: listado de páginas editoriales bilingües y su
 * formulario de alta/edición. La lógica y las peticiones viven en la feature.
 */
export const ContentPage = () => {
  const content = useContent()
  const { form, setForm } = content

  const updateLocale = (locale: "es" | "en", field: keyof LocalizedContent, value: string) => {
    setForm((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...current.translations[locale], [field]: value },
      },
    }))
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1" id="content-list-heading" tabIndex={-1}>Contenido Jovy</Heading>
            <p className="text-ui-fg-subtle text-sm">Páginas editoriales bilingües y su estado de publicación.</p>
          </div>
          <Button type="button" variant="secondary" onClick={content.reset}>Nueva página</Button>
        </div>
        <div className="p-6">
          {content.error && <p className="text-ui-fg-error mb-4" role="alert">{content.error}</p>}
          {content.isLoading ? (
            <p className="text-ui-fg-subtle">Cargando contenido…</p>
          ) : content.pages.length === 0 ? (
            <p className="text-ui-fg-subtle">Aún no hay páginas editoriales.</p>
          ) : (
            <ul className="divide-y">
              {content.pages.map((page) => (
                <li key={page.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-ui-fg-base font-medium">{page.translations.es.title}</p>
                    <p className="text-ui-fg-subtle text-sm">/{page.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={page.status === "published" ? "green" : page.status === "archived" ? "grey" : "orange"}>{page.status}</Badge>
                    <Button type="button" size="small" variant="secondary" onClick={() => content.edit(page)}>Editar</Button>
                    <Button type="button" size="small" variant="secondary" isLoading={content.deletingId === page.id} onClick={() => void content.remove(page)}>Eliminar</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>

      <Container className="p-6">
        <Heading level="h2" className="mb-4">{content.editingId ? "Editar página" : "Nueva página"}</Heading>
        <form className="flex max-w-3xl flex-col gap-y-4" onSubmit={(event) => void content.save(event)}>
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
            <Button type="submit" isLoading={content.isSaving}>{content.editingId ? "Guardar cambios" : "Crear página"}</Button>
            {content.editingId && <Button type="button" variant="secondary" onClick={content.reset}>Cancelar</Button>}
          </div>
        </form>
      </Container>
    </div>
  )
}
