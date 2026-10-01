# Power BI model for the network operations console

This folder is a star schema exported from the same fictional incident seed the console uses. One row in `fact_incidents.csv` is one incident. Power BI Desktop is how you open it. This repo does not sign in to an AT&T tenant, call the Power BI API, or publish a workspace.

The in-app Analytics page can change during a browser session. These files do not. They match the seed at export time. After the seed changes, regenerate from the repo root:

```bash
npm run export:powerbi
npm run check:powerbi
```

On the current seed the unfiltered model matches Analytics: 52 incidents, 24 open, 28 resolved (including closed), SLA attainment 61.8%, mean time to resolve 12.0 hours.

## Files

| File | Grain | Role |
| --- | --- | --- |
| `fact_incidents.csv` | One incident | Counts, outcome, SLA flags, resolve hours |
| `dim_service.csv` | Service | 5G RAN, Fiber, Enterprise VPN, Voice |
| `dim_region.csv` | Region | Northeast, Southeast, Midwest, Southwest, West |
| `dim_assignment_group.csv` | Assignment group | The eight console groups |
| `dim_date.csv` | Calendar day | Every UTC day from the earliest incident through the operations clock |
| `measures.dax` | Measures | Incident Count, Open Incidents, SLA Attainment %, MTTR Hours |

`outcome` is `Open` or `Resolved`. `Resolved` includes state Closed, which is how the Analytics donut is defined. `is_open` is 1 for New, In Progress, and On Hold. `sla_met` and `sla_evaluated` encode the console SLA rule: met, missed, and breached count; open incidents still inside the window do not. `resolve_hours` is blank until the incident is resolved or closed.

## Get data from this folder

Use Power BI Desktop on your own machine. A local PBIX does not need an AT&T account.

1. Open Power BI Desktop.
2. On the Home ribbon, choose **Get data** → **Text/CSV**.
3. Browse to this `powerbi` folder. Select `fact_incidents.csv`. Choose **Load**. Do not combine files.
4. Repeat Get data → Text/CSV for `dim_service.csv`, `dim_region.csv`, `dim_assignment_group.csv`, and `dim_date.csv`.
5. Leave `measures.dax` and this README out of the model. They are not tables.

Do not use **Combine & Transform** on the Folder connector. That stacks every file into one table and breaks the star schema.

If a key column arrives as text, set it to Whole number before you create relationships: `service_key`, `region_key`, `assignment_group_key`, `date_key`, `opened_date_key`, `resolved_date_key`, `is_open`, `sla_met`, `sla_evaluated`. Set `resolve_hours` to Decimal number. Set `dim_date[date]` to Date. `resolved_date_key` is blank on open incidents; blanks should stay null, not zero.

## Relationships

Open **Model view**. Create each relationship many-to-one, cross-filter direction single, from the fact to the dimension (the dimension filters the fact).

| From | To | Active |
| --- | --- | --- |
| `fact_incidents[service_key]` | `dim_service[service_key]` | Yes |
| `fact_incidents[region_key]` | `dim_region[region_key]` | Yes |
| `fact_incidents[assignment_group_key]` | `dim_assignment_group[assignment_group_key]` | Yes |
| `fact_incidents[opened_date_key]` | `dim_date[date_key]` | Yes |
| `fact_incidents[resolved_date_key]` | `dim_date[date_key]` | No |

The resolved-date relationship stays inactive because a date table can have only one active path. The four visuals below do not need it. A resolved-by-day line would use `USERELATIONSHIP(fact_incidents[resolved_date_key], dim_date[date_key])`.

## Paste the measures

1. In the Data pane, select `fact_incidents`.
2. On the Home ribbon (or Modeling), choose **New measure**.
3. Paste the `Incident Count` block from `measures.dax`, including the name and the equals sign. Press Enter.
4. Repeat New measure for `Open Incidents`, `SLA Attainment %`, and `MTTR Hours`. Paste one block at a time.
5. Select **SLA Attainment %** and set the format to **Percentage** with one decimal place.
6. Select **MTTR Hours** and set the format to **Decimal number** with one decimal place.

## Four visuals

These match the Analytics page. Build them on a report page with no page-level filters.

1. **Volume by service.** Clustered column chart. X-axis: `dim_service[service]`. Y-axis: `Incident Count`. In the axis format, turn on **Show items with no data** so an empty service still appears.
2. **Volume by region.** Clustered column chart. X-axis: `dim_region[region]`. Y-axis: `Incident Count`. Turn on **Show items with no data**.
3. **Open vs resolved.** Donut chart. Legend: `fact_incidents[outcome]`. Values: `Incident Count`. Resolved includes closed records.
4. **SLA and time to resolve.** Multi-row card. Fields: `Open Incidents`, `SLA Attainment %`, `MTTR Hours`.

Unfiltered, the card should read 24 open, 61.8% SLA attainment, and 12.0 MTTR hours. Incident Count on either bar chart totals 52.

## What this repo does not include

Publishing the PBIX to a Power BI workspace, and embedding that report in the console, needs a Power BI license. That can be an AT&T tenant or a free trial. This project has neither, and it does not call the Power BI REST API. The Analytics page in the console is a separate view of the same seed, not an embedded report.
