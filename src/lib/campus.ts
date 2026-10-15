export type Category = "lecture" | "dorm" | "amenity";
export type Building = {
  id: string;
  name: string;
  vi: string;
  category: Category;
  x: number;
  y: number;
  desc: string;
  floors?: number | null;
};

export const MAP_W = 1000;
export const MAP_H = 720;
export const METERS_PER_UNIT = 0.7;

export const DEFAULT_BUILDINGS: Building[] = [
  { id: "alpha", name: "Alpha Building", vi: "Tòa Alpha", category: "lecture", x: 470, y: 300, desc: "Iconic dragon‑wave main hall: administration, library and lecture rooms." },
  { id: "beta", name: "Beta Building", vi: "Tòa Beta", category: "lecture", x: 640, y: 250, desc: "Lecture halls and labs for engineering and IT programs." },
  { id: "gamma", name: "Gamma Building", vi: "Tòa Gamma", category: "lecture", x: 700, y: 400, desc: "Classrooms, student services and event hall." },
  { id: "delta", name: "Delta Building", vi: "Tòa Delta", category: "lecture", x: 560, y: 470, desc: "New lecture building with modern seminar rooms." },
  { id: "doma", name: "Dorm A", vi: "Dom A", category: "dorm", x: 150, y: 170, desc: "Student dormitory A." },
  { id: "domb", name: "Dorm B", vi: "Dom B", category: "dorm", x: 230, y: 130, desc: "Student dormitory B." },
  { id: "domc", name: "Dorm C", vi: "Dom C", category: "dorm", x: 310, y: 110, desc: "Student dormitory C." },
  { id: "domd", name: "Dorm D", vi: "Dom D", category: "dorm", x: 130, y: 270, desc: "Student dormitory D." },
  { id: "dome", name: "Dorm E", vi: "Dom E", category: "dorm", x: 210, y: 320, desc: "Student dormitory E." },
  { id: "domf", name: "Dorm F", vi: "Dom F", category: "dorm", x: 130, y: 380, desc: "Student dormitory F." },
  { id: "domg", name: "Dorm G", vi: "Dom G", category: "dorm", x: 220, y: 430, desc: "Student dormitory G." },
  { id: "lake", name: "Lotus Lake", vi: "Hồ Sen", category: "amenity", x: 420, y: 470, desc: "Lotus lake at the campus heart — a favourite spot for a walk." },
  { id: "vovinam", name: "Vovinam Dojo", vi: "Võ đường Vovinam", category: "amenity", x: 820, y: 300, desc: "Training hall for the compulsory Vovinam martial arts course." },
  { id: "sports", name: "Sports Field", vi: "Khu thể thao / Sân bóng đá", category: "amenity", x: 820, y: 560, desc: "Football pitch, courts and outdoor sports area." },
  { id: "canteen", name: "Canteen & 7‑Eleven", vi: "Canteen & 7‑Eleven", category: "amenity", x: 330, y: 250, desc: "Main canteen and convenience store near the dorms." },
  { id: "parking", name: "Parking", vi: "Bãi xe", category: "amenity", x: 470, y: 620, desc: "Motorbike and car parking by the main gate." },
];

// Road network
export const ROAD_NODES: Record<string, [number, number]> = {
  g: [470, 680], r1: [470, 560], r2: [470, 400], r3: [470, 200], r4: [330, 200],
  r5: [180, 220], r6: [180, 350], r7: [180, 480], r8: [330, 380], r9: [620, 330],
  r10: [760, 330], r11: [760, 480], r12: [620, 560], r13: [760, 620], r14: [620, 200],
};
export const ROAD_EDGES: [string, string][] = [
  ["g", "r1"], ["r1", "r2"], ["r2", "r3"], ["r3", "r4"], ["r4", "r5"], ["r5", "r6"], ["r6", "r7"],
  ["r6", "r8"], ["r8", "r2"], ["r4", "r8"], ["r2", "r9"], ["r9", "r10"], ["r10", "r11"],
  ["r11", "r12"], ["r12", "r1"], ["r11", "r13"], ["r12", "r13"], ["r3", "r14"], ["r14", "r9"], ["r7", "r1"],
];

