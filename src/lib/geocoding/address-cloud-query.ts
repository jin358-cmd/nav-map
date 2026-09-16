const SOUTH_IN = "(雲林縣,嘉義市,嘉義縣,臺南市,高雄市,屏東縣)";

export function addressFallbackSearchParams(query: string) {
  return new URLSearchParams({
    select:
      "id,display_address,normalized_address,latitude,longitude,accuracy,source,county,district,road",
    publish_status: "eq.published",
    county: `in.${SOUTH_IN}`,
    latitude: "not.is.null",
    longitude: "not.is.null",
    normalized_address: `ilike.*${query.trim()}*`,
    limit: "12",
  });
}
