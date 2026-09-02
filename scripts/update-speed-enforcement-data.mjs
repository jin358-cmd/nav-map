import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const source =
  "https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/EA5E6FCD-B82D-43B7-A5CF-E9893253187E/resource/8F8822DA-2D76-45B4-8945-71F5FFD0DE85/download";
const target = path.join(
  process.cwd(),
  "src",
  "data",
  "speed-enforcement-public.json",
);

const response = await fetch(source, {
  headers: { Accept: "text/csv" },
  signal: AbortSignal.timeout(60_000),
});
if (!response.ok) {
  throw new Error(`Public speed dataset request failed (${response.status})`);
}

const csv = await response.text();
if (
  !csv.includes("CityName,RegionName,Address") ||
  !csv.includes("Longitude,Latitude")
) {
  throw new Error("Public speed dataset columns do not match the expected CSV");
}

await mkdir(path.dirname(target), { recursive: true });
await writeFile(
  target,
  `${JSON.stringify({ source, downloadedAt: new Date().toISOString(), csv })}\n`,
  "utf8",
);
console.log(`Updated ${target} (${csv.length.toLocaleString()} characters)`);
