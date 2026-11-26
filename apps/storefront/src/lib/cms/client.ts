import { cacheLife, cacheTag } from "next/cache"

import type { Locale } from "@/lib/i18n"
import {
  MEDUSA_BACKEND_URL as BACKEND,
  MEDUSA_PUBLISHABLE_API_KEY as PUBLISHABLE_KEY,
} from "@/lib/medusa/config"

const REQUEST_TIMEOUT_MS = 4_000

export type CmsCategory = {
  key: string
  name: string
  description: string | null
  image: string | null
  hoverImage: string | null
  accent: string
  active: boolean
  comingSoon: boolean
  interactionLocked: boolean
}

export type CmsProduct = {
  id: string
  productId: string | null
  title: string
  handle: string | null
  thumbnail: string | null
  commercialMode: "SELLABLE" | "CATALOG_ONLY"
  gramaje: string | null
  certifications: string[]
  isNew: boolean
  categoryKeys: string[]
  family: { id: string; slug: string; name: string; cardPreset?: string | null } | null
}

export type CmsEvent = {
  id: string
  title: string
  description: string | null
  image: string | null
  video: string | null
  startsAt: string | null
}

export type CmsGalleryItem = {
  id: string
  title: string
  description: string | null
  image: string
}

export type CmsBanner = {
  id: string
  title: string
  description: string | null
  alt: string
  ctaLabel: string | null
  ctaUrl: string | null
  image: string | null
  autoOpen: boolean
  frequency: "every" | "session" | "daily" | "once"
  rotationSeconds: number
}

export type CmsAnnouncement = {
  es: string
  en: string
}

export type HomeContent = {
  hero: {
    id: string
    title: string
    description: string | null
    ctaLabel: string | null
    ctaUrl: string | null
    image: string | null
    backgroundColor: string | null
  } | null
  promo: CmsBanner[]
  categories: CmsCategory[]
  products: CmsProduct[]
  productsAvailable: boolean
  events: CmsEvent[]
  gallery: CmsGalleryItem[]
  announcement: CmsAnnouncement | null
}

type RawCategory = {
  key: string
  name: string
  description?: string | null
  active?: boolean
  coming_soon?: boolean
  interaction_locked?: boolean
  image_url?: string | null
}

type RawProduct = {
  id: string
  commercial_mode?: string | null
  gramaje?: string | null
  certifications?: string[] | null
  is_new?: boolean | null
  category_keys?: string[] | null
  product?: {
    id?: string
    title?: string
    handle?: string
    thumbnail?: string | null
  } | null
  family?: { id?: string; slug?: string; name?: string; card_preset?: string | null } | null
}

type RawBanner = {
  id: string
  translations?: Record<string, { title?: string; alt?: string; description?: string; cta_label?: string }>
  media_url?: string | null
  cta_url?: string | null
  auto_open?: boolean | null
  frequency?: string | null
  rotation_seconds?: number | null
}

type RawEvent = {
  id: string
  title?: string
  description?: string | null
  media_url?: string | null
  image_url?: string | null
  video_url?: string | null
  starts_at?: string | null
}

type RawGalleryItem = {
  id: string
  title?: string
  description?: string | null
  media_url?: string
}

