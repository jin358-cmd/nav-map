import type { CctvFallbackRecord } from "@/lib/cctv-normalize";

declare const fallbackCatalog: {
  sourceLabel: string;
  origin: {
    city: string;
    freeway: string;
    cityFetchedAt: string;
    freewayFetchedAt: string;
    cityApi: string;
    freewayApi: string;
  };
  scope: string;
  count: number;
  cameras: CctvFallbackRecord[];
};

export default fallbackCatalog;