/** Default segment flags matching the DB seed — varied so switching vehicles shows visual differences. */
const SEG_FLAG_MAP: Record<string, string[]> = {
  "g-r1":    ["accessible_ramp", "motor_allowed", "car_allowed", "bus_route"],
  "r1-r2":   ["accessible_ramp", "motor_allowed", "car_allowed", "bus_route"],
  "r2-r3":   ["accessible_ramp", "motor_allowed", "car_allowed", "bus_route"],
  "r2-r9":   ["accessible_ramp", "motor_allowed", "car_allowed", "bus_route"],
  "r9-r10":  ["accessible_ramp", "motor_allowed", "car_allowed", "bus_route"],
  "r10-r11": ["accessible_ramp", "motor_allowed", "car_allowed", "bus_route"],
  "r11-r12": ["accessible_ramp", "motor_allowed", "car_allowed", "bus_route"],
  "r12-r1":  ["accessible_ramp", "motor_allowed", "car_allowed", "bus_route"],
  "r3-r4":   ["accessible_ramp", "motor_allowed", "car_allowed", "bus_route"],
  "r4-r5":   ["motor_allowed", "accessible_ramp"],
  "r5-r6":   ["motor_allowed", "accessible_ramp"],
  "r6-r7":   ["motor_allowed", "accessible_ramp"],
  "r7-r1":   ["motor_allowed", "accessible_ramp"],
  "r6-r8":   ["walk_only"],
  "r8-r2":   ["walk_only"],
  "r4-r8":   ["walk_only"],
  "r11-r13": ["accessible_ramp", "bus_route"],
  "r12-r13": ["accessible_ramp", "bus_route"],
  "r3-r14":  ["accessible_ramp", "motor_allowed", "car_allowed"],
  "r14-r9":  ["accessible_ramp", "motor_allowed", "car_allowed"],
};
export const DEFAULT_SEGMENTS: Segment[] = ROAD_EDGES.map(([a, b]) => ({
  id: `${a}-${b}`, a, b, flags: SEG_FLAG_MAP[`${a}-${b}`] ?? ["walk_only"],
}));

export type VehicleId = "walk" | "motor" | "car" | "bus" | "wheelchair";
export const VEHICLES: { id: VehicleId; label: string; vi: string; kmh: number; emoji: string }[] = [
  { id: "walk", label: "Walk", vi: "Đi bộ", kmh: 5, emoji: "🚶" },
  { id: "motor", label: "Motor", vi: "Xe máy", kmh: 25, emoji: "🛵" },
  { id: "car", label: "Car", vi: "Ô tô", kmh: 20, emoji: "🚗" },
  { id: "bus", label: "Bus", vi: "Xe đưa đón", kmh: 15, emoji: "🚌" },
  { id: "wheelchair", label: "Wheelchair", vi: "Xe lăn", kmh: 3, emoji: "♿" },
];

const d = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function nearest(p: [number, number]) {
  let best = "g", bd = Infinity;
  for (const [k, v] of Object.entries(ROAD_NODES)) {
    const dd = d(p, v);
    if (dd < bd) { bd = dd; best = k; }
  }
  return best;
}

export function computeRoute(a: Building, b: Building) {
  const pa: [number, number] = [a.x, a.y], pb: [number, number] = [b.x, b.y];
  const s = nearest(pa), t = nearest(pb);
  const dist: Record<string, number> = {}; const prev: Record<string, string> = {};
  const q = new Set(Object.keys(ROAD_NODES));
  q.forEach((k) => (dist[k] = Infinity));
  dist[s] = 0;
  while (q.size) {
    let u = ""; let m = Infinity;
    q.forEach((k) => { if (dist[k]! < m) { m = dist[k]!; u = k; } });
    if (!u || u === t) break;
    q.delete(u);
    for (const [x, y] of ROAD_EDGES) {
      const v = x === u ? y : y === u ? x : null;
      if (!v || !q.has(v)) continue;
      const nd = dist[u]! + d(ROAD_NODES[u]!, ROAD_NODES[v]!);
      if (nd < dist[v]!) { dist[v] = nd; prev[v] = u; }
    }
  }
  const chain: string[] = [t];
  while (chain[0] !== s && prev[chain[0]!]) chain.unshift(prev[chain[0]!]!);
  const pts: [number, number][] = [pa, ...chain.map((k) => ROAD_NODES[k]!), pb];
  const direct = d(pa, pb);
  const roadLen = pts.slice(1).reduce((acc, p, i) => acc + d(pts[i]!, p), 0);
  const usePts = direct < 90 ? [pa, pb] : pts;
  const len = direct < 90 ? direct : roadLen;
  return { points: usePts, meters: Math.round(len * METERS_PER_UNIT) };
}

