import { v } from "convex/values";
import { action } from "./_generated/server";

export const trainRoute = action({
  args: { trainNumber: v.string() },
  handler: async (_ctx, args) => {
    "use node";
    const apiKey =
      process.env.INDIAN_RAIL_API_KEY ||
      process.env.VITE_INDIAN_RAIL_API_KEY ||
      "";
    if (!apiKey) {
      throw new Error("INDIAN_RAIL_API_KEY is not configured");
    }
    const url = `http://indianrailapi.com/api/v1/trainroute/apikey/${encodeURIComponent(
      apiKey,
    )}/trainno/${encodeURIComponent(args.trainNumber)}/`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`TrainRoute error: ${res.status}`);
    }
    const data = await res.json();
    const route = Array.isArray(data?.Route) ? data.Route : [];
    return route.map((r: any) => ({
      stationName: String(r?.StationName ?? ""),
      stationCode: String(r?.StationCode ?? ""),
      arrival: String(r?.ArrivalTime ?? ""),
      departure: String(r?.DepartureTime ?? ""),
      day: Number(r?.Day ?? 0),
      distance: String(r?.Distance ?? ""),
      halt: String(r?.Halt ?? ""),
    }));
  },
});

export const railradarTrain = action({
  args: { trainNumber: v.string() },
  handler: async (_ctx, args) => {
    "use node";
    const key =
      process.env.RAILRADAR_API_KEY || process.env.VITE_RAILRADAR_API_KEY || "";
    const headers: Record<string, string> = {};
    if (key) headers["x-api-key"] = key;
    const res = await fetch(
      `https://api.railradar.org/api/v1/trains/${encodeURIComponent(args.trainNumber)}`,
      { headers },
    );
    if (!res.ok) {
      throw new Error(`RailRadar trains error: ${res.status}`);
    }
    const data = await res.json();
    const list =
      Array.isArray(data?.stops) ? data.stops : Array.isArray(data?.Route) ? data.Route : [];
    return list.map((r: any) => ({
      stationName: String(r?.station?.name ?? r?.StationName ?? ""),
      stationCode: String(r?.station?.code ?? r?.StationCode ?? ""),
      arrival: String(r?.arrivalTime ?? r?.ArrivalTime ?? ""),
      departure: String(r?.departureTime ?? r?.DepartureTime ?? ""),
      day: Number(r?.day ?? r?.Day ?? 0),
      distance: String(r?.distance ?? r?.Distance ?? ""),
      halt: String(r?.halt ?? r?.Halt ?? ""),
    }));
  },
});
