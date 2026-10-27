# NAVPILOT-PREFLIGHT-20261028

- Document ID: NAVPILOT-PREFLIGHT-20261028
- Audit time: 2026-10-28 04:17 CST (Asia/Taipei); machine clock 2026-10-27 20:17 UTC
- Workspace: `/workspace`
- Repository: `jin358-cmd/nav-map`
- Mode: read-only audit of `main` and remote-tracking refs, then an isolated branch for the road-construction layer
- Safety: no `reset`, `clean`, `stash`, `merge`, or `pull`. `git fetch` of five heads ran only after `git status` showed a clean worktree. No Supabase unpause, SQL write, migration, production deploy, or NLSC scan.

## 1. Workspace

| Check | Result | Evidence |
| --- | --- | --- |
| Path | PASS | `pwd` → `/workspace` |
| Remote | PASS | `origin` is `github.com/jin358-cmd/nav-map` |
| Starting branch | PASS | `main` |
| HEAD | PASS | `c57777ba7c947d3f462dc035c80ed388a6132d28` |
| Dirty files | PASS | `git status --short` empty before this branch |
| Worktree | PASS | only `/workspace` on `main` at audit start |

`main` tip: `fix: double the yellow location triangle` (2026-09-03 02:59:51 UTC).

## 2. What is actually in this checkout

`main` contains the driving HUD (Next.js 16.3.4, MapLibre GL 6, Tailwind 4): navigation banner, route snap, CCTV, TDX Tainan traffic with mock fallback, speed enforcement, NCDR disasters, address search via NLSC TextQueryMap, bookmarks, and YouTube Music. There is no `npm run typecheck` on `main` before this branch, and no automated test script.

POI canonical gzip, south-pilot summaries, Supabase migrations, and GCIS/NLSC ingest scripts are **not** on `main`. They exist only on unmerged branches.

## 3. Historical branches

Fetched into remote-tracking refs only. None is an ancestor of `main` (`git merge-base --is-ancestor` is false). Each is 0 commits behind `main`, so `main` is contained in them.

| Branch | HEAD | Date (source zone) | Ahead of main | Merged into main |
| --- | --- | --- | --- | --- |
| `cursor/phase-5-3a-south-poi-cloud-pilot-5225` | `b41784577c2eb7ff3b5b1545b49605400f117219` | 2026-09-20 19:46:06 +0800 | 203 | NO |
| `fix/TDX-integration` | `c97066d4c2eae49fcd58b40f0440ad710348f1ed` | 2026-09-26 01:30:32 +0800 | 205 | NO |
| `feat/phase-5-2-navigation-experience` | `29ebd365130d1992cd46e3d071cef343d030a0f0` | 2026-09-10 06:25:49 UTC | 170 | NO |
| `feat/volunteer-service-layer-private-preview` | `feee5981476339d5c9c99cd50c374f6e9402b827` | 2026-10-16 15:10:45 +0800 | 1 | NO |

`fix/TDX-integration` contains the Phase 5.3a tip plus two commits: `8661092` south parking staging and `c97066d` checkpoint resume. Those commits are not in `main`.

Status: **PASS** for existence and merge comparison. **PARTIAL** as a working copy: the audit checkout was `main`, not the historical POI branch.

## 4. POI / NLSC

Status: **BLOCKED** for the handoff canonical file. No metadata rewrite was performed.

Claimed canonical (`658,971` rows, `45,604,873` bytes, SHA-256 `47894b8e094514cedf90a6ad5ada450bda0e7c855c62b6a24a882150dfb7c314`) is absent from every remote head, from GitHub releases (`gh release list` empty), and from this workspace. `git grep` for `658971`, that SHA, `Z5905069`, and `588198` returned no hits.

Committed evidence on Phase 5.3a:

| Artifact | Result |
| --- | --- |
| `data/south-pilot/summary.json` | Historical. `sourceCount` **812,257**. SHA-256 `657c34315a8ea072f564722607ff4edcce146d76e2af41bcc330d6b0a2fc490f`. Source path was `/tmp/phase53a-src/taiwan-poi-index.json.gz`. |
| `data/south-pilot/rebuild-manifest.json` | `legacyVersion.recoveryStatus` = `source-unavailable`. `importAllowed` false. Rebuild version `south-pilot-20260920-rebuild1` has null source count and SHA. `sourceSnapshotArchived` false. |
| `src/data/taiwan-poi-index.json.gz` | Blob `3c74c9d5`, **8,968,675** bytes, SHA-256 `94c912daa53de634f4da569ef89b9dd5ec1ac3707531c36b9719372da0ccd8dd`, **149,481** JSON rows. Matches neither 812,257 nor 658,971. |
| `src/data/poi-ingest-manifest.json` | `total` 812,257, `active` 805,419, `gcisImported` 669,499. This is a manifest, not the missing 45.6 MB master. |
| Address staging | `src/data/south-address-index.json.gz` SHA-256 `ea5b0923e61b3f7014672f76d5a6d57e9270c2b0b78822497f257f541b5e75cc` matches `address-index-manifest.json`. **181,794** unique addresses. `exact-house` **168,309**. `supabase: not_written`. |
| Yunlin dry-run in git | `docs/phase-5-3a-yunlin-dry-run.json` at 2026-09-17T23:46:18.983Z: `wouldUpsert` **11,515**, `wroteSupabase` false, blocked on `missing_credentials`. Summary county row: 雲林 located **20,298**, published **11,515**. The handoff figures 12,721 located / 10,247 published are **not** in this git history. |
| NLSC checkpoint | Not the handoff values. `src/data/gcis-ingest-checkpoint.json` last registry id is `XX574650`, offset 69,751, status `completed` (2026-09-13). `Z5905069` / 588,198 were not found. |
| Source snapshots | `data/source-snapshots/` is gitignored. The rebuild plan says a GCIS snapshot was archived on 2026-09-20 and then notes `sourceSnapshotArchived` remains false until NLSC results are preserved. Those bytes are not in this workspace. |