export function travelMinutes(meters: number, kmh: number) {
  return Math.max(1, Math.round((meters / 1000 / kmh) * 60));
}

// ---------- Path network graph (CMS-editable) ----------
export const SEGMENT_FLAGS = [
  { id: "walk_only", label: "Chỉ đi bộ", hint: "Sân trong, cầu thang, lối nhỏ" },
  { id: "accessible_ramp", label: "Lối xe lăn", hint: "Không bậc thang" },
  { id: "motor_allowed", label: "Xe máy", hint: "Đường vòng tới bãi xe" },
  { id: "car_allowed", label: "Ô tô", hint: "Cổng chính tới điểm đón" },
  { id: "bus_route", label: "Xe buýt", hint: "Tuyến tới trạm xe buýt" },
] as const;
export type SegmentFlag = (typeof SEGMENT_FLAGS)[number]["id"];
export type Waypoint = { id: string; x: number; y: number; kind: string };
export type Segment = { id: string; a: string; b: string; flags: string[] };

/** Strict rule: which segments a vehicle may travel on. */
export function segmentAllows(flags: string[], v: VehicleId): boolean {
  switch (v) {
    case "walk": return true;
    case "wheelchair": return flags.includes("accessible_ramp");
    case "motor": return !flags.includes("walk_only") && flags.includes("motor_allowed");
    case "car": return !flags.includes("walk_only") && flags.includes("car_allowed");
    case "bus": return !flags.includes("walk_only") && flags.includes("bus_route");
  }
}

/** A* over allowed segments; buildings attach to the nearest usable waypoint. */
export function routeOnGraph(a: Building, b: Building, nodes: Waypoint[], segs: Segment[], v: VehicleId) {
  const pos = new Map(nodes.map((n) => [n.id, [n.x, n.y] as [number, number]]));
  const adj = new Map<string, { to: string; w: number }[]>();
  for (const s of segs) {
    if (!segmentAllows(s.flags, v)) continue;
    const pa = pos.get(s.a), pb = pos.get(s.b); if (!pa || !pb) continue;
    const w = d(pa, pb);
    (adj.get(s.a) ?? adj.set(s.a, []).get(s.a)!).push({ to: s.b, w });
    (adj.get(s.b) ?? adj.set(s.b, []).get(s.b)!).push({ to: s.a, w });
  }
  const pa: [number, number] = [a.x, a.y], pb: [number, number] = [b.x, b.y];
  if (v === "walk" && d(pa, pb) < 90) return { points: [pa, pb], meters: Math.round(d(pa, pb) * METERS_PER_UNIT) };
  const near = (p: [number, number]) => {
    let best: string | null = null, bd = Infinity;
    for (const k of adj.keys()) { const dd = d(p, pos.get(k)!); if (dd < bd) { bd = dd; best = k; } }
    return best;
  };
  const s = near(pa), t = near(pb);
  if (!s || !t) return null;
  const g = new Map<string, number>([[s, 0]]); const prev = new Map<string, string>();
  const open = new Set([s]); const h = (k: string) => d(pos.get(k)!, pos.get(t)!);
  while (open.size) {
    let u = ""; let m = Infinity;
    open.forEach((k) => { const f = g.get(k)! + h(k); if (f < m) { m = f; u = k; } });
    if (u === t) break;
    open.delete(u);
    for (const { to, w } of adj.get(u) ?? []) {
      const nd = g.get(u)! + w;
      if (nd < (g.get(to) ?? Infinity)) { g.set(to, nd); prev.set(to, u); open.add(to); }
    }
  }
  if (!g.has(t)) return null;
  const chain = [t]; while (chain[0] !== s) chain.unshift(prev.get(chain[0]!)!);
  const pts: [number, number][] = [pa, ...chain.map((k) => pos.get(k)!), pb];
  const len = pts.slice(1).reduce((acc, p, i) => acc + d(pts[i]!, p), 0);
  return { points: pts, meters: Math.round(len * METERS_PER_UNIT) };
}

// ---------- Rooms & directory ----------
export type Room = { id: string; building_id: string; floor: number; name: string; code: string | null; kind: string };

