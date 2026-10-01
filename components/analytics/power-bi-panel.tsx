import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const FILES = [
  "powerbi/fact_incidents.csv",
  "powerbi/dim_service.csv",
  "powerbi/dim_region.csv",
  "powerbi/dim_assignment_group.csv",
  "powerbi/dim_date.csv",
  "powerbi/measures.dax",
]

export function PowerBiPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Power BI Desktop model</CardTitle>
        <CardDescription>
          The same seed behind these charts, shaped as a star schema you open on your own machine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6">
        <p>
          Each incident is one row in the fact table. Service, region, assignment group, and date are dimensions. The DAX measures count incidents, count open records, and calculate SLA attainment and mean time to resolve with the same rules as this page.
        </p>
        <p>
          Power BI Desktop is how you open it: Get data from the <span className="font-mono text-xs">powerbi</span> folder, relate the keys, and paste the measures. Steps are in <span className="font-mono text-xs">powerbi/README.md</span>. This console does not embed a report.
        </p>
        <p>
          Publishing that file to a workspace and embedding it here needs a Power BI license, either an AT&T tenant or a free trial. This project does not include one.
        </p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {FILES.map((file) => (
            <li key={file} className="font-mono text-xs text-muted-foreground">
              {file}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
