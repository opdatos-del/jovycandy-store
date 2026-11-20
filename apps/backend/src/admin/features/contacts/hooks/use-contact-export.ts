import { useState } from "react"
import { errorMessage, saveBlob } from "@admin/shared/lib/admin-api"
import { contactsApi } from "../api/contacts-api"
import {
  CONTACT_TYPE_LABELS,
  type ContactExportFormat,
  type ContactStatusFilter,
  type ContactType,
} from "../components/inbox"

type ContactExportOptions = {
  exportType: ContactType | null
  typeFilter: ContactType | ""
  statusFilter: ContactStatusFilter
  search: string
  dateFrom: string
  dateTo: string
  onStart?: () => void
  onNotice: (message: string) => void
  onError: (message: string) => void
}

/**
 * Descargas de la bandeja y del libro consolidado. Mantiene solo el estado de
 * progreso y deja los avisos en la pantalla para no duplicar el sistema de
 * notificaciones.
 */
export function useContactExport({
  exportType,
  typeFilter,
  statusFilter,
  search,
  dateFrom,
  dateTo,
  onStart,
  onNotice,
  onError,
}: ContactExportOptions) {
  const [exportingFormat, setExportingFormat] = useState<ContactExportFormat | null>(null)
  const [exportingAll, setExportingAll] = useState(false)

  const runExport = async (format: ContactExportFormat) => {
    if (!exportType) return
    onStart?.()
    setExportingFormat(format)
    try {
      const download = await contactsApi.exportInbox(exportType, format, {
        status: statusFilter,
        q: search,
        dateFrom,
        dateTo,
      })
      saveBlob(download.blob, download.fileName)

      const count = download.count ?? 0
      const label = format === "xlsx" ? "Excel" : "CSV"
      onNotice(
        `${label} exportado: ${count} ${count === 1 ? "solicitud" : "solicitudes"} de ${CONTACT_TYPE_LABELS[exportType]}.`,
      )
    } catch (error) {
      onError(errorMessage(error, "No se pudo exportar la bandeja."))
    } finally {
      setExportingFormat(null)
    }
  }

  const runExportAll = async () => {
    if (exportType) return
    onStart?.()
    setExportingAll(true)
    try {
      const download = await contactsApi.exportAll({
        contactTypes: typeFilter ? [typeFilter] : undefined,
        status: statusFilter,
        q: search,
        dateFrom,
        dateTo,
      })
      saveBlob(download.blob, download.fileName)

      const count = download.count ?? 0
      const sheets = download.sheets ?? 0
      onNotice(
        `Excel consolidado: ${count} ${count === 1 ? "solicitud" : "solicitudes"} en ${sheets} ${sheets === 1 ? "bandeja" : "bandejas"}.`,
      )
    } catch (error) {
      onError(errorMessage(error, "No se pudo exportar el consolidado."))
    } finally {
      setExportingAll(false)
    }
  }

  return { exportingFormat, exportingAll, runExport, runExportAll }
}
