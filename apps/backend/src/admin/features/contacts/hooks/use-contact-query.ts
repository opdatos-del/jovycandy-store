import { useCallback, useEffect, useRef, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { contactsApi } from "../api/contacts-api"
import {
  mergeSeenIds,
  newContactIds,
  type Contact,
  type ContactCounts,
  type ContactStatusFilter,
  type ContactType,
} from "../components/inbox"

type QueryOptions = {
  listType?: ContactType
  statusFilter: ContactStatusFilter
  search: string
  dateFrom: string
  dateTo: string
  limit: number
  page: number
  queryVersion: number
}

type ReloadOptions = { silent?: boolean; manual?: boolean; force?: boolean }

/**
 * Estado del servidor de la bandeja: lista paginada, contadores y polling.
 * La UI mantiene los filtros; este hook solo traduce filtros a peticiones y
 * conserva la detección de solicitudes nuevas entre refrescos.
 */
export function useContactQuery({
  listType,
  statusFilter,
  search,
  dateFrom,
  dateTo,
  limit,
  page,
  queryVersion,
}: QueryOptions) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [counts, setCounts] = useState<ContactCounts | null>(null)
  const [countsError, setCountsError] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  const requestIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const countsRequestRef = useRef(0)
  const seenIdsRef = useRef<Set<string> | null>(null)
  const sessionStartRef = useRef(Date.now())
  const filterKey = [listType ?? "", statusFilter, search, dateFrom, dateTo, limit].join("|")

  // Un cambio de filtro invalida la detección de novedades y los datos visibles.
  useEffect(() => {
    seenIdsRef.current = null
    sessionStartRef.current = Date.now()
    setNewIds(new Set())
    setContacts([])
    setTotal(0)
    setListError(null)
  }, [filterKey])

  const reload = useCallback(
    async (options?: ReloadOptions) => {
      if (options?.silent && !options?.force && inFlightRef.current) return
      const requestId = ++requestIdRef.current
      inFlightRef.current = true
      if (options?.manual) setRefreshing(true)
      if (!options?.silent) setLoading(true)

      try {
        const result = await contactsApi.list({
          contactType: listType,
          status: statusFilter,
          q: search,
          dateFrom,
          dateTo,
          limit,
          offset: (page - 1) * limit,
        })
        if (requestId !== requestIdRef.current) return

        const previous = seenIdsRef.current
        const appeared = newContactIds(previous, result.contacts, sessionStartRef.current)
        seenIdsRef.current = mergeSeenIds(previous ?? new Set(), result.contacts)
        setContacts(result.contacts)
        setTotal(result.count)
        setListError(null)
        if (appeared.size > 0) {
          setNewIds((current) => new Set([...current, ...appeared]))
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setListError(errorMessage(error, "No se pudieron cargar las solicitudes."))
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
          setRefreshing(false)
          inFlightRef.current = false
        }
      }
    },
    [listType, statusFilter, search, dateFrom, dateTo, limit, page],
  )

  const loadCounts = useCallback(async (silent = false) => {
    const requestId = ++countsRequestRef.current
    try {
      const result = await contactsApi.counts()
      if (requestId !== countsRequestRef.current) return
      setCounts(result.counts)
      setCountsError(null)
    } catch (error) {
      if (requestId === countsRequestRef.current && !silent) {
        setCountsError(errorMessage(error, "No se pudieron cargar los contadores."))
      }
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, queryVersion])

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  return {
    contacts,
    total,
    loading,
    refreshing,
    listError,
    counts,
    countsError,
    newIds,
    setNewIds,
    reload,
    loadCounts,
  }
}
