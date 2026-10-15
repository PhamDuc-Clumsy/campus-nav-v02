import { describe, it, expect } from "vitest";
import { travelMinutes, computeRoute, DEFAULT_BUILDINGS } from "@/lib/campus";

describe("campus routing", () => {
  it("walking 500m at 5km/h takes 6 minutes", () => {
    expect(travelMinutes(500, 5)).toBe(6);
  });
  it("route between two buildings has positive distance", () => {
    const r = computeRoute(DEFAULT_BUILDINGS[4]!, DEFAULT_BUILDINGS[13]!);
    expect(r.meters).toBeGreaterThan(0);
  });
});

import { routeOnGraph, segmentAllows } from "@/lib/campus";
describe("vehicle segment rules", () => {
  it("wheelchair cannot use stairs (walk_only without ramp)", () => {
    expect(segmentAllows(["walk_only"], "wheelchair")).toBe(false);
  });
  it("car cannot use a motor-only road", () => {
    expect(segmentAllows(["motor_allowed"], "car")).toBe(false);
  });
  it("walking can use any segment", () => {
    expect(segmentAllows(["walk_only"], "walk")).toBe(true);
  });
  it("car route avoids a walk-only shortcut", () => {
    const nodes = [{ id: "a", x: 0, y: 0, kind: "road" }, { id: "b", x: 1000, y: 0, kind: "road" }, { id: "c", x: 500, y: 500, kind: "road" }];
    const segs = [
      { id: "1", a: "a", b: "b", flags: ["walk_only"] },
      { id: "2", a: "a", b: "c", flags: ["car_allowed"] },
      { id: "3", a: "c", b: "b", flags: ["car_allowed"] },
    ];
    const A = { ...DEFAULT_BUILDINGS[0]!, x: 0, y: 0 }, B = { ...DEFAULT_BUILDINGS[1]!, x: 1000, y: 0 };
    expect(routeOnGraph(A, B, nodes, segs, "car")!.points).toContainEqual([500, 500]);
    expect(routeOnGraph(A, B, nodes, segs, "bus")).toBeNull();
  });
});

import { searchDirectory, buildDirections, pointAlong } from "@/lib/campus";
describe("directory & directions", () => {
  const rooms = [{ id: "r1", building_id: "alpha", floor: 3, name: "Hội trường Trịnh Công Sơn", code: "AL-301", kind: "hall" }];
  it("finds a room without accents and returns its parent building", () => {
    const h = searchDirectory("hoi truong trinh", DEFAULT_BUILDINGS, rooms);
    expect(h[0]!.building.id).toBe("alpha");
  });
  it("finds a room by code", () => {
    expect(searchDirectory("al-301", DEFAULT_BUILDINGS, rooms)[0]!.room!.id).toBe("r1");
  });
  it("directions start at origin and end at destination, with a right turn", () => {
    const A = DEFAULT_BUILDINGS[0]!, B = DEFAULT_BUILDINGS[1]!;
    const s = buildDirections([[0, 0], [100, 0], [100, 100]], A, B, []);
    expect(s[0]!.text).toContain(A.vi);
    expect(s.some((x) => x.text.startsWith("Rẽ phải"))).toBe(true);
    expect(s[s.length - 1]!.text).toContain(B.vi);
  });
  it("live position halfway along a route", () => {
    expect(pointAlong([[0, 0], [100, 0]], 50).p).toEqual([50, 0]);
  });
});

import { gpsToCanvas, isWithinCampus } from "@/lib/campus";
describe("gps projection", () => {
  it("north-west corner maps to (0,0) and outside points are clamped", () => {
    expect(gpsToCanvas(21.0168, 105.5225)).toEqual({ x: 0, y: 0 });
    expect(gpsToCanvas(20, 106)).toEqual({ x: 1000, y: 720 });
  });
  it("Hanoi center is off campus, campus center is on", () => {
    expect(isWithinCampus(21.0285, 105.8542)).toBe(false);
    expect(isWithinCampus(21.014, 105.526)).toBe(true);
  });
});

import { projectOnPolyline, isOffRoute } from "@/lib/campus";
describe("off-route detection", () => {
  const line: [number, number][] = [[0, 0], [100, 0]];
  it("10 m from the route is still on route", () => { expect(isOffRoute(line, [50, 10 / 0.7])).toBe(false); });
  it("30 m from the route triggers recalculation", () => { expect(isOffRoute(line, [50, 30 / 0.7])).toBe(true); });
  it("remaining distance counts from the projected point", () => { expect(projectOnPolyline(line, [40, 5]).along).toBe(40); });
});
