import type { MarkerData } from "@/components/globe-3d-cesium.tsx";

export async function loadStations(): Promise<MarkerData[]> {
  try {
    console.log("Loading stations from /stations.json");
    const res = await fetch("/stations.json", { cache: "no-store" });
    if (!res.ok) {
      console.error("Failed to load stations.json", { status: res.status, statusText: res.statusText });
      return [];
    }
    const data = await res.json();
    const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.stations) ? data.stations : [];
    const stations: MarkerData[] = (list as any[])
      .map((station: any) => {
        const id = String(station?.id ?? "").toUpperCase();
        const label = String(station?.label ?? station?.name ?? id);
        const lat = Number(station?.lat);
        const lng = Number(station?.lng ?? station?.lon);
        if (!id || !label || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { id, label, lat, lng };
      })
      .filter(Boolean) as MarkerData[];
    console.log("Stations loaded:", stations.length);
    return stations;
  } catch (err) {
    console.error("Failed to load stations.json", err);
    return [];
  }
}
