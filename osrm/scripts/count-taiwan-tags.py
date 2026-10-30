#!/usr/bin/env python3
"""Count motorcycle-related tags on a Geofabrik Taiwan PBF.

Requires the osmium command-line tool. Prints JSON to stdout.
"""

import json
import subprocess
import sys
from collections import Counter


def tag_field(line: str) -> str:
    idx = line.find(" T")
    if idx < 0:
        return ""
    return line[idx + 2 :].split(" ", 1)[0]


def parse(field: str) -> dict[str, str]:
    tags: dict[str, str] = {}
    if not field:
        return tags
    for part in field.split(","):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        tags[key] = (
            value.replace("%2C", ",")
            .replace("%3D", "=")
            .replace("%20", " ")
            .replace("%25", "%")
        )
    return tags


def main() -> None:
    pbf = sys.argv[1] if len(sys.argv) > 1 else "osrm/data/taiwan-latest.osm.pbf"
    motorcycle: Counter[str] = Counter()
    motor_vehicle: Counter[str] = Counter()
    motorcar: Counter[str] = Counter()
    moped: Counter[str] = Counter()
    access: Counter[str] = Counter()
    highway: Counter[str] = Counter()
    expressway: Counter[str] = Counter()
    motorroad: Counter[str] = Counter()
    motorway_mc: Counter[str] = Counter()
    link_mc: Counter[str] = Counter()
    ways = highway_ways = named_express = alley = narrow = 0
    oneway_mc_no = oneway_moped_no = conditional = 0

    proc = subprocess.Popen(
        ["osmium", "cat", "-f", "opl", "-t", "way", pbf],
        stdout=subprocess.PIPE,
        text=True,
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        ways += 1
        tags = parse(tag_field(line))
        if not tags:
            continue
        hw = tags.get("highway")
        if hw:
            highway_ways += 1
            highway[hw] += 1
        if "motorcycle" in tags:
            motorcycle[tags["motorcycle"]] += 1
        if "motor_vehicle" in tags:
            motor_vehicle[tags["motor_vehicle"]] += 1
        if "motorcar" in tags:
            motorcar[tags["motorcar"]] += 1
        if "moped" in tags:
            moped[tags["moped"]] += 1
        if "access" in tags:
            access[tags["access"]] += 1
        if "expressway" in tags:
            expressway[f"{hw}|{tags['expressway']}"] += 1
        if "motorroad" in tags:
            motorroad[f"{hw}|{tags['motorroad']}"] += 1
        if tags.get("oneway:motorcycle") == "no":
            oneway_mc_no += 1
        if tags.get("oneway:moped") == "no":
            oneway_moped_no += 1
        if "motorcycle:conditional" in tags:
            conditional += 1
        if hw in {"motorway", "motorway_link"}:
            bucket = motorway_mc if hw == "motorway" else link_mc
            bucket[tags.get("motorcycle", "<unset>")] += 1
        name = tags.get("name", "")
        if hw and ("快速道路" in name or "快速公路" in name):
            named_express += 1
        if tags.get("service") == "alley":
            alley += 1
        if hw in {"service", "residential", "living_street"} and tags.get("motorcar") in {
            "no",
            "private",
        }:
            narrow += 1
    if proc.wait() != 0:
        raise SystemExit(proc.returncode)
    json.dump(
        {
            "pbf": pbf,
            "ways": ways,
            "highwayWays": highway_ways,
            "motorcycle": motorcycle.most_common(),
            "motorVehicle": motor_vehicle.most_common(12),
            "motorcar": motorcar.most_common(8),
            "moped": moped.most_common(),
            "accessNo": access.get("no", 0),
            "motorwayMotorcycle": motorway_mc,
            "motorwayLinkMotorcycle": link_mc,
            "expressway": expressway.most_common(),
            "motorroadYes": [
                item for item in motorroad.most_common() if item[0].endswith("|yes")
            ],
            "trunk": highway.get("trunk", 0),
            "namedExpressway": named_express,
            "onewayMotorcycleNo": oneway_mc_no,
            "onewayMopedNo": oneway_moped_no,
            "motorcycleConditional": conditional,
            "serviceAlley": alley,
            "narrowMotorcarRestricted": narrow,
        },
        sys.stdout,
        ensure_ascii=False,
        indent=2,
    )
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
