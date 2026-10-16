import type { VolunteerMapPoint } from "@/types/domain";

/**
 * Synthetic-only UI fixtures. These are public district-level reference points,
 * not volunteer homes. Real volunteer records must come from a separately
 * authorized server API and must never be bundled with the client.
 */
export const DEMO_VOLUNTEERS: VolunteerMapPoint[] = [
  {
    id: "demo-yongkang-a",
    displayName: "示範志工 A",
    district: "永康區",
    addressLabel: "永康區示意點（非住宅精確位置）",
    contactLabel: "私人資料源未連接",
    assignedGroup: "示範甲組",
    assignmentStatus: "assigned",
    geocodeStatus: "APPROX_DISTRICT",
    location: { lng: 120.2533, lat: 23.0262 },
    synthetic: true,
  },
  {
    id: "demo-yongkang-b",
    displayName: "示範志工 B",
    district: "永康區",
    addressLabel: "永康區示意點（非住宅精確位置）",
    contactLabel: "私人資料源未連接",
    assignedGroup: "未分組",
    assignmentStatus: "unassigned",
    geocodeStatus: "APPROX_DISTRICT",
    location: { lng: 120.2472, lat: 23.0185 },
    synthetic: true,
  },
  {
    id: "demo-east-a",
    displayName: "示範志工 C",
    district: "東區",
    addressLabel: "東區示意點（非住宅精確位置）",
    contactLabel: "私人資料源未連接",
    assignedGroup: "示範乙組",
    assignmentStatus: "completed",
    geocodeStatus: "APPROX_DISTRICT",
    location: { lng: 120.2268, lat: 22.9818 },
    synthetic: true,
  },
  {
    id: "demo-north-a",
    displayName: "示範志工 D",
    district: "北區",
    addressLabel: "北區示意點（非住宅精確位置）",
    contactLabel: "私人資料源未連接",
    assignedGroup: "待核對",
    assignmentStatus: "unassigned",
    geocodeStatus: "REVIEW_REQUIRED",
    location: { lng: 120.2095, lat: 23.0094 },
    synthetic: true,
  },
];
