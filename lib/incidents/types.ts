export const SERVICES = ["5G RAN", "Fiber", "Enterprise VPN", "Voice"] as const
export const REGIONS = ["Northeast", "Southeast", "Midwest", "Southwest", "West"] as const
export const PRIORITIES = ["1 - Critical", "2 - High", "3 - Moderate", "4 - Low"] as const
export const INCIDENT_STATES = ["New", "In Progress", "On Hold", "Resolved", "Closed"] as const
export const ASSIGNMENT_GROUPS = [
  "NOC Tier 1",
  "RAN Performance",
  "5G Core Packet",
  "Fiber Field Operations",
  "Optical Transport",
  "Enterprise VPN",
  "Voice Core",
  "E911 Engineering",
] as const
export const IMPACTS = ["1 - High", "2 - Medium", "3 - Low"] as const
export const SOURCES = ["Alarm correlation", "Field report", "Enterprise care", "E911 desk"] as const

export type Service = (typeof SERVICES)[number]
export type Region = (typeof REGIONS)[number]
export type Priority = (typeof PRIORITIES)[number]
export type IncidentState = (typeof INCIDENT_STATES)[number]
export type AssignmentGroup = (typeof ASSIGNMENT_GROUPS)[number]
export type Impact = (typeof IMPACTS)[number]
export type Source = (typeof SOURCES)[number]

export type WorkNote = {
  id: string
  at: string
  author: string
  text: string
}

export type Incident = {
  number: string
  shortDescription: string
  description: string
  priority: Priority
  state: IncidentState
  assignmentGroup: AssignmentGroup
  assignedTo: string
  service: Service
  region: Region
  configurationItem: string
  location: string
  source: Source
  impact: Impact
  urgency: Impact
  openedAt: string
  updatedAt: string
  resolvedAt: string | null
  slaDueAt: string
  workNotes: WorkNote[]
}

export type IncidentFilters = {
  query: string
  priority: Priority | "all"
  state: IncidentState | "all"
  assignmentGroup: AssignmentGroup | "all"
  service: Service | "all"
}

export const DEFAULT_FILTERS: IncidentFilters = {
  query: "",
  priority: "all",
  state: "all",
  assignmentGroup: "all",
  service: "all",
}