const demoRoomsByBuilding: Record<string, Omit<Room, "id" | "building_id">[]> = {
  alpha: [
    { floor: 1, name: "Sảnh chính", code: "AL-101", kind: "facility" },
    { floor: 1, name: "Thư viện", code: "AL-102", kind: "facility" },
    { floor: 1, name: "Phòng ban Khoa CNTT", code: "AL-105", kind: "department" },
    { floor: 2, name: "Hội trường 200", code: "AL-200", kind: "hall" },
    { floor: 2, name: "Phòng học 201", code: "AL-201", kind: "room" },
    { floor: 2, name: "Phòng học 202", code: "AL-202", kind: "room" },
    { floor: 3, name: "Lab IoT", code: "AL-301", kind: "lab" },
    { floor: 3, name: "Lab AI/ML", code: "AL-302", kind: "lab" },
    { floor: 3, name: "Phòng học 303", code: "AL-303", kind: "room" },
  ],
  beta: [
    { floor: 1, name: "Sảnh Beta", code: "BT-101", kind: "facility" },
    { floor: 1, name: "Quầy hỗ trợ sinh viên", code: "BT-105", kind: "desk" },
    { floor: 2, name: "Hội trường 201", code: "BT-201", kind: "hall" },
    { floor: 2, name: "Lab Robot", code: "BT-205", kind: "lab" },
    { floor: 2, name: "Phòng học 210", code: "BT-210", kind: "room" },
    { floor: 3, name: "Lab Mạng", code: "BT-301", kind: "lab" },
    { floor: 3, name: "Phòng học 305", code: "BT-305", kind: "room" },
    { floor: 3, name: "Phòng học 306", code: "BT-306", kind: "room" },
  ],
  gamma: [
    { floor: 1, name: "Sảnh Gamma", code: "GM-101", kind: "facility" },
    { floor: 1, name: "Văn phòng sinh viên", code: "GM-103", kind: "department" },
    { floor: 2, name: "Hội trường sự kiện", code: "GM-201", kind: "hall" },
    { floor: 2, name: "Phòng học 205", code: "GM-205", kind: "room" },
    { floor: 2, name: "Phòng học 206", code: "GM-206", kind: "room" },
    { floor: 3, name: "Lab Điện tử", code: "GM-301", kind: "lab" },
    { floor: 3, name: "Phòng họp 310", code: "GM-310", kind: "room" },
  ],
  delta: [
    { floor: 1, name: "Sảnh Delta", code: "DL-101", kind: "facility" },
    { floor: 1, name: "Phòng seminar 102", code: "DL-102", kind: "room" },
    { floor: 2, name: "Phòng seminar 201", code: "DL-201", kind: "room" },
    { floor: 2, name: "Phòng seminar 202", code: "DL-202", kind: "room" },
    { floor: 2, name: "Lab An toàn thông tin", code: "DL-205", kind: "lab" },
    { floor: 3, name: "Hội trường 301", code: "DL-301", kind: "hall" },
    { floor: 3, name: "Phòng học 305", code: "DL-305", kind: "room" },
  ],
  doma: [
    { floor: 1, name: "Sảnh Dom A", code: null, kind: "facility" },
    { floor: 1, name: "Phòng giặt", code: null, kind: "laundry" },
    { floor: 2, name: "Phòng 201", code: null, kind: "room" },
    { floor: 2, name: "Phòng 202", code: null, kind: "room" },
    { floor: 3, name: "Phòng 301", code: null, kind: "room" },
    { floor: 3, name: "Phòng 302", code: null, kind: "room" },
  ],
  domb: [
    { floor: 1, name: "Sảnh Dom B", code: null, kind: "facility" },
    { floor: 1, name: "Phòng giặt", code: null, kind: "laundry" },
    { floor: 2, name: "Phòng 201", code: null, kind: "room" },
    { floor: 2, name: "Phòng 202", code: null, kind: "room" },
    { floor: 3, name: "Phòng 301", code: null, kind: "room" },
  ],
  domc: [
    { floor: 1, name: "Sảnh Dom C", code: null, kind: "facility" },
    { floor: 1, name: "Phòng giặt", code: null, kind: "laundry" },
    { floor: 2, name: "Phòng 201", code: null, kind: "room" },
    { floor: 3, name: "Phòng 301", code: null, kind: "room" },
  ],
  domd: [
    { floor: 1, name: "Sảnh Dom D", code: null, kind: "facility" },
    { floor: 1, name: "Phòng giặt", code: null, kind: "laundry" },
    { floor: 2, name: "Phòng 201", code: null, kind: "room" },
    { floor: 2, name: "Phòng 202", code: null, kind: "room" },
  ],
  dome: [
    { floor: 1, name: "Sảnh Dom E", code: null, kind: "facility" },
    { floor: 1, name: "Phòng giặt", code: null, kind: "laundry" },
    { floor: 2, name: "Phòng 201", code: null, kind: "room" },
    { floor: 3, name: "Phòng 301", code: null, kind: "room" },
  ],
  domf: [
    { floor: 1, name: "Sảnh Dom F", code: null, kind: "facility" },
    { floor: 1, name: "Phòng giặt", code: null, kind: "laundry" },
    { floor: 2, name: "Phòng 201", code: null, kind: "room" },
  ],
  domg: [
    { floor: 1, name: "Sảnh Dom G", code: null, kind: "facility" },
    { floor: 1, name: "Phòng giặt", code: null, kind: "laundry" },
    { floor: 2, name: "Phòng 201", code: null, kind: "room" },
    { floor: 3, name: "Phòng 301", code: null, kind: "room" },
  ],
  lake: [
    { floor: 1, name: "Khu vực hồ Sen", code: null, kind: "facility" },
  ],
  vovinam: [
    { floor: 1, name: "Sàn tập Vovinam", code: null, kind: "facility" },
    { floor: 1, name: "Phòng đồ dùng", code: null, kind: "room" },
  ],
  sports: [
    { floor: 1, name: "Sân bóng đá", code: null, kind: "facility" },
    { floor: 1, name: "Khu vực cầu lông", code: null, kind: "facility" },
  ],
  canteen: [
    { floor: 1, name: "Canteen", code: null, kind: "facility" },
    { floor: 1, name: "7-Eleven", code: null, kind: "facility" },
  ],
  parking: [
    { floor: 1, name: "Bãi xe máy", code: null, kind: "facility" },
    { floor: 1, name: "Bãi ô tô", code: null, kind: "facility" },
  ],
};

