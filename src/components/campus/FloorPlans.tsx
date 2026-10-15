import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { Room, VehicleId } from "@/lib/campus";
import { IN_H, IN_W, buildingFloors, findBox, indoorRoute, type FloorLayout, type RoomBox } from "@/lib/indoor";

export type FloorPlan = { id: string; building_id: string; floor: number; image_url: string; url?: string | null };

const BUCKET = "floor-plans";

export async function loadFloorPlans(): Promise<FloorPlan[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase.from("floor_plans").select("*");
  if (!data?.length) return [];
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(data.map((d) => d.image_url), 60 * 60 * 24);
  return data.map((d, i) => ({ ...d, url: signed?.[i]?.signedUrl ?? null }));
}

export async function uploadFloorPlan(buildingId: string, floor: number, file: File): Promise<FloorPlan> {
  if (!isSupabaseConfigured()) throw new Error("Kết nối dữ liệu chưa sẵn sàng.");
  if (file.type !== "image/png") throw new Error("Chỉ chấp nhận ảnh PNG.");
  const path = `${buildingId}/floor-${floor}-${Date.now()}.png`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: "image/png" });
  if (up.error) throw up.error;
  const { data, error } = await supabase.from("floor_plans")
    .upsert({ building_id: buildingId, floor, image_url: path }, { onConflict: "building_id,floor" }).select().single();
  if (error) throw error;
  const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
  return { ...data, url: s?.signedUrl ?? null };
}

