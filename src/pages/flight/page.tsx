import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import Globe3D from "@/components/globe-3d.tsx";
import Globe3DCesium from "@/components/globe-3d-cesium.tsx";
import type { MarkerData } from "@/components/globe-3d-cesium.tsx";

const WORLD_FLIGHTS: MarkerData[] = [
  { id: "f1", lat: 51.47, lng: -0.4543, label: "London Heathrow" },
  { id: "f2", lat: 40.6413, lng: -73.7781, label: "New York JFK" },
  { id: "f3", lat: 35.5494, lng: 139.7798, label: "Tokyo Haneda" },
  { id: "f4", lat: 25.2532, lng: 55.3657, label: "Dubai" },
  { id: "f5", lat: 1.3644, lng: 103.9915, label: "Singapore Changi" },
  { id: "f6", lat: 33.9416, lng: -118.4085, label: "Los Angeles" },
  { id: "f7", lat: 48.3538, lng: 11.7861, label: "Munich" },
  { id: "f8", lat: 41.9786, lng: -87.9048, label: "Chicago O'Hare" },
  { id: "f9", lat: 25.7959, lng: -80.2871, label: "Miami" },
  { id: "f10", lat: 28.5562, lng: 77.1000, label: "Delhi Indira Gandhi" },
  { id: "f11", lat: 22.3080, lng: 113.9185, label: "Hong Kong" },
  { id: "f12", lat: -33.9461, lng: 151.1772, label: "Sydney" },
  { id: "f13", lat: 50.0379, lng: 8.5622, label: "Frankfurt" },
  { id: "f14", lat: 45.6300, lng: 8.7231, label: "Milan Malpensa" },
  { id: "f15", lat: -23.4356, lng: -46.4731, label: "São Paulo GRU" },
  { id: "f16", lat: -26.1337, lng: 28.2420, label: "Johannesburg" },
  { id: "f17", lat: 55.9728, lng: 37.4146, label: "Moscow Sheremetyevo" },
  { id: "f18", lat: 45.4706, lng: -73.7408, label: "Montréal" },
  { id: "f19", lat: 52.3105, lng: 4.7683, label: "Amsterdam Schiphol" },
  { id: "f20", lat: 13.9125, lng: 100.6067, label: "Bangkok Suvarnabhumi" },
];

export default function FlightPage() {
  const hasIonToken = Boolean((import.meta as any).env?.VITE_CESIUM_ION_TOKEN);
  const [satellite, setSatellite] = useState(true);
  const base = satellite ? "satellite" : "map";
  const terrain = Boolean(hasIonToken);
  return (
    <div className="relative h-full w-full">
      <Globe3DCesium
        markers={[]}
        airports={WORLD_FLIGHTS}
        flightPaths={[
          { id: "lhr-jfk", from: [-0.4543, 51.47], to: [-73.7781, 40.6413] },
          { id: "jfk-hnd", from: [-73.7781, 40.6413], to: [139.7798, 35.5494] },
          { id: "dxb-sin", from: [55.3657, 25.2532], to: [103.9915, 1.3644] },
          { id: "lax-syd", from: [-118.4085, 33.9416], to: [151.1772, -33.9461] },
        ]}
        base={base}
        terrain={terrain}
        centerLat={20}
        centerLng={0}
        zoom={3}
        labelsOnClick
      />

      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <h2 className="text-lg font-bold text-white drop-shadow-lg">Global Flights</h2>
        <p className="text-sm text-white/70">{WORLD_FLIGHTS.length} hubs highlighted</p>
      </div>
      <div className="absolute left-4 top-16 z-20">
        <Button
          size="sm"
          variant={satellite ? "default" : "secondary"}
          onClick={() => setSatellite((v) => !v)}
        >
          {satellite ? "Satellite + Terrain" : "Map"}
        </Button>
      </div>
    </div>
  );
}
