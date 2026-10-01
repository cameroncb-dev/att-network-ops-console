import { formatStamp } from "@/lib/incidents/format"
import { OPERATIONS_CLOCK_ISO } from "@/lib/incidents/clock"
import { isOpenState, noteSuggestsRestored, riskScore, slaLabel, slaStatus } from "@/lib/incidents/sla"
import type { AssignmentGroup, Incident, IncidentState } from "@/lib/incidents/types"
import type {
  AssignmentData,
  NoteData,
  Pattern,
  PatternData,
  RankedIncident,
  SearchData,
  SummaryData,
  ToolName,
  ToolObservation,
} from "@/lib/agent/types"

function requireIncident(number: string, incidents: Incident[]): Incident {
  const incident = incidents.find((item) => item.number === number)
  if (!incident) throw new Error(`Incident ${number} is not in the feed.`)
  return incident
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a list of strings.`)
  }
  return value
}

function rankIncident(incident: Incident): RankedIncident {
  return {
    number: incident.number,
    shortDescription: incident.shortDescription,
    priority: incident.priority,
    state: incident.state,
    service: incident.service,
    region: incident.region,
    assignmentGroup: incident.assignmentGroup,
    configurationItem: incident.configurationItem,
    slaStatus: slaStatus(incident),
    riskScore: riskScore(incident),
  }
}

function specialistGroup(incident: Incident): AssignmentGroup {
  const text = `${incident.shortDescription} ${incident.description} ${incident.configurationItem}`.toLowerCase()
  if (incident.service === "5G RAN") {
    if (/upf|amf|smf|packet core/.test(text)) return "5G Core Packet"
    return "RAN Performance"
  }
  if (incident.service === "Fiber") {
    if (/dwdm|transport|ols|optical/.test(text)) return "Optical Transport"
    return "Fiber Field Operations"
  }
  if (incident.service === "Enterprise VPN") return "Enterprise VPN"
  if (/e911|911|psap/.test(text)) return "E911 Engineering"
  return "Voice Core"
}

export function searchIncidents(args: Record<string, unknown>, incidents: Incident[]): SearchData {
  const states = args.states == null ? null : asStringArray(args.states, "states")
  const relatedTo = typeof args.relatedTo === "string" ? args.relatedTo : null
  const configurationItem = typeof args.configurationItem === "string" ? args.configurationItem : null
  const service = typeof args.service === "string" ? args.service : null
  const region = typeof args.region === "string" ? args.region : null
  const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : ""

  let matches = incidents.filter((incident) => {
    if (relatedTo && incident.number === relatedTo) return false
    if (states && !states.includes(incident.state)) return false
    if (relatedTo) {
      const sameCi = configurationItem != null && incident.configurationItem === configurationItem
      const sameSlice = service != null && region != null && incident.service === service && incident.region === region
      if (!sameCi && !sameSlice) return false
    } else if (configurationItem && incident.configurationItem !== configurationItem) {
      return false
    }
    if (!relatedTo && service && incident.service !== service) return false
    if (!relatedTo && region && incident.region !== region) return false
    if (!query) return true
    return `${incident.number} ${incident.shortDescription} ${incident.description} ${incident.configurationItem}`
      .toLowerCase()
      .includes(query)
  })

  matches = [...matches].sort((a, b) => {
    const openRank = Number(isOpenState(b.state)) - Number(isOpenState(a.state))
    if (openRank !== 0) return openRank
    const risk = riskScore(b) - riskScore(a)
    if (risk !== 0) return risk
    return Date.parse(b.openedAt) - Date.parse(a.openedAt)
  })

  const ranked = matches.map(rankIncident)
  return {
    total: ranked.length,
    numbers: ranked.map((item) => item.number),
    openNumbers: ranked.filter((item) => item.state === "New" || item.state === "In Progress" || item.state === "On Hold").map((item) => item.number),
    ranked,
  }
}

export function summarizeIncident(number: string, incidents: Incident[]): SummaryData {
  const incident = requireIncident(number, incidents)
  const last = incident.workNotes.at(-1) ?? null
  const openSiblings = incidents.filter(
    (item) =>
      item.number !== incident.number &&
      item.configurationItem === incident.configurationItem &&
      isOpenState(item.state),
  )
  const narrative = [
    `${incident.number} is ${incident.priority}, ${incident.state}, owned by ${incident.assignmentGroup}.`,
    `CI ${incident.configurationItem} in ${incident.location} (${incident.service}, ${incident.region}).`,
    `SLA ${slaLabel(incident)}, due ${formatStamp(incident.slaDueAt)}.`,
    incident.shortDescription,
    last ? `Latest note by ${last.author}: ${last.text}` : "No work notes yet.",
    openSiblings.length
      ? `Open siblings on this CI: ${openSiblings.map((item) => item.number).join(", ")}.`
      : "No other open incident shares this CI.",
  ].join(" ")

  return {
    number: incident.number,
    shortDescription: incident.shortDescription,
    description: incident.description,
    priority: incident.priority,
    state: incident.state,
    assignmentGroup: incident.assignmentGroup,
    assignedTo: incident.assignedTo,
    service: incident.service,
    region: incident.region,
    location: incident.location,
    configurationItem: incident.configurationItem,
    slaStatus: slaStatus(incident),
    slaLabel: slaLabel(incident),
    slaDueAt: incident.slaDueAt,
    openedAt: incident.openedAt,
    lastNote: last?.text ?? null,
    lastNoteSuggestsRestored: last ? noteSuggestsRestored(last.text) : false,
    openSiblingNumbers: openSiblings.map((item) => item.number),
    narrative,
  }
}

export function recommendAssignment(number: string, incidents: Incident[]): AssignmentData {
  const incident = requireIncident(number, incidents)
  const specialist = specialistGroup(incident)
  const resolvedSameCi = incidents.filter(
    (item) => item.configurationItem === incident.configurationItem && item.number !== incident.number && !isOpenState(item.state),
  )
  const pool = resolvedSameCi.length
    ? resolvedSameCi
    : incidents.filter((item) => item.service === incident.service && !isOpenState(item.state))
  const counts = new Map<AssignmentGroup, number>()
  for (const item of pool) {
    counts.set(item.assignmentGroup, (counts.get(item.assignmentGroup) ?? 0) + 1)
  }
  const historical = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  const supporting = pool
    .filter((item) => item.assignmentGroup === specialist)
    .slice(0, 3)
    .map((item) => item.number)

  const sameCiClause = resolvedSameCi.length
    ? `Resolved history on ${incident.configurationItem} includes ${resolvedSameCi.map((item) => item.number).slice(0, 3).join(", ")}.`
    : `No resolved ticket on this CI. Compared ${pool.length} resolved ${incident.service} incidents instead.`
  const historyClause = historical
    ? `${historical[0]} closed ${historical[1]} of those records.`
    : "There is no resolved sample for this service."
  const agree = historical && historical[0] === specialist
  const reason = agree
    ? `${specialist} matches both the CI type and the resolved history. ${sameCiClause} ${historyClause}`
    : `${specialist} matches the CI type (${incident.configurationItem}). ${sameCiClause} ${historyClause}`

  return {
    number: incident.number,
    currentGroup: incident.assignmentGroup,
    recommendedGroup: specialist,
    reason,
    supportingNumbers: supporting,
  }
}

export function flagRepeatPatterns(numbers: string[], incidents: Incident[]): PatternData {
  const set = incidents.filter((incident) => numbers.includes(incident.number))
  const patterns: Pattern[] = []

  const byCi = new Map<string, Incident[]>()
  for (const incident of set) {
    const list = byCi.get(incident.configurationItem) ?? []
    list.push(incident)
    byCi.set(incident.configurationItem, list)
  }
  for (const [ci, items] of byCi) {
    if (items.length < 2) continue
    patterns.push({
      kind: "configuration_item",
      key: ci,
      numbers: items.map((item) => item.number),
      summary: `${items.length} incidents share CI ${ci}: ${items.map((item) => `${item.number} (${item.state})`).join(", ")}.`,
    })
  }

  const bySlice = new Map<string, Incident[]>()
  for (const incident of set) {
    const key = `${incident.service} · ${incident.region}`
    const list = bySlice.get(key) ?? []
    list.push(incident)
    bySlice.set(key, list)
  }
  for (const [key, items] of bySlice) {
    const severe = items.filter((item) => item.priority.startsWith("1") || item.priority.startsWith("2"))
    if (items.length >= 3 && severe.length >= 1) {
      patterns.push({
        kind: "service_region",
        key,
        numbers: items.map((item) => item.number),
        summary: `${items.length} incidents in ${key}, including ${severe.length} priority 1 or 2.`,
      })
    }
  }

  const keywords: { key: string; pattern: RegExp }[] = [
    { key: "span loss", pattern: /span|loss of signal|\blos\b/i },
    { key: "gNodeB", pattern: /gnodeb|gnb-/i },
    { key: "BGP", pattern: /\bbgp\b/i },
    { key: "SIP", pattern: /\bsip\b/i },
    { key: "E911", pattern: /e911|psap|911/i },
  ]
  for (const keyword of keywords) {
    const items = set.filter((incident) =>
      keyword.pattern.test(`${incident.shortDescription} ${incident.description} ${incident.configurationItem}`),
    )
    if (items.length >= 2) {
      patterns.push({
        kind: "keyword",
        key: keyword.key,
        numbers: items.map((item) => item.number),
        summary: `${items.length} records in this set mention ${keyword.key}.`,
      })
    }
  }

  return { patterns }
}

export function draftWorkNote(args: Record<string, unknown>, incidents: Incident[]): NoteData {
  const number = typeof args.number === "string" ? args.number : ""
  const incident = requireIncident(number, incidents)
  const proposedState = args.proposedState as IncidentState
  const proposedGroup = args.proposedAssignmentGroup as AssignmentGroup
  const relatedNumbers = asStringArray(args.relatedNumbers ?? [], "relatedNumbers")
  const related = relatedNumbers.map((item) => requireIncident(item, incidents))
  const last = incident.workNotes.at(-1)
  const lines = [
    `Ops Agent review at ${formatStamp(OPERATIONS_CLOCK_ISO)} for ${incident.number}.`,
    `${incident.priority} ${incident.state} on ${incident.configurationItem} (${incident.service}, ${incident.region}, ${incident.location}). SLA ${slaLabel(incident)} (due ${formatStamp(incident.slaDueAt)}).`,
    `Symptom: ${incident.shortDescription}`,
  ]
  if (related.length) {
    lines.push(
      `Related records: ${related.map((item) => `${item.number} (${item.priority}, ${item.state})`).join("; ")}.`,
    )
  }
  if (incident.assignmentGroup !== proposedGroup) {
    lines.push(`Reassign from ${incident.assignmentGroup} to ${proposedGroup}.`)
  } else {
    lines.push(`Keep assignment with ${proposedGroup}.`)
  }
  if (proposedState === "Resolved") {
    lines.push(
      "Latest note says service was verified and no open sibling remains on this CI. Resolve the incident and watch the next poll.",
    )
  } else if (last && noteSuggestsRestored(last.text) && related.length > 0) {
    lines.push(
      `Do not resolve. The latest note reports restoration, but open siblings are still active (${related.map((item) => item.number).join(", ")}). Leave the state at ${proposedState}.`,
    )
  } else if (proposedState !== incident.state) {
    lines.push(`Move state from ${incident.state} to ${proposedState} so the queue shows active ownership.`)
  } else {
    lines.push(`Leave state as ${incident.state}. Post the next field or peer ETA on this thread before the SLA checkpoint.`)
  }
  return { number: incident.number, note: lines.join("\n") }
}

function previewNumbers(numbers: string[]): string[] {
  return numbers.slice(0, 5)
}

export function executeTool(tool: ToolName, args: Record<string, unknown>, incidents: Incident[]): ToolObservation {
  if (tool === "search_incidents") {
    const data = searchIncidents(args, incidents)
    const top = data.ranked[0]
    const summary = data.total
      ? `Found ${data.total} incident${data.total === 1 ? "" : "s"}. Highest base SLA risk is ${top?.number} (${top?.priority}, ${top?.state}, risk ${top?.riskScore}) on ${top?.configurationItem}.`
      : "Search returned no incidents."
    return { tool, args, summary, recordNumbers: previewNumbers(data.numbers), data }
  }
  if (tool === "summarize_incident") {
    const number = typeof args.number === "string" ? args.number : ""
    const data = summarizeIncident(number, incidents)
    return { tool, args, summary: data.narrative, recordNumbers: [data.number, ...data.openSiblingNumbers], data }
  }
  if (tool === "recommend_assignment") {
    const number = typeof args.number === "string" ? args.number : ""
    const data = recommendAssignment(number, incidents)
    const summary = `${data.number} is on ${data.currentGroup}. Recommend ${data.recommendedGroup}. ${data.reason}`
    return { tool, args, summary, recordNumbers: [data.number, ...data.supportingNumbers], data }
  }
  if (tool === "flag_repeat_patterns") {
    const numbers = asStringArray(args.numbers ?? [], "numbers")
    const data = flagRepeatPatterns(numbers, incidents)
    const ci = data.patterns.filter((pattern) => pattern.kind === "configuration_item")
    const summary = data.patterns.length
      ? data.patterns.map((pattern) => pattern.summary).join(" ")
      : "No repeat pattern in this set."
    const recordNumbers = [...new Set((ci.length ? ci : data.patterns).flatMap((pattern) => pattern.numbers))].slice(0, 8)
    return { tool, args, summary, recordNumbers, data }
  }
  const data = draftWorkNote(args, incidents)
  return {
    tool,
    args,
    summary: `Drafted a work note for ${data.number}.`,
    recordNumbers: [data.number, ...asStringArray(args.relatedNumbers ?? [], "relatedNumbers")],
    data,
  }
}
