export function elevatedGroundChoiceEnabled(
  env: { flag?: string | undefined; vercelEnv?: string | undefined } = {
    flag: process.env.NEXT_PUBLIC_ELEVATED_GROUND_CHOICE,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV,
  },
): boolean {
  const flag = env.flag?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  if (flag === "1" || flag === "true" || flag === "on") return true;
  return env.vercelEnv !== "production";
}

export function elevatedGroundFixtureMode(
  search: string,
  nodeEnv = process.env.NODE_ENV,
): "near" | "far" | null {
  if (nodeEnv === "production") return null;
  const value = new URLSearchParams(search).get("egFixture");
  if (value === "near" || value === "far") return value;
  return null;
}
