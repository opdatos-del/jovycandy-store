type SkeletonProps = {
  className?: string
  height?: number | string
  width?: number | string
}

/** Bloque de carga con la misma geometría que el contenido final. */
export function Skeleton({ className = "", height, width }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`jovy-skeleton block ${className}`}
      style={{ height, width }}
    />
  )
}
