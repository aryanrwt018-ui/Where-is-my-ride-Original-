import { v } from "convex/values";
import { action } from "./_generated/server";

export const fetchStationByCode = action({
  args: { code: v.string() },
  handler: async (_ctx, args) => {
    "use node";
    const rrKey = process.env.RAILRADAR_API_KEY || process.env.VITE_RAILRADAR_API_KEY || "";
    if (!rrKey) throw new Error("RAILRADAR_API_KEY not configured");
    const headers: Record<string, string> = { "x-api-key": rrKey, authorization: rrKey };
    // Fetch all stations and find the requested code (primary: RailRadar)
    const url = "https://api.railradar.org/api/v1/stations/all";
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`RailRadar stations error: ${res.status}`);
    const data = await res.json();
    const list: any[] =
      Array.isArray(data?.stations) ? data.stations
      : Array.isArray(data?.result) ? data.result
      : Array.isArray(data?.data) ? data.data
      : Array.isArray(data) ? data
      : [];
    const codeUpper = args.code.toUpperCase();
    const found = list.find((s: any) => String(s?.code ?? s?.stationCode ?? s?.id ?? "").toUpperCase() === codeUpper);
    if (!found) throw new Error("Station not found");
    const lat = Number(found?.lat ?? found?.latitude ?? found?.Lat ?? found?.Latitude);
    const lng = Number(found?.lng ?? found?.lon ?? found?.longitude ?? found?.Lon ?? found?.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Invalid coordinates");
    const label = String(found?.name ?? found?.stationName ?? found?.StationName ?? codeUpper);
    return { id: codeUpper, lat, lng, label, zone: found?.zone ?? "", state: found?.state ?? "" };
  },
});

