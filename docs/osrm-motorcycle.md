# Taiwan motorcycle routing (OSRM)

NavPilot asks `/api/directions?mode=car|motorcycle`. The route handler proxies to OSRM. It does not run a routing engine inside Vercel.

| Mode | Env var | When unset |
| --- | --- | --- |
| `car` | `OSRM_CAR_URL` | Public demo `https://router.project-osrm.org/route/v1/driving` (no SLA) |
| `motorcycle` | `OSRM_MOTORCYCLE_URL` | HTTP 501 `NOT_CONFIGURED` |

Both values are server-only. Do not prefix them with `NEXT_PUBLIC_`. Do not point the motorcycle URL at `router.project-osrm.org`: that server is a car graph and the API rejects it.

The UI toggle is the 汽車 / 機車 pair on the route confirm card. Choosing a mode replans the current destination through `planDrivingRoute`, which sends `mode` to `/api/directions`. The handler builds `GET {base}/lon,lat;lon,lat?overview=full&geometries=geojson&steps=true`. The path segment stays `driving` because that is the OSRM service name; the motorcycle behavior is compiled into the graph by `osrm/profiles/motorcycle.lua`.

Production on Vercel should leave `OSRM_MOTORCYCLE_URL` empty until someone is actually running `osrm-routed`. This repo does not provision a host.

## Why a custom profile

OSRM ships `car`, `bicycle`, and `foot` only. There is no official motorcycle profile. `osrm/profiles/motorcycle.lua` is the car profile from the pinned image, changed for ordinary Taiwan scooters (not 大型重機):

- `highway=motorway` and `motorway_link` are closed. That is the 國道 ban. `motorcycle=yes` does not reopen them.
- `motorroad=yes` and `expressway=yes` are closed unless `moped` or `motorcycle` is `yes`, `designated`, or `permissive`. That is the stand-in for 快速道路. Untagged `highway=trunk` stays open (省道 such as 台1).
- `trunk` / `trunk_link` whose `ref` is `61`, `61甲`, `62`, `64`, `65`, `66`, `68`, `72`, `74`, `76`, `78`, `82`, `84`, `86`, or `88` is closed the same way. In the 2026-10-29 extract, hundreds of 台61 trunk ways have no `motorroad` tag, and a scooter router will otherwise follow 西部濱海快速公路. `primary` + `ref=61` stays open (often the parallel coastal road).
- Access hierarchy is `moped`, `motorcycle`, `motor_vehicle`, `vehicle`, `access`. `moped=no` blocks scooters even when `motorcycle=yes`. `motorcycle=no`, `motor_vehicle=no`, and `access=no` block. `motorcar=*` is ignored, so a `motorcar=no` alley stays open.
- `oneway:moped` and `oneway:motorcycle` are read before plain `oneway`.
- `motorcycle:conditional` (displacement rules used for 大型重機) is not evaluated. OSRM cannot test engine size, so a conditional allow does not open the way.
- Scooter speed is capped at 80 km/h. One-lane and narrow streets are not given the car profile's routability penalty, because those streets are normal scooter roads.
- In `process_turn`, a left turn (`turn.angle` between -150 and -30) on a primary-or-above road, or on a way with 3 or more lanes, adds 20 seconds. This does **not** build a 兩段式左轉. The route geometry still turns left in one movement. The penalty only makes that turn a bit slower so a similar straight alternative can win.

## Tag coverage

Counted with `osrm/scripts/count-taiwan-tags.py` on Geofabrik `taiwan-latest.osm.pbf`, replication timestamp `2026-10-29T21:21:26Z`.

| Item | Count |
| --- | --- |
| Ways | 1,897,391 |
| Ways with `highway=*` | 830,601 |
| `motorcycle=*` | 3,307 (0.40% of highway ways): `no` 1,644, `yes` 1,193, `designated` 407, `permissive` 21, `private` 13, `>250 cc` 8, `>150 cc` 6 |
| `motor_vehicle=*` | 5,020: `no` 2,826, `yes` 1,451, `private` 367, `designated` 140 |
| `motorcar=*` | 1,285: `no` 858, `yes` 305, `designated` 80 |
| `moped=*` | 432: `no` 221, `designated` 128, `yes` 76 |
| `motorcycle:conditional` | 662, mostly displacement conditions |
| `access=no` | 5,383 |
| `highway=motorway` | 3,281. Motorcycle tag present on 180 (179 `no`, 1 `yes`). **3,101 (94.5%) have no `motorcycle` tag.** |
| `highway=motorway_link` | 3,804. Motorcycle tag on 31, all `no`. 3,773 untagged. |
| `expressway=yes` | 123 (primary 82, tertiary 22, secondary 19) |
| `motorroad=yes` | 2,434 (trunk 1,413, primary 354, trunk_link 296, primary_link 128, …) |
| `highway=trunk` | 2,178 |
| Way `name` containing 快速道路 or 快速公路 | 0 |
| `oneway:motorcycle=no` | 60 |
| `oneway:moped=no` | 17 |
| `service=alley` | 110,122 (106,064 of them `highway=service`) |
| `service` / `residential` / `living_street` with `motorcar=no` or `private` | 581, many of them `motorcycle=yes` or `designated` |

