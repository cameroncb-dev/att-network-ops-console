import { isOpenState } from "@/lib/incidents/sla"
import type { IncidentState } from "@/lib/incidents/types"
import type { AgentDecision, AgentPlanner, Pattern, PlannerInput, RankedIncident, ToolObservation } from "@/lib/agent/types"

export const CI_PATTERN_WEIGHT = 30

function findTool<T extends ToolObservation["tool"]>(observations: ToolObservation[], tool: T) {
  return observations.find((observation) => observation.tool === tool) as Extract<ToolObservation, { tool: T }> | undefined
}

function chooseState(summary: Extract<ToolObservation, { tool: "summarize_incident" }>["data"]): IncidentState {
  if (!isOpenState(summary.state)) return summary.state
  if (summary.lastNoteSuggestsRestored && summary.openSiblingNumbers.length === 0) return "Resolved"
  if (summary.state === "New") return "In Progress"
  if (summary.state === "On Hold" && (summary.slaStatus === "breached" || summary.slaStatus === "at-risk")) {
    return "In Progress"
  }
  return summary.state
}

function relatedNumbers(summaryNumber: string, patterns: Pattern[], openSiblings: string[]): string[] {
  const ci = patterns.find((pattern) => pattern.kind === "configuration_item" && pattern.numbers.includes(summaryNumber))
  const fromPattern = ci ? ci.numbers.filter((number) => number !== summaryNumber) : []
  return [...new Set([...fromPattern, ...openSiblings])]
}

function pickFocus(ranked: RankedIncident[], patterns: Pattern[]): { number: string; reason: string } {
  const boosted = new Set(
    patterns.filter((pattern) => pattern.kind === "configuration_item").flatMap((pattern) => pattern.numbers),
  )
  const adjusted = ranked.map((row) => ({
    ...row,
    adjustedScore: row.riskScore + (boosted.has(row.number) ? CI_PATTERN_WEIGHT : 0),
  }))
  adjusted.sort((a, b) => b.adjustedScore - a.adjustedScore || b.riskScore - a.riskScore)
  const focus = adjusted[0]
  if (!focus) throw new Error("Cannot pick a focus incident from an empty ranking.")
  const base = ranked[0]
  const ci = patterns.find((pattern) => pattern.kind === "configuration_item" && pattern.numbers.includes(focus.number))
  if (base && base.number !== focus.number && ci) {
    const others = ci.numbers.filter((number) => number !== focus.number).join(", ")
    return {
      number: focus.number,
      reason: `${base.number} has the highest base SLA risk (${base.riskScore}), but ${focus.number} shares ${ci.key} with ${others}. Adding ${CI_PATTERN_WEIGHT} points for that repeat makes ${focus.number} the queue action (adjusted ${focus.adjustedScore}).`,
    }
  }
  return {
    number: focus.number,
    reason: `${focus.number} has the highest SLA risk in the open queue (${focus.riskScore} before pattern weight).`,
  }
}

export class LocalHeuristicPlanner implements AgentPlanner {
  readonly id = "local-heuristic" as const

  plan(input: PlannerInput): string {
    return `${input.briefing} I will call the incident tools one at a time and stop when I can recommend a state, an assignment group, and a work note.`
  }

