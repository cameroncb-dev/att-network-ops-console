import type { Incident, IncidentState, Priority } from "@/lib/incidents/types"
import { OPERATIONS_CLOCK_MS } from "@/lib/incidents/clock"

export type SlaStatus = "breached" | "at-risk" | "within" | "met" | "missed"

const PRIORITY_TARGET_HOURS: Record<Priority, number> = {
  "1 - Critical": 4,
  "2 - High": 8,
  "3 - Moderate": 24,
  "4 - Low": 72,
}

export function slaTargetHours(priority: Priority): number {
  return PRIORITY_TARGET_HOURS[priority]
}

export function isOpenState(state: IncidentState): boolean {
  return state === "New" || state === "In Progress" || state === "On Hold"
}

export function slaStatus(incident: Incident, now = OPERATIONS_CLOCK_MS): SlaStatus {
  const due = Date.parse(incident.slaDueAt)
  if (!isOpenState(incident.state)) {
    const resolved = Date.parse(incident.resolvedAt ?? incident.updatedAt)
    return resolved <= due ? "met" : "missed"
  }
  if (now > due) return "breached"
  if (due - now <= 60 * 60 * 1000) return "at-risk"
  return "within"
}

/**
 * Base queue risk before repeat-pattern weight.
 * The ops agent adds weight only after the pattern tool returns.
 * New is 5 and On Hold is 8 so a lone breached P1 on hold can outrank
 * a breached P1 that is new, until a configuration-item pattern flips it.
 */
export function riskScore(incident: Incident, now = OPERATIONS_CLOCK_MS): number {
  if (!isOpenState(incident.state)) return 0
  const priorityScore: Record<Priority, number> = {
    "1 - Critical": 100,
    "2 - High": 70,
    "3 - Moderate": 40,
    "4 - Low": 10,
  }
  const sla = slaStatus(incident, now)
  const slaScore = sla === "breached" ? 50 : sla === "at-risk" ? 25 : 0
  const stateScore = incident.state === "New" ? 5 : incident.state === "On Hold" ? 8 : 0
  return priorityScore[incident.priority] + slaScore + stateScore
}

export function noteSuggestsRestored(text: string): boolean {
  const restored = /restored|alarm cleared|service verified|bgp established/i.test(text)
  const negative = /not restored|still down|still alarmed|customer impact remains|flapping/i.test(text)
  return restored && !negative
}

export function formatDuration(hours: number): string {
  const abs = Math.abs(hours)
  if (abs < 1) return `${Math.max(1, Math.round(abs * 60))}m`
  if (abs < 48) {
    const rounded = abs < 10 ? Math.round(abs * 10) / 10 : Math.round(abs)
    return `${rounded}h`
  }
  return `${Math.round(abs / 24)}d`
}

export function slaLabel(incident: Incident, now = OPERATIONS_CLOCK_MS): string {
  const status = slaStatus(incident, now)
  const due = Date.parse(incident.slaDueAt)
  if (status === "breached") return `Breached ${formatDuration((now - due) / 3600000)}`
  if (status === "at-risk" || status === "within") return `Due ${formatDuration((due - now) / 3600000)}`
  if (status === "met") return "Met"
  return "Missed"
}
