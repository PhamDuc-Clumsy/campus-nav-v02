import { useEffect, useState } from "react";
import { canvasToGps, gpsToCanvas, isWithinCampus } from "@/lib/campus";

export type GeoCoords = { x: number; y: number; lat: number; lng: number; accuracy: number; heading: number | null; speed: number | null };
export type GeoState = { coords: GeoCoords | null; isTracking: boolean; permissionState: string; isOffCampus: boolean; error: string | null };

export function useGeolocation(enabled: boolean, demo: { x: number; y: number; heading: number | null } | null) {
  const [s, setS] = useState<GeoState>({ coords: null, isTracking: false, permissionState: "prompt", isOffCampus: false, error: null });
  useEffect(() => {
    if (!enabled || demo || typeof navigator === "undefined" || !navigator.geolocation) {
      if (enabled && !demo && typeof navigator !== "undefined" && !navigator.geolocation) setS((p) => ({ ...p, error: "Thiết bị không hỗ trợ GPS" }));
      return;
    }
    navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((r) => setS((p) => ({ ...p, permissionState: r.state }))).catch(() => {});
    setS((p) => ({ ...p, isTracking: true, error: null }));
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy, heading, speed } = pos.coords;
        const { x, y } = gpsToCanvas(lat, lng);
        setS({ coords: { x, y, lat, lng, accuracy, heading: heading ?? null, speed: speed ?? null }, isTracking: true, permissionState: "granted", isOffCampus: !isWithinCampus(lat, lng), error: null });
      },
      (e) => setS((p) => ({ ...p, error: e.code === 1 ? "Bạn đã từ chối quyền truy cập vị trí" : "Không lấy được vị trí GPS", permissionState: e.code === 1 ? "denied" : p.permissionState })),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
    return () => { navigator.geolocation.clearWatch(id); setS((p) => ({ ...p, isTracking: false })); };
  }, [enabled, !!demo]);
  if (enabled && demo) {
    const g = canvasToGps(demo.x, demo.y);
    return { coords: { ...demo, ...g, accuracy: 5, speed: null }, isTracking: true, permissionState: "demo", isOffCampus: false, error: null } as GeoState;
  }
  return enabled ? s : { ...s, coords: null, isTracking: false };
}