export const DEFAULT_ROOMS: Room[] = DEFAULT_BUILDINGS.flatMap((building) =>
  (demoRoomsByBuilding[building.id] ?? []).map((room, index) => ({
    ...room,
    id: `${building.id}-room-${index + 1}`,
    building_id: building.id,
  })),
);

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();

export type SearchHit = { building: Building; room?: Room };
/** Accent-insensitive search over buildings and rooms (name or code). */
export function searchDirectory(q: string, buildings: Building[], rooms: Room[], limit = 8): SearchHit[] {
  const n = norm(q); if (!n) return [];
  const hits: SearchHit[] = [];
  for (const b of buildings) if (norm(b.vi).includes(n) || norm(b.name).includes(n)) hits.push({ building: b });
  for (const r of rooms) {
    if (norm(r.name).includes(n) || (r.code && norm(r.code).includes(n))) {
      const b = buildings.find((x) => x.id === r.building_id); if (b) hits.push({ building: b, room: r });
    }
  }
  return hits.slice(0, limit);
}

// ---------- Turn-by-turn directions ----------
export type Step = { text: string; icon: string; at: number; meters: number };
type P = [number, number];

/** Build human steps from a route polyline. `at` = distance (map units) where the step begins. */
export function buildDirections(points: P[], from: Building, to: Building, buildings: Building[]): Step[] {
  const landmark = (p: P) => {
    let best: Building | null = null, bd = 130;
    for (const b of buildings) { if (b.id === from.id || b.id === to.id) continue; const dd = d(p, [b.x, b.y]); if (dd < bd) { bd = dd; best = b; } }
    return best;
  };
  const steps: Step[] = [{ text: `Xuất phát từ ${from.vi}`, icon: "🟢", at: 0, meters: 0 }];
  let acc = 0, legStart = 0, legLm: Building | null = null;
  for (let i = 1; i < points.length; i++) {
    const seg = d(points[i - 1]!, points[i]!);
    legLm ??= landmark([(points[i - 1]![0] + points[i]![0]) / 2, (points[i - 1]![1] + points[i]![1]) / 2]);
    acc += seg;
    const last = i === points.length - 1;
    let turn: string | null = null;
    if (!last) {
      const [ax, ay] = [points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]];
      const [bx, by] = [points[i + 1]![0] - points[i]![0], points[i + 1]![1] - points[i]![1]];
      const ang = (Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180) / Math.PI;
      if (Math.abs(ang) > 30) turn = ang > 0 ? "phải" : "trái";
    }
    if (turn || last) {
      const m = Math.round((acc - legStart) * METERS_PER_UNIT);
      if (m > 0) steps.push({ text: `Đi thẳng ${m} m theo đường nội khu${legLm ? ` qua ${legLm.vi}` : ""}`, icon: "⬆️", at: legStart, meters: m });
      if (turn) {
        const lm = landmark(points[i]!);
        steps.push({ text: `Rẽ ${turn}${lm ? ` gần ${lm.vi}` : ""}`, icon: turn === "phải" ? "↪️" : "↩️", at: acc, meters: 0 });
      }
      legStart = acc; legLm = null;
    }
  }
  steps.push({ text: `Rẽ vào sảnh ${to.vi} — bạn đã đến nơi`, icon: "🏁", at: acc, meters: 0 });
  return steps;
}

