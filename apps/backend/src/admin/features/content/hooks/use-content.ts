import { usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { createPage, deletePage, fetchPages, updatePage } from "../api"
import { emptyPage, type EditorialPage, type PageDraft } from "../types"

/**
 * Estado y acciones del listado editorial. Conserva los mensajes, las
 * confirmaciones y el foco posterior al borrado que ya conocía la pantalla.
 */
export function useContent() {
  const prompt = usePrompt()
  const [pages, setPages] = useState<EditorialPage[]>([])
  const [form, setForm] = useState<PageDraft>(emptyPage)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPages = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchPages()
      setPages(result)
      setError(null)
    } catch {
      setError("No fue posible cargar las páginas editoriales.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPages()
  }, [loadPages])

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
      if (editingId) {
        await updatePage(editingId, form)
      } else {
        await createPage(form)
      }
      reset()
      await loadPages()
    } catch {
      setError("No se pudo guardar. Verifica los campos obligatorios y la sesión administrativa.")
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async (page: EditorialPage) => {
    const confirmed = await prompt({
      title: "Eliminar página",
      description: `Se eliminará “${page.translations.es.title}” (/${page.slug}). La página saldrá del listado editorial y dejará de servirse en Store.`,
      confirmText: "Eliminar página",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) {
      return
    }

    setDeletingId(page.id)
    try {
      await deletePage(page.id)
      if (editingId === page.id) reset()
      await loadPages()
      requestAnimationFrame(() => document.getElementById("content-list-heading")?.focus())
    } catch {
      setError("No se pudo eliminar la página.")
    } finally {
      setDeletingId(null)
    }
  }

  return {
    pages,
    form,
    editingId,
    isLoading,
    isSaving,
    deletingId,
    error,
    setForm,
    edit,
    reset,
    save,
    remove,
  }
}
