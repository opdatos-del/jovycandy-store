import Link from "next/link"
import { notFound } from "next/navigation"

import { ArrowRightIcon } from "@/components/icons"
import { ContactTrigger } from "@/components/contact-trigger"
import { getHomeContent } from "@/lib/cms/client"
import { responsiveSrcSet } from "@/lib/images"
import { getDictionary, isLocale } from "@/lib/i18n"

type ProductPageProps = {
  params: Promise<{ locale: string; handle: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, handle } = await params
  if (!isLocale(locale)) notFound()
  const dictionary = getDictionary(locale)
  const content = await getHomeContent(locale)
  const product = content.products.find((item) => item.handle === handle)

  if (!product) notFound()

  return (
    <main className="bg-[#fffaf0] pb-20 pt-28 sm:pt-32">
      <div className="page-shell-wide">
        <Link href={`/${locale}/catalogo`} className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500 hover:text-[#0d3b6e]">
          â† {dictionary.catalog.title}
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#fff5d4]">
              {product.thumbnail ? <img src={product.thumbnail.startsWith("/assets/catalog/products/") ? product.thumbnail.replace(/\.webp$/, "-640.webp") : product.thumbnail} srcSet={product.thumbnail.startsWith("/assets/catalog/products/") ? responsiveSrcSet(product.thumbnail, [400, 640]) : undefined} sizes="(max-width: 1024px) 90vw, 45vw" alt={product.title} className="h-full w-full object-contain p-6" width={640} height={640} /> : null}
            </div>
          </div>

          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-[#b4234a]">{product.family?.name ?? dictionary.nav.store}</p>
            <h1 className="mt-2 text-4xl font-black uppercase leading-tight tracking-[0.01em] text-[#0d3b6e] sm:text-5xl">{product.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white ${product.commercialMode === "SELLABLE" ? "bg-[#00afaa]" : "bg-stone-500"}`}>
                {product.commercialMode}
              </span>
              {product.gramaje ? <span className="rounded-full bg-stone-100 px-3 py-1 text-[0.65rem] font-semibold text-stone-600">{dictionary.catalog.weight}: {product.gramaje}</span> : null}
              {product.certifications.map((certification) => (
                <span key={certification} className="rounded-full bg-[#00afaa]/10 px-3 py-1 text-[0.65rem] font-semibold text-[#007d79]">{certification}</span>
              ))}
            </div>

            <p className="mt-5 text-sm leading-7 text-stone-600">
              {product.commercialMode === "SELLABLE"
                ? "Producto disponible para compra. La validaciÃ³n comercial se ejecuta en el servidor de Medusa."
                : "Producto informativo. Su compra no estÃ¡ habilitada; solicita informaciÃ³n o el catÃ¡logo completo."}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {product.commercialMode === "SELLABLE" ? (
                <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0d3b6e] px-6 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-white opacity-60" title="Carrito en preparaciÃ³n">
                  {dictionary.catalog.viewDetails}
                </button>
              ) : null}
              <ContactTrigger className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0d3b6e]/25 bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-[#0d3b6e]">
                {dictionary.contact.title}
                <ArrowRightIcon className="h-4 w-4" />
              </ContactTrigger>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export const instant = false


