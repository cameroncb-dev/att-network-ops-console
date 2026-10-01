"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { buildSeed } from "@/lib/incidents/seed"
import { OPERATIONS_CLOCK_MS } from "@/lib/incidents/clock"
import { isOpenState } from "@/lib/incidents/sla"
import { DEFAULT_FILTERS, type AssignmentGroup, type Incident, type IncidentFilters, type IncidentState } from "@/lib/incidents/types"

type FeedStatus = "loading" | "ready" | "error"

type ApplyInput = {
  number: string
  state: IncidentState
  assignmentGroup: AssignmentGroup
  workNote: string
}

type IncidentStore = {
  status: FeedStatus
  error: string | null
  incidents: Incident[]
  filters: IncidentFilters
  setFilters: (filters: IncidentFilters) => void
  reload: () => void
  updateIncident: (number: string, patch: { state: IncidentState; assignmentGroup: AssignmentGroup }) => boolean
  addWorkNote: (number: string, text: string) => boolean
  applyRecommendation: (input: ApplyInput) => boolean
}

const IncidentStoreContext = createContext<IncidentStore | null>(null)

async function loadIncidentFeed(forceError: boolean): Promise<Incident[]> {
  await new Promise((resolve) => setTimeout(resolve, 450))
  if (forceError) {
    throw new Error("The incident feed did not respond. The local seed could not be read.")
  }
  return buildSeed()
}

export function IncidentStoreProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<FeedStatus>("loading")
  const [error, setError] = useState<string | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [filters, setFilters] = useState<IncidentFilters>(DEFAULT_FILTERS)
  const [reloadToken, setReloadToken] = useState(0)
  const stampOffset = useRef(0)
  const incidentsRef = useRef(incidents)
  useEffect(() => {
    incidentsRef.current = incidents
  }, [incidents])

  const nextStamp = useCallback(() => {
    const at = new Date(OPERATIONS_CLOCK_MS + stampOffset.current * 60 * 1000).toISOString()
    stampOffset.current += 1
    return at
  }, [])

  useEffect(() => {
    let cancelled = false
    const forceError = new URLSearchParams(window.location.search).get("feed") === "down" && reloadToken === 0
    loadIncidentFeed(forceError)
      .then((data) => {
        if (cancelled) return
        setIncidents(data)
        setStatus("ready")
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setIncidents([])
        setError(reason instanceof Error ? reason.message : "The incident feed failed.")
        setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const reload = useCallback(() => {
    setStatus("loading")
    setError(null)
    setReloadToken((current) => current + 1)
  }, [])

  const mutate = useCallback((number: string, updater: (incident: Incident) => Incident) => {
    if (!incidentsRef.current.some((incident) => incident.number === number)) return false
    setIncidents((current) => current.map((incident) => (incident.number === number ? updater(incident) : incident)))
    return true
  }, [])

  const updateIncident = useCallback(
    (number: string, patch: { state: IncidentState; assignmentGroup: AssignmentGroup }) => {
      const at = nextStamp()
      return mutate(number, (incident) => ({
        ...incident,
        state: patch.state,
        assignmentGroup: patch.assignmentGroup,
        updatedAt: at,
        resolvedAt: isOpenState(patch.state) ? null : incident.resolvedAt ?? at,
      }))
    },
    [mutate, nextStamp],
  )

  const addWorkNote = useCallback(
    (number: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return false
      const at = nextStamp()
      return mutate(number, (incident) => ({
        ...incident,
        updatedAt: at,
        workNotes: [
          ...incident.workNotes,
          {
            id: `${incident.number}-local-${incident.workNotes.length + 1}`,
            at,
            author: "Duty operator",
            text: trimmed,
          },
        ],
      }))
    },
    [mutate, nextStamp],
  )

  const applyRecommendation = useCallback(
    (input: ApplyInput) => {
      const trimmed = input.workNote.trim()
      if (!trimmed) return false
      const at = nextStamp()
      return mutate(input.number, (incident) => ({
        ...incident,
        state: input.state,
        assignmentGroup: input.assignmentGroup,
        updatedAt: at,
        resolvedAt: isOpenState(input.state) ? null : incident.resolvedAt ?? at,
        workNotes: [
          ...incident.workNotes,
          {
            id: `${incident.number}-agent-${incident.workNotes.length + 1}`,
            at,
            author: "Ops Agent",
            text: trimmed,
          },
        ],
      }))
    },
    [mutate, nextStamp],
  )

  const value = useMemo<IncidentStore>(
    () => ({
      status,
      error,
      incidents,
      filters,
      setFilters,
      reload,
      updateIncident,
      addWorkNote,
      applyRecommendation,
    }),
    [status, error, incidents, filters, reload, updateIncident, addWorkNote, applyRecommendation],
  )

  return <IncidentStoreContext.Provider value={value}>{children}</IncidentStoreContext.Provider>
}

export function useIncidentStore(): IncidentStore {
  const store = useContext(IncidentStoreContext)
  if (!store) throw new Error("useIncidentStore must be used inside IncidentStoreProvider")
  return store
}
