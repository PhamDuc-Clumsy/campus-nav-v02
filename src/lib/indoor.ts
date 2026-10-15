// Indoor floor layouts (procedural demo blueprints) + vehicle-aware multi-floor routing.
import type { Room, VehicleId } from "./campus";

export const IN_W = 800;
export const IN_H = 500;
const CY = 250; // corridor centre line

export type IndoorNodeKind = "entrance" | "ramp" | "elevator" | "stairs" | "hallway" | "room_door";
export type IndoorFlag = "wheelchair_accessible" | "elevator_link" | "stairs_only" | "walk_only";
export type IndoorNode = { id: string; floor: number; x: number; y: number; kind: IndoorNodeKind; label: string };
export type IndoorEdge = { a: string; b: string; flags: IndoorFlag[] };
export type RoomBox = { key: string; floor: number; x: number; y: number; w: number; h: number; label: string; code: string; roomId?: string; kind: string; side: "top" | "bottom" };
export type FloorLayout = { floor: number; boxes: RoomBox[]; nodes: IndoorNode[]; edges: IndoorEdge[] };

const isDorm = (buildingId: string) => buildingId.startsWith("dom");

/** Generate a demo floor layout; seeded rooms on that floor take the first slots. */
export function floorLayout(buildingId: string, floor: number, rooms: Room[]): FloorLayout {
  const dorm = isDorm(buildingId);
  const perSide = dorm ? 6 : 5;
  const x0 = 140, x1 = 660, w = (x1 - x0) / perSide;
  const mine = rooms.filter((r) => r.building_id === buildingId && r.floor === floor);
  const fillers: { label: string; kind: string }[] = dorm
    ? [{ label: "Phòng giặt", kind: "laundry" }, { label: "Lối thoát hiểm", kind: "exit" }]
    : [{ label: "Nhà vệ sinh", kind: "wc" }, { label: floor === 1 ? "Sảnh / Atrium" : "Phòng học lớn", kind: floor === 1 ? "atrium" : "hall" }];
  const boxes: RoomBox[] = [];
  let mi = 0, fi = 0, num = 1;
  for (let i = 0; i < perSide * 2; i++) {
    const side = i < perSide ? "top" : "bottom";
    const col = i % perSide;
    const x = x0 + col * w, y = side === "top" ? 40 : CY + 40, h = CY - 80;
    const code = `${floor}${String(num).padStart(2, "0")}`;
    const r = mine[mi];
    // reserve the last bottom slot(s) for amenities
    const isFiller = i >= perSide * 2 - fillers.length && fi < fillers.length && !r;
    if (r) { mi++; boxes.push({ key: r.id, floor, x, y, w, h, label: r.name, code: r.code ?? code, roomId: r.id, kind: r.kind, side }); num++; }
    else if (isFiller) { const f = fillers[fi++]!; boxes.push({ key: `f${i}`, floor, x, y, w, h, label: f.label, code: "", kind: f.kind, side }); }
    else { boxes.push({ key: `g${i}`, floor, x, y, w, h, label: dorm ? `Phòng ${code}` : `Phòng học ${code}`, code, kind: "room", side }); num++; }
  }
  const id = (s: string) => `${floor}:${s}`;
  const nodes: IndoorNode[] = [
    { id: id("stairs"), floor, x: 80, y: CY, kind: "stairs", label: "Cầu thang bộ" },
    { id: id("elev"), floor, x: 720, y: CY, kind: "elevator", label: "Thang máy A (trợ năng)" },
  ];
  const edges: IndoorEdge[] = [];
  const hall: string[] = [];
  for (let c = 0; c < perSide; c++) {
    const hid = id(`h${c}`); hall.push(hid);
    nodes.push({ id: hid, floor, x: x0 + c * w + w / 2, y: CY, kind: "hallway", label: "Hành lang" });
  }
  hall.forEach((h, i) => { if (i) edges.push({ a: hall[i - 1]!, b: h, flags: ["wheelchair_accessible"] }); });
  edges.push({ a: id("stairs"), b: hall[0]!, flags: ["wheelchair_accessible"] });
  edges.push({ a: id("elev"), b: hall[hall.length - 1]!, flags: ["wheelchair_accessible"] });
  for (const b of boxes) {
    const col = Math.round((b.x - x0) / w);
    const dy = b.side === "top" ? b.y + b.h : b.y;
    const did = id(`d:${b.key}`);
    nodes.push({ id: did, floor, x: b.x + b.w / 2, y: dy, kind: "room_door", label: b.label });
    edges.push({ a: hall[col]!, b: did, flags: ["wheelchair_accessible"] });
  }
  if (floor === 1) {
    const mid = hall[Math.floor(perSide / 2)]!;
    nodes.push({ id: id("entrance"), floor, x: 400, y: 485, kind: "entrance", label: "Sảnh chính (bậc thềm)" });
    nodes.push({ id: id("ramp"), floor, x: 250, y: 485, kind: "ramp", label: "Lối dốc trợ năng" });
    // Main entrance has front steps → not wheelchair accessible. Ramp is step-free.
    edges.push({ a: id("entrance"), b: mid, flags: ["stairs_only"] });
    edges.push({ a: id("ramp"), b: hall[1]!, flags: ["wheelchair_accessible"] });
  }
  return { floor, boxes, nodes, edges };
}

