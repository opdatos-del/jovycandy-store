import { AdminDialog, type AdminDialogWidth } from "@admin/shared/components/admin-dialog"
import type { ReactNode, RefObject } from "react"

type ContactDialogProps = {
  title: string
  titleId: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: Extract<AdminDialogWidth, "md" | "lg" | "xl">
  initialFocusRef?: RefObject<HTMLElement | null>
}

/**
 * Adaptador de dominio del diálogo compartido. Mantiene el testid histórico
 * de la bandeja y delega foco, Escape, scroll y restauración en AdminDialog.
 */
export function ContactDialog({ width = "lg", ...props }: ContactDialogProps) {
  return (
    <AdminDialog
      {...props}
      width={width}
      backdropTestId="contact-dialog-backdrop"
    />
  )
}