export const fetchStationsByCodes = action({
  args: { codes: v.array(v.string()) },
  handler: async (_ctx, args) => {
    "use node";
    const rrKey = process.env.RAILRADAR_API_KEY || process.env.VITE_RAILRADAR_API_KEY || "";
    if (!rrKey) throw new Error("RAILRADAR_API_KEY not configured");
    const headers: Record<string, string> = { "x-api-key": rrKey, authorization: rrKey };
    const res = await fetch("https://api.railradar.org/api/v1/stations/all", { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`RailRadar stations error: ${res.status}`);
    const data = await res.json();
    const list: any[] =
      Array.isArray(data?.stations) ? data.stations
      : Array.isArray(data?.result) ? data.result
      : Array.isArray(data?.data) ? data.data
      : Array.isArray(data) ? data
      : [];
    const set = new Set(args.codes.map((c) => c.toUpperCase()));
    const out = list.filter((s: any) => set.has(String(s?.code ?? s?.stationCode ?? s?.id ?? "").toUpperCase()))
      .map((s: any) => {
        const code = String(s?.code ?? s?.stationCode ?? s?.id ?? "").toUpperCase();
        const lat = Number(s?.lat ?? s?.latitude ?? s?.Lat ?? s?.Latitude);
        const lng = Number(s?.lng ?? s?.lon ?? s?.longitude ?? s?.Lon ?? s?.Longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const label = String(s?.name ?? s?.stationName ?? s?.StationName ?? code);
        return { id: code, lat, lng, label, zone: s?.zone ?? "", state: s?.state ?? "" };
      })
      .filter(Boolean);
    return out;
  },
});

export const liveStation = action({
  args: { stationCode: v.string(), hours: v.union(v.literal(2), v.literal(4)) },
  handler: async () => {
    "use node";
    // Rail Radar does not expose the same live station board; return empty list to avoid 500s.
    return [];
  },
});

export const liveTrainStatus = action({
  args: { trainNumber: v.string(), dateYYYYMMDD: v.string() },
  handler: async (_ctx, args) => {
    "use node";
    const rrKey = process.env.RAILRADAR_API_KEY || process.env.VITE_RAILRADAR_API_KEY || "";
    if (!rrKey) throw new Error("RAILRADAR_API_KEY not configured");
    const headers: Record<string, string> = { "x-api-key": rrKey, authorization: rrKey };
    const res = await fetch(`https://api.railradar.org/api/v1/trains/${encodeURIComponent(args.trainNumber)}`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`RailRadar train error: ${res.status}`);
    const data = await res.json();
    const route = Array.isArray(data?.stops) ? data.stops : Array.isArray(data?.Route) ? data.Route : [];
    const current = route.find((r: any) => r?.current === true || r?.isCurrent === true) ?? null;
    return {
      currentStation: current,
      route: route.map((r: any) => ({
        stationName: String(r?.station?.name ?? r?.StationName ?? ""),
        stationCode: String(r?.station?.code ?? r?.StationCode ?? ""),
        scheduleArrival: String(r?.scheduleArrival ?? r?.ScheduleArrival ?? r?.arrivalTime ?? ""),
        scheduleDeparture: String(r?.scheduleDeparture ?? r?.ScheduleDeparture ?? r?.departureTime ?? ""),
        actualArrival: String(r?.actualArrival ?? ""),
        actualDeparture: String(r?.actualDeparture ?? ""),
        delayArrival: String(r?.delayArrival ?? r?.DelayInArrival ?? ""),
        delayDeparture: String(r?.delayDeparture ?? r?.DelayInDeparture ?? ""),
      })),
    };
  },
});

export const fetchAllStations = action({
  args: {},
  handler: async () => {
    "use node";
    const normalize = (lat: number, lng: number) => {
      const a = Number(lat), b = Number(lng);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      const inRange = (x: number, min: number, max: number) => x >= min && x <= max;
      if (!inRange(a, -90, 90) || !inRange(b, -180, 180) || (inRange(a, 60, 97) && inRange(b, 6, 37))) {
        return { lat: b, lng: a };
      }
      return { lat: a, lng: b };
    };
    const toMarker = (s: any) => {
      const code = s?.StationCode ?? s?.stationCode ?? s?.code ?? s?.id;
      const name = s?.StationName ?? s?.stationName ?? s?.name ?? code;
      const latRaw = s?.Latitude ?? s?.latitude ?? s?.lat;
      const lngRaw = s?.Longitude ?? s?.longitude ?? s?.lng;
      const coords = normalize(Number(latRaw), Number(lngRaw));
      if (!code || !coords) return null;
      return { id: String(code), label: String(name), lat: coords.lat, lng: coords.lng };
    };
    // Try local service
    try {
      const r = await fetch("http://localhost:3001/api/v1/search/stations");
      if (r.ok) {
        const data = await r.json();
        const list = Array.isArray(data?.stations)
          ? data.stations
          : Array.isArray(data?.result)
            ? data.result
            : Array.isArray(data?.data)
              ? data.data
              : data;
        const markers = (Array.isArray(list) ? list : []).map(toMarker).filter(Boolean);
        if (markers.length) return markers;
      }
    } catch {}
    // Fallback to railradar
    try {
      const rrKey =
        process.env.RAILRADAR_API_KEY || process.env.VITE_RAILRADAR_API_KEY || "";
      const url = `https://api.railradar.org/api/v1/stations/all?apikey=${encodeURIComponent(
        rrKey || "",
      )}`;
      const headers: Record<string, string> = {};
      if (rrKey) {
        headers["x-api-key"] = rrKey;
        headers["authorization"] = rrKey;
      }
      const r2 = await fetch(url, { headers });
      if (r2.ok) {
        const data2 = await r2.json();
        const primary = Array.isArray(data2?.stations)
          ? data2.stations
          : Array.isArray(data2?.result)
            ? data2.result
            : Array.isArray(data2?.data)
              ? data2.data
              : data2;
        const arr = Array.isArray(primary)
          ? primary
          : primary && typeof primary === "object"
            ? Object.values(primary as Record<string, unknown>)
            : [];
        const markers2 = arr.map(toMarker).filter(Boolean);
        if (markers2.length) return markers2;
      }
    } catch {}
    return [];
  },
});
