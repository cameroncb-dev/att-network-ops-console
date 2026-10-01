import { isOpenState, riskScore } from "@/lib/incidents/sla"
import type { Incident, IncidentFilters, Region, Service } from "@/lib/incidents/types"

export function filterIncidents(incidents: Incident[], filters: IncidentFilters): Incident[] {
  const query = filters.query.trim().toLowerCase()
  return incidents.filter((incident) => {
    if (filters.priority !== "all" && incident.priority !== filters.priority) return false
    if (filters.state !== "all" && incident.state !== filters.state) return false
    if (filters.assignmentGroup !== "all" && incident.assignmentGroup !== filters.assignmentGroup) return false
    if (filters.service !== "all" && incident.service !== filters.service) return false
    if (!query) return true
    const haystack = [
      incident.number,
      incident.shortDescription,
      incident.description,
      incident.configurationItem,
      incident.location,
      incident.region,
      incident.service,
      incident.assignmentGroup,
      incident.assignedTo,
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(query)
  })
}

export function sortIncidents(incidents: Incident[]): Incident[] {
  return [...incidents].sort((a, b) => {
    const openRank = Number(isOpenState(b.state)) - Number(isOpenState(a.state))
    if (openRank !== 0) return openRank
    const risk = riskScore(b) - riskScore(a)
    if (risk !== 0) return risk
    return Date.parse(b.openedAt) - Date.parse(a.openedAt)
  })
}

export function sliceIncidents(
  incidents: Incident[],
  slice: { service: Service | "all"; region: Region | "all" },
): Incident[] {
  return incidents.filter((incident) => {
    if (slice.service !== "all" && incident.service !== slice.service) return false
    if (slice.region !== "all" && incident.region !== slice.region) return false
    return true
  })
}
