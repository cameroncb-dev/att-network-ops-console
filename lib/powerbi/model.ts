import { OPERATIONS_CLOCK_ISO } from "@/lib/incidents/clock"
import { buildSeed } from "@/lib/incidents/seed"
import { resolveHours } from "@/lib/incidents/metrics"
import { isOpenState, slaStatus } from "@/lib/incidents/sla"
import { ASSIGNMENT_GROUPS, REGIONS, SERVICES, type Incident } from "@/lib/incidents/types"

export type CsvTable = {
  name: string
  headers: string[]
  rows: (string | number)[][]
}

function dateKey(iso: string): number {
  return Number(iso.slice(0, 10).replaceAll("-", ""))
}

function addDays(isoDay: string, days: number): string {
  return new Date(Date.parse(`${isoDay}T00:00:00.000Z`) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function formatHours(hours: number): string {
  return String(Math.round(hours * 1_000_000) / 1_000_000)
}

function indexKeys<T extends string>(values: readonly T[]): Map<T, number> {
  return new Map(values.map((value, index) => [value, index + 1]))
}

export function buildPowerBiTables(incidents: Incident[] = buildSeed()): CsvTable[] {
  const serviceKeys = indexKeys(SERVICES)
  const regionKeys = indexKeys(REGIONS)
  const groupKeys = indexKeys(ASSIGNMENT_GROUPS)

  const factRows = [...incidents]
    .sort((a, b) => a.number.localeCompare(b.number))
    .map((incident) => {
      const open = isOpenState(incident.state)
      const status = slaStatus(incident)
      const hours = resolveHours(incident)
      const evaluated = status === "met" || status === "missed" || status === "breached"
      return [
        incident.number,
        serviceKeys.get(incident.service)!,
        regionKeys.get(incident.region)!,
        groupKeys.get(incident.assignmentGroup)!,
        dateKey(incident.openedAt),
        incident.resolvedAt ? dateKey(incident.resolvedAt) : "",
        incident.priority,
        incident.state,
        open ? "Open" : "Resolved",
        open ? 1 : 0,
        status,
        status === "met" ? 1 : 0,
        evaluated ? 1 : 0,
        hours == null ? "" : formatHours(hours),
        incident.shortDescription,
      ]
    })

  const daySet = new Set<string>([OPERATIONS_CLOCK_ISO.slice(0, 10)])
  for (const incident of incidents) {
    daySet.add(incident.openedAt.slice(0, 10))
    if (incident.resolvedAt) daySet.add(incident.resolvedAt.slice(0, 10))
  }
  const sortedDays = [...daySet].sort()
  const first = sortedDays[0]!
  const last = sortedDays.at(-1)!
  const dateRows: (string | number)[][] = []
  for (let day = first; day <= last; day = addDays(day, 1)) {
    const stamp = new Date(`${day}T00:00:00.000Z`)
    dateRows.push([
      dateKey(`${day}T00:00:00.000Z`),
      day,
      stamp.getUTCFullYear(),
      stamp.getUTCMonth() + 1,
      new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(stamp),
      stamp.getUTCDate(),
    ])
  }

  return [
    {
      name: "fact_incidents",
      headers: [
        "incident_number",
        "service_key",
        "region_key",
        "assignment_group_key",
        "opened_date_key",
        "resolved_date_key",
        "priority",
        "state",
        "outcome",
        "is_open",
        "sla_status",
        "sla_met",
        "sla_evaluated",
        "resolve_hours",
        "short_description",
      ],
      rows: factRows,
    },
    {
      name: "dim_service",
      headers: ["service_key", "service"],
      rows: SERVICES.map((service) => [serviceKeys.get(service)!, service]),
    },
    {
      name: "dim_region",
      headers: ["region_key", "region"],
      rows: REGIONS.map((region) => [regionKeys.get(region)!, region]),
    },
    {
      name: "dim_assignment_group",
      headers: ["assignment_group_key", "assignment_group"],
      rows: ASSIGNMENT_GROUPS.map((group) => [groupKeys.get(group)!, group]),
    },
    {
      name: "dim_date",
      headers: ["date_key", "date", "year", "month_number", "month_name", "day"],
      rows: dateRows,
    },
  ]
}

export function tableToCsv(table: CsvTable): string {
  const lines = [table.headers.join(",")]
  for (const row of table.rows) {
    lines.push(row.map(csvCell).join(","))
  }
  return `${lines.join("\n")}\n`
}

function csvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}