export function polylineLength(points: P[]) {
  return points.slice(1).reduce((a, p, i) => a + d(points[i]!, p), 0);
}
/** Point at distance `t` along the polyline, plus the traveled sub-polyline. */
export function pointAlong(points: P[], t: number): { p: P; done: P[] } {
  let acc = 0; const done: P[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const s = d(points[i - 1]!, points[i]!);
    if (acc + s >= t) {
      const r = s ? (t - acc) / s : 0;
      const p: P = [points[i - 1]![0] + (points[i]![0] - points[i - 1]![0]) * r, points[i - 1]![1] + (points[i]![1] - points[i - 1]![1]) * r];
      done.push(p); return { p, done };
    }
    acc += s; done.push(points[i]!);
  }
  return { p: points[points.length - 1]!, done };
}

// ---------- GPS geo-projection (FPT Hoa Lac) ----------
export const GPS_BOUNDS = { latMin: 21.0115, latMax: 21.0168, lngMin: 105.5225, lngMax: 105.5295 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** GPS → canvas units, clamped to the map. North is up (y grows southward). */
export function gpsToCanvas(lat: number, lng: number): { x: number; y: number } {
  const { latMin, latMax, lngMin, lngMax } = GPS_BOUNDS;
  const x = ((lng - lngMin) / (lngMax - lngMin)) * MAP_W;
  const y = ((latMax - lat) / (latMax - latMin)) * MAP_H;
  return { x: clamp(x, 0, MAP_W), y: clamp(y, 0, MAP_H) };
}
/** Canvas → GPS (used by demo mode). */
export function canvasToGps(x: number, y: number) {
  const { latMin, latMax, lngMin, lngMax } = GPS_BOUNDS;
  return { lat: latMax - (y / MAP_H) * (latMax - latMin), lng: lngMin + (x / MAP_W) * (lngMax - lngMin) };
}
/** True when within ~800 m of the campus bounding box. */
export function isWithinCampus(lat: number, lng: number, marginM = 800) {
  const { latMin, latMax, lngMin, lngMax } = GPS_BOUNDS;
  const dLat = marginM / 111320, dLng = marginM / (111320 * Math.cos((lat * Math.PI) / 180));
  return lat >= latMin - dLat && lat <= latMax + dLat && lng >= lngMin - dLng && lng <= lngMax + dLng;
}
/** Nearest waypoint (or built-in road node when none) to a canvas point. */
export function findNearestNode(x: number, y: number, nodes: Waypoint[] = []) {
  const list = nodes.length ? nodes.map((n) => [n.id, n.x, n.y] as const) : Object.entries(ROAD_NODES).map(([k, [a, b]]) => [k, a, b] as const);
  let best: { id: string; x: number; y: number } | null = null, bd = Infinity;
  for (const [id, nx, ny] of list) { const dd = Math.hypot(nx - x, ny - y); if (dd < bd) { bd = dd; best = { id, x: nx, y: ny }; } }
  return best;
}
export function canvasMeters(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y) * METERS_PER_UNIT;
}

/** Project p onto a polyline: perpendicular distance and distance travelled along it (map units). */
export function projectOnPolyline(points: P[], p: P): { dist: number; along: number } {
  let best = { dist: Infinity, along: 0 }, acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, len = d(a, b);
    const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (len * len))) : 0;
    const q: P = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const dd = d(p, q); if (dd < best.dist) best = { dist: dd, along: acc + len * t };
    acc += len;
  }
  return best;
}
/** Off-route when farther than this from the current walking route. */
export const OFF_ROUTE_METERS = 20;
export function isOffRoute(points: P[], p: P, thresholdM = OFF_ROUTE_METERS) {
  return projectOnPolyline(points, p).dist * METERS_PER_UNIT > thresholdM;
}
