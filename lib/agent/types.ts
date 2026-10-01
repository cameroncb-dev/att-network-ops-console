import type { AssignmentGroup, IncidentState } from "@/lib/incidents/types"

export type AgentScope = { type: "queue" } | { type: "incident"; number: string }

export type ToolName =
  | "search_incidents"
  | "summarize_incident"
  | "recommend_assignment"
  | "draft_work_note"
  | "flag_repeat_patterns"

export type RankedIncident = {
  number: string
  shortDescription: string
  priority: string
  state: string
  service: string
  region: string
  assignmentGroup: string
  configurationItem: string
  slaStatus: string
  riskScore: number
}

export type SearchData = {
  total: number
  numbers: string[]
  openNumbers: string[]
  ranked: RankedIncident[]
}

export type SummaryData = {
  number: string
  shortDescription: string
  description: string
  priority: string
  state: IncidentState
  assignmentGroup: AssignmentGroup
  assignedTo: string
  service: string
  region: string
  location: string
  configurationItem: string
  slaStatus: string
  slaLabel: string
  slaDueAt: string
  openedAt: string
  lastNote: string | null
  lastNoteSuggestsRestored: boolean
  openSiblingNumbers: string[]
  narrative: string
}

export type AssignmentData = {
  number: string
  currentGroup: AssignmentGroup
  recommendedGroup: AssignmentGroup
  reason: string
  supportingNumbers: string[]
}

export type NoteData = {
  number: string
  note: string
}

export type Pattern = {
  kind: "configuration_item" | "service_region" | "keyword"
  key: string
  numbers: string[]
  summary: string
}

export type PatternData = {
  patterns: Pattern[]
}

export type ToolObservation =
  | { tool: "search_incidents"; args: Record<string, unknown>; summary: string; recordNumbers: string[]; data: SearchData }
  | { tool: "summarize_incident"; args: Record<string, unknown>; summary: string; recordNumbers: string[]; data: SummaryData }
  | { tool: "recommend_assignment"; args: Record<string, unknown>; summary: string; recordNumbers: string[]; data: AssignmentData }
  | { tool: "draft_work_note"; args: Record<string, unknown>; summary: string; recordNumbers: string[]; data: NoteData }
  | { tool: "flag_repeat_patterns"; args: Record<string, unknown>; summary: string; recordNumbers: string[]; data: PatternData }

export type Recommendation = {
  incidentNumber: string
  shortDescription: string
  currentState: IncidentState
  proposedState: IncidentState
  currentAssignmentGroup: AssignmentGroup
  proposedAssignmentGroup: AssignmentGroup
  workNote: string
  rationale: string
  evidenceNumbers: string[]
}

export type AgentDecision =
  | { type: "tool"; tool: ToolName; args: Record<string, unknown>; reason: string }
  | { type: "recommend"; recommendation: Recommendation }
  | { type: "stop"; text: string }

export type AgentEvent =
  | { id: string; kind: "plan"; text: string }
  | { id: string; kind: "tool_call"; tool: ToolName; args: Record<string, unknown>; reason: string }
  | { id: string; kind: "tool_result"; tool: ToolName; summary: string; recordNumbers: string[] }
  | { id: string; kind: "recommendation"; recommendation: Recommendation }
  | { id: string; kind: "stop"; text: string }

export type PlannerInput = {
  scope: AgentScope
  briefing: string
  observations: ToolObservation[]
}

export interface AgentPlanner {
  readonly id: "local-heuristic" | "azure-openai"
  plan(input: PlannerInput): string
  decide(input: PlannerInput): AgentDecision
}
