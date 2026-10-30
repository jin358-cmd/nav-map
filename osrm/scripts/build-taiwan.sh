#!/usr/bin/env bash
# Download the Geofabrik Taiwan extract and build MLD graphs for the car
# and motorcycle profiles with the official osrm/osrm-backend image.
# Graph files stay under osrm/data/ and are gitignored.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/data"
PROFILES="$ROOT/profiles"
PBF_URL="${OSRM_PBF_URL:-https://download.geofabrik.de/asia/taiwan-latest.osm.pbf}"
IMAGE="${OSRM_IMAGE:-osrm/osrm-backend@sha256:af5d4a83fb90086a43b1ae2ca22872e6768766ad5fcbb07a29ff90ec644ee409}"
PBF="$DATA/taiwan-latest.osm.pbf"

if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
elif sudo docker info >/dev/null 2>&1; then
  DOCKER=(sudo docker)
else
  echo "Docker is not available. osrm-routed cannot be built without it." >&2
  exit 1
fi

mkdir -p "$DATA"

if [[ ! -f "$PBF" ]]; then
  echo "Downloading $PBF_URL"
  curl -L --fail --retry 3 -o "$PBF.partial" "$PBF_URL"
  mv "$PBF.partial" "$PBF"
fi

build_profile() {
  local name="$1"
  local profile="$PROFILES/${name}.lua"
  local out="$DATA/$name"
  mkdir -p "$out"
  if [[ ! -f "$profile" ]]; then
    echo "Missing profile $profile" >&2
    exit 1
  fi
  if [[ -f "$out/taiwan.osrm.cell_metrics" && "${OSRM_FORCE:-0}" != "1" ]]; then
    echo "Skipping $name (taiwan.osrm.cell_metrics exists; set OSRM_FORCE=1 to rebuild)"
    return
  fi
  ln -f "$PBF" "$out/taiwan.osm.pbf"
  echo "Extracting $name"
  "${DOCKER[@]}" run --rm \
    -v "$out:/data" \
    -v "$profile:/opt/${name}.lua:ro" \
    "$IMAGE" \
    osrm-extract -p "/opt/${name}.lua" /data/taiwan.osm.pbf
  echo "Partitioning $name"
  "${DOCKER[@]}" run --rm -v "$out:/data" "$IMAGE" \
    osrm-partition /data/taiwan.osrm
  echo "Customizing $name"
  "${DOCKER[@]}" run --rm -v "$out:/data" "$IMAGE" \
    osrm-customize /data/taiwan.osrm
}

if [[ $# -gt 0 ]]; then
  for name in "$@"; do
    build_profile "$name"
  done
else
  build_profile motorcycle
  build_profile car
fi
echo "MLD graphs are in $DATA"
