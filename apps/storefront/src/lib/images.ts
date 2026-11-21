/** Construye un srcset para variantes `-<width>.webp` generadas en public/. */
export function responsiveSrcSet(path: string, widths: number[]) {
  const dot = path.lastIndexOf(".")
  if (dot === -1) return undefined
  const base = path.slice(0, dot)
  return widths.map((width) => `${base}-${width}.webp ${width}w`).join(", ")
}

export function isLocalAsset(path: string | null | undefined, prefix: string) {
  return Boolean(path && path.startsWith(prefix))
}
