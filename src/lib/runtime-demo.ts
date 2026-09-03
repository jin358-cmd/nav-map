/** Production 永遠關閉示範資料。僅在明確開啟時可用。 */
export function isDemoDataEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO === "1";
}