export function buildingFloors(buildingId: string, floors: number, rooms: Room[]) {
  const n = Math.max(1, floors, ...rooms.filter((r) => r.building_id === buildingId).map((r) => r.floor));
  return Array.from({ length: n }, (_, i) => floorLayout(buildingId, i + 1, rooms));
}

/** Stairs for short climbs (≤2 floors) when walking; elevators otherwise. Wheelchair: always elevator. */
export function verticalMode(v: VehicleId, climb: number): "stairs" | "elevator" {
  if (v === "wheelchair") return "elevator";
  return climb <= 2 ? "stairs" : "elevator";
}

export type IndoorStep = { text: string; icon: string; floor: number };
export type IndoorRoute = { nodes: IndoorNode[]; byFloor: Record<number, [number, number][]>; steps: IndoorStep[]; mode: "stairs" | "elevator"; meters: number };

const IN_M_PER_UNIT = 0.06; // ~48 m across the demo blueprint

/** Route from the ground-floor entrance (or ramp) to a target room box. */
export function indoorRoute(layouts: FloorLayout[], target: RoomBox, v: VehicleId): IndoorRoute | null {
  const climb = target.floor - 1;
  const mode = verticalMode(v, climb);
  const wheel = v === "wheelchair";
  const nodes = new Map<string, IndoorNode>();
  const edges: IndoorEdge[] = [];
  for (const l of layouts) { l.nodes.forEach((n) => nodes.set(n.id, n)); edges.push(...l.edges); }
  for (let f = 1; f < layouts.length; f++) {
    edges.push({ a: `${f}:stairs`, b: `${f + 1}:stairs`, flags: ["stairs_only"] });
    edges.push({ a: `${f}:elev`, b: `${f + 1}:elev`, flags: ["elevator_link", "wheelchair_accessible"] });
  }
  const allowed = (e: IndoorEdge) => {
    const vertical = nodes.get(e.a)!.floor !== nodes.get(e.b)!.floor;
    if (wheel && e.flags.includes("stairs_only")) return false;
    if (vertical && mode === "stairs" && e.flags.includes("elevator_link")) return false;
    if (vertical && mode === "elevator" && e.flags.includes("stairs_only")) return false;
    return true;
  };
  const adj = new Map<string, { to: string; w: number }[]>();
  for (const e of edges) {
    if (!allowed(e)) continue;
    const A = nodes.get(e.a), B = nodes.get(e.b); if (!A || !B) continue;
    const w = A.floor !== B.floor ? 100 : Math.hypot(A.x - B.x, A.y - B.y);
    (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push({ to: e.b, w });
    (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push({ to: e.a, w });
  }
  const start = wheel ? "1:ramp" : "1:entrance";
  const goal = `${target.floor}:d:${target.key}`;
  if (!nodes.has(start) || !nodes.has(goal)) return null;
  const dist = new Map([[start, 0]]); const prev = new Map<string, string>(); const open = new Set([start]);
  while (open.size) {
    let u = "", m = Infinity; open.forEach((k) => { if (dist.get(k)! < m) { m = dist.get(k)!; u = k; } });
    if (u === goal) break; open.delete(u);
    for (const { to, w } of adj.get(u) ?? []) { const nd = m + w; if (nd < (dist.get(to) ?? Infinity)) { dist.set(to, nd); prev.set(to, u); open.add(to); } }
  }
  if (!dist.has(goal)) return null;
  const chain = [goal]; while (chain[0] !== start) chain.unshift(prev.get(chain[0]!)!);
  const path = chain.map((k) => nodes.get(k)!);
  const byFloor: Record<number, [number, number][]> = {};
  for (const n of path) (byFloor[n.floor] ??= []).push([n.x, n.y]);
  let flat = 0;
  for (let i = 1; i < path.length; i++) if (path[i]!.floor === path[i - 1]!.floor) flat += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  return { nodes: path, byFloor, steps: indoorSteps(path, target, mode, wheel), mode, meters: Math.round(flat * IN_M_PER_UNIT) };
}

function indoorSteps(path: IndoorNode[], target: RoomBox, mode: "stairs" | "elevator", wheel: boolean): IndoorStep[] {
  const steps: IndoorStep[] = [];
  steps.push(wheel
    ? { text: "Đi lối dốc trợ năng vào sảnh", icon: "♿", floor: 1 }
    : { text: "Bước vào sảnh chính", icon: "🚪", floor: 1 });
  if (target.floor > 1) {
    const vIdx = path.findIndex((n) => n.kind === (mode === "elevator" ? "elevator" : "stairs"));
    const before = vIdx > 0 ? segMeters(path.slice(0, vIdx + 1)) : 0;
    steps.push(mode === "elevator"
      ? { text: `Đi ${before} m tới Thang máy A${wheel ? " (trợ năng)" : ""}`, icon: "🛗", floor: 1 }
      : { text: `Đi ${before} m tới cầu thang bộ`, icon: "🪜", floor: 1 });
    steps.push(mode === "elevator"
      ? { text: `Lên Tầng ${target.floor} bằng thang máy`, icon: "⬆️", floor: target.floor }
      : { text: `Lên cầu thang bộ tới Tầng ${target.floor}`, icon: "⬆️", floor: target.floor });
  }
  const onFloor = path.filter((n) => n.floor === target.floor);
  const startIdx = target.floor > 1 ? 0 : 1;
  const leg = onFloor.slice(startIdx);
  const m = segMeters(leg);
  const from = leg[0];
  const door = leg[leg.length - 1]!;
  const turn = from && from.kind !== "entrance" && from.kind !== "ramp"
    ? (door.x > from.x ? "phải" : "trái") : null;
  const flat = wheel ? " theo hành lang phẳng" : " theo hành lang";
  steps.push({ text: `${target.floor > 1 ? "Ra khỏi " + (mode === "elevator" ? "thang" : "cầu thang") + ", rẽ " + (turn ?? "phải") : "Đi"}${flat} ${m} m`, icon: turn === "trái" ? "↩️" : "↪️", floor: target.floor });
  // Corridor runs left→right; facing the walking direction, top rooms are on the left when heading right.
  const headingRight = from ? door.x >= from.x : true;
  const side = (target.side === "top") === headingRight ? "trái" : "phải";
  steps.push({ text: `Đến ${target.code ? `P.${target.code} — ` : ""}${target.label} bên tay ${side}`, icon: "🏁", floor: target.floor });
  return steps;
}

function segMeters(ns: IndoorNode[]) {
  let s = 0; for (let i = 1; i < ns.length; i++) if (ns[i]!.floor === ns[i - 1]!.floor) s += Math.hypot(ns[i]!.x - ns[i - 1]!.x, ns[i]!.y - ns[i - 1]!.y);
  return Math.round(s * IN_M_PER_UNIT);
}

export function findBox(layouts: FloorLayout[], roomId: string | null | undefined) {
  if (!roomId) return null;
  for (const l of layouts) { const b = l.boxes.find((x) => x.roomId === roomId); if (b) return b; }
  return null;
}