async function jovyGet<T>(path: string): Promise<T | null> {
  if (!PUBLISHABLE_KEY) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${BACKEND}${path}`, {
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        accept: "application/json",
      },
      signal: controller.signal,
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Fallback visual recuperado del sitio oficial mientras el CMS no tenga contenido real. */
export const FALLBACK_CATEGORIES: CmsCategory[] = [
  {
    key: "sazonador",
    name: "Sazonadores",
    description: "Sazonadores Jovy.",
    image: "/assets/brand/isotypes/isotipos-n-01.webp",
    hoverImage: "/assets/catalog/backgrounds/category-cards/sazonador/hover.webp",
    accent: "#FFE400",
    active: true,
    comingSoon: true,
    interactionLocked: true,
  },
  {
    key: "chamoy",
    name: "Grenetina Chamoy",
    description: "Gomitas de grenetina con chamoy.",
    image: "/assets/brand/isotypes/isotipo-chamoy.webp",
    hoverImage: "/assets/catalog/backgrounds/category-cards/chamoy/hover.webp",
    accent: "#E51B41",
    active: true,
    comingSoon: false,
    interactionLocked: false,
  },
  {
    key: "gomitas_almidon",
    name: "Almidón Chamoy",
    description: "Gomitas de almidón con chamoy.",
    image: "/assets/brand/isotypes/isotipos-n-05.webp",
    hoverImage: "/assets/catalog/backgrounds/category-cards/gomitas-almidon/hover.webp",
    accent: "#EC681C",
    active: true,
    comingSoon: false,
    interactionLocked: false,
  },
  {
    key: "dulces_paletas",
    name: "Caramelos y Paletas",
    description: "Caramelos y paletas Jovy.",
    image: "/assets/brand/isotypes/isotipos-n-04.webp",
    hoverImage: "/assets/catalog/backgrounds/category-cards/dulces-paletas/hover.webp",
    accent: "#16A1DC",
    active: true,
    comingSoon: true,
    interactionLocked: true,
  },
  {
    key: "pinatero",
    name: "Piñateros",
    description: "Piñateros y mezclas surtidas.",
    image: "/assets/brand/isotypes/isotipos-n-03.webp",
    hoverImage: "/assets/catalog/backgrounds/category-cards/pinatero/hover.webp",
    accent: "#CB87B9",
    active: true,
    comingSoon: false,
    interactionLocked: false,
  },
  {
    key: "gomitas_grenetina",
    name: "Gomitas Grenetina",
    description: "Gomitas de grenetina.",
    image: "/assets/brand/isotypes/isotipo-gomitas-grenetina.webp",
    hoverImage: "/assets/catalog/backgrounds/category-cards/gomitas-grenetina/hover.webp",
    accent: "#FABD05",
    active: true,
    comingSoon: false,
    interactionLocked: false,
  },
]

export const FALLBACK_PRODUCTS: CmsProduct[] = [
  {
    id: "fallback-mini-sharks",
    productId: null,
    title: "Mini Sharks",
    handle: null,
    thumbnail: "/assets/marketing/hero/mini-sharks.webp",
    commercialMode: "CATALOG_ONLY",
    gramaje: "5 lb",
    certifications: ["SGS"],
    isNew: true,
    categoryKeys: ["pinatero"],
    family: { id: "pinatero", slug: "pinatero", name: "Piñateros" },
  },
  {
    id: "fallback-chamoy-bears",
    productId: null,
    title: "Chamoy Bears",
    handle: null,
    thumbnail: "/assets/catalog/products/chamoy-bears.webp",
    commercialMode: "CATALOG_ONLY",
    gramaje: "5 lb",
    certifications: ["SGS"],
    isNew: false,
    categoryKeys: ["chamoy"],
    family: { id: "chamoy", slug: "chamoy", name: "Grenetina Chamoy" },
  },
  {
    id: "fallback-enchilokas",
    productId: null,
    title: "Enchilokas",
    handle: null,
    thumbnail: "/assets/catalog/products/enchilokas-bowl.webp",
    commercialMode: "CATALOG_ONLY",
    gramaje: "150 g",
    certifications: ["SGS"],
    isNew: false,
    categoryKeys: ["gomitas_almidon"],
    family: { id: "almidon", slug: "almidon", name: "Almidón Chamoy" },
  },
  {
    id: "fallback-gummi-bears",
    productId: null,
    title: "Gummi Bears",
    handle: null,
    thumbnail: "/assets/catalog/products/gummi-bears.webp",
    commercialMode: "CATALOG_ONLY",
    gramaje: "5 lb",
    certifications: ["SGS", "Halal"],
    isNew: false,
    categoryKeys: ["gomitas_grenetina"],
    family: { id: "grenetina", slug: "grenetina", name: "Gomitas Grenetina" },
  },
  {
    id: "fallback-chamoy-bears-bag",
    productId: null,
    title: "Chamoy Bears Bolsa",
    handle: null,
    thumbnail: "/assets/catalog/products/chamoy-bears-bag.webp",
    commercialMode: "CATALOG_ONLY",
    gramaje: "100 g",
    certifications: ["SGS"],
    isNew: false,
    categoryKeys: ["chamoy"],
    family: { id: "chamoy", slug: "chamoy", name: "Grenetina Chamoy" },
  },
  {
    id: "fallback-enchilokas-mango",
    productId: null,
    title: "Enchilokas Mango",
    handle: null,
    thumbnail: "/assets/catalog/products/enchilokas-mango.webp",
    commercialMode: "CATALOG_ONLY",
    gramaje: "5 lb",
    certifications: ["SGS"],
    isNew: false,
    categoryKeys: ["gomitas_almidon"],
    family: { id: "almidon", slug: "almidon", name: "Almidón Chamoy" },
  },
  {
    id: "fallback-enchilokas-watermelon",
    productId: null,
    title: "Enchilokas Sandía",
    handle: null,
    thumbnail: "/assets/catalog/products/enchilokas-watermelon.webp",
    commercialMode: "CATALOG_ONLY",
    gramaje: "5 lb",
    certifications: ["SGS"],
    isNew: false,
    categoryKeys: ["gomitas_almidon"],
    family: { id: "almidon", slug: "almidon", name: "Almidón Chamoy" },
  },
  {
    id: "fallback-gummi-bears-alt",
    productId: null,
    title: "Gummi Bears Surtidos",
    handle: null,
    thumbnail: "/assets/catalog/products/gummi-bears-alt1.webp",
    commercialMode: "CATALOG_ONLY",
    gramaje: "5 lb",
    certifications: ["SGS", "Halal"],
    isNew: false,
    categoryKeys: ["gomitas_grenetina"],
    family: { id: "grenetina", slug: "grenetina", name: "Gomitas Grenetina" },
  },
]

/** Contenido editorial oficial usado solo cuando el CMS no tiene elementos publicados. */
export const FALLBACK_EVENTS: CmsEvent[] = [
  {
    id: "fallback-evento",
    title: "Evento Jovy",
    description: "Novedades y activaciones de la marca.",
    image: "/assets/marketing/events/evento.webp",
    video: null,
    startsAt: null,
  },
  {
    id: "fallback-premium-pinatero",
    title: "Premium Piñatero",
    description: "Mezcla premium para compartir.",
    image: "/assets/marketing/events/premium-pinatero.webp",
    video: null,
    startsAt: null,
  },
  {
    id: "fallback-tropimix",
    title: "Tropimix",
    description: "Sabores tropicales Jovy.",
    image: "/assets/marketing/events/tropimix.webp",
    video: null,
    startsAt: null,
  },
  {
    id: "fallback-revolcados",
    title: "Revolcados Mix",
    description: "Gomitas revolcadas con chamoy.",
    image: "/assets/marketing/events/revolcados-mix.webp",
    video: null,
    startsAt: null,
  },
  {
    id: "fallback-happy-mix",
    title: "Happy Mix",
    description: "Una mezcla para cada momento.",
    image: "/assets/marketing/events/happy-mix.webp",
    video: null,
    startsAt: null,
  },
]

export const FALLBACK_GALLERY: CmsGalleryItem[] = [1, 2, 3, 4].map((index) => ({
  id: `fallback-casa-jovy-${index}`,
  title: `Casa Jovy ${index}`,
  description: null,
  image: `/assets/marketing/about/casa-jovy-${index}.webp`,
}))

function normalizeProduct(raw: RawProduct): CmsProduct | null {
  if (!raw.product?.title) return null
  return {
    id: raw.id,
    productId: raw.product.id ?? null,
    title: raw.product.title,
    handle: raw.product.handle ?? null,
    thumbnail: raw.product.thumbnail ?? null,
    commercialMode: raw.commercial_mode === "SELLABLE" ? "SELLABLE" : "CATALOG_ONLY",
    gramaje: raw.gramaje ?? null,
    certifications: Array.isArray(raw.certifications) ? raw.certifications : [],
    isNew: Boolean(raw.is_new),
    categoryKeys: Array.isArray(raw.category_keys) ? raw.category_keys : [],
    family: raw.family?.name
      ? {
          id: raw.family.id ?? raw.family.slug ?? "",
          slug: raw.family.slug ?? "",
          name: raw.family.name,
          cardPreset: raw.family.card_preset ?? null,
        }
      : null,
  }
}

function normalizeBanner(raw: RawBanner, locale: Locale): CmsBanner {
  const translation = raw.translations?.[locale] ?? raw.translations?.es ?? {}
  const frequency =
    raw.frequency === "every" || raw.frequency === "session" || raw.frequency === "daily" || raw.frequency === "once"
      ? raw.frequency
      : "every"
  return {
    id: raw.id,
    title: translation.title ?? "",
    description: translation.description ?? null,
    alt: translation.alt ?? translation.title ?? "",
    ctaLabel: translation.cta_label ?? null,
    ctaUrl: raw.cta_url ?? null,
    image: raw.media_url ?? null,
    autoOpen: Boolean(raw.auto_open),
    frequency,
    rotationSeconds: typeof raw.rotation_seconds === "number" ? raw.rotation_seconds : 8,
  }
}

export async function getHomeContent(locale: Locale): Promise<HomeContent> {
  "use cache"
  cacheLife("minutes")
  cacheTag("jovy-content")

  const [heroPayload, promoPayload, categoriesPayload, productsPayload, eventsPayload, galleryPayload, announcementPayload] =
    await Promise.all([
      jovyGet<{ hero_items?: Array<{ id: string; translations?: Record<string, { title?: string; description?: string; cta_label?: string }>; media_url?: string | null; cta_url?: string | null; background_color?: string | null }> }>("/store/jovy/marketing/hero"),
      jovyGet<{ banners?: RawBanner[] }>("/store/jovy/marketing/banners/promo"),
      jovyGet<{ categories?: RawCategory[] }>("/store/jovy/catalogue/categories"),
      jovyGet<{ products?: RawProduct[] }>("/store/jovy/products"),
      jovyGet<{ events?: RawEvent[] }>("/store/jovy/events"),
      jovyGet<{ items?: RawGalleryItem[] }>("/store/jovy/brand/gallery"),
      jovyGet<{ settings?: { corporate_message_es?: string | null; corporate_message_en?: string | null } }>("/store/jovy/announcements/settings"),
    ])

  const rawHero = heroPayload?.hero_items?.[0]
  const heroTranslation = rawHero?.translations?.[locale] ?? rawHero?.translations?.es
  const hero = rawHero
    ? {
        id: rawHero.id,
        title: heroTranslation?.title ?? "",
        description: heroTranslation?.description ?? null,
        ctaLabel: heroTranslation?.cta_label ?? null,
        ctaUrl: rawHero.cta_url ?? null,
        image: rawHero.media_url ?? null,
        backgroundColor: rawHero.background_color ?? null,
      }
    : null

  const cmsCategories = (categoriesPayload?.categories ?? []).filter((item) => item.key && item.name)
  const mappedCategories = cmsCategories.map((item) => {
    const fallback = FALLBACK_CATEGORIES.find((category) => category.key === item.key)
    return {
      key: item.key,
      name: item.name,
      description: item.description ?? fallback?.description ?? null,
      image: fallback?.image ?? item.image_url ?? null,
      hoverImage: fallback?.hoverImage ?? null,
      accent: fallback?.accent ?? "#00AFAA",
      active: item.active !== false,
      comingSoon: Boolean(item.coming_soon),
      interactionLocked: Boolean(item.interaction_locked),
    }
  })
  const categories = [
    ...FALLBACK_CATEGORIES.map(
      (fallback) => mappedCategories.find((category) => category.key === fallback.key) ?? fallback,
    ),
    ...mappedCategories.filter(
      (category) => !FALLBACK_CATEGORIES.some((fallback) => fallback.key === category.key),
    ),
  ]

  const products = (productsPayload?.products ?? [])
    .map(normalizeProduct)
    .filter((product): product is CmsProduct => Boolean(product))

  const cmsEvents = (eventsPayload?.events ?? [])
    .filter((event) => event.id)
    .map((event) => ({
      id: event.id,
      title: event.title ?? "Jovy",
      description: event.description ?? null,
      image: event.image_url ?? event.media_url ?? null,
      video: event.video_url ?? null,
      startsAt: event.starts_at ?? null,
    }))

  const cmsGallery = (galleryPayload?.items ?? [])
    .filter((item) => item.media_url)
    .map((item) => ({
      id: item.id,
      title: item.title ?? "Casa Jovy",
      description: item.description ?? null,
      image: item.media_url as string,
    }))
    .filter((item) => !/demo|mermaid|guerrero|defensa/i.test(item.title))

  return {
    hero,
    promo: (promoPayload?.banners ?? [])
      .map((banner) => normalizeBanner(banner, locale))
      .filter((banner) => banner.image && !/demo/i.test(`${banner.title} ${banner.alt}`)),
    categories,
    products: products.length ? products : FALLBACK_PRODUCTS,
    productsAvailable: productsPayload !== null,
    events: cmsEvents.length ? cmsEvents : FALLBACK_EVENTS,
    gallery: cmsGallery.length >= 2 ? cmsGallery : FALLBACK_GALLERY,
    announcement: announcementPayload?.settings
      ? {
          es: announcementPayload.settings.corporate_message_es ?? "",
          en: announcementPayload.settings.corporate_message_en ?? "",
        }
      : null,
  }
}

export function mediaUrl(value: string | null | undefined) {
  if (!value) return ""
  if (/^https?:\/\//.test(value)) return value
  return `${BACKEND}${value.startsWith("/") ? "" : "/"}${value}`
}