`npm run ingest:company-registry` and `GCIS_NLSC_LIMIT=0` were not run.

Next step: Owner must supply the 45,604,873-byte canonical file. Until its SHA matches, do not regenerate `summary.json` and do not import.

## 5. Supabase

Status: **BLOCKED** for any cloud gate. Read-only management API only.

- Env names present in this process: `SUPABASE_ACCESS_TOKEN` only. No `SUPABASE_URL`, service role, anon key, or `TDX_CLIENT_*`. `.env` and `.env.local` are absent. Token value was not printed.
- `GET /v1/projects/rxzbsthsqlozxgctdoks` → HTTP 200. `name` NavPilot, `status` **INACTIVE**, region `ap-northeast-1`, database version `17.6.1.166`, created `2026-09-16T05:07:28.60616Z`.
- Security advisors returned `{"lints":[]}` while the project is INACTIVE. That is not a live RLS pass.
- No database query and no restore call. Row counts are **UNKNOWN**.
- Repo migrations on Phase 5.3a enable RLS on the NavPilot tables they create and add public-read policies plus anon execute grants for search RPCs. `20260917234436_phase53a_advisor_remediation.sql` states `public.spatial_ref_sys` cannot have RLS enabled by a project migration. Live policy state remains unconfirmed until the project is readable without an unpause from this task.

## 6. TDX RoadEvent v1

Status: **PARTIAL**. Spec was read. No live call, because no TDX credentials exist.

Source: `https://tdx.transportdata.tw/webapi/File/Swagger/V3/60abfa19-ffe3-4eef-a4b1-0539435dfca9` (the HTML swagger page is a client app; the OAS file is the spec). Info version `v1`, title `道路事件`.

Paths:

- `GET /v1/Traffic/RoadEvent/Event/Highway` scheduled provincial-highway events
- `GET /v1/Traffic/RoadEvent/Event/City/{City}` scheduled city events
- `GET /v1/Traffic/RoadEvent/LiveEvent/Highway`
- `GET /v1/Traffic/RoadEvent/LiveEvent/Freeway`
- `GET /v1/Traffic/RoadEvent/LiveEvent/City/{City}`
- `GET /v1/Traffic/RoadEvent/Authority`

Scheduled city enum: Taipei, NewTaipei, Taoyuan, Taichung, Tainan, Keelung, MiaoliCounty, ChiayiCounty, PingtungCounty, YilanCounty, KinmenCounty. **Kaohsiung is not in this enum.**

Live city enum adds Kaohsiung. Yunlin, Chiayi City, Hsinchu, Changhua, Nantou, Hualien, Taitung, Penghu, and others are absent. Coverage is not national.

Geometry fields `Positions` and `Geometry` are nullable strings. Guest mode is documented as 20 browser calls per IP per day. This audit made **zero** RoadEvent API calls.

Highway bureau HTML (`https://www.thb.gov.tw/NewsConstructionRoad.aspx?n=353`) returned an Incapsula shell, not the notice list.

Tainan open data page `9b81b8ff-84b2-486c-926e-6e5512ab1072` prerender lists historical dig statistics (newest title `道路挖掘案件資料統計202306`) plus older annual files. It is not a 2026-10-28 live construction feed. No public query API was verified on `diggis.tainan.gov.tw`.

`NavPilot_roadwork_official_sample_20261019.json` is not in the repo, uploads, or home directory. It was not invented.

## 7. Gate snapshot at audit

| Gate | Status |
| --- | --- |
| G0 workspace | PASS for clean `main`. Historical branches are unmerged. |
| G1 canonical 658,971 | BLOCKED. File absent. |
| G2 old 812,257 summary | PARTIAL. Git summary is explicitly historical and not importable. No new summary was written, because the canonical file is missing. |
| G3 Supabase | BLOCKED. Project INACTIVE. Live RLS and row counts not confirmed. |
| G4 TDX | PARTIAL. Spec and coverage recorded. Credentials absent. No live probe. |
| G5–G8 | Not part of the read-only audit. Road-construction code is on `cursor/road-construction-layer-dcd2` and is not a production authorization. |

## 8. Not done

- NLSC rescan, geocode, checkpoint edit, or master overwrite
- Supabase unpause, migration, or upsert
- Production deploy, merge to `main`
- Treating the 11-notice attachment as present
