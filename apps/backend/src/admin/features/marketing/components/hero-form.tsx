import { Button, Container, Heading, Input, Textarea } from "@medusajs/ui"
import type { Dispatch, SetStateAction } from "react"
import { toDateTimeLocal, toIso } from "../lib/datetime"
import type { HeroForm, MarketingProduct } from "../types"

type Props = {
  form: HeroForm
  setForm: Dispatch<SetStateAction<HeroForm>>
  editingId: string | null
  saving: boolean
  product: MarketingProduct | null
  products: MarketingProduct[]
  productQuery: string
  setProductQuery: (value: string) => void
  previewUrl: string | null
  onProductChange: (product: MarketingProduct | null) => void
  onSearchProducts: () => void
  onUpload: (file?: File) => void
  onSubmit: (event: React.FormEvent) => void
}

/**
 * Formulario del Hero. No incluye el Prompt de borrado ni la carga inicial:
 * aquí solo se edita el borrador y se conservan las etiquetas accesibles.
 */
export const HeroFormSection = ({
  form,
  setForm,
  editingId,
  saving,
  product,
  products,
  productQuery,
  setProductQuery,
  previewUrl,
  onProductChange,
  onSearchProducts,
  onUpload,
  onSubmit,
}: Props) => (
  <Container className="p-6">
    <Heading level="h2">{editingId ? "Editar Hero" : "Nuevo Hero"}</Heading>
    <form className="mt-4 flex max-w-3xl flex-col gap-4" onSubmit={onSubmit}>
      <Input
        required
        aria-label="Hero título es"
        value={form.translations.es.title}
        onChange={(event) =>
          setForm({
            ...form,
            translations: {
              ...form.translations,
              es: { ...form.translations.es, title: event.target.value },
            },
          })
        }
        placeholder="Título ES"
      />
      <Textarea
        aria-label="Hero descripción es"
        value={form.translations.es.description ?? ""}
        onChange={(event) =>
          setForm({
            ...form,
            translations: {
              ...form.translations,
              es: { ...form.translations.es, description: event.target.value },
            },
          })
        }
        placeholder="Descripción ES"
      />
      <Input
        required
        aria-label="Hero título en"
        value={form.translations.en.title}
        onChange={(event) =>
          setForm({
            ...form,
            translations: {
              ...form.translations,
              en: { ...form.translations.en, title: event.target.value },
            },
          })
        }
        placeholder="Title EN"
      />
      <Textarea
        aria-label="Hero descripción en"
        value={form.translations.en.description ?? ""}
        onChange={(event) =>
          setForm({
            ...form,
            translations: {
              ...form.translations,
              en: { ...form.translations.en, description: event.target.value },
            },
          })
        }
        placeholder="Description EN"
      />
      <Input
        aria-label="CTA Hero"
        value={form.cta_url ?? ""}
        onChange={(event) => setForm({ ...form, cta_url: event.target.value || null })}
        placeholder="/tienda o https://…"
      />
      <Input
        aria-label="Color Hero"
        value={form.background_color ?? ""}
        onChange={(event) => setForm({ ...form, background_color: event.target.value || null })}
        placeholder="#00AFAA"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          type="datetime-local"
          aria-label="Inicio Hero"
          value={toDateTimeLocal(form.starts_at)}
          onChange={(event) => setForm({ ...form, starts_at: toIso(event.target.value) })}
        />
        <Input
          type="datetime-local"
          aria-label="Fin Hero"
          value={toDateTimeLocal(form.ends_at)}
          onChange={(event) => setForm({ ...form, ends_at: toIso(event.target.value) })}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Estado Hero"
          value={form.status}
          onChange={(event) =>
            setForm({ ...form, status: event.target.value as HeroForm["status"] })
          }
        >
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </select>
        <label>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
          />{" "}
          Activo
        </label>
        <Input
          type="number"
          min="0"
          aria-label="Orden Hero"
          value={form.sort_order}
          onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })}
        />
      </div>
      <div>
        <label htmlFor="hero-media">Imagen Hero</label>
        <Input
          id="hero-media"
          accept="image/png,image/jpeg,image/webp"
          type="file"
          onChange={(event) => void onUpload(event.target.files?.[0])}
          disabled={saving}
        />
        {previewUrl ? (
          <img src={previewUrl} alt="Vista previa Hero" className="mt-3 max-h-48 rounded-md" />
        ) : (
          form.media_file_id && (
            <p className="mt-2 text-ui-fg-subtle">
              No fue posible recuperar la vista previa del archivo asociado.
            </p>
          )
        )}
      </div>
      <div className="border-ui-border-base rounded-md border p-3">
        <p className="font-medium">Producto destacado</p>
        {product ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {product.thumbnail && (
              <img src={product.thumbnail} alt="" className="h-10 w-10 rounded object-cover" />
            )}
            <span>{product.title}</span>
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={() => onProductChange(null)}
            >
              Retirar
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-2 flex gap-2">
              <Input
                aria-label="Buscar producto"
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
              />
              <Button type="button" variant="secondary" onClick={() => void onSearchProducts()}>
                Buscar
              </Button>
            </div>
            {products.length > 0 && (
              <ul className="mt-2">
                {products.map((candidate) => (
                  <li key={candidate.id}>
                    <Button
                      type="button"
                      variant="transparent"
                      onClick={() => onProductChange(candidate)}
                    >
                      {candidate.title}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <Button type="submit" isLoading={saving}>
        {editingId ? "Guardar cambios" : "Crear Hero"}
      </Button>
    </form>
  </Container>
)
