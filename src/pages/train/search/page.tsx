import { useEffect, useState, useRef } from "react";
import { Search, TrainFront } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { loadStations } from "@/lib/stations.ts";
import { formatMinutesToClockString, formatRelativeUpdateTime, parseMinutesAny } from "@/lib/train-time.ts";

export default function SearchTrainPage() {
  const [query, setQuery] = useState("");
  const [stationMap, setStationMap] = useState<Map<string, { id: string; label: string }>>(new Map());
  const [foundTrain, setFoundTrain] = useState<any | null>(null);
  const [trainImg, setTrainImg] = useState<string | null>(null);
  const [lastUpdateTs, setLastUpdateTs] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"live" | "info">("live");
  const currentRef = useRef<HTMLDivElement | null>(null);
  const lastUpdateLocal = lastUpdateTs ? formatRelativeUpdateTime(lastUpdateTs) : "";

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

  useEffect(() => {
    let canceled = false;
    loadStations()
      .then((list) => {
        if (canceled) return;
        const mp = new Map<string, { id: string; label: string }>();
        list.forEach((s) => mp.set(String(s.id).toUpperCase(), { id: s.id, label: s.label }));
        setStationMap(mp);
        console.log("Stations loaded:", list.length);
      })
      .catch(() => {
        console.error("Failed to load stations.json");
        setStationMap(new Map());
      });
    return () => {
      canceled = true;
    };
  }, []);

  const handleSearch = () => {
    const q = query.trim();
    if (!q) {
      toast.error("Please enter a train number or name");
      return;
    }
    let dataset: any[] = [];
    let metaTs: string | null = null;
    try {
      const raw = localStorage.getItem("live_map_cache");
      if (raw) {
        const cached = JSON.parse(raw);
        dataset = Array.isArray(cached?.data) ? cached.data : [];
        metaTs = String(cached?.meta?.timestamp ?? "") || null;
        console.log("[DATA] loaded from local cache; count:", dataset.length);
      }
    } catch {}
    const isNum = /^\d{3,6}$/.test(q);
    const match = dataset.find((t) => {
      const num = String(t?.train_number ?? "").toUpperCase();
      const name = String(t?.train_name ?? "").toUpperCase();
      const qq = q.toUpperCase();
      return isNum ? num === qq : name.includes(qq);
    });
    if (!match) {
      toast.error("Train not found in local dataset");
      setFoundTrain(null);
      setTrainImg(null);
      return;
    }
    console.log("[SEARCH] matched train from local dataset:", match?.train_number, match?.train_name);
    setFoundTrain(match);
    setLastUpdateTs(metaTs);
    (async () => {
      const img = (await getWikipediaTrainImage(String(match?.train_name || match?.train_number || q))) || null;
      setTrainImg(img);
    })();
  };

  useEffect(() => {
    if (!foundTrain) return;
    if (!currentRef.current) return;
    try {
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {}
  }, [foundTrain]);

  return (
    <div className="flex h-full flex-col overflow-auto bg-background">
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Search Train</h1>
            <p className="text-sm text-muted-foreground">
              Find trains by number, name, or route
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        {/* Search bar */}
        <Card className="mb-8">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Enter train number or name (e.g. 12301, Rajdhani)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch}>Search</Button>
            </div>
          </CardContent>
        </Card>

        {!foundTrain ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TrainFront />
              </EmptyMedia>
              <EmptyTitle>Search for a train</EmptyTitle>
              <EmptyDescription>
                Enter a train number or name to view details and location
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-3">
            <Card>
              <CardContent className="flex items-stretch gap-4 py-3">
                <img
                  src={trainImg || 'data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"200\"><rect width=\"320\" height=\"200\" fill=\"%23222\"/><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"%23aaa\" font-size=\"16\" font-family=\"sans-serif\">No image</text></svg>'}
                  alt={String(foundTrain?.train_name ?? "")}
                  className="h-36 w-48 rounded-md object-cover"
                />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-semibold text-foreground">{String(foundTrain?.train_name ?? "")}</div>
                  <div className="text-right text-muted-foreground">{String(foundTrain?.train_number ?? "")}</div>
                  <div>Current: {String(foundTrain?.current_station_name ?? "")} ({String(foundTrain?.current_station ?? "")})</div>
                  <div>Next: {String(foundTrain?.next_station_name ?? "")} ({String(foundTrain?.next_station ?? "")})</div>
                  <div>Mins since dep: {String(foundTrain?.mins_since_dep ?? "")}</div>
                  <div>Departure mins: {String(foundTrain?.departure_minutes ?? "")}</div>
                  <div>Next arrival mins: {String(foundTrain?.next_arrival_minutes ?? "")}</div>
                  <div>Current distance: {String(foundTrain?.curr_distance ?? "")}</div>
                  <div>Next distance: {String(foundTrain?.next_distance ?? "")}</div>
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
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="mb-3 flex items-center gap-3">
                  <button
                    className={`rounded-md px-3 py-1.5 text-sm ${activeTab === "live" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
                    onClick={() => setActiveTab("live")}
                  >
                    Live Status
                  </button>
                  <button
                    className={`rounded-md px-3 py-1.5 text-sm ${activeTab === "info" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
                    onClick={() => setActiveTab("info")}
                  >
                    Info
                  </button>
                </div>
                {activeTab === "live" ? (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-1 rounded bg-muted" />
                    <div className="space-y-3 pl-8">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">
                          {String(foundTrain?.source ?? foundTrain?.src ?? "")}
                        </div>
                        <div className="text-xs text-muted-foreground">Start</div>
                      </div>
                      <div className="rounded-md border border-border bg-muted/30 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div ref={currentRef} className="font-semibold text-foreground">
                            {String(foundTrain?.current_station_name ?? "")} ({String(foundTrain?.current_station ?? "")})
                          </div>
                          <div className="text-right">
                            {foundTrain?.departure_minutes ? (
                              <div className="text-muted-foreground">Dep: {formatMinutesToClockString(foundTrain?.departure_minutes)}</div>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Currently at {String(foundTrain?.current_station_name ?? "")}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          {String(foundTrain?.next_station_name ?? "")} ({String(foundTrain?.next_station ?? "")})
                        </div>
                        <div className="text-right text-xs">
                          {foundTrain?.next_arrival_minutes ? (
                            <div className="text-muted-foreground">Arr: {formatMinutesToClockString(foundTrain?.next_arrival_minutes)}</div>
                          ) : null}
                          {foundTrain?.next_distance ? (
                            <div className="text-muted-foreground">{String(foundTrain?.next_distance)} km</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">
                          {String(foundTrain?.destination ?? foundTrain?.dest ?? "")}
                        </div>
                        <div className="text-xs text-muted-foreground">Destination</div>
                      </div>
                    </div>
                    <div className="sticky bottom-0 mt-4 rounded-lg bg-secondary p-3 text-sm">
                      <div className="font-semibold">
                        Currently at {String(foundTrain?.current_station_name ?? "")}
                      </div>
                      {lastUpdateTs ? (
                        <div className="text-xs text-muted-foreground">Last update: {lastUpdateLocal}</div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Type: {String(foundTrain?.type ?? "")}</div>
                    <div>Day: {String(foundTrain?.current_day ?? "")}</div>
                    <div>Current: {String(foundTrain?.current_station_name ?? "")} ({String(foundTrain?.current_station ?? "")})</div>
                    <div>Next: {String(foundTrain?.next_station_name ?? "")} ({String(foundTrain?.next_station ?? "")})</div>
                    <div>Since dep: {Math.max(0, parseMinutesAny(foundTrain?.mins_since_dep)).toString()} min</div>
                    <div>Dep: {formatMinutesToClockString(foundTrain?.departure_minutes)}</div>
                    <div>Arr: {formatMinutesToClockString(foundTrain?.next_arrival_minutes)}</div>
                    <div>Current distance: {String(foundTrain?.curr_distance ?? "")}</div>
                    <div>Next distance: {String(foundTrain?.next_distance ?? "")}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
