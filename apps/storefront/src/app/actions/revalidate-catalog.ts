"use server"

import { revalidateTag } from "next/cache"

/** Invalida la lectura CMS antes de reintentar una vista que falló. */
export async function revalidateCatalogContent() {
  revalidateTag("jovy-content", { expire: 0 })
}