  decide(input: PlannerInput): AgentDecision {
    const search = findTool(input.observations, "search_incidents")
    const patterns = findTool(input.observations, "flag_repeat_patterns")
    const summary = findTool(input.observations, "summarize_incident")
    const assignment = findTool(input.observations, "recommend_assignment")
    const note = findTool(input.observations, "draft_work_note")

    if (input.scope.type === "queue" && !search) {
      return {
        type: "tool",
        tool: "search_incidents",
        args: { states: ["New", "In Progress", "On Hold"], sort: "sla_risk" },
        reason: "Rank the open queue by base SLA risk before looking for repeats.",
      }
    }

    if (input.scope.type === "incident" && !summary) {
      return {
        type: "tool",
        tool: "summarize_incident",
        args: { number: input.scope.number },
        reason: `Read ${input.scope.number} before searching for related records.`,
      }
    }

    if (input.scope.type === "incident" && summary && !search) {
      return {
        type: "tool",
        tool: "search_incidents",
        args: {
          relatedTo: summary.data.number,
          configurationItem: summary.data.configurationItem,
          service: summary.data.service,
          region: summary.data.region,
        },
        reason: `Find other ${summary.data.service} records in ${summary.data.region} and anything else on ${summary.data.configurationItem}.`,
      }
    }

    if (!patterns) {
      const numbers = input.scope.type === "queue"
        ? search?.data.numbers ?? []
        : [summary?.data.number, ...(search?.data.openNumbers ?? [])].filter((value): value is string => Boolean(value))
      return {
        type: "tool",
        tool: "flag_repeat_patterns",
        args: { numbers },
        reason: input.scope.type === "queue"
          ? "Flag shared configuration items in the open set. That weight can change which incident I pick."
          : "Check whether this incident and its open relatives form a repeat.",
      }
    }

    if (input.scope.type === "queue" && search && !summary) {
      if (search.data.ranked.length === 0) {
        return { type: "stop", text: "The open queue is empty. There is no incident to assign or update." }
      }
      const focus = pickFocus(search.data.ranked, patterns.data.patterns)
      return {
        type: "tool",
        tool: "summarize_incident",
        args: { number: focus.number },
        reason: focus.reason,
      }
    }

    if (!summary) {
      throw new Error("Planner reached assignment without a summary.")
    }

    if (!assignment) {
      return {
        type: "tool",
        tool: "recommend_assignment",
        args: { number: summary.data.number },
        reason: `Match ${summary.data.configurationItem} to the group that clears this kind of ${summary.data.service} incident.`,
      }
    }

    const proposedState = chooseState(summary.data)
    const related = relatedNumbers(summary.data.number, patterns.data.patterns, summary.data.openSiblingNumbers)

    if (!note) {
      return {
        type: "tool",
        tool: "draft_work_note",
        args: {
          number: summary.data.number,
          proposedState,
          proposedAssignmentGroup: assignment.data.recommendedGroup,
          relatedNumbers: related,
        },
        reason: `Draft the ServiceNow work note for ${summary.data.number} using the summary, the assignment, and ${related.length ? related.join(", ") : "no sibling records"}.`,
      }
    }

    const evidence = [...new Set([summary.data.number, ...related, ...assignment.data.supportingNumbers])]
    const ci = patterns.data.patterns.find(
      (pattern) => pattern.kind === "configuration_item" && pattern.numbers.includes(summary.data.number),
    )
    const baseLeader = search?.data.ranked[0]
    const rationaleParts = [
      `${summary.data.number} is ${summary.data.priority} ${summary.data.state} on ${summary.data.configurationItem} (${summary.data.service}, ${summary.data.region}, ${summary.data.location}). SLA is ${summary.data.slaLabel}.`,
    ]
    if (input.scope.type === "queue" && baseLeader && baseLeader.number !== summary.data.number) {
      rationaleParts.push(
        `${baseLeader.number} leads on base SLA risk (${baseLeader.riskScore}), but the pattern tool put ${summary.data.number} ahead.`,
      )
    }
    if (ci) rationaleParts.push(ci.summary)
    if (assignment.data.recommendedGroup !== summary.data.assignmentGroup) {
      rationaleParts.push(`Move assignment from ${summary.data.assignmentGroup} to ${assignment.data.recommendedGroup}.`)
    } else {
      rationaleParts.push(`Keep ${assignment.data.recommendedGroup}.`)
    }
    rationaleParts.push(assignment.data.reason)
    if (proposedState !== summary.data.state) {
      rationaleParts.push(`Change state from ${summary.data.state} to ${proposedState}.`)
    } else {
      rationaleParts.push(`Leave state as ${summary.data.state}.`)
    }

    return {
      type: "recommend",
      recommendation: {
        incidentNumber: summary.data.number,
        shortDescription: summary.data.shortDescription,
        currentState: summary.data.state,
        proposedState,
        currentAssignmentGroup: summary.data.assignmentGroup,
        proposedAssignmentGroup: assignment.data.recommendedGroup,
        workNote: note.data.note,
        rationale: rationaleParts.join(" "),
        evidenceNumbers: evidence,
      },
    }
  }
}
