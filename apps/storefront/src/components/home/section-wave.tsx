type SectionWaveProps = {
  fill: string
  className?: string
}

/**
 * Separador ondulado recuperado del sitio histórico. Evita el corte recto
 * entre secciones y mantiene la transición de color original.
 */
export function SectionWave({ fill, className = "" }: SectionWaveProps) {
  return (
    <svg
      viewBox="0 0 1440 160"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`pointer-events-none absolute -bottom-px left-0 h-[clamp(3.5rem,6vw,6.5rem)] w-full ${className}`}
    >
      <path
        d="M0 132C110 102 216 95 319 100C422 105 517 129 629 136C741 143 853 133 962 118C1071 103 1177 83 1286 81C1346 80 1397 85 1440 92V160H0Z"
        fill={fill}
      />
    </svg>
  )
}
