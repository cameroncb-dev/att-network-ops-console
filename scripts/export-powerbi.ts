import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { buildPowerBiTables, tableToCsv } from "../lib/powerbi/model"

const outDir = path.join(process.cwd(), "powerbi")
mkdirSync(outDir, { recursive: true })

for (const table of buildPowerBiTables()) {
  const file = path.join(outDir, `${table.name}.csv`)
  writeFileSync(file, tableToCsv(table))
  console.log(`${table.name}.csv ${table.rows.length} rows`)
}
