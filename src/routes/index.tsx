import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { DirectionsPanel, FloorDirectory, RoomEditor, SearchBox } from "@/components/campus/Directory";
import { FloorPlanUploader, IndoorViewer, loadFloorPlans, type FloorPlan } from "@/components/campus/FloorPlans";
import {
  Building, Category, DEFAULT_BUILDINGS, DEFAULT_ROOMS, DEFAULT_SEGMENTS, MAP_H, MAP_W, ROAD_EDGES, ROAD_NODES, Room, SEGMENT_FLAGS, Segment, VEHICLES, VehicleId, Waypoint,
  buildDirections, computeRoute, pointAlong, polylineLength, routeOnGraph, segmentAllows, travelMinutes,
  METERS_PER_UNIT, canvasMeters, isOffRoute, projectOnPolyline,
} from "@/lib/campus";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useIsMobile } from "@/hooks/use-mobile";
import { registerPWA } from "@/lib/pwa";
import { FILTERS, FilterId, matchesFilter } from "@/lib/filters";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FPT Hoa Lac Campus Navigation" },
      { name: "description", content: "Interactive map and route planner for FPT University Hoa Lac campus." },
      { property: "og:title", content: "FPT Hoa Lac Campus Navigation" },
      { property: "og:description", content: "Find buildings and routes across the FPT Hoa Lac campus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Settings = { image_path: string | null; scale: number; offset_x: number; offset_y: number; opacity: number };
type Tool = "pin" | "waypoint" | "connect" | "select";
type Target = { kind: "pin" | "wp"; id: string };

const catColor: Record<Category, string> = { lecture: "var(--lecture)", dorm: "var(--dorm)", amenity: "var(--amenity)" };
const catIcon: Record<Category, string> = { lecture: "🏛️", dorm: "🏠", amenity: "📍" };
const routeStyle: Record<VehicleId, { w: number; dash: string }> = {
  walk: { w: 5, dash: "2 10" }, motor: { w: 7, dash: "18 8" }, car: { w: 9, dash: "24 10" },
  bus: { w: 10, dash: "30 10" }, wheelchair: { w: 6, dash: "6 8" },
};
const flagColor: Record<string, string> = {
  walk_only: "var(--dorm)", accessible_ramp: "var(--lecture)", motor_allowed: "var(--amenity)",
  car_allowed: "var(--primary)", bus_route: "var(--foreground)",
};

function Index() {
  const [buildings, setBuildings] = useState<Building[]>(DEFAULT_BUILDINGS);
  const [nodes, setNodes] = useState<Waypoint[]>(() => Object.entries(ROAD_NODES).map(([id, [x, y]]) => ({ id, x, y, kind: "road" })));
  const [segs, setSegs] = useState<Segment[]>(() => DEFAULT_SEGMENTS);
  const [settings, setSettings] = useState<Settings>({ image_path: null, scale: 1, offset_x: 0, offset_y: 0, opacity: 0.8 });
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [fromRoom, setFromRoom] = useState<string>("");
  const [to, setTo] = useState("");
  const [toRoom, setToRoom] = useState<string>("");
  const [vehicle, setVehicle] = useState<VehicleId>("walk");
  const [admin, setAdmin] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [selSeg, setSelSeg] = useState<string | null>(null);
  const [newFlags, setNewFlags] = useState<string[]>(["accessible_ramp"]);
  const [tapMode, setTapMode] = useState<"from" | "to" | null>(null);
  const [err, setErr] = useState("");
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [hlRoom, setHlRoom] = useState<string | null>(null);
  const [navT, setNavT] = useState<number | null>(null);
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [indoor, setIndoor] = useState<{ id: string; floor: number | null } | null>(null);
  const [arrivalDismissed, setArrivalDismissed] = useState(false);
  const [enteringBuilding, setEnteringBuilding] = useState<{ id: string; vi: string; floor: number | null } | null>(null);
  useEffect(() => { if (navT === 0 || navT === null) setArrivalDismissed(false); }, [navT]);
  useEffect(() => { if (navT !== null) setSheetOpen(false); }, [navT]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [dark, setDark] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [offline, setOffline] = useState(false);
  const [gpsOn, setGpsOn] = useState(false);
  const [follow, setFollow] = useState(false);
  const [demo, setDemo] = useState<{ x: number; y: number; heading: number | null } | null>(null);
  const [demoWalk, setDemoWalk] = useState(false);
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const geo = useGeolocation(gpsOn, demo);
  useEffect(() => { if (from === "my_location") setGpsOn(true); }, [from]);
  const locateMe = () => {
    if (!gpsOn) { setGpsOn(true); setFollow(true); return; }
    if (geo.coords) { focusOn(geo.coords.x, geo.coords.y); setFollow((f) => !f); }
  };
  useEffect(() => {
    registerPWA();
    setDark(document.documentElement.classList.contains("dark"));
    const on = () => setOffline(!navigator.onLine || !isSupabaseConfigured()); on();
    window.addEventListener("online", on); window.addEventListener("offline", on);
    const q = new URLSearchParams(location.search);
    if (q.get("from")) setFrom(q.get("from")!);
    if (q.get("to")) setTo(q.get("to")!);
    const v = q.get("v"); if (v && VEHICLES.some((x) => x.id === v)) setVehicle(v as VehicleId);
    if (q.get("b")) setSelected(q.get("b"));
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);
  const toggleDark = () => { const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d); try { localStorage.setItem("theme", d ? "dark" : "light"); } catch { /* ignore */ } };
  const share = async (params: Record<string, string>, title: string) => {
    const url = `${location.origin}/?${new URLSearchParams(params).toString()}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); setShareMsg("Đã sao chép liên kết!"); setTimeout(() => setShareMsg(""), 2000); }
    } catch { /* cancelled */ }
  };
  const wrap = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const drag = useRef<{ type: "pan" | "move"; t?: Target | undefined; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; k: number } | null>(null);

  const report = (e: { message: string } | null) => { if (e) setErr(e.message); };
  const databaseAvailable = isSupabaseConfigured();

  // Load shared data
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    (async () => {
      const [b, w, s, m, rm] = await Promise.all([
        supabase.from("buildings").select("*"),
        supabase.from("waypoints").select("id,x,y,kind"),
        supabase.from("path_segments").select("id,a,b,flags"),
        supabase.from("map_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("rooms").select("id,building_id,floor,name,code,kind"),
      ]);
      const CACHE = "campus-cache-v2";
      const ok = !!b.data?.length;
      if (ok) { try { localStorage.setItem(CACHE, JSON.stringify({ b: b.data, w: w.data, s: s.data, m: m.data, rm: rm.data })); } catch { /* quota */ } }
      else { try { const c = JSON.parse(localStorage.getItem(CACHE) || "null"); if (c) { b.data = c.b; w.data = c.w; s.data = c.s; m.data = c.m; rm.data = c.rm; } } catch { /* ignore */ } }
      if (rm.data?.length) setRooms(rm.data);
      loadFloorPlans().then(setPlans).catch(() => {});
      if (b.data?.length) setBuildings(b.data.map((r) => ({ id: r.id, name: r.name, vi: r.vi, category: r.category as Category, x: r.x, y: r.y, desc: r.description, floors: r.floors })));
      if (w.data?.length && s.data?.length) { setNodes(w.data); setSegs(s.data); }
      else {
        // Fallback: built-in road network so paths are always visible
        setNodes(Object.entries(ROAD_NODES).map(([id, [x, y]]) => ({ id, x, y, kind: "road" })));
        setSegs(DEFAULT_SEGMENTS);
      }
      if (m.data) setSettings(m.data);
    })();
  }, []);

  useEffect(() => {
    if (!settings.image_path || !isSupabaseConfigured()) { setBgUrl(null); return; }
    supabase.storage.from("campus-maps").createSignedUrl(settings.image_path, 60 * 60 * 24).then(({ data }) => setBgUrl(data?.signedUrl ?? null));
  }, [settings.image_path]);

  // Auth + admin role
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      setSignedIn(!!data.user);
      if (!data.user) { setIsAdmin(false); return; }
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin");
      setIsAdmin(!!r?.length);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") check(); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const fit = () => {
    const el = wrap.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const k = Math.min(r.width / MAP_W, r.height / MAP_H) * 0.95;
    setView({ k, x: (r.width - MAP_W * k) / 2, y: (r.height - MAP_H * k) / 2 });
  };
  useEffect(() => { fit(); window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit); }, []);

  const zoomAt = (px: number, py: number, next: number) => {
    const v = viewRef.current; const k2 = Math.min(6, Math.max(0.3, next)); const f = k2 / v.k;
    setView({ k: k2, x: px - (px - v.x) * f, y: py - (py - v.y) * f });
  };
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(e.clientX - r.left, e.clientY - r.top, viewRef.current.k * Math.exp(-dy * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const zoomBtn = (f: number) => { const r = wrap.current!.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, view.k * f); };
  const focusOn = (x: number, y: number) => {
    const el = wrap.current; if (!el) return; const r = el.getBoundingClientRect();
    const k = Math.max(viewRef.current.k, 1.4);
    setView({ k, x: r.width / 2 - x * k, y: r.height * 0.45 - y * k });
  };
  const addRoom = async (r: Omit<Room, "id">) => {
    const { data, error } = await supabase.from("rooms").insert(r).select("id,building_id,floor,name,code,kind").single();
    report(error); if (data) setRooms((rs) => [...rs, data]);
  };
  const deleteRoom = async (id: string) => { setRooms((rs) => rs.filter((r) => r.id !== id)); report((await supabase.from("rooms").delete().eq("id", id)).error); };
  const saveFloors = async (id: string, n: number | null) => { report((await supabase.from("buildings").update({ floors: n }).eq("id", id)).error); };
  const toMap = (cx: number, cy: number) => {
    const r = wrap.current!.getBoundingClientRect(); const v = viewRef.current;
    return { x: Math.round((cx - r.left - v.x) / v.k), y: Math.round((cy - r.top - v.y) / v.k) };
  };

  // Persistence
  const saveBuilding = async (b: Building) => {
    report((await supabase.from("buildings").upsert({ id: b.id, name: b.name, vi: b.vi, category: b.category, x: b.x, y: b.y, description: b.desc })).error);
  };
  const updateBuilding = (id: string, patch: Partial<Building>) => {
    setBuildings((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };
  const deleteBuilding = async (id: string) => {
    setBuildings((bs) => bs.filter((b) => b.id !== id)); setSelected(null);
    report((await supabase.from("buildings").delete().eq("id", id)).error);
  };
  const addWaypoint = async (x: number, y: number) => {
    const w = { id: `w${Date.now().toString(36)}`, x, y, kind: "walkway" };
    setNodes((n) => [...n, w]);
    report((await supabase.from("waypoints").insert(w)).error);
    return w.id;
  };
  const deleteWaypoint = async (id: string) => {
    setNodes((n) => n.filter((w) => w.id !== id)); setSegs((s) => s.filter((x) => x.a !== id && x.b !== id));
    report((await supabase.from("waypoints").delete().eq("id", id)).error);
  };
  const connect = async (a: string, b: string) => {
    if (a === b || segs.some((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a))) return;
    const { data, error } = await supabase.from("path_segments").insert({ a, b, flags: newFlags }).select("id,a,b,flags").single();
    report(error); if (data) { setSegs((s) => [...s, data]); setSelSeg(data.id); }
  };
  const toggleFlag = async (segId: string, f: string) => {
    const s = segs.find((x) => x.id === segId); if (!s) return;
    const flags = s.flags.includes(f) ? s.flags.filter((x) => x !== f) : [...s.flags, f];
    setSegs((all) => all.map((x) => (x.id === segId ? { ...x, flags } : x)));
    report((await supabase.from("path_segments").update({ flags }).eq("id", segId)).error);
  };
  const deleteSeg = async (id: string) => {
    setSegs((s) => s.filter((x) => x.id !== id)); setSelSeg(null);
    report((await supabase.from("path_segments").delete().eq("id", id)).error);
  };
  const saveSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }; setSettings(next);
    report((await supabase.from("map_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1)).error);
  };
  const uploadMap = async (file: File) => {
    const path = `blueprint-${Date.now()}.${file.name.split(".").pop() || "png"}`;
    const { error } = await supabase.storage.from("campus-maps").upload(path, file, { contentType: file.type });
    if (error) return report(error);
    saveSettings({ image_path: path });
  };

  // Pointer handling
  const onDown = (e: React.PointerEvent, t?: Target) => {
    e.stopPropagation();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: viewRef.current.k };
      drag.current = null; return;
    }
    const movable = admin && t && tool !== "connect";
    if (movable) {
      const o = t.kind === "pin" ? buildings.find((x) => x.id === t.id)! : nodes.find((x) => x.id === t.id)!;
      drag.current = { type: "move", t, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, moved: false };
    } else drag.current = { type: "pan", t, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const r = wrap.current!.getBoundingClientRect();
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, pinch.current.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist);
      return;
    }
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.hypot(dx, dy) > 4) d.moved = true;
    if (!d.moved) return;
    if (d.type === "pan") { setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy })); return; }
    const nx = Math.round(d.ox + dx / view.k), ny = Math.round(d.oy + dy / view.k);
    if (d.t!.kind === "pin") updateBuilding(d.t!.id, { x: nx, y: ny });
    else setNodes((ns) => ns.map((w) => (w.id === d.t!.id ? { ...w, x: nx, y: ny } : w)));
  };
  const onUp = async (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (d.type === "move" && d.moved) {
      if (d.t!.kind === "pin") { const b = buildings.find((x) => x.id === d.t!.id); if (b) saveBuilding(b); }
      else { const w = nodes.find((x) => x.id === d.t!.id); if (w) report((await supabase.from("waypoints").update({ x: w.x, y: w.y }).eq("id", w.id)).error); }
      return;
    }
    if (d.moved) return;
    const t = d.t;
    if (!admin) {
      if (t?.kind === "pin") pickBuilding(t.id);
      else if (demo) { const p = toMap(e.clientX, e.clientY); setDemo({ x: p.x, y: p.y, heading: demo.heading }); }
      else setSelected(null);
      return;
    }
    // Admin clicks
    if (tool === "connect") {
      let id = t?.kind === "wp" ? t.id : null;
      if (!id && !t) { const p = toMap(e.clientX, e.clientY); id = await addWaypoint(p.x, p.y); }
      if (!id) return;
      if (connectFrom) await connect(connectFrom, id);
      setConnectFrom(id);
      return;
    }
    if (t?.kind === "pin") { setSelected(t.id); setSelSeg(null); return; }
    if (t?.kind === "wp") { setSelected(`wp:${t.id}`); setSelSeg(null); return; }
    const p = toMap(e.clientX, e.clientY);
    if (tool === "waypoint") { await addWaypoint(p.x, p.y); return; }
    if (tool === "pin") {
      const name = window.prompt("Tên tòa nhà mới / New building name?"); if (!name) return;
      const b: Building = { id: `b${Date.now()}`, name, vi: name, category: "amenity", x: p.x, y: p.y, desc: "" };
      setBuildings((bs) => [...bs, b]); setSelected(b.id); saveBuilding(b); return;
    }
    setSelected(null); setSelSeg(null);
  };

  const pickBuilding = (id: string) => {
    if (tapMode === "from") { setFrom(id); setTapMode(null); return; }
    if (tapMode === "to") { setTo(id); setTapMode(null); return; }
    setSelected(id);
  };

  const gx = geo.coords ? Math.round(geo.coords.x) : null, gy = geo.coords ? Math.round(geo.coords.y) : null;
  const myLoc = useMemo<Building | undefined>(() => (gx === null || gy === null ? undefined : { id: "my_location", name: "My location", vi: "Vị trí của tôi", category: "amenity", x: gx, y: gy, desc: "" }), [gx, gy]);
  const A = from === "my_location" ? myLoc : buildings.find((b) => b.id === from), B = buildings.find((b) => b.id === to);
  const liveKey = `${to}|${vehicle}|${nodes.length}|${segs.length}`;
  const [locked, setLocked] = useState<{ key: string; A: Building; route: ReturnType<typeof routeOnGraph> } | null>(null);
  const [rerouteMsg, setRerouteMsg] = useState(false);
  useEffect(() => {
    if (from !== "my_location" || !myLoc || !B || myLoc.id === B.id) { if (locked) setLocked(null); return; }
    const fresh = () => ({ key: liveKey, A: myLoc, route: routeOnGraph(myLoc, B, nodes, segs, vehicle) });
    if (!locked || locked.key !== liveKey || !locked.route) { setLocked(fresh()); return; }
    if (isOffRoute(locked.route.points, [myLoc.x, myLoc.y])) { setLocked(fresh()); setRerouteMsg(true); }
  }, [from, myLoc, B, liveKey]);
  useEffect(() => { if (!rerouteMsg) return; const id = setTimeout(() => setRerouteMsg(false), 2500); return () => clearTimeout(id); }, [rerouteMsg]);
  const staticRoute = useMemo(() => {
    if (from === "my_location" || !A || !B || A.id === B.id) return null;
    return routeOnGraph(A, B, nodes, segs, vehicle) ?? (vehicle === "walk" ? computeRoute(A, B) : null);
  }, [from, A, B, nodes, segs, vehicle]);
  const route = from === "my_location" ? (locked?.key === liveKey ? locked.route : null) : staticRoute;
  const routeA = from === "my_location" ? locked?.A : A;
  const remainingM = route && from === "my_location" && myLoc
    ? Math.max(0, Math.round((polylineLength(route.points) - projectOnPolyline(route.points, [myLoc.x, myLoc.y]).along) * METERS_PER_UNIT))
    : route?.meters ?? 0;
  const steps = useMemo(() => (route && routeA && B ? buildDirections(route.points, routeA!, B, buildings) : []), [route, routeA, B, buildings]);
  const totalLen = route ? polylineLength(route.points) : 0;
  useEffect(() => { if (from !== "my_location") setNavT(null); }, [route, from]);
  useEffect(() => {
    if (navT === null || !totalLen || from === "my_location") return;
    if (navT >= totalLen) return;
    // Simulated speed: ~12s for the full route, regardless of length
    const id = setTimeout(() => setNavT((t) => (t === null ? null : Math.min(totalLen, t + totalLen / 120))), 100);
    return () => clearTimeout(id);
  }, [navT, totalLen, from]);
  // Demo walk: move the mock pin along the route frozen at start (~5 m per tick)
  const demoPath = useRef<{ pts: [number, number][]; t: number } | null>(null);
  useEffect(() => {
    if (!demoWalk) { demoPath.current = null; return; }
    if (!demoPath.current && route) demoPath.current = { pts: route.points, t: 0 };
  }, [demoWalk, route]);
  useEffect(() => {
    if (!demoWalk) return;
    const id = setInterval(() => {
      const dp = demoPath.current; if (!dp) return;
      const L = polylineLength(dp.pts);
      if (dp.t >= L) { setDemoWalk(false); return; }
      const prev = pointAlong(dp.pts, dp.t).p;
      dp.t = Math.min(L, dp.t + 5 / METERS_PER_UNIT);
      const p = pointAlong(dp.pts, dp.t).p;
      const heading = (Math.atan2(p[0] - prev[0], -(p[1] - prev[1])) * 180) / Math.PI;
      setDemo({ x: p[0], y: p[1], heading });
    }, 250);
    return () => clearInterval(id);
  }, [demoWalk]);
  // Follow-me: keep the map centered on the user while they move
  useEffect(() => { if (follow && geo.coords) focusOn(geo.coords.x, geo.coords.y); }, [follow, gx, gy]);
  const gpsDistToB = geo.coords && B ? canvasMeters(geo.coords, B) : Infinity;
  const gpsArrived = from === "my_location" && gpsDistToB <= 15;
  useEffect(() => { if (gpsArrived) setDemoWalk(false); else setArrivalDismissed(false); }, [gpsArrived]);
  const navPos = route && navT !== null && from !== "my_location" ? pointAlong(route.points, navT) : null;
  const activeStep = navT === null ? -1 : navT >= totalLen ? steps.length - 1 : Math.max(0, steps.reduce((acc, s, i) => (s.at <= navT + 0.001 ? i : acc), 0));
  const veh = VEHICLES.find((v) => v.id === vehicle)!;
  const sel = buildings.find((b) => b.id === selected);
  const arrived = gpsArrived || (navT !== null && totalLen > 0 && navT >= totalLen);
  const destRoom = B ? rooms.find((r) => r.id === toRoom && r.building_id === B.id) : undefined;
  const indoorB = indoor ? buildings.find((b) => b.id === indoor.id) : undefined;

  // Smooth camera zoom-pan to building, then auto-open indoor viewer
  const transitionToIndoor = (building: Building, floor: number | null) => {
    setEnteringBuilding({ id: building.id, vi: building.vi, floor });
    const el = wrap.current; if (!el) { setIndoor({ id: building.id, floor }); setEnteringBuilding(null); return; }
    const r = el.getBoundingClientRect();
    const targetK = 4;
    const targetX = r.width / 2 - building.x * targetK;
    const targetY = r.height / 2 - building.y * targetK;
    const startV = { ...viewRef.current };
    const duration = 800;
    const t0 = performance.now();
    const animate = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setView({
        k: startV.k + (targetK - startV.k) * e,
        x: startV.x + (targetX - startV.x) * e,
        y: startV.y + (targetY - startV.y) * e,
      });
      if (p < 1) requestAnimationFrame(animate);
      else { setTimeout(() => { setIndoor({ id: building.id, floor }); setEnteringBuilding(null); }, 200); }
    };
    requestAnimationFrame(animate);
  };
  const selWp = selected?.startsWith("wp:") ? nodes.find((w) => `wp:${w.id}` === selected) : undefined;
  const seg = segs.find((s) => s.id === selSeg);
  const rs = routeStyle[vehicle];
  const pos = (id: string) => nodes.find((n) => n.id === id);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-map-ground font-sans select-none">
      {isMobile && sheetOpen && <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setSheetOpen(false)} />}
      {/* Left column — header box & transportation */}
      <div className={isMobile
        ? `fixed inset-x-0 bottom-0 z-40 flex max-h-[78vh] flex-col gap-3 overflow-y-auto rounded-t-3xl border-t border-border bg-background p-3 pb-6 shadow-lg transition-transform duration-300 ease-out ${sheetOpen ? "translate-y-0" : "pointer-events-none translate-y-full"}`
        : "flex w-[380px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-border bg-background p-3"}>
        {isMobile && (
          <div className="relative pb-1">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-muted" />
            <button onClick={() => setSheetOpen(false)} className="absolute right-0 top-0 text-sm text-muted-foreground">✕</button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">F</span>
            <div className="leading-tight">
              <div className="text-sm font-bold">FPT Hòa Lạc</div>
              <div className="text-xs text-muted-foreground">Campus Navigation</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {offline && <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">Offline</span>}
            <button onClick={toggleDark} aria-label="Chế độ tối" className="grid h-8 w-8 place-items-center rounded-full bg-muted text-sm">{dark ? "☀️" : "🌙"}</button>
            {isAdmin ? (
              <button onClick={() => { setAdmin(!admin); setSelected(null); setSelSeg(null); setConnectFrom(null); }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${admin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {admin ? "CMS: BẬT" : "CMS"}
              </button>
            ) : signedIn ? (
              <button onClick={() => supabase.auth.signOut()} className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Đăng xuất</button>
            ) : (
              <Link to="/auth" className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Admin</Link>
            )}
          </div>
        </div>

        {!admin && (
          <>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {FILTERS.map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{f.label}</button>
              ))}
            </div>
            <SearchBox buildings={buildings} rooms={rooms} onPick={(b, r) => { setTo(b.id); setSelected(b.id); setHlRoom(r?.id ?? null); setToRoom(r?.id ?? ""); focusOn(b.x, b.y); }} />
            <div className="flex items-center gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <Picker label="Từ" value={from} onChange={setFrom} buildings={buildings} active={tapMode === "from"} onTap={() => setTapMode(tapMode === "from" ? null : "from")}
                  rooms={rooms} selectedRoom={fromRoom} onRoomChange={setFromRoom} />
                <Picker label="Đến" value={to} onChange={(v) => { setTo(v); if (v !== to) { setHlRoom(null); setToRoom(""); } }} buildings={buildings} active={tapMode === "to"} onTap={() => setTapMode(tapMode === "to" ? null : "to")}
                  rooms={rooms} selectedRoom={toRoom} onRoomChange={(id) => { setToRoom(id); setHlRoom(id || null); }} />
              </div>
              <button aria-label="Swap" onClick={() => { setFrom(to); setTo(from); }}
                className="grid h-10 w-10 place-items-center rounded-full bg-accent text-lg text-accent-foreground transition hover:rotate-180">⇅</button>
            </div>
            {tapMode && <div className="text-xs font-medium text-primary">Chạm vào một tòa nhà trên bản đồ để chọn điểm {tapMode === "from" ? "đi" : "đến"}.</div>}

            {/* Transportation selections */}
            <div className="rounded-2xl border bg-card p-2">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Phương tiện</div>
              <div className="flex items-center gap-1 overflow-x-auto">
                {VEHICLES.map((v) => (
                  <button key={v.id} onClick={() => setVehicle(v.id)} title={v.label}
                    className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${vehicle === v.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                    <span className="text-base">{v.emoji}</span>{v.vi}
                  </button>
                ))}
              </div>
            </div>

            {A && B && A.id !== B.id && (route ? (
              <>
              <div className="flex items-center justify-between rounded-xl bg-accent px-3 py-2 text-sm">
                <span className="font-semibold text-accent-foreground">{veh.emoji} {veh.vi}</span>
                <button onClick={() => share({ from: A.id, to: B.id, v: vehicle }, `${A.vi} → ${B.vi}`)} className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-primary">🔗 Chia sẻ</button>
                <span><b>{remainingM} m</b> · <b className="text-primary">{travelMinutes(remainingM, veh.kmh)} phút</b>{from === "my_location" && <span className="text-[10px] text-muted-foreground"> còn lại</span>}</span>
              </div>
              <DirectionsPanel steps={steps} activeIdx={activeStep} navigating={navT !== null} progress={navT !== null && totalLen ? navT / totalLen : 0}
                onStart={() => { setNavT(0); setSelected(null); }} onStop={() => setNavT(null)} />
              </>
            ) : (
              <div className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">Không có đường cho {veh.vi} giữa hai điểm này. Thử phương tiện khác.</div>
            ))}
          </>
        )}
      </div>

      {/* Right column — map */}
      <div className="relative flex-1 overflow-hidden">
        {isMobile && !sheetOpen && (
          <button onClick={() => setSheetOpen(true)} className="glass absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-lg">
            <span className="text-base">🧭</span> Chỉ đường
          </button>
        )}
        <div ref={wrap} className="absolute inset-0 touch-none" style={{ cursor: admin ? "crosshair" : "grab" }}
          onPointerDown={(e) => onDown(e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <svg className="h-full w-full">
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            <rect width={MAP_W} height={MAP_H} rx={40} fill="var(--map-grass)" />
            {bgUrl ? (
              <image href={bgUrl} x={settings.offset_x} y={settings.offset_y} width={MAP_W * settings.scale} height={MAP_H * settings.scale}
                opacity={settings.opacity} preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: "none" }} />
            ) : (
              <>
                <rect x={20} y={20} width={MAP_W - 40} height={MAP_H - 40} rx={30} fill="none" stroke="var(--primary)" strokeOpacity={0.25} strokeWidth={3} strokeDasharray="10 8" />
                <path d="M360 440 C 380 400, 470 410, 490 450 S 470 530, 420 525 S 340 480, 360 440 Z" fill="var(--map-water)" />
                <rect x={760} y={510} width={140} height={100} rx={8} fill="var(--amenity)" fillOpacity={0.25} />
                <rect x={400} y={590} width={140} height={60} rx={8} fill="var(--muted)" />
                <path d="M400 290 q 35 -40 70 0 t 70 0" fill="none" stroke="var(--primary)" strokeWidth={14} strokeLinecap="round" opacity={0.35} />
                <text x={470} y={705} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--muted-foreground)">CỔNG CHÍNH · MAIN GATE</text>
              </>
            )}

            {segs.map((s) => {
              const a = pos(s.a), b = pos(s.b); if (!a || !b) return null;
              const off = !admin && !segmentAllows(s.flags, vehicle);
              const walkOnly = s.flags.includes("walk_only");
              return (
                <g key={s.id}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="#ffffff"
                    strokeWidth={off ? (walkOnly ? 4 : 10) : (walkOnly ? 7 : 16)}
                    strokeLinecap="round"
                    strokeDasharray={walkOnly ? "4 6" : undefined}
                    opacity={off ? 0.55 : 0.95}
                    style={{ transition: "stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease" }} />
                  {admin && (
                    <>
                      {s.flags.map((f, i) => (
                        <line key={f} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={flagColor[f]} strokeWidth={3} strokeDasharray={`10 ${10 * (s.flags.length - 1) + 4}`} strokeDashoffset={-i * 10} />
                      ))}
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={s.id === selSeg ? "var(--primary)" : "transparent"} strokeOpacity={0.5} strokeWidth={18}
                        style={{ cursor: "pointer" }} onPointerDown={(e) => { e.stopPropagation(); }}
                        onPointerUp={(e) => { e.stopPropagation(); setSelSeg(s.id); setSelected(null); }} />
                    </>
                  )}
                </g>
              );
            })}

            {route && (
              <>
                <polyline points={route.points.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--primary)" strokeOpacity={0.25} strokeWidth={rs.w + 8} strokeLinejoin="round" strokeLinecap="round" />
                <polyline className="route-anim" points={route.points.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--primary)" strokeWidth={rs.w} strokeDasharray={rs.dash} strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
            {route && navPos && (
              <>
                <polyline points={navPos.done.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--primary)" strokeWidth={rs.w + 4} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={navPos.p[0]} cy={navPos.p[1]} r={18} fill="var(--primary)" opacity={0.25} className="animate-pulse" />
                <circle cx={navPos.p[0]} cy={navPos.p[1]} r={9} fill="var(--primary)" stroke="var(--card)" strokeWidth={3} />
              </>
            )}

            {admin && nodes.map((w) => {
              const on = connectFrom === w.id || selected === `wp:${w.id}`;
              return (
                <circle key={w.id} cx={w.x} cy={w.y} r={on ? 10 : 7} fill={on ? "var(--primary)" : "var(--card)"} stroke="var(--primary)" strokeWidth={3}
                  style={{ cursor: tool === "connect" ? "pointer" : "move" }} onPointerDown={(e) => onDown(e, { kind: "wp", id: w.id })} />
              );
            })}

            {buildings.filter((b) => admin || matchesFilter(b, filter) || b.id === from || b.id === to || b.id === selected).map((b) => {
              const active = b.id === selected || b.id === from || b.id === to;
              return (
                <g key={b.id} transform={`translate(${b.x},${b.y})`} style={{ cursor: admin ? "move" : "pointer" }}
                  onPointerDown={(e) => onDown(e, { kind: "pin", id: b.id })}>
                  {b.id === selected && hlRoom && <circle r={34} fill="none" stroke="var(--primary)" strokeWidth={4} className="animate-ping" style={{ transformBox: "fill-box", transformOrigin: "center" }} />}
                  <circle r={active ? 22 : 17} fill={catColor[b.category]} stroke="var(--card)" strokeWidth={4} />
                  <text textAnchor="middle" dy={6} fontSize={16}>{b.id === from ? "🟢" : b.id === to ? "🏁" : catIcon[b.category]}</text>
                  <text textAnchor="middle" y={38} fontSize={13} fontWeight={700} fill="var(--foreground)" stroke="var(--card)" strokeWidth={4} paintOrder="stroke">{b.vi}</text>
                </g>
              );
            })}
            {geo.coords && (
              <g transform={`translate(${geo.coords.x},${geo.coords.y})`} pointerEvents="none">
                <circle r={Math.max(8, geo.coords.accuracy / METERS_PER_UNIT)} fill="var(--gps)" fillOpacity={0.12} stroke="var(--gps)" strokeOpacity={0.4} />
                <circle r={18} fill="var(--gps)" fillOpacity={0.3} className="animate-ping" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                {geo.coords.heading !== null && (
                  <path d="M0 0 L-14 -40 A42 42 0 0 1 14 -40 Z" fill="var(--gps)" fillOpacity={0.35} transform={`rotate(${geo.coords.heading})`} />
                )}
                <circle r={9} fill="var(--gps)" stroke="var(--card)" strokeWidth={3} />
              </g>
            )}
          </g>
        </svg>
      </div>

      {rerouteMsg && <div className="glass absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold">🔄 Bạn đã đi lệch — đã tính lại lộ trình</div>}
      {shareMsg && <div className="glass absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold">{shareMsg}</div>}
      {/* GPS + Zoom controls stacked vertically, bottom-right */}
      <div className="absolute bottom-3 right-3 z-30 flex flex-col items-end gap-2">
        {!admin && (
          <>
            {gpsOn && (geo.error || geo.isOffCampus || demo) && (
              <div className="glass max-w-56 rounded-xl p-2 text-xs">
                {geo.error && <div className="mb-1 font-semibold text-destructive">{geo.error}</div>}
                {geo.isOffCampus && !demo && <div className="mb-1">Bạn đang ở ngoài khuôn viên trường.</div>}
                {demo ? (
                  <div className="flex flex-col gap-1">
                    <div className="font-semibold">Chế độ Demo — chạm bản đồ để đặt vị trí</div>
                    <div className="flex gap-1">
                      <button disabled={!route} onClick={() => setDemoWalk((w) => !w)} className="flex-1 rounded-lg bg-primary px-2 py-1 font-bold text-primary-foreground disabled:opacity-50">{demoWalk ? "⏸ Dừng" : "▶ Mô phỏng đi"}</button>
                      <button onClick={() => { setDemo(null); setDemoWalk(false); }} className="rounded-lg bg-muted px-2 py-1 font-bold">Tắt demo</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setDemo({ x: 470, y: 660, heading: null })} className="w-full rounded-lg bg-primary px-2 py-1 font-bold text-primary-foreground">Bật chế độ Demo</button>
                )}
              </div>
            )}
            <button aria-label="Vị trí của tôi" title="Vị trí của tôi" onClick={locateMe}
              className={`glass grid h-12 w-12 place-items-center rounded-full text-xl ${follow ? "text-gps" : ""}`}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg>
            </button>
          </>
        )}
        <div className="glass flex flex-col overflow-hidden rounded-xl">
          {([["+", () => zoomBtn(1.3)], ["−", () => zoomBtn(1 / 1.3)], ["◎", fit]] as const).map(([l, f]) => (
            <button key={l} onClick={f} className="h-10 w-10 text-lg font-bold hover:bg-accent">{l}</button>
          ))}
        </div>
      </div>
      {admin && (
        <CmsPanel
          tool={tool} setTool={(t) => { setTool(t); setConnectFrom(null); }}
          connectFrom={connectFrom} stopConnect={() => setConnectFrom(null)}
          newFlags={newFlags} setNewFlags={setNewFlags}
          seg={seg} toggleFlag={toggleFlag} deleteSeg={deleteSeg}
          sel={sel} updateBuilding={updateBuilding} saveBuilding={saveBuilding} deleteBuilding={deleteBuilding}
          roomEditor={sel ? <>
            <RoomEditor key={sel.id} building={sel} rooms={rooms.filter((r) => r.building_id === sel.id)} onAdd={addRoom} onDelete={deleteRoom}
              onFloors={(n) => { updateBuilding(sel.id, { floors: n }); saveFloors(sel.id, n); }} />
            <div className="mt-2 rounded-xl border bg-card p-3 text-xs">
              <FloorPlanUploader buildingId={sel.id} floors={sel.floors ?? Math.max(1, ...rooms.filter((r) => r.building_id === sel.id).map((r) => r.floor))} plans={plans} onChange={setPlans} />
            </div>
          </> : null}
          selWp={selWp} deleteWaypoint={(id) => { deleteWaypoint(id); setSelected(null); }}
          settings={settings} setSettingsLocal={(p) => setSettings((s) => ({ ...s, ...p }))} saveSettings={saveSettings} uploadMap={uploadMap}
          counts={{ b: buildings.length, w: nodes.length, s: segs.length }} err={err} clearErr={() => setErr("")}
          signOut={() => { setAdmin(false); supabase.auth.signOut(); }}
        />
      )}

      {/* Drawer */}
      {!admin && sel && (
        <div className="drawer-in absolute inset-x-0 bottom-0 z-20 mx-auto max-w-xl p-3">
          <div className="glass rounded-3xl p-4">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="flex gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-4xl" style={{ background: `color-mix(in oklab, ${catColor[sel.category]} 25%, var(--card))` }}>
                {catIcon[sel.category]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">{sel.name}</div>
                <h2 className="text-xl font-extrabold">{sel.vi}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{sel.desc}</p>
              </div>
              <button onClick={() => { setSelected(null); setHlRoom(null); }} className="self-start text-muted-foreground">✕</button>
            </div>
            <FloorDirectory rooms={rooms.filter((r) => r.building_id === sel.id)} floors={sel.floors} highlight={hlRoom}
              onPickRoom={(r) => { setHlRoom(r.id); setToRoom(r.id); setTo(sel.id); }} />
            <button onClick={() => setIndoor({ id: sel.id, floor: rooms.find((r) => r.id === hlRoom && r.building_id === sel.id)?.floor ?? null })}
              className="mt-3 w-full rounded-xl bg-muted py-2 text-sm font-bold hover:bg-accent">🗺️ Xem sơ đồ tầng</button>
            <button onClick={() => share({ b: sel.id }, sel.vi)} className="mt-2 w-full rounded-xl bg-muted py-2 text-sm font-bold hover:bg-accent">🔗 Chia sẻ địa điểm</button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => { setFrom(sel.id); setSelected(null); }} className="rounded-xl border border-primary py-2.5 text-sm font-bold text-primary hover:bg-accent">Đi từ đây</button>
              <button onClick={() => { setTo(sel.id); setSelected(null); }} className="rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">Đến đây</button>
            </div>
          </div>
        </div>
      )}

      {/* Entering-building transition toast */}
      {enteringBuilding && (
        <div className="fade-in absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
          <div className="glass rounded-2xl px-6 py-4 text-center shadow-lg">
            <div className="text-2xl">📍</div>
            <div className="mt-1 text-sm font-bold">Bạn đã bước vào {enteringBuilding.vi}</div>
            <div className="text-xs text-muted-foreground">Chuyển sang sơ đồ Tầng {enteringBuilding.floor ?? 1}</div>
          </div>
        </div>
      )}

      {/* Arrival banner */}
      {arrived && B && !arrivalDismissed && !indoor && !enteringBuilding && (
        <div className="drawer-in absolute inset-x-0 bottom-0 z-30 mx-auto max-w-xl p-3">
          <div className="glass rounded-3xl p-4">
            <div className="text-base font-bold">🎉 Bạn đã đến {B.vi}! {destRoom ? `Đích đến của bạn ở Tầng ${destRoom.floor}` : ""}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => transitionToIndoor(B, destRoom?.floor ?? null)} className="rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">Xem sơ đồ tầng</button>
              <button onClick={() => setArrivalDismissed(true)} className="rounded-xl bg-muted py-2.5 text-sm font-bold">Bỏ qua</button>
            </div>
          </div>
        </div>
      )}

      {indoorB && (
        <IndoorViewer key={indoorB.id} title={indoorB.vi} buildingId={indoorB.id} vehicle={vehicle} floors={indoorB.floors ?? 0} plans={plans.filter((p) => p.building_id === indoorB.id)}
          rooms={rooms.filter((r) => r.building_id === indoorB.id)} initialFloor={indoor?.floor} highlight={hlRoom} onClose={() => setIndoor(null)} />
      )}
      </div>
    </div>
  );
}

function CmsPanel(p: {
  tool: Tool; setTool: (t: Tool) => void; connectFrom: string | null; stopConnect: () => void;
  newFlags: string[]; setNewFlags: (f: string[]) => void;
  seg?: Segment | undefined; toggleFlag: (id: string, f: string) => void; deleteSeg: (id: string) => void;
  sel?: Building | undefined; updateBuilding: (id: string, patch: Partial<Building>) => void; saveBuilding: (b: Building) => void; deleteBuilding: (id: string) => void;
  selWp?: Waypoint | undefined; deleteWaypoint: (id: string) => void;
  settings: Settings; setSettingsLocal: (p: Partial<Settings>) => void; saveSettings: (p: Partial<Settings>) => void; uploadMap: (f: File) => void;
  counts: { b: number; w: number; s: number }; err: string; clearErr: () => void; signOut: () => void;
  roomEditor?: React.ReactNode;
}) {
  const [tab, setTab] = useState<"paths" | "places" | "map">("paths");
  const tools: [Tool, string, string][] = [
    ["select", "Chọn", "Chọn / kéo điểm"], ["waypoint", "+ Điểm", "Chạm bản đồ thêm waypoint"],
    ["connect", "Nối đường", "Chạm lần lượt các điểm để vẽ đoạn"], ["pin", "+ Tòa nhà", "Chạm bản đồ thêm tòa nhà"],
  ];
  const Slider = ({ label, k, min, max, step }: { label: string; k: "scale" | "offset_x" | "offset_y" | "opacity"; min: number; max: number; step: number }) => (
    <label className="block text-xs">
      <div className="flex justify-between"><span className="font-semibold">{label}</span><span className="text-muted-foreground">{p.settings[k].toFixed(step < 1 ? 2 : 0)}</span></div>
      <input type="range" min={min} max={max} step={step} value={p.settings[k]} className="w-full accent-primary"
        onChange={(e) => p.setSettingsLocal({ [k]: Number(e.target.value) })}
        onPointerUp={(e) => p.saveSettings({ [k]: Number((e.target as HTMLInputElement).value) })}
        onKeyUp={(e) => p.saveSettings({ [k]: Number((e.target as HTMLInputElement).value) })} />
    </label>
  );
  return (
    <aside className="glass absolute inset-y-3 right-3 z-20 max-h-none w-[22rem] overflow-y-auto rounded-3xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div><div className="text-sm font-extrabold">Campus CMS</div>
          <div className="text-[11px] text-muted-foreground">{p.counts.b} tòa nhà · {p.counts.w} điểm · {p.counts.s} đoạn đường</div></div>
        <button onClick={p.signOut} className="text-xs text-muted-foreground underline">Đăng xuất</button>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-xs font-semibold">
        {([["paths", "Đường đi"], ["places", "Tòa nhà"], ["map", "Bản đồ nền"]] as const).map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-lg py-1.5 ${tab === id ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {p.err && <div className="mb-3 flex justify-between rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{p.err}<button onClick={p.clearErr}>✕</button></div>}

      {(tab === "paths" || tab === "places") && (
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {tools.map(([id, l, hint]) => (
            <button key={id} title={hint} onClick={() => p.setTool(id)}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold ${p.tool === id ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{l}</button>
          ))}
          <p className="col-span-2 text-[11px] text-muted-foreground">{tools.find((t) => t[0] === p.tool)![2]}
            {p.tool === "connect" && p.connectFrom && <> · đang nối từ <b>{p.connectFrom}</b> <button className="underline" onClick={p.stopConnect}>dừng</button></>}</p>
        </div>
      )}

      {tab === "paths" && (
        <div className="space-y-3">
          <FlagGroup title="Cờ mặc định cho đoạn mới" flags={p.newFlags} onToggle={(f) => p.setNewFlags(p.newFlags.includes(f) ? p.newFlags.filter((x) => x !== f) : [...p.newFlags, f])} />
          {p.seg ? (
            <div className="rounded-xl border bg-card p-3">
              <FlagGroup title={`Đoạn ${p.seg.a} ↔ ${p.seg.b}`} flags={p.seg.flags} onToggle={(f) => p.toggleFlag(p.seg!.id, f)} />
              <button onClick={() => p.deleteSeg(p.seg!.id)} className="mt-2 text-xs font-semibold text-destructive">Xóa đoạn</button>
            </div>
          ) : <p className="text-xs text-muted-foreground">Chạm vào một đoạn đường để sửa cờ.</p>}
          {p.selWp && (
            <div className="flex items-center justify-between rounded-xl border bg-card p-3 text-xs">
              <span>Waypoint <b>{p.selWp.id}</b> ({p.selWp.x}, {p.selWp.y})</span>
              <button onClick={() => p.deleteWaypoint(p.selWp!.id)} className="font-semibold text-destructive">Xóa</button>
            </div>
          )}
          <div className="rounded-xl bg-muted p-3 text-[11px] text-muted-foreground">
            Quy tắc: Đi bộ dùng mọi đoạn · Xe lăn chỉ đoạn có "Lối xe lăn" · Xe máy/Ô tô/Xe buýt chỉ đoạn có cờ tương ứng và không "Chỉ đi bộ".
          </div>
        </div>
      )}

      {tab === "places" && (p.sel ? (
        <div className="space-y-2 rounded-xl border bg-card p-3 text-xs">
          {(["vi", "name"] as const).map((k) => (
            <input key={k} value={p.sel![k]} placeholder={k === "vi" ? "Tên tiếng Việt" : "English name"} className="h-9 w-full rounded-lg border bg-background px-2"
              onChange={(e) => p.updateBuilding(p.sel!.id, { [k]: e.target.value })} onBlur={() => p.saveBuilding(p.sel!)} />
          ))}
          <select value={p.sel.category} className="h-9 w-full rounded-lg border bg-background px-2"
            onChange={(e) => { const b = { ...p.sel!, category: e.target.value as Category }; p.updateBuilding(b.id, b); p.saveBuilding(b); }}>
            <option value="lecture">Giảng đường</option><option value="dorm">Ký túc xá</option><option value="amenity">Tiện ích</option>
          </select>
          <textarea value={p.sel.desc} rows={3} placeholder="Mô tả" className="w-full rounded-lg border bg-background p-2"
            onChange={(e) => p.updateBuilding(p.sel!.id, { desc: e.target.value })} onBlur={() => p.saveBuilding(p.sel!)} />
          <div className="flex justify-between text-muted-foreground"><span>x {p.sel.x} · y {p.sel.y}</span>
            <button onClick={() => p.deleteBuilding(p.sel!.id)} className="font-semibold text-destructive">Xóa tòa nhà</button></div>
          {p.roomEditor}
        </div>
      ) : <p className="text-xs text-muted-foreground">Chạm vào một tòa nhà để sửa, hoặc kéo để di chuyển.</p>)}

      {tab === "map" && (
        <div className="space-y-3">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-primary/40 bg-card p-4 text-center text-xs">
            <div className="font-semibold text-primary">Tải lên bản đồ / blueprint</div>
            <div className="text-muted-foreground">PNG, JPG, WebP hoặc SVG · tối đa 20MB</div>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) p.uploadMap(f); e.target.value = ""; }} />
          </label>
          {p.settings.image_path ? (
            <>
              <Slider label="Tỉ lệ (scale)" k="scale" min={0.2} max={3} step={0.01} />
              <Slider label="Lệch X (offset)" k="offset_x" min={-1000} max={1000} step={1} />
              <Slider label="Lệch Y (offset)" k="offset_y" min={-720} max={720} step={1} />
              <Slider label="Độ mờ (opacity)" k="opacity" min={0.1} max={1} step={0.05} />
              <div className="flex justify-between text-xs">
                <button className="underline" onClick={() => p.saveSettings({ scale: 1, offset_x: 0, offset_y: 0 })}>Đặt lại căn chỉnh</button>
                <button className="font-semibold text-destructive" onClick={() => p.saveSettings({ image_path: null })}>Gỡ bản đồ nền</button>
              </div>
            </>
          ) : <p className="text-xs text-muted-foreground">Chưa có bản đồ nền — đang dùng bản vẽ mặc định.</p>}
        </div>
      )}
    </aside>
  );
}

function FlagGroup({ title, flags, onToggle }: { title: string; flags: string[]; onToggle: (f: string) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {SEGMENT_FLAGS.map((f) => (
          <button key={f.id} title={f.hint} onClick={() => onToggle(f.id)}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${flags.includes(f.id) ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground"}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: flagColor[f.id] }} />{f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Picker({ label, value, onChange, buildings, active, onTap, rooms, selectedRoom, onRoomChange }: {
  label: string; value: string; onChange: (v: string) => void; buildings: Building[]; active: boolean; onTap: () => void;
  rooms?: Room[]; selectedRoom?: string; onRoomChange?: (id: string) => void;
}) {
  const sel = buildings.find((b) => b.id === value);
  const isFrom = label === "Từ";
  const buildingRooms = sel && rooms ? rooms.filter((r) => r.building_id === sel.id).sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name)) : [];
  return (
    <div className={`rounded-xl border bg-card px-2 ${active ? "border-primary" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="w-8 text-xs font-bold text-muted-foreground">{label}</span>
        <select value={value} onChange={(e) => { onChange(e.target.value); if (onRoomChange) onRoomChange(""); }} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none">
          <option value="">Chọn tòa nhà…</option>
          {isFrom && <option value="my_location">📍 Vị trí của tôi</option>}
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.vi}</option>)}
        </select>
        <button onClick={onTap} title="Chọn trên bản đồ" className={`text-sm ${active ? "text-primary" : "text-muted-foreground"}`}>⌖</button>
      </div>
      {sel && buildingRooms.length > 0 && (
        <div className="flex items-center gap-2 border-t pb-1.5 pt-1">
          <span className="w-8 text-[10px] font-bold text-muted-foreground">P.</span>
          <select value={selectedRoom ?? ""} onChange={(e) => onRoomChange?.(e.target.value)} className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none">
            <option value="">Chọn phòng (không bắt buộc)…</option>
            {buildingRooms.map((r) => <option key={r.id} value={r.id}>T{r.floor} · {r.name}{r.code ? ` (${r.code})` : ""}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
