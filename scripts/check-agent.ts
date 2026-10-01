import { runAgentLoop } from "../lib/agent/loop"
import { LocalHeuristicPlanner } from "../lib/agent/local-planner"
import { executeTool } from "../lib/agent/tools"
import { computeAnalytics } from "../lib/incidents/metrics"
import { sliceIncidents } from "../lib/incidents/query"
import { buildSeed } from "../lib/incidents/seed"
import { isOpenState, slaStatus } from "../lib/incidents/sla"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const incidents = buildSeed()
const open = incidents.filter((incident) => isOpenState(incident.state))
const breached = open.filter((incident) => slaStatus(incident) === "breached")

assert(incidents.length >= 40 && incidents.length <= 60, `seed count ${incidents.length}`)
assert(sliceIncidents(incidents, { service: "Voice", region: "West" }).length === 0, "Voice/West should be empty")

const search = executeTool("search_incidents", { states: ["New", "In Progress", "On Hold"], sort: "sla_risk" }, incidents)
assert(search.tool === "search_incidents", "search tool")
assert(search.data.ranked[0]?.number === "INC0048280", `base risk leader was ${search.data.ranked[0]?.number}`)

const planner = new LocalHeuristicPlanner()
const queue = runAgentLoop({ type: "queue" }, incidents, planner)
const plan = queue.find((event) => event.kind === "plan")
assert(plan?.kind === "plan" && plan.text.includes(`${open.length} open`), "plan missing open count")
assert(plan.text.includes(`${breached.length} are past SLA`), "plan missing breached count")

const tools = queue.filter((event) => event.kind === "tool_call").map((event) => (event.kind === "tool_call" ? event.tool : ""))
assert(
  tools.join(",") === "search_incidents,flag_repeat_patterns,summarize_incident,recommend_assignment,draft_work_note",
  `unexpected tool order ${tools.join(",")}`,
)

const summarize = queue.find((event) => event.kind === "tool_call" && event.tool === "summarize_incident")
assert(summarize?.kind === "tool_call", "missing summarize")
assert(summarize.args.number === "INC0048211", `focus was ${String(summarize.args.number)}`)
assert(summarize.reason.includes("INC0048280"), "reason should explain the base-risk leader")
assert(summarize.reason.includes("DAL-METRO-RING-04"), "reason should name the repeat CI")

const recommendation = queue.find((event) => event.kind === "recommendation")
assert(recommendation?.kind === "recommendation", "missing recommendation")
assert(recommendation.recommendation.incidentNumber === "INC0048211", "wrong incident")
assert(recommendation.recommendation.proposedState === "In Progress", "state should move to In Progress")
assert(recommendation.recommendation.proposedAssignmentGroup === "Fiber Field Operations", "group should be fiber field")
assert(recommendation.recommendation.workNote.includes("INC0048238"), "note missing sibling 8238")
assert(recommendation.recommendation.workNote.includes("INC0048244"), "note missing sibling 8244")
assert(recommendation.recommendation.rationale.includes("INC0048280"), "rationale should cite the runner-up")

const resolveRun = runAgentLoop({ type: "incident", number: "INC0048260" }, incidents, planner)
const resolveRec = resolveRun.find((event) => event.kind === "recommendation")
assert(resolveRec?.kind === "recommendation", "missing single-incident recommendation")
assert(resolveRec.recommendation.proposedState === "Resolved", `8260 state was ${resolveRec.recommendation.proposedState}`)
assert(resolveRec.recommendation.proposedAssignmentGroup === "Voice Core", "8260 group")
assert(/resolve/i.test(resolveRec.recommendation.workNote), "8260 note should recommend resolve")

const blocked = runAgentLoop({ type: "incident", number: "INC0048252" }, incidents, planner)
const blockedRec = blocked.find((event) => event.kind === "recommendation")
assert(blockedRec?.kind === "recommendation", "missing blocked recommendation")
assert(blockedRec.recommendation.proposedState === "In Progress", "8252 should stay open because a sibling is down")
assert(blockedRec.recommendation.workNote.includes("INC0048218"), "8252 note should cite the open sibling")

const analytics = computeAnalytics(incidents)
assert(analytics.total === incidents.length, "analytics total")
assert(analytics.open === open.length, "analytics open")
assert(analytics.trend.length === 14, "trend days")
assert(analytics.slaAttainment != null && analytics.slaAttainment > 0 && analytics.slaAttainment < 100, "sla attainment")
assert(analytics.mttrHours != null && analytics.mttrHours > 0, "mttr")
assert(slaStatus(incidents.find((incident) => incident.number === "INC0048126")!) === "missed", "8126 missed")
assert(slaStatus(incidents.find((incident) => incident.number === "INC0048144")!) === "met", "8144 met")

console.log(
  `ok seed=${incidents.length} open=${open.length} breached=${breached.length} sla=${analytics.slaAttainment?.toFixed(1)}% mttr=${analytics.mttrHours?.toFixed(1)}h focus=INC0048211`,
)
