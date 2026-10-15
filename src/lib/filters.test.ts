import { describe, expect, it } from "vitest";
import { DEFAULT_BUILDINGS } from "@/lib/campus";
import { matchesFilter } from "@/lib/filters";
const ids = (f: Parameters<typeof matchesFilter>[1]) => DEFAULT_BUILDINGS.filter((b) => matchesFilter(b, f)).map((b) => b.id);
describe("map filters", () => {
  it("Bãi gửi xe shows only parking", () => expect(ids("parking")).toEqual(["parking"]));
  it("Ăn uống / Tiện ích excludes parking", () => { expect(ids("food")).toContain("canteen"); expect(ids("food")).not.toContain("parking"); });
  it("Giảng đường shows the 4 lecture halls", () => expect(ids("lecture")).toEqual(["alpha", "beta", "gamma", "delta"]));
});
