const base = process.env.PARKING_SYNC_URL ?? "http://127.0.0.1:43145/api/parking/sync";
const key = process.env.PARKING_SYNC_KEY ?? "";

const response = await fetch(base, {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(key ? { "x-parking-sync-key": key } : {}),
  },
  body: JSON.stringify({ force: true }),
});

if (!response.ok) {
  console.error(`sync failed ${response.status}`);
  process.exit(1);
}

const payload = await response.json();
console.log(JSON.stringify(payload, null, 2));
