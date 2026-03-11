import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { toast } from "sonner";
import Globe3DCesium from "@/components/globe-3d-cesium.tsx";
import type { MarkerData } from "@/components/globe-3d-cesium.tsx";
import { RotateCw } from "lucide-react";
import { loadStations } from "@/lib/stations.ts";
import { formatMinutesToClockString, formatRelativeUpdateTime, parseMinutesAny } from "@/lib/train-time.ts";

// Coordinate normalization for inconsistent API fields
function normalize(lat: number, lng: number) {
  const a = Number(lat), b = Number(lng);
  const inRange = (x: number, min: number, max: number) => x >= min && x <= max;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (!inRange(a, -90, 90) || !inRange(b, -180, 180) || (inRange(a, 60, 97) && inRange(b, 6, 37))) {
    return { lat: b, lng: a };
  }
  return { lat: a, lng: b };
}

const DEFAULT_STATIONS: MarkerData[] = [
  { id: "NDLS", label: "New Delhi", lat: 28.6448, lng: 77.2159 },
  { id: "CSMT", label: "Mumbai CSMT", lat: 18.9402, lng: 72.8356 },
  { id: "BCT", label: "Mumbai Central", lat: 18.9696, lng: 72.8192 },
  { id: "HWH", label: "Howrah", lat: 22.585, lng: 88.3426 },
  { id: "MAS", label: "Chennai Central", lat: 13.0829, lng: 80.275 },
  { id: "SBC", label: "Bengaluru City", lat: 12.9789, lng: 77.5703 },
  { id: "NGP", label: "Nagpur", lat: 21.1466, lng: 79.0888 },
  { id: "BPL", label: "Bhopal", lat: 23.2599, lng: 77.4126 },
  { id: "CNB", label: "Kanpur Central", lat: 26.4525, lng: 80.3507 },
  { id: "LKO", label: "Lucknow NR", lat: 26.8393, lng: 80.9346 },
  { id: "JP", label: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { id: "GHY", label: "Guwahati", lat: 26.1806, lng: 91.751 },
  { id: "ASR", label: "Amritsar", lat: 31.634, lng: 74.8723 },
  { id: "BBS", label: "Bhubaneswar", lat: 20.2706, lng: 85.8336 },
  { id: "PUNE", label: "Pune Jn", lat: 18.5289, lng: 73.874 },
  { id: "TVC", label: "Trivandrum", lat: 8.4875, lng: 76.952 },
  { id: "ERS", label: "Ernakulam Jn", lat: 9.9715, lng: 76.2865 },
  { id: "CBE", label: "Coimbatore", lat: 11.0168, lng: 76.9558 },
  { id: "TATA", label: "Tatanagar", lat: 22.793, lng: 86.203 },
  { id: "ST", label: "Surat", lat: 21.1702, lng: 72.8311 },
];

export default function TrainPage() {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  const hasIonToken = Boolean(env?.VITE_CESIUM_ION_TOKEN);
  const [satellite, setSatellite] = useState(true);
  const [terrain, setTerrain] = useState(false);
  const [stations, setStations] = useState<MarkerData[]>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 22, lng: 78 });
  const [zoomLevel, setZoomLevel] = useState(3);
  const [searchCode, setSearchCode] = useState("");
  const [searchTrain, setSearchTrain] = useState("");
  const [trains, setTrains] = useState<MarkerData[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const stationsReady = stations.length > 0;
  const [selected, setSelected] = useState<(MarkerData & { ts: number; img?: string }) | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [rotateToken, setRotateToken] = useState(0);
  const [rotateCmd, setRotateCmd] = useState<{ dh: number; dp: number }>({ dh: 0, dp: 0 });
  const [status, setStatus] = useState<{ unavailable: boolean; cached: boolean }>({
    unavailable: false,
    cached: false,
  });
  const base = satellite ? "satellite" : "map";
  const [liveTrains, setLiveTrains] = useState<any[]>([]);
  const [lastUpdateTs, setLastUpdateTs] = useState<string | null>(null);
  const [selectedTrainInfo, setSelectedTrainInfo] = useState<any | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<{
  id: string;
  current: [number, number];
  next: [number, number];
  lastUpdated?: string;
  etaMinutes?: number;
} | null>(null);
  const [selectedTrainImg, setSelectedTrainImg] = useState<string | null>(null);

  const PLACEHOLDER_IMG =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="%23222"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23aaa" font-size="16" font-family="sans-serif">No image</text></svg>';

  async function getWikipediaStationImage(stationName: string): Promise<string | null> {
    const clean = String(stationName || "").trim();
    if (!clean) return null;
    const fmt = clean.replace(/\s+/g, "_");
    const attempts = [`${fmt}_railway_station`, `${fmt}`];
    for (const title of attempts) {
      try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        const image: string | null =
          data?.originalimage?.source || data?.thumbnail?.source || null;
        if (image) return image;
      } catch (err) {
        console.error("Wikipedia request failed", err);
      }
    }
    // Fallback: search for similar pages and try the first result's summary
    try {
      const q = `${clean} railway station`;
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        q,
      )}&format=json&origin=*`;
      const searchRes = await fetch(searchUrl, { cache: "no-store" });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const firstTitle: string | undefined = searchData?.query?.search?.[0]?.title;
        if (firstTitle) {
          const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            firstTitle,
          )}`;
          const summaryRes = await fetch(summaryUrl, { cache: "no-store" });
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            const image: string | null =
              summaryData?.originalimage?.source || summaryData?.thumbnail?.source || null;
            if (image) return image;
          }
        }
      }
    } catch (err) {
      console.error("Wikipedia search fallback failed", err);
    }
    return null;
  }
  async function getWikipediaTrainImage(nameOrNum: string): Promise<string | null> {
    const clean = String(nameOrNum || "").trim();
    if (!clean) return null;
    const tries = [
      clean.replace(/\s+/g, "_"),
      `${clean.replace(/\s+/g, "_")}_Express`,
      `${clean.replace(/\s+/g, "_")}_train`,
    ];
    for (const title of tries) {
      try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        const image: string | null =
          data?.originalimage?.source || data?.thumbnail?.source || null;
        if (image) {
          try { console.log("[TRAIN IMAGE] wikipedia image found for", nameOrNum); } catch {}
          return image;
        }
      } catch {}
    }
    try {
      const q = `${clean} train`;
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`;
      const searchRes = await fetch(searchUrl, { cache: "no-store" });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const firstTitle: string | undefined = searchData?.query?.search?.[0]?.title;
        if (firstTitle) {
          const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`;
          const summaryRes = await fetch(summaryUrl, { cache: "no-store" });
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            const image: string | null =
              summaryData?.originalimage?.source || summaryData?.thumbnail?.source || null;
            if (image) {
              try { console.log("[TRAIN IMAGE] wikipedia image found for", nameOrNum); } catch {}
              return image;
            }
          }
        }
      }
    } catch {}
    try { console.log("[TRAIN IMAGE] fallback image used for", nameOrNum); } catch {}
    return null;
  }

  const lastUpdateLocal = lastUpdateTs ? formatRelativeUpdateTime(lastUpdateTs) : "";

  async function handleStationSelect(st: MarkerData) {
    const ts = Date.now();
    const img = (await getWikipediaStationImage(st.label)) || PLACEHOLDER_IMG;
    setSelected({ ...st, ts, img });
    setCenter({ lat: st.lat, lng: st.lng });
  }

  useEffect(() => {}, [selected?.id, selected?.ts]);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      try {
        const markers = await loadStations();
        if (!canceled && markers.length) {
          setStations(markers);
          setCenter({ lat: markers[0].lat, lng: markers[0].lng });
          setStatus({ unavailable: false, cached: false });
          try {
            localStorage.setItem("stations_cache", JSON.stringify(markers));
          } catch {}
          return;
        }
      } catch {}
      if (!canceled) {
        setStations([]);
        setStatus({ unavailable: true, cached: false });
      }
    };
    load();
    return () => {
      canceled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let canceled = false;
    let timer: number | null = null;
    const keyName = "live_map_cache";
    try {
      console.log("[Frontend] Attempting to load live_map_cache from localStorage");
      const raw = localStorage.getItem(keyName);
      if (raw) {
        const cached = JSON.parse(raw);
        const list: any[] = Array.isArray(cached?.data) ? cached.data : [];
        const metaTs: string | undefined = String(cached?.meta?.timestamp ?? "");
        console.log("[Frontend] Cache load success; items:", list.length, "timestamp:", metaTs);
        setLiveTrains(list);
        setLastUpdateTs(metaTs || null);
        const markers: MarkerData[] = list
          .map((t: any) => {
            const id = String(t?.train_number ?? "");
            const label = String(t?.train_name ?? id);
            const lat = Number(t?.current_lat);
            const lng = Number(t?.current_lng);
            if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return { id, label, lat, lng };
          })
          .filter(Boolean) as MarkerData[];
        setTrains(markers);
        if (markers.length) {
          const sum = markers.reduce((acc, m) => ({ lat: acc.lat + m.lat, lng: acc.lng + m.lng }), { lat: 0, lng: 0 });
          const avg = { lat: sum.lat / markers.length, lng: sum.lng / markers.length };
          setCenter(avg);
          setZoomLevel(4);
        }
      }
    } catch {}
    const run = async () => {
      try {
        console.log("[Frontend] Requesting proxy /api/railradar/live-map");
        const ts = lastUpdateTs ? Date.parse(String(lastUpdateTs)) : NaN;
        const now = Date.now();
        if (Number.isFinite(ts) && now - ts < 30000) {
          console.log("[DATA] skip backend refresh; cache age <", (now - ts), "ms");
          return;
        }
        const r = await fetch("/api/railradar/live-map", { cache: "no-store" });
        console.log("[Frontend] Proxy response status:", r.status);
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        const list: any[] = Array.isArray(d?.data) ? d.data : [];
        const metaTs: string | undefined = String(d?.meta?.timestamp ?? "");
        if (canceled) return;
        console.log("[DATA] loaded from backend refresh; items:", list.length, "timestamp:", metaTs);
        setLiveTrains(list);
        setLastUpdateTs(metaTs || null);
        try {
          console.log("[Frontend] Saving live_map_cache to localStorage");
          localStorage.setItem(keyName, JSON.stringify(d));
        } catch {}
        const markers: MarkerData[] = list
          .map((t: any) => {
            const id = String(t?.train_number ?? "");
            const label = String(t?.train_name ?? id);
            const lat = Number(t?.current_lat);
            const lng = Number(t?.current_lng);
            if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return { id, label, lat, lng };
          })
          .filter(Boolean) as MarkerData[];
        setTrains(markers);
        if (markers.length) {
          const sum = markers.reduce((acc, m) => ({ lat: acc.lat + m.lat, lng: acc.lng + m.lng }), { lat: 0, lng: 0 });
          const avg = { lat: sum.lat / markers.length, lng: sum.lng / markers.length };
          setCenter(avg);
          setZoomLevel(4);
        }
      } catch {
      }
    };
    run();
    timer = window.setInterval(run, 600000) as unknown as number;
    return () => {
      canceled = true;
      if (timer) {
        try { window.clearInterval(timer); } catch {}
      }
    };
  }, []);
  return (
    <div className="relative h-full w-full">
      <Globe3DCesium
        markers={stations}
        trains={trains}
        onStationSelect={(st) => {
          console.log("onStationSelect from globe:", st);
          handleStationSelect(st);
        }}
        onTrainSelect={(t) => {
          const num = String(t.id);
          const found = liveTrains.find((x: any) => String(x?.train_number ?? "").toUpperCase() === num.toUpperCase());
          if (found) {
            console.log("[SEARCH] matched train from local dataset:", found?.train_number, found?.train_name);
            setSelectedTrainInfo(found);
            (async () => {
              const img = (await getWikipediaTrainImage(String(found?.train_name || found?.train_number || num))) || null;
              setSelectedTrainImg(img);
            })();
            const cLat = Number(found?.current_lat);
            const cLng = Number(found?.current_lng);
            const nLat = Number(found?.next_lat);
            const nLng = Number(found?.next_lng);
            if (Number.isFinite(cLat) && Number.isFinite(cLng) && Number.isFinite(nLat) && Number.isFinite(nLng)) {
              setSelectedTarget({ id: num, current: [cLat, cLng], next: [nLat, nLng], lastUpdated: lastUpdateTs || undefined });
            } else {
              setSelectedTarget(null);
            }
          }
        }}
        suppressInfoPanel
        resetViewToken={resetToken}
        resetLat={20.5937}
        resetLng={78.9629}
        resetAltitudeMeters={20000000}
        rotateToken={rotateToken}
        rotateHeadingDeltaDeg={rotateCmd.dh}
        rotatePitchDeltaDeg={rotateCmd.dp}
        selectedTrainTarget={selectedTarget || undefined}
        trainRoutes={[
          {
            id: "mumbai-delhi",
            points: [
              [72.878, 19.076],
              [75.7139, 26.912], // Jaipur approx
              [77.103, 28.704],
            ],
          },
          {
            id: "kolkata-chennai",
            points: [
              [88.364, 22.573],
              [85.145, 25.612], // Patna approx
              [80.271, 13.083],
            ],
          },
          {
            id: "delhi-bangalore",
            points: [
              [77.103, 28.704],
              [79.089, 21.146], // Nagpur approx
              [77.595, 12.972],
            ],
          },
        ]}
        base={base}
        terrain={terrain}
        centerLat={center.lat}
        centerLng={center.lng}
        flyToToken={selected?.ts}
        zoom={zoomLevel}
        labelsOnClick
      />

      {/* Overlay title + station search */}
      <div className="absolute left-4 top-4 z-10">
        <h2 className="text-lg font-bold text-white drop-shadow-lg">
          Indian Railways
        </h2>
        {status.unavailable && (
          <Card className="mt-2 w-fit border-amber-400 bg-amber-100/30 text-amber-900 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-200">
            <CardContent className="py-2 text-xs">
              {status.cached
                ? "Service unavailable — showing cached stations"
                : "Service unavailable — start local API or check RailRadar key"}
            </CardContent>
          </Card>
        )}
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
            placeholder="Station code (e.g. NDLS)"
            className="h-8 w-44 bg-black/40 text-white placeholder:text-white/60"
          />
          <Button
            size="sm"
            className="h-8"
            disabled={!stationsReady}
            onClick={async () => {
              const code = searchCode.trim();
              if (!code) return;
              const codeUpper = code.toUpperCase();
              console.log("Fetch station code input:", codeUpper);
              console.log("Total stations available:", stations.length);
              // Prefer navigating within loaded dataset by code or name
              const found =
                stations.find((s) => String(s.id).trim().toUpperCase() === codeUpper) ||
                stations.find((s) => String(s.label).trim().toUpperCase() === codeUpper) ||
                stations.find((s) => String(s.label).trim().toUpperCase().includes(codeUpper));
              console.log("Matched station:", found);
              if (found) {
                handleStationSelect(found);
                return;
              }
              console.warn(`Station not found for code: ${codeUpper}`);
              toast.error(`Station not found for code: ${codeUpper}`);
            }}
          >
            Fetch
          </Button>
          <Input
            value={searchTrain}
            onChange={(e) => setSearchTrain(e.target.value)}
            placeholder="Train number (e.g. 12230)"
            className="h-8 w-44 bg-black/40 text-white placeholder:text-white/60"
          />
          <Button
            size="sm"
            className="h-8"
            onClick={() => {
              const num = searchTrain.trim();
              if (!num) return;
              const exists = trains.some((t) => t.id.toUpperCase() === num.toUpperCase());
              const goSelect = () => {
                try {
                  window.dispatchEvent(new CustomEvent("select-train", { detail: { trainNumber: num, flyTo: true } }));
                  setTimeout(() => {
                    try {
                      window.dispatchEvent(new CustomEvent("select-train", { detail: { trainNumber: num, flyTo: true } }));
                    } catch {}
                  }, 80);
                } catch {}
              };
              const foundLive = liveTrains.find((x: any) => String(x?.train_number ?? "").toUpperCase() === num.toUpperCase());
              if (exists || foundLive) {
                if (foundLive) {
                  setSelectedTrainInfo(foundLive);
              const cLat = Number(foundLive?.current_lat);
                  const cLng = Number(foundLive?.current_lng);
                  const nLat = Number(foundLive?.next_lat);
                  const nLng = Number(foundLive?.next_lng);
                  if (Number.isFinite(cLat) && Number.isFinite(cLng) && Number.isFinite(nLat) && Number.isFinite(nLng)) {
                    const eta = parseMinutesAny((foundLive as any)?.next_arrival_minutes);
                    setSelectedTarget({ id: num, current: [cLat, cLng], next: [nLat, nLng], lastUpdated: lastUpdateTs || undefined, etaMinutes: Number.isFinite(eta) ? eta : undefined });
                  } else {
                    setSelectedTarget(null);
                  }
                }
                goSelect();
                return;
              }
              toast.error("Train not found in local dataset");
            }}
          >
            Go to Train
          </Button>
        </div>
        {lastUpdateTs && (
          <p className="pointer-events-none mt-2 text-sm text-white/60">
            Last updated: {lastUpdateTs}
          </p>
        )}
        <p className="pointer-events-none mt-2 text-sm text-white/60">
          {stations.length} stations tracked
        </p>
      </div>
      {/* Pitch/Rotate controls (bottom-left) */}
      <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-black/40 p-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setRotateCmd({ dh: -15, dp: 0 });
              setRotateToken(Date.now());
            }}
            title="Rotate Left"
          >
            ⟲
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setRotateCmd({ dh: 15, dp: 0 });
              setRotateToken(Date.now());
            }}
            title="Rotate Right"
          >
            ⟳
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setRotateCmd({ dh: 0, dp: 8 });
              setRotateToken(Date.now());
            }}
            title="Tilt Up"
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setRotateCmd({ dh: 0, dp: -8 });
              setRotateToken(Date.now());
            }}
            title="Tilt Down"
          >
            ↓
          </Button>
        </div>
      </div>
      {/* Station dialog below search area */}
      {selected && (
        <Card className="absolute bottom-4 left-1/2 z-10 w-[680px] max-w-[96vw] -translate-x-1/2 bg-background/95">
          <CardContent className="flex items-stretch gap-4 py-4">
            <img
              src={selected.img || PLACEHOLDER_IMG}
              alt={selected.label}
              className="h-36 w-48 rounded-md object-cover"
            />
            <div className="flex-1">
              <div className="text-base font-semibold">{selected.label}</div>
              <div className="text-sm text-muted-foreground">Code: {selected.id}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>Lat: {selected.lat.toFixed(6)}</div>
                <div>Lng: {selected.lng.toFixed(6)}</div>
                <div>Zone: {selected.zone || "-"}</div>
                <div>State: {selected.state || "-"}</div>
              </div>
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelected(null);
                    setCenter({ lat: 20.5937, lng: 78.9629 });
                    setResetToken(Date.now());
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTrainInfo && (
        <Card className="absolute bottom-4 left-1/2 z-10 w-[720px] max-w-[96vw] -translate-x-1/2 bg-background/95">
          <CardContent className="flex items-stretch gap-4 py-4">
            <img
              src={selectedTrainImg || 'data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"200\"><rect width=\"320\" height=\"200\" fill=\"%23222\"/><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"%23aaa\" font-size=\"16\" font-family=\"sans-serif\">No image</text></svg>'}
              alt={String(selectedTrainInfo?.train_name ?? "")}
              className="h-36 w-48 rounded-md object-cover"
            />
            <div className="grid flex-1 grid-cols-2 gap-2 text-sm">
              <div className="font-semibold text-foreground">{String(selectedTrainInfo?.train_name ?? "")}</div>
              <div className="text-right text-muted-foreground">{String(selectedTrainInfo?.train_number ?? "")}</div>
              <div>Type: {String(selectedTrainInfo?.type ?? "")}</div>
              <div>Day: {String(selectedTrainInfo?.current_day ?? "")}</div>
              <div>Current: {String(selectedTrainInfo?.current_station_name ?? "")} ({String(selectedTrainInfo?.current_station ?? "")})</div>
              <div>Next: {String(selectedTrainInfo?.next_station_name ?? "")} ({String(selectedTrainInfo?.next_station ?? "")})</div>
              <div>Since dep: {Math.max(0, parseMinutesAny(selectedTrainInfo?.mins_since_dep)).toString()} min</div>
              <div>Dep: {formatMinutesToClockString(selectedTrainInfo?.departure_minutes)}</div>
              <div>Arr: {formatMinutesToClockString(selectedTrainInfo?.next_arrival_minutes)}</div>
              <div>Current distance: {String(selectedTrainInfo?.curr_distance ?? "")}</div>
              <div>Next distance: {String(selectedTrainInfo?.next_distance ?? "")}</div>
              <div>Last updated: {lastUpdateLocal}</div>
              <div className="col-span-2 mt-2">
                <div className="text-xs text-muted-foreground">Running Days</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                    <span key={d} className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelectedTrainInfo(null);
                  setSelectedTarget(null);
                  setSelectedTrainImg(null);
                  try {
                    window.dispatchEvent(new CustomEvent("clear-train-filter"));
                  } catch {}
                }}
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-40 rounded-xl bg-black/40 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
          <span className="text-xs text-white/80">Active Station</span>
        </div>
      </div>

      <div className="absolute right-4 top-4 z-10">
        <Button
          size="sm"
          variant="secondary"
          className="mr-2"
          onClick={() => {
            try {
              localStorage.removeItem("stations_cache");
            } catch {}
            setReloadKey((k) => k + 1);
          }}
          title="Clear cached stations and reload"
        >
          <RotateCw className="mr-1 h-4 w-4" />
          Clear Cache
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="mr-2"
          onClick={() => {
            setSelected(null);
            setCenter({ lat: 20.5937, lng: 78.9629 });
            setResetToken(Date.now());
            try { window.dispatchEvent(new CustomEvent("clear-train-filter")); } catch {}
          }}
          title="Home"
        >
          Home
        </Button>
        <Button
          size="sm"
          variant={satellite ? "default" : "secondary"}
          onClick={() => setSatellite((v) => !v)}
        >
          {satellite ? "Satellite On" : "Satellite Off"}
        </Button>
        <Button
          size="sm"
          className="ml-2"
          variant={terrain ? "default" : "secondary"}
          onClick={() => setTerrain((v) => !v)}
          disabled={!hasIonToken}
        >
          {terrain ? "Terrain On" : "Terrain Off"}
        </Button>
      </div>
    </div>
  );
}
