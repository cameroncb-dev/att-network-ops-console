import { createPlanner } from "@/lib/agent/provider"
import { executeTool } from "@/lib/agent/tools"
import { isOpenState, slaStatus } from "@/lib/incidents/sla"
import type { Incident } from "@/lib/incidents/types"
import type { AgentEvent, AgentPlanner, AgentScope, PlannerInput, ToolObservation } from "@/lib/agent/types"

const MAX_TOOL_CALLS = 6

export function buildBriefing(scope: AgentScope, incidents: Incident[]): string {
  if (scope.type === "incident") {
    const incident = incidents.find((item) => item.number === scope.number)
    if (!incident) {
      return `${scope.number} is not in the incident feed.`
    }
    return `Review ${incident.number} (${incident.priority}, ${incident.state}) on ${incident.configurationItem} in ${incident.location}. Service is ${incident.service}, region is ${incident.region}.`
  }
  const open = incidents.filter((incident) => isOpenState(incident.state))
  const breached = open.filter((incident) => slaStatus(incident) === "breached")
  const critical = open.filter((incident) => incident.priority.startsWith("1"))
  return `Triage ${open.length} open incidents. ${critical.length} are priority 1 and ${breached.length} are past SLA.`
}

export function runAgentLoop(
  scope: AgentScope,
  incidents: Incident[],
  planner: AgentPlanner = createPlanner(),
): AgentEvent[] {
  const briefing = buildBriefing(scope, incidents)
  const observations: ToolObservation[] = []
  const events: AgentEvent[] = []
  let step = 0
  const nextId = () => {
    step += 1
    return `step-${step}`
  }
  const input = (): PlannerInput => ({ scope, briefing, observations })

  events.push({ id: nextId(), kind: "plan", text: planner.plan(input()) })

  for (let toolCalls = 0; toolCalls < MAX_TOOL_CALLS; toolCalls += 1) {
    const decision = planner.decide(input())
    if (decision.type === "stop") {
      events.push({ id: nextId(), kind: "stop", text: decision.text })
      return events
    }
    if (decision.type === "recommend") {
      events.push({ id: nextId(), kind: "recommendation", recommendation: decision.recommendation })
      return events
    }
    events.push({
      id: nextId(),
      kind: "tool_call",
      tool: decision.tool,
      args: decision.args,
      reason: decision.reason,
    })
    const result = executeTool(decision.tool, decision.args, incidents)
    observations.push(result)
    events.push({
      id: nextId(),
      kind: "tool_result",
      tool: result.tool,
      summary: result.summary,
      recordNumbers: result.recordNumbers,
    })
  }

  throw new Error("Agent stopped: step budget exhausted before a recommendation.")
}
