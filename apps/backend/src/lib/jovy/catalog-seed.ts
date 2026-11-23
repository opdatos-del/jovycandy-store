import type { ProductCertification } from "./product-editorial"
import { CATALOGUE_CATEGORY_KEYS } from "./catalogue"

/**
 * Datos base del catálogo Jovy local. Los nombres, presentaciones e imágenes
 * se tomaron de referencias públicas de producto de Jovy; precios y textos son
 * valores de seed para desarrollo y deben editarse desde el Admin antes de
 * cualquier uso comercial.
 */
export type JovySeedCategoryKey = (typeof CATALOGUE_CATEGORY_KEYS)[number]

export type JovySeedCategory = {
  key: JovySeedCategoryKey
  name: string
  handle: string
  familySlug: string
  sortOrder: number
}

export type JovySeedProduct = {
  handle: string
  title: string
  categoryKey: JovySeedCategoryKey
  gramaje: string
  certifications: ProductCertification[]
  commercialMode: "catalog_only" | "sellable"
  isNew?: boolean
  priceMxn: number
  imageFile: string
}

const CDN = "https://cdn.shopify.com/s/files/1/0549/3122/6778/files/"

export const jovySeedImage = (file: string) => `${CDN}${file}?width=800`

export const JOVY_SEED_CATEGORIES: readonly JovySeedCategory[] = [
  { key: "chamoy", name: "Chamoy", handle: "jovy-chamoy", familySlug: "chamoy", sortOrder: 0 },
  {
    key: "gomitas_almidon",
    name: "Gomitas de almidón",
    handle: "jovy-gomitas-almidon",
    familySlug: "gomitas-de-almidon",
    sortOrder: 1,
  },
  {
    key: "dulces_paletas",
    name: "Dulces y paletas",
    handle: "jovy-dulces-paletas",
    familySlug: "dulces-y-paletas",
    sortOrder: 2,
  },
  { key: "pinatero", name: "Piñatero", handle: "jovy-pinatero", familySlug: "pinatero", sortOrder: 3 },
  {
    key: "gomitas_grenetina",
    name: "Gomitas de grenetina",
    handle: "jovy-gomitas-grenetina",
    familySlug: "gomitas-de-grenetina",
    sortOrder: 4,
  },
  { key: "sazonador", name: "Sazonador", handle: "jovy-sazonador", familySlug: "sazonador", sortOrder: 5 },
] as const

