import { describe, expect, it } from "vitest";
import { buildingFloors, indoorRoute, verticalMode } from "./indoor";
import type { Room } from "./campus";

const rooms: Room[] = [{ id: "r302", building_id: "alpha", floor: 3, name: "Phòng 302", code: "302", kind: "room" }];
const layouts = buildingFloors("alpha", 5, rooms);
const target = layouts[2]!.boxes.find((b) => b.roomId === "r302")!;

describe("indoor routing", () => {
  it("wheelchair never uses stairs and enters via ramp", () => {
    const r = indoorRoute(layouts, target, "wheelchair")!;
    expect(r.mode).toBe("elevator");
    expect(r.nodes[0]!.kind).toBe("ramp");
    expect(r.nodes.some((n) => n.kind === "stairs")).toBe(false);
  });
  it("walking takes stairs for a 2-floor climb", () => {
    const r = indoorRoute(layouts, target, "walk")!;
    expect(r.mode).toBe("stairs");
    expect(r.nodes.some((n) => n.kind === "elevator")).toBe(false);
  });
  it("walking takes the elevator above 2 floors", () => {
    expect(verticalMode("walk", 3)).toBe("elevator");
    expect(verticalMode("walk", 2)).toBe("stairs");
  });
});