export async function deleteFloorPlan(p: FloorPlan) {
  if (!isSupabaseConfigured()) throw new Error("Kết nối dữ liệu chưa sẵn sàng.");
  const { error } = await supabase.from("floor_plans").delete().eq("id", p.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([p.image_url]);
}

export function FloorPlanUploader({ buildingId, floors, plans, onChange }: {
  buildingId: string; floors: number; plans: FloorPlan[]; onChange: (next: FloorPlan[]) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const mine = plans.filter((p) => p.building_id === buildingId);
  const list = Array.from({ length: Math.max(1, floors) }, (_, i) => i + 1);
  return (
    <div className="space-y-1.5 border-t pt-2">
      <div className="font-semibold">Blueprint từng tầng (PNG)</div>
      {err && <div className="text-destructive">{err}</div>}
      {list.map((f) => {
        const p = mine.find((x) => x.floor === f);
        return (
          <div key={f} className="flex items-center gap-2 rounded bg-muted px-2 py-1">
            <span className="w-8 font-bold">T{f}</span>
            {p?.url ? <img src={p.url} alt={`Tầng ${f}`} className="h-9 w-12 rounded border object-cover" /> : null}
            <label className="flex-1 cursor-pointer truncate text-primary">
              {busy === f ? "Đang tải…" : p ? "Thay ảnh" : `Tải blueprint PNG Tầng ${f}`}
              <input type="file" accept="image/png,.png" className="hidden" disabled={busy !== null}
                onChange={async (e) => {
                  const file = e.target.files?.[0]; e.target.value = "";
                  if (!file) return;
                  setBusy(f); setErr("");
                  try { const np = await uploadFloorPlan(buildingId, f, file); onChange([...plans.filter((x) => x.id !== np.id && !(x.building_id === buildingId && x.floor === f)), np]); }
                  catch (er) { setErr((er as Error).message); }
                  setBusy(null);
                }} />
            </label>
            {p && (
              <button className="text-destructive" onClick={async () => {
                try { await deleteFloorPlan(p); onChange(plans.filter((x) => x.id !== p.id)); } catch (er) { setErr((er as Error).message); }
              }}>Xóa ảnh</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function IndoorViewer({ title, buildingId, floors, plans, rooms, initialFloor, highlight, vehicle = "walk", onClose }: {
  title: string; buildingId: string; floors: number; plans: FloorPlan[]; rooms: Room[]; initialFloor?: number | null | undefined;
  highlight?: string | null | undefined; vehicle?: VehicleId; onClose: () => void;
}) {
  const layouts = useMemo(() => buildingFloors(buildingId, Math.max(floors, ...plans.map((p) => p.floor)), rooms), [buildingId, floors, plans, rooms]);
  const list = layouts.map((l) => l.floor);
  const target = findBox(layouts, highlight);
  const route = useMemo(() => (target ? indoorRoute(layouts, target, vehicle) : null), [layouts, target, vehicle]);
  const [floor, setFloor] = useState<number>(initialFloor ?? target?.floor ?? 1);
  const [v, setV] = useState({ x: 0, y: 0, k: 1 });
  const [sim, setSim] = useState<number | null>(null); // index into route.nodes (fractional)
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => setV({ x: 0, y: 0, k: 1 }), [floor]);
  useEffect(() => {
    if (sim === null || !route) return;
    if (sim >= route.nodes.length - 1) return;
    const id = setTimeout(() => {
      const next = Math.min(route.nodes.length - 1, sim + 0.08);
      const n = route.nodes[Math.floor(next)]!;
      if (n.floor !== floor) setFloor(n.floor);
      setSim(next);
    }, 60);
    return () => clearTimeout(id);
  }, [sim, route, floor]);
  const plan = plans.find((p) => p.floor === floor);
  const layout = layouts.find((l) => l.floor === floor)!;
  const floorRooms = rooms.filter((r) => r.floor === floor);
  const pts = route?.byFloor[floor];
  let dot: [number, number] | null = null;
  if (route && sim !== null) {
    const i = Math.floor(sim), a = route.nodes[i]!, b = route.nodes[Math.min(i + 1, route.nodes.length - 1)]!;
    const t = sim - i;
    if (a.floor === floor) dot = b.floor === floor ? [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t] : [a.x, a.y];
  }
  const curStep = route && sim !== null ? Math.min(route.steps.length - 1, Math.floor((sim / Math.max(1, route.nodes.length - 1)) * route.steps.length)) : -1;
  return (
    <div className="fade-in absolute inset-0 z-40 flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b bg-card p-3">
        <button onClick={onClose} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground shadow">← Trở lại bản đồ trường</button>
        <h2 className="truncate text-lg font-extrabold">{title}</h2>
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-b bg-card px-3 py-2">
        {list.map((f) => (
          <button key={f} onClick={() => setFloor(f)}
            className={`relative rounded-full px-3 py-1 text-sm font-bold ${f === floor ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            T{f}{route?.byFloor[f] ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" /> : null}
          </button>
        ))}
      </div>
      <div className="relative flex-1 touch-none overflow-hidden bg-muted"
        onWheel={(e) => setV((s) => ({ ...s, k: Math.min(6, Math.max(0.5, s.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1))) }))}
        onPointerDown={(e) => { drag.current = { x: e.clientX - v.x, y: e.clientY - v.y }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current) setV((s) => ({ ...s, x: e.clientX - drag.current!.x, y: e.clientY - drag.current!.y })); }}
        onPointerUp={() => (drag.current = null)}>
        <div className="absolute inset-0 m-auto flex items-center justify-center p-3" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.k})` }}>
          {plan?.url ? (
            <img src={plan.url} alt={`Sơ đồ tầng ${floor}`} draggable={false} className="max-h-full max-w-full select-none" />
          ) : (
            <DemoBlueprint layout={layout} target={target?.floor === floor ? target : null} route={pts ?? null} dot={dot} vehicle={vehicle} />
          )}
        </div>
        {plan?.url && <div className="glass absolute left-3 top-3 rounded-lg px-2 py-1 text-[11px]">Ảnh blueprint tải lên — đường đi trong nhà hiển thị trên sơ đồ mẫu</div>}
        <div className="glass absolute right-3 top-3 flex flex-col overflow-hidden rounded-xl">
          <button className="h-9 w-9 font-bold hover:bg-accent" onClick={() => setV((s) => ({ ...s, k: Math.min(6, s.k * 1.3) }))}>+</button>
          <button className="h-9 w-9 font-bold hover:bg-accent" onClick={() => setV((s) => ({ ...s, k: Math.max(0.5, s.k / 1.3) }))}>−</button>
          <button className="h-9 w-9 font-bold hover:bg-accent" onClick={() => setV({ x: 0, y: 0, k: 1 })}>◎</button>
        </div>
      </div>
      <div className="space-y-2 border-t bg-card p-3">
        {route && (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {vehicle === "wheelchair" ? "♿ Lộ trình trợ năng" : "🚶 Lộ trình trong nhà"} · {route.mode === "elevator" ? "Thang máy" : "Cầu thang bộ"} · {route.meters} m
              </div>
              <button onClick={() => { setFloor(1); setSim(0); }} className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                {sim !== null && sim < route.nodes.length - 1 ? "Đang mô phỏng…" : "▶ Mô phỏng đi trong nhà"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {route.steps.map((s, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground">➔</span>}
                  <button onClick={() => setFloor(s.floor)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${i === curStep ? "border-primary bg-primary text-primary-foreground" : s.floor === floor ? "border-primary/50 bg-primary/10" : "bg-background"}`}>
                    {s.icon} {s.text}
                  </button>
                </span>
              ))}
            </div>
          </>
        )}
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Phòng tại Tầng {floor}</div>
        <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
          {floorRooms.length ? floorRooms.map((r) => (
            <span key={r.id} className={`rounded-full border px-2.5 py-1 text-xs ${r.id === highlight ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>
              {r.name}{r.code ? ` · ${r.code}` : ""}
            </span>
          )) : <span className="text-xs text-muted-foreground">Chưa có phòng.</span>}
        </div>
      </div>
    </div>
  );
}

const KIND_FILL: Record<string, string> = { laundry: "var(--accent)", exit: "var(--destructive)", wc: "var(--secondary)", atrium: "var(--accent)", hall: "var(--secondary)" };

function DemoBlueprint({ layout, target, route, dot, vehicle }: {
  layout: FloorLayout; target: RoomBox | null; route: [number, number][] | null; dot: [number, number] | null; vehicle: VehicleId;
}) {
  return (
    <svg viewBox={`0 0 ${IN_W} ${IN_H}`} className="h-full max-h-full w-full max-w-full select-none rounded-xl bg-card shadow" role="img" aria-label={`Sơ đồ mẫu tầng ${layout.floor}`}>
      <defs>
        <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="var(--border)" strokeWidth="0.5" /></pattern>
      </defs>
      <rect x="20" y="20" width={IN_W - 40} height={IN_H - 40} rx="10" fill="url(#bp-grid)" stroke="var(--foreground)" strokeWidth="3" />
      <rect x="40" y="225" width={IN_W - 80} height="50" fill="var(--muted)" />
      <text x={IN_W / 2} y="254" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">HÀNH LANG</text>
      {layout.boxes.map((b) => {
        const hl = target?.key === b.key;
        return (
          <g key={b.key}>
            <rect x={b.x + 3} y={b.y} width={b.w - 6} height={b.h} rx="4"
              fill={hl ? "var(--primary)" : KIND_FILL[b.kind] ?? "var(--background)"} fillOpacity={hl ? 0.25 : 1}
              stroke={hl ? "var(--primary)" : "var(--foreground)"} strokeOpacity={hl ? 1 : 0.5} strokeWidth={hl ? 3 : 1.2}
              className={hl ? "animate-pulse" : undefined} />
            <foreignObject x={b.x + 6} y={b.y + 6} width={b.w - 12} height={b.h - 12}>
              <div className="flex h-full flex-col items-center justify-center text-center leading-tight" style={{ fontSize: 10 }}>
                {b.code && <b>{b.code}</b>}
                <span className="line-clamp-3 text-muted-foreground">{b.label}</span>
              </div>
            </foreignObject>
            <rect x={b.x + b.w / 2 - 9} y={b.side === "top" ? b.y + b.h - 2 : b.y - 2} width="18" height="4" fill="var(--card)" />
            {hl && <g><rect x={b.x + b.w / 2 - 30} y={b.y - 14} width="60" height="18" rx="9" fill="var(--primary)" />
              <text x={b.x + b.w / 2} y={b.y - 1} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--primary-foreground)">📍 Đích</text></g>}
          </g>
        );
      })}
      {layout.nodes.filter((n) => ["stairs", "elevator", "entrance", "ramp"].includes(n.kind)).map((n) => (
        <g key={n.id}>
          <rect x={n.x - 26} y={n.y - 22} width="52" height="44" rx="8" fill="var(--secondary)" stroke="var(--foreground)" strokeOpacity="0.5" />
          <text x={n.x} y={n.y + 2} textAnchor="middle" fontSize="18">{n.kind === "stairs" ? "🪜" : n.kind === "elevator" ? "🛗" : n.kind === "ramp" ? "♿" : "🚪"}</text>
          <text x={n.x} y={n.y + 17} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">{n.kind === "stairs" ? "Cầu thang" : n.kind === "elevator" ? "Thang máy" : n.kind === "ramp" ? "Lối dốc" : "Sảnh chính"}</text>
        </g>
      ))}
      {route && route.length > 1 && (
        <polyline points={route.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--primary)" strokeWidth="5"
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray={vehicle === "wheelchair" ? "2 10" : "12 8"} className="route-dash" />
      )}
      {dot && <g><circle cx={dot[0]} cy={dot[1]} r="14" fill="var(--primary)" opacity="0.25" /><circle cx={dot[0]} cy={dot[1]} r="7" fill="var(--primary)" stroke="var(--card)" strokeWidth="2.5" /></g>}
      <text x="30" y={IN_H - 6} fontSize="10" fill="var(--muted-foreground)">Sơ đồ mẫu — Tầng {layout.floor}</text>
    </svg>
  );
}
