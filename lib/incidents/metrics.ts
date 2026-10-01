import { OPERATIONS_CLOCK_ISO } from "@/lib/incidents/clock"
import { isOpenState, slaStatus } from "@/lib/incidents/sla"
import { REGIONS, SERVICES, type Incident, type Region, type Service } from "@/lib/incidents/types"

export type Analytics = {
  total: number
  open: number
  resolved: number
  slaAttainment: number | null
  slaMet: number
  slaEvaluated: number
  mttrHours: number | null
  byService: { service: Service; count: number }[]
  byRegion: { region: Region; count: number }[]
  openVsResolved: { status: "open" | "resolved"; count: number }[]
  mttrByService: { service: Service; hours: number }[]
  trend: { day: string; opened: number; resolved: number }[]
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function trendDays(): string[] {
  const end = Date.parse(`${OPERATIONS_CLOCK_ISO.slice(0, 10)}T00:00:00.000Z`)
  const days: string[] = []
  for (let offset = 13; offset >= 0; offset -= 1) {
    days.push(new Date(end - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  }
  return days
}

export function resolveHours(incident: Incident): number | null {
  if (isOpenState(incident.state) || !incident.resolvedAt) return null
  return (Date.parse(incident.resolvedAt) - Date.parse(incident.openedAt)) / 3600000
}

export function computeAnalytics(incidents: Incident[]): Analytics {
  const open = incidents.filter((incident) => isOpenState(incident.state))
  const resolvedRecords = incidents.filter((incident) => !isOpenState(incident.state))
  let slaMet = 0
  let slaEvaluated = 0
  for (const incident of incidents) {
    const status = slaStatus(incident)
    if (status === "met") {
      slaMet += 1
      slaEvaluated += 1
    } else if (status === "missed" || status === "breached") {
      slaEvaluated += 1
    }
  }

  const mttrSamples = resolvedRecords
    .map((incident) => resolveHours(incident))
    .filter((hours): hours is number => hours != null)

  const byService = SERVICES.map((service) => ({
    service,
    count: incidents.filter((incident) => incident.service === service).length,
  }))
  const byRegion = REGIONS.map((region) => ({
    region,
    count: incidents.filter((incident) => incident.region === region).length,
  }))

  const mttrByService = SERVICES.flatMap((service) => {
    const samples = resolvedRecords
      .filter((incident) => incident.service === service)
      .map((incident) => resolveHours(incident))
      .filter((hours): hours is number => hours != null)
    const hours = mean(samples)
    return hours == null ? [] : [{ service, hours }]
  })

  const days = trendDays()
  const trend = days.map((day) => ({
    day,
    opened: incidents.filter((incident) => dayKey(incident.openedAt) === day).length,
    resolved: resolvedRecords.filter((incident) => incident.resolvedAt && dayKey(incident.resolvedAt) === day).length,
  }))

  return {
    total: incidents.length,
    open: open.length,
    resolved: resolvedRecords.length,
    slaAttainment: slaEvaluated === 0 ? null : (slaMet / slaEvaluated) * 100,
    slaMet,
    slaEvaluated,
    mttrHours: mean(mttrSamples),
    byService,
    byRegion,
    openVsResolved: [
      { status: "open", count: open.length },
      { status: "resolved", count: resolvedRecords.length },
    ],
    mttrByService,
    trend,
  }
}
