import { TAINAN_ACCIDENTS } from "@/data/mock-route";
import type { AccidentReport } from "@/types/domain";

export async function fetchAccidentReports(): Promise<AccidentReport[]> {
  return TAINAN_ACCIDENTS;
}
