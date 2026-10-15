import type { Building } from "@/lib/campus";

export type FilterId = "all" | "lecture" | "dorm" | "food" | "parking";
export const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "lecture", label: "Giảng đường" },
  { id: "dorm", label: "Ký túc xá" },
  { id: "food", label: "Ăn uống / Tiện ích" },
  { id: "parking", label: "Bãi gửi xe" },
];
const isParking = (b: Pick<Building, "id" | "name" | "vi">) => /parking|bãi xe|bãi gửi/i.test(`${b.id} ${b.name} ${b.vi}`);

export function matchesFilter(b: Pick<Building, "id" | "name" | "vi" | "category">, f: FilterId) {
  if (f === "all") return true;
  if (f === "parking") return isParking(b);
  if (f === "food") return b.category === "amenity" && !isParking(b);
  return b.category === f;
}
