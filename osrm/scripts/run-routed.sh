#!/usr/bin/env bash
# Run osrm-routed for the Taiwan car and motorcycle MLD graphs.
# Car listens on 127.0.0.1:5000, motorcycle on 127.0.0.1:5001.
# The URL profile segment stays "driving"; the graph selects the mode.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/data"
IMAGE="${OSRM_IMAGE:-osrm/osrm-backend@sha256:af5d4a83fb90086a43b1ae2ca22872e6768766ad5fcbb07a29ff90ec644ee409}"
CAR_PORT="${OSRM_CAR_PORT:-5000}"
MOTO_PORT="${OSRM_MOTORCYCLE_PORT:-5001}"

if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
elif sudo docker info >/dev/null 2>&1; then
  DOCKER=(sudo docker)
else
  echo "Docker is not available." >&2
  exit 1
fi

start_one() {
  local name="$1"
  local port="$2"
  local container="navpilot-osrm-${name}"
  if [[ ! -f "$DATA/$name/taiwan.osrm.cell_metrics" ]]; then
    echo "Missing $DATA/$name graph. Run osrm/scripts/build-taiwan.sh first." >&2
    exit 1
  fi
  "${DOCKER[@]}" rm -f "$container" >/dev/null 2>&1 || true
  "${DOCKER[@]}" run -d --name "$container" --restart no \
    -p "127.0.0.1:${port}:5000" \
    -v "$DATA/$name:/data:ro" \
    "$IMAGE" \
    osrm-routed --algorithm mld /data/taiwan.osrm
  echo "$name http://127.0.0.1:${port}/route/v1/driving"
}

start_one car "$CAR_PORT"
start_one motorcycle "$MOTO_PORT"
echo "OSRM_CAR_URL=http://127.0.0.1:${CAR_PORT}/route/v1/driving"
echo "OSRM_MOTORCYCLE_URL=http://127.0.0.1:${MOTO_PORT}/route/v1/driving"
