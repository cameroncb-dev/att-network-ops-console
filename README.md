# AT&T Network Operations Console

A portfolio console for a student preparing for an AT&T internship. It is an experience layer for network incident operations: a ServiceNow-shaped queue, analytics computed from that queue, and an ops agent that plans, calls tools, and hands a recommendation back to the operator.

The records are fictional. There is no production connection to AT&T, ServiceNow, or Azure.

## What you can do

- Filter the incident queue by priority, state, assignment group, and service, then open a record.
- On an incident, read the SLA, assignment, and work notes. Update state and assignment group, or add a work note. Changes stay in browser memory for the session.
- Open Analytics for volume by service and region, open versus resolved, SLA attainment, mean time to resolve, and a 14-day trend.
- Run the Ops Agent on the open queue or on one incident. The trace shows the plan, each tool call, and the tool result tied to incident numbers. Apply the recommendation to update that record.

The operations clock is frozen at 01 Oct 2026 22:00 UTC so SLA math does not drift. Session notes are stamped a minute apart after that clock.

Empty, loading, and error states are part of the feed. Append `?feed=down` to the URL to force the feed error, then use Retry. Voice in the West, fiber in the West, and enterprise VPN in the Southwest are empty cuts on the analytics filters.

## How this maps to the internship skills

**Data analytics.** The analytics view is computed from the same incident records the queue uses. It reports volume by service and region, open versus resolved, SLA attainment (resolved or closed on time, plus open records already past due), mean time to resolve overall and by service, and a daily open/resolve trend. Applying an agent recommendation changes the figures.

**Agentic AI development.** The agent is a real loop, not a scripted chat. `lib/agent/loop.ts` asks a planner for the next action, runs a tool in `lib/agent/tools.ts`, appends the observation, and repeats until the planner recommends or stops. Tools search the feed, summarize one incident, flag repeat configuration items and service-region clusters, recommend an assignment group from CI type plus resolved history, and draft a work note from those results. Queue triage uses the pattern tool to change which incident it picks: `INC0048280` has the highest base SLA risk, and the Dallas metro-ring repeat (`INC0048211`, `INC0048238`, `INC0048244`) outranks it after the pattern weight.

**Agentic workflows.** The operator chooses the scope, watches each step, and decides whether to apply the recommendation. The apply dialog can edit state, assignment group, and the note before anything is written. The agent does not close the loop by itself.

## How this maps to Azure and ServiceNow

ServiceNow stays the system of record for incidents, assignment, SLA, and work notes. This console is the experience layer a team would put in front of that record: a clearer queue, analytics, and an agent that proposes the next update.

On Azure, the same shape would be:

- **Web app.** This Next.js app, hosted as an Azure App Service or Azure Container Apps site.
- **Data store.** The seed JSON stands in for Azure SQL or Cosmos DB holding a read model synced from ServiceNow. The UI already treats the feed as a loadable source with loading and error states.
- **Azure OpenAI.** `lib/agent/provider.ts` returns the local planner unless `NEXT_PUBLIC_AGENT_PROVIDER=azure-openai`. That setting selects `AzureOpenAIPlanner`, which refuses to run until an endpoint, deployment, and key exist. Tool execution stays in this repo, so a future model would choose tools and the app would still apply them to the incident data. No API key is required for the local loop.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The dev server listens on `0.0.0.0:43123`.

```bash
npm run check:agent
```

That runs the offline agent loop and analytics checks against the seed.

```bash
npm run lint
```