A profile that only obeyed `motorcycle=no` would still ride 國道. The hard motorway ban is there because the tag is missing, not because the tag is wrong.

## Build and run

Official image, pinned because Docker Hub `osrm/osrm-backend:latest` was published 2021-07-20 and there is no newer tag on that registry:

`osrm/osrm-backend@sha256:af5d4a83fb90086a43b1ae2ca22872e6768766ad5fcbb07a29ff90ec644ee409`

git `dca35dcc8676df6fa93f491a7b157136918173d5`. `osrm/profiles/car.lua` is that image's `/opt/car.lua`.

```bash
npm run osrm:build    # download + osrm-extract / partition / customize (MLD)
npm run osrm:routed   # car on :5000, motorcycle on :5001
```

Or `docker compose -f osrm/docker-compose.yml up` after the build. Extracts and `.osrm*` files live in `osrm/data/` and are gitignored.

```bash
OSRM_CAR_URL=http://127.0.0.1:5000/route/v1/driving
OSRM_MOTORCYCLE_URL=http://127.0.0.1:5001/route/v1/driving
```

## Hosting

`osrm-routed` is a long-running process with a multi-gigabyte graph. Vercel Functions cannot host it. This change does not create a Fly, Railway, or VM bill.

Ways to run it later, on infrastructure you already operate:

- The Docker image in this repo, on a machine you control (the same flow as `npm run osrm:routed`).
- A small VPS or a spare always-on box with the published image. Taiwan MLD graphs are a few gigabytes of disk and about 1 GB of RAM once `osrm-routed` is up; extract needs more RAM for a few minutes.
- Not the public Project OSRM demo. It is car-only, rate-limited, and not a motorcycle graph.

Until that process exists, leave `OSRM_MOTORCYCLE_URL` unset in the Vercel project. The app keeps car routing and shows the motorcycle button as not configured.

## Routes checked against this extract

Local `osrm-routed` on the 2026-10-29 Taiwan graph. Motorway overlap is route length whose midpoint sits within 25 m of `highway=motorway` or `motorway_link`. A few hundred metres can be an interchange the surface road passes under.

| Trip | Mode | Distance | Duration | On a motorway geometry | Notes |
| --- | --- | --- | --- | --- | --- |
| 斗六火車站 → 高鐵雲林站 | car | 14.8 km | 21.0 min | 0.6 km | Neither mode takes 國道. The roads between these two are local. |
| 斗六火車站 → 高鐵雲林站 | motorcycle | 14.8 km | 21.2 min | 0.6 km | Same corridor, scooter timing. |
| 彰化火車站 → 嘉義火車站(出口) | car | 75.4 km | 59.9 min | 66.6 km | Step `1 中山高速公路` for 64.7 km. |
| 彰化火車站 → 嘉義火車站(出口) | motorcycle | 74.7 km | 99.3 min | 0.8 km | No freeway or 快速公路 in the step names. |
| 台北車站 → 台中車站 | car | 159.2 km | 127.3 min | 142.1 km | 福爾摩沙高速公路 then 中山高速公路. |
| 台北車站 → 台中車站 | motorcycle | 158.3 km | 214.5 min | 1.2 km | Does not name 西部濱海快速公路. |

A point on 國道1 in Yunlin (`120.47616, 23.71546`, 中山高速公路) snaps the car graph onto that carriageway (0 m). The motorcycle graph snaps 50 m away, onto a different way.

## Limitations

- 兩段式左轉 is not a path. Riders still get a single left-turn instruction; only the duration grows by 20 seconds on large roads.
- 大型重機 exceptions (`motorcycle:conditional` with a displacement) are not modeled. Those ways stay closed for this scooter profile.
- 快速道路 are inferred from `motorroad=yes` and `expressway=yes`, not from the Chinese name (the name is unused in this extract). A provincial road wrongly tagged `motorroad=yes` will be avoided. A real expressway with neither tag will be allowed.
- `minspeed=*` is not a ban by itself.
- The public car fallback is the Project OSRM demo. It is not the same graph as the local Taiwan car build, and it should not be treated as production routing.
- The pinned image is the newest official Docker Hub build, and it is from 2021. Newer OSRM source exists upstream but is not what that registry publishes.
