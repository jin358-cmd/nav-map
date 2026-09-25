# TDX Phase 1

TDX is isolated from the NLSC/GCIS ingestion pipeline. The server-side adapter owns credentials, normalization, caching, and API fallback; clients use NavPilot route handlers only.

## South parking import

The six-region order is Yunlin County, Chiayi County, Chiayi City, Tainan, Kaohsiung, and Pingtung County. The importer is dry-run by default:

```powershell
npm run import:tdx:south -- --dry-run --fixture=fixtures/tdx/south-parking.json
```

Live staging requires `TDX_CLIENT_ID`, `TDX_CLIENT_SECRET`, server-only Supabase credentials, the Phase 1 migration, and `TDX_SOUTH_APPLY=1`. Checkpoint and reject files are written under `data/tdx-south/`; interrupted jobs resume at the recorded region offset. A rejected row never enters the promoted NavPilot tables.

## Traffic freshness

Traffic live status refreshes independently of parking imports. Section shapes use a longer cache. When a refresh fails, the backend retains the last successful snapshot and returns `stale: true`; the client must show the stale state and last source update time. Demo traffic is only enabled with `NEXT_PUBLIC_ENABLE_DEMO=1`.

## Promotion boundary

`tdx_staging_records.normalization_status = 'accepted'` means automated validation passed. Promotion into `parking_lots`, `parking_availability`, `parking_rates`, `traffic_segments`, or `traffic_status` is a separate operation so malformed bulk data cannot directly contaminate the application dataset.

Parking promotion is explicit and service-role-only: call `promote_tdx_parking_job(job_id)` after reviewing the job summary. It promotes accepted rows, marks them promoted, and creates an `unknown` availability record; it never invents a live space count.
