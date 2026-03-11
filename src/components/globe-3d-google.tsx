import { useEffect, useRef } from "react";

type MarkerData = {
  id: string;
  lat: number;
  lng: number;
  label: string;
};

type Props = {
  markers: MarkerData[];
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
};

declare global {
  interface Window {
    initGoogleMapsReady?: () => void;
  }
}

declare const google: any;

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById("google-maps-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-js";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
}

export default function Globe3DGoogle({
  markers,
  centerLat = 20,
  centerLng = 0,
  zoom = 2,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!apiKey) return;

    let map: any | undefined;
    let markerInstances: Array<any> = [];

    loadGoogleMaps(apiKey)
      .then(async () => {
        const mapsLib: any = await (google as any).maps.importLibrary("maps");
        const markerLib: any = await (google as any).maps.importLibrary("marker");
        const Map = mapsLib.Map;
        const AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
        if (!ref.current) return;
        map = new Map(ref.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom,
          heading: 0,
          tilt: 45,
          mapId: undefined,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
        });
       
        markerInstances = markers.map((m) => {
          const el = document.createElement("div");
          el.style.width = "10px";
          el.style.height = "10px";
          el.style.borderRadius = "50%";
          el.style.boxShadow = "0 0 8px rgba(34, 211, 238, 0.8)";
          el.style.background = "#22d3ee";
          return new AdvancedMarkerElement({
            position: { lat: m.lat, lng: m.lng },
            map,
            title: m.label,
            content: el,
          });
        });
      })
      .catch(() => {
     
      });

    return () => {
     
      markerInstances = [];
      map = undefined;
    };
  }, [markers, centerLat, centerLng, zoom]);

  return <div ref={ref} className="absolute inset-0 bg-black" />;
}

export type { MarkerData };