export const JOVY_SEED_PRODUCTS: readonly JovySeedProduct[] = [
  {
    handle: "jovy-ositos-surtidos",
    title: "Ositos Surtidos 12 Sabores",
    categoryKey: "gomitas_grenetina",
    gramaje: "6 oz",
    certifications: ["SGS", "Halal"],
    commercialMode: "sellable",
    priceMxn: 45,
    imageFile: "Bears_Gummies.webp",
  },
  {
    handle: "jovy-aros-neon",
    title: "Aros Neón",
    categoryKey: "gomitas_grenetina",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    isNew: true,
    priceMxn: 42,
    imageFile: "Neon_Rings.webp",
  },
  {
    handle: "jovy-gusanos-neon",
    title: "Gusanos Neón",
    categoryKey: "gomitas_grenetina",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    isNew: true,
    priceMxn: 42,
    imageFile: "Neon_Worms.webp",
  },
  {
    handle: "jovy-aros-manzana-verde",
    title: "Aros Sabor Manzana Verde",
    categoryKey: "gomitas_grenetina",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 40,
    imageFile: "Green_Apple_Rings.webp",
  },
  {
    handle: "jovy-rebanadas-sandia",
    title: "Rebanadas de Sandía",
    categoryKey: "gomitas_grenetina",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 40,
    imageFile: "Watermelon_Slices.webp",
  },
  {
    handle: "jovy-gusanos-gomita",
    title: "Gusanos de Gomita",
    categoryKey: "gomitas_grenetina",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 40,
    imageFile: "Worms_Gummies.webp",
  },
  {
    handle: "jovy-aros-sandia",
    title: "Aros Sabor Sandía",
    categoryKey: "gomitas_grenetina",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 40,
    imageFile: "Watermelon_Rings.webp",
  },
  {
    handle: "jovy-aros-durazno",
    title: "Aros Sabor Durazno",
    categoryKey: "gomitas_grenetina",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 40,
    imageFile: "Peach_Shopify.webp",
  },
  {
    handle: "jovy-fruta",
    title: "Jovy Fruit",
    categoryKey: "gomitas_grenetina",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 38,
    imageFile: "Jovy_Fruit.webp",
  },
  {
    handle: "jovy-aros-chamoy-durazno",
    title: "Aros Chamoy Durazno",
    categoryKey: "chamoy",
    gramaje: "5 oz",
    certifications: ["SGS", "Halal"],
    commercialMode: "sellable",
    isNew: true,
    priceMxn: 45,
    imageFile: "Chamoy_Peach_5oz.webp",
  },
  {
    handle: "jovy-enchilokas-mango",
    title: "Enchilokas Mango",
    categoryKey: "gomitas_almidon",
    gramaje: "5.29 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 46,
    imageFile: "Enchilokas_Mango.webp",
  },
  {
    handle: "jovy-mini-gummy-mix",
    title: "Mini Gummy Mix",
    categoryKey: "pinatero",
    gramaje: "5 oz",
    certifications: ["SGS"],
    commercialMode: "catalog_only",
    isNew: true,
    priceMxn: 48,
    imageFile: "1_fe53df9f-aa63-4952-adbc-14de72764e66.png",
  },
  {
    handle: "jovy-caja-surtida",
    title: "Caja Surtida Jovy",
    categoryKey: "pinatero",
    gramaje: "1 kg",
    certifications: ["SGS", "Halal"],
    commercialMode: "catalog_only",
    priceMxn: 180,
    imageFile: "2_6330acb6-2e3c-42fd-a23f-ecb62df64f6b.jpg",
  },
  {
    handle: "jovy-fruit-roll-variedad",
    title: "Variedad de Fruit Roll",
    categoryKey: "pinatero",
    gramaje: "20 piezas",
    certifications: ["SGS"],
    commercialMode: "catalog_only",
    priceMxn: 120,
    imageFile: "1_85cf45a3-a4e6-43e4-ad8f-6d3dd754114f.png",
  },
  {
    handle: "jovy-fruit-roll",
    title: "Fruit Roll Jovy",
    categoryKey: "dulces_paletas",
    gramaje: "48 piezas",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 110,
    imageFile: "0005-9165287929592441906.png",
  },
  {
    handle: "jovy-vallenito",
    title: "Vallenito",
    categoryKey: "dulces_paletas",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 42,
    imageFile: "Vallenito_Assorted.webp",
  },
  {
    handle: "jovy-paleta-mango-revolcado",
    title: "Paleta Mango Revolcado",
    categoryKey: "dulces_paletas",
    gramaje: "10 piezas",
    certifications: ["SGS"],
    commercialMode: "sellable",
    isNew: true,
    priceMxn: 55,
    imageFile: "Mango_Revolcado.webp",
  },
  {
    handle: "jovy-pika-slice-sandia",
    title: "Paleta Pika Slice Sandía",
    categoryKey: "dulces_paletas",
    gramaje: "11 piezas",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 58,
    imageFile: "Pika_Slice.webp",
  },
  {
    handle: "jovy-paleta-elote-revolcado",
    title: "Paleta Elote Revolcado",
    categoryKey: "dulces_paletas",
    gramaje: "11 piezas",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 58,
    imageFile: "Elote_Revolcado.webp",
  },
  {
    handle: "jovy-tamaros",
    title: "Támaros",
    categoryKey: "dulces_paletas",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 42,
    imageFile: "Tamaros.webp",
  },
  {
    handle: "jovy-revolcaditas",
    title: "Revolcaditas",
    categoryKey: "dulces_paletas",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 42,
    imageFile: "Revolcaditas_Assorted.webp",
  },
  {
    handle: "jovy-chilirokas",
    title: "Chilirokas",
    categoryKey: "dulces_paletas",
    gramaje: "6 oz",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 42,
    imageFile: "Chili_Rokas_Assorted.webp",
  },
  {
    handle: "jovy-acirrico",
    title: "Acirrico",
    categoryKey: "sazonador",
    gramaje: "10 piezas",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 35,
    imageFile: "Acirrico_Stacked.webp",
  },
  {
    handle: "jovy-limonazo",
    title: "Limonazo",
    categoryKey: "sazonador",
    gramaje: "10 piezas",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 35,
    imageFile: "Limonazo_Stacked.webp",
  },
  {
    handle: "jovy-acirrico-fire",
    title: "Acirrico Fire",
    categoryKey: "sazonador",
    gramaje: "10 piezas",
    certifications: ["SGS"],
    commercialMode: "sellable",
    priceMxn: 35,
    imageFile: "Acirrico_Fire_Stacked.webp",
  },
] as const

export const JOVY_SEED_PRODUCT_COUNT = JOVY_SEED_PRODUCTS.length
