import { readFileSync } from "node:fs"
import path from "node:path"
import { computeAnalytics } from "../lib/incidents/metrics"
import { buildSeed } from "../lib/incidents/seed"
import { buildPowerBiTables, tableToCsv } from "../lib/powerbi/model"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const incidents = buildSeed()
const analytics = computeAnalytics(incidents)
const tables = buildPowerBiTables(incidents)
const dir = path.join(process.cwd(), "powerbi")

for (const table of tables) {
  const file = path.join(dir, `${table.name}.csv`)
  const onDisk = readFileSync(file, "utf8")
  assert(onDisk === tableToCsv(table), `${table.name}.csv is out of date. Run npm run export:powerbi.`)
}

const fact = tables.find((table) => table.name === "fact_incidents")!
const header = Object.fromEntries(fact.headers.map((name, index) => [name, index]))
const rows = fact.rows
assert(rows.length === incidents.length, `fact rows ${rows.length} != seed ${incidents.length}`)
assert(rows.length === analytics.total, "fact rows != analytics total")

const open = rows.filter((row) => row[header.is_open] === 1).length
const resolved = rows.filter((row) => row[header.outcome] === "Resolved").length
assert(open === analytics.open, `open ${open} != ${analytics.open}`)
assert(resolved === analytics.resolved, `resolved ${resolved} != ${analytics.resolved}`)
assert(open + resolved === rows.length, "outcome does not cover every incident")

const cell = (row: (string | number)[], name: string) => row[header[name]!]
let slaMet = 0
let slaEvaluated = 0
let hourSum = 0
let hourCount = 0
for (const row of rows) {
  slaMet += Number(cell(row, "sla_met"))
  slaEvaluated += Number(cell(row, "sla_evaluated"))
  const hours = cell(row, "resolve_hours")
  if (hours !== "") {
    hourSum += Number(hours)
    hourCount += 1
  }
}
assert(slaMet === analytics.slaMet, `sla met ${slaMet} != ${analytics.slaMet}`)
assert(slaEvaluated === analytics.slaEvaluated, `sla evaluated ${slaEvaluated} != ${analytics.slaEvaluated}`)
const attainment = (slaMet / slaEvaluated) * 100
assert(Math.abs(attainment - (analytics.slaAttainment ?? NaN)) < 0.001, "SLA attainment drifted")

const mttr = hourSum / hourCount
assert(Math.abs(mttr - (analytics.mttrHours ?? NaN)) < 0.001, `MTTR ${mttr} != ${analytics.mttrHours}`)

const services = new Set(tables.find((table) => table.name === "dim_service")!.rows.map((row) => row[1]))
const regions = new Set(tables.find((table) => table.name === "dim_region")!.rows.map((row) => row[1]))
const groups = new Set(tables.find((table) => table.name === "dim_assignment_group")!.rows.map((row) => row[1]))
const dates = new Set(tables.find((table) => table.name === "dim_date")!.rows.map((row) => row[0]))
assert(services.size === 4 && regions.size === 5 && groups.size === 8, "dimension member counts")

for (const row of rows) {
  assert(
    tables.find((table) => table.name === "dim_service")!.rows.some((item) => item[0] === cell(row, "service_key")),
    "bad service key",
  )
  assert(dates.has(cell(row, "opened_date_key")), `opened date ${cell(row, "opened_date_key")} missing from dim_date`)
  if (cell(row, "resolved_date_key") !== "") {
    assert(dates.has(cell(row, "resolved_date_key")), `resolved date ${cell(row, "resolved_date_key")} missing from dim_date`)
  }
}

console.log(
  `ok powerbi facts=${rows.length} open=${open} resolved=${resolved} sla=${attainment.toFixed(1)}% mttr=${mttr.toFixed(1)}h`,
)
