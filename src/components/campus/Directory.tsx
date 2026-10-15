import { useEffect, useMemo, useRef, useState } from "react";
import { Building, Room, Step, searchDirectory } from "@/lib/campus";

const kindIcon: Record<string, string> = { department: "🏢", hall: "🎤", lab: "🔬", facility: "📚", desk: "🛎️", laundry: "🧺", room: "🚪" };

export function SearchBox({ buildings, rooms, onPick }: { buildings: Building[]; rooms: Room[]; onPick: (b: Building, r?: Room) => void }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchDirectory(q, buildings, rooms), [q, buildings, rooms]);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!q) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setQ(""); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [q]);
  return (
    <div ref={wrapRef} className="relative">
      <div className="flex h-10 items-center gap-2 rounded-xl border bg-card px-3 transition-colors focus-within:border-primary">
        <span className="text-sm">🔍</span>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tòa nhà, phòng, khoa…"
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        {q && <button onClick={() => setQ("")} className="shrink-0 text-muted-foreground hover:text-foreground">✕</button>}
      </div>
      {q && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl bg-card p-1 shadow-lg ring-1 ring-border">
          {hits.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Không tìm thấy kết quả.</div>}
          {hits.map((h, i) => (
            <button key={i} onClick={() => { onPick(h.building, h.room); setQ(""); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent">
              <span>{h.room ? kindIcon[h.room.kind] ?? "🚪" : "📍"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{h.room ? h.room.name : h.building.vi}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {h.room ? `${h.building.vi} · Tầng ${h.room.floor}${h.room.code ? ` · ${h.room.code}` : ""}` : h.building.name}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FloorDirectory({ rooms, floors, highlight, onPickRoom }: {
  rooms: Room[]; floors?: number | null | undefined; highlight?: string | null | undefined;
  onPickRoom?: (room: Room) => void;
}) {
  const byFloor = useMemo(() => {
    const m = new Map<number, Room[]>();
    for (const r of rooms) (m.get(r.floor) ?? m.set(r.floor, []).get(r.floor)!).push(r);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [rooms]);
  if (!rooms.length && !floors) return null;
  return (
    <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl bg-muted/60 p-3">
      <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <span>Danh sách phòng ({rooms.length})</span>{floors ? <span>{floors} tầng</span> : null}
      </div>
      {byFloor.map(([f, rs]) => (
        <div key={f} className="mb-2.5 last:mb-0">
          <div className="mb-1 text-xs font-bold text-primary">Tầng {f}</div>
          <div className="space-y-1">
            {rs.map((r) => {
              const active = r.id === highlight;
              const Tag = onPickRoom ? "button" : "div";
              return (
                <Tag
                  key={r.id}
                  {...(onPickRoom ? { onClick: () => onPickRoom(r) } : {})}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-transparent bg-card hover:bg-accent"}`}
                >
                  <span className="shrink-0 text-base">{kindIcon[r.kind] ?? "🚪"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.name}</span>
                    {r.code && <span className={`block truncate text-[10px] ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{r.code}</span>}
                  </span>
                  {onPickRoom && !active && <span className="shrink-0 text-muted-foreground">→</span>}
                </Tag>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DirectionsPanel({ steps, activeIdx, navigating, onStart, onStop, progress }: {
  steps: Step[]; activeIdx: number; navigating: boolean; onStart: () => void; onStop: () => void; progress: number;
}) {
  const [open, setOpen] = useState(false);
  const show = open || navigating;
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 p-2">
        <button onClick={() => setOpen(!open)} className="flex-1 text-left text-xs font-semibold">
          {show ? "▾" : "▸"} Chỉ đường từng bước ({steps.length})
        </button>
        {navigating ? (
          <button onClick={onStop} className="rounded-lg bg-muted px-3 py-1.5 text-xs font-bold">Dừng</button>
        ) : (
          <button onClick={onStart} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">▶ Bắt đầu dẫn đường</button>
        )}
      </div>
      {navigating && <div className="mx-2 mb-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} /></div>}
      {show && (
        <ol className="max-h-48 space-y-0.5 overflow-y-auto px-2 pb-2">
          {steps.map((s, i) => (
            <li key={i} className={`flex gap-2 rounded-lg px-2 py-1.5 text-sm ${navigating && i === activeIdx ? "bg-accent font-bold text-accent-foreground" : navigating && i < activeIdx ? "text-muted-foreground line-through" : ""}`}>
              <span>{s.icon}</span><span>{s.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function RoomEditor({ building, rooms, onAdd, onDelete, onFloors }: {
  building: Building & { floors?: number | null }; rooms: Room[];
  onAdd: (r: Omit<Room, "id">) => void; onDelete: (id: string) => void; onFloors: (n: number | null) => void;
}) {
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [floor, setFloor] = useState(1); const [kind, setKind] = useState("room");
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3 text-xs">
      <div className="flex items-center justify-between font-semibold">
        <span>Tầng & phòng</span>
        <label className="flex items-center gap-1">Số tầng
          <input type="number" min={1} defaultValue={building.floors ?? ""} className="h-7 w-14 rounded border bg-background px-1"
            onBlur={(e) => onFloors(e.target.value ? Number(e.target.value) : null)} />
        </label>
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {rooms.sort((a, b) => a.floor - b.floor).map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded bg-muted px-2 py-1">
            <span>T{r.floor} · {r.name}{r.code ? ` (${r.code})` : ""}</span>
            <button onClick={() => onDelete(r.id)} className="text-destructive">✕</button>
          </div>
        ))}
        {!rooms.length && <div className="text-muted-foreground">Chưa có phòng.</div>}
      </div>
      <div className="grid grid-cols-[3rem_1fr] gap-1">
        <input type="number" min={0} value={floor} onChange={(e) => setFloor(Number(e.target.value))} className="h-8 rounded border bg-background px-1" title="Tầng" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên phòng / khoa" className="h-8 rounded border bg-background px-2" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="col-span-2 h-8 rounded border bg-background px-1">
          <option value="room">Phòng học</option><option value="department">Phòng ban / Khoa</option><option value="hall">Hội trường</option>
          <option value="lab">Lab</option><option value="facility">Tiện ích (thư viện…)</option><option value="desk">Bàn hỗ trợ</option><option value="laundry">Phòng giặt</option>
        </select>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã (vd AL-302)" className="h-8 rounded border bg-background px-2" />
        <button disabled={!name} onClick={() => { onAdd({ building_id: building.id, floor, name, code: code || null, kind }); setName(""); setCode(""); }}
          className="h-8 rounded bg-primary font-bold text-primary-foreground disabled:opacity-50">+ Thêm</button>
      </div>
    </div>
  );
}
