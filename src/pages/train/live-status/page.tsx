import { useCallback, useEffect, useMemo, useState } from "react";
import { Radio, Wifi, WifiOff, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { formatMinutesToClockString, formatLocalTimeFromISO } from "@/lib/train-time.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { Input } from "@/components/ui/input.tsx";

function formatYYYYMMDD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
function parseMinutesAny(v: any) {
  const m = String(v ?? "").match(/\d+/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) ? n : 0;
}
function formatArrivalTime(_: string | null, minutes: any) { return formatMinutesToClockString(minutes); }
function localeTs(iso: string | null) { return formatLocalTimeFromISO(iso); }

export default function LiveStatusPage() {
  const [stationCode, setStationCode] = useState("NDLS");
  const [hours, setHours] = useState<2 | 4>(2);
  const [stationTrains, setStationTrains] = useState<any[]>([]);
  const [trainNo, setTrainNo] = useState("12565");
  const [trainDate, setTrainDate] = useState<string>(formatYYYYMMDD(new Date()));
  const [trainStatus, setTrainStatus] = useState<any | null>(null);
  const [dataset, setDataset] = useState<any[]>([]);
  const [lastTs, setLastTs] = useState<string | null>(null);
  const PLACEHOLDER_IMG =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="%23222"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23aaa" font-size="16" font-family="sans-serif">No image</text></svg>';

  useEffect(() => {
    try {
      const raw = localStorage.getItem("live_map_cache");
      if (raw) {
        const cached = JSON.parse(raw);
        const list = Array.isArray(cached?.data) ? cached.data : [];
        const ts: string | undefined = String(cached?.meta?.timestamp ?? "");
        console.log("[DATA] loaded from local cache; count:", list.length, "timestamp:", ts);
        setDataset(list);
        setLastTs(ts || null);
      }
    } catch {
      setDataset([]);
      setLastTs(null);
    }
  }, []);

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
        const image: string | null = data?.originalimage?.source || data?.thumbnail?.source || null;
        if (image) return image;
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
            const image: string | null = summaryData?.originalimage?.source || summaryData?.thumbnail?.source || null;
            if (image) return image;
          }
        }
      }
    } catch {}
    return null;
  }

  const fetchLiveStation = useCallback(async () => {
    try {
      const code = String(stationCode).toUpperCase();
      const windowMins = Number(hours) * 60;
      const getVal = (obj: any, keys: string[]) => {
        for (const k of keys) {
          const v = obj?.[k];
          if (v !== undefined && v !== null && String(v).length > 0) return v;
        }
        return undefined;
      };
      const toUpper = (v: any) => String(v ?? "").toUpperCase();
      const parseMinutes = (v: any) => {
        const n = parseMinutesAny(v);
        return Number.isFinite(n) ? n : Infinity;
      };
      const isNextStationMatch = (t: any) => {
        const codeVal = getVal(t, ["next_station", "nextStation", "next_station_code", "NextStationCode"]);
        return toUpper(codeVal) === code;
      };
      const isCurrentStationMatch = (t: any) => {
        const codeVal = getVal(t, ["current_station", "currentStation", "current_station_code", "CurrentStationCode"]);
        return toUpper(codeVal) === code;
      };
      const arrivalMins = (t: any) => {
        const v = getVal(t, ["next_arrival_minutes", "arrival_minutes", "eta_minutes", "ETA"]);
        return parseMinutes(v);
      };
      const base = dataset.filter((t) => {
        const matchNext = isNextStationMatch(t) && arrivalMins(t) <= windowMins;
        const matchCurrent = isCurrentStationMatch(t);
        return matchNext || matchCurrent;
      });
      const mapped = await Promise.all(
        base.map(async (t) => {
          const number = String(t?.train_number ?? "");
          const name = String(t?.train_name ?? "");
          const img = (await getWikipediaTrainImage(name || number)) || PLACEHOLDER_IMG;
          return {
            number,
            name,
            source: String(t?.source ?? t?.src ?? ""),
            destination: String(t?.destination ?? t?.dest ?? ""),
            currentStationName: String(t?.current_station_name ?? t?.CurrentStationName ?? ""),
            currentStationCode: String(t?.current_station ?? t?.CurrentStationCode ?? ""),
            nextStationName: String(t?.next_station_name ?? t?.NextStationName ?? ""),
            nextStationCode: String(t?.next_station ?? t?.NextStationCode ?? ""),
            expectedArrival: String(getVal(t, ["next_arrival_minutes", "arrival_minutes", "eta_minutes", "ETA"]) ?? ""),
            expectedArrivalTime: formatArrivalTime(lastTs, getVal(t, ["next_arrival_minutes", "arrival_minutes", "eta_minutes", "ETA"])),
            delayArrival: String(t?.delayArrival ?? ""),
            img,
          };
        }),
      );
      console.log("[SEARCH] matched trains at station from local dataset:", mapped.length);
      setStationTrains(mapped);
    } catch {
      setStationTrains([]);
    }
  }, [dataset, stationCode, hours]);

  const fetchLiveTrain = useCallback(async () => {
    try {
      const num = String(trainNo).toUpperCase();
      const match = dataset.find((t) => String(t?.train_number ?? "").toUpperCase() === num);
      if (!match) {
        setTrainStatus(null);
        return;
      }
      console.log("[SEARCH] matched train from local dataset:", match?.train_number, match?.train_name);
      const name = String(match?.train_name ?? "");
      const number = String(match?.train_number ?? "");
      const img = (await getWikipediaTrainImage(name || number)) || PLACEHOLDER_IMG;
      setTrainStatus({
        currentStation: {
          StationName: String(match?.current_station_name ?? ""),
          StationCode: String(match?.current_station ?? ""),
        },
        nextStation: {
          StationName: String(match?.next_station_name ?? ""),
          StationCode: String(match?.next_station ?? ""),
          ArrivalMinutes: String(match?.next_arrival_minutes ?? ""),
          ArrivalTime: formatArrivalTime(lastTs, match?.next_arrival_minutes),
        },
        meta: {
          name,
          number,
          source: String(match?.source ?? match?.src ?? ""),
          destination: String(match?.destination ?? match?.dest ?? ""),
          img,
        },
        route: [
          {
            stationName: String(match?.current_station_name ?? ""),
            stationCode: String(match?.current_station ?? ""),
            scheduleArrival: "",
            scheduleDeparture: String(match?.departure_minutes ?? ""),
            actualArrival: "",
            actualDeparture: "",
            delayArrival: "",
            delayDeparture: "",
          },
          {
            stationName: String(match?.next_station_name ?? ""),
            stationCode: String(match?.next_station ?? ""),
            scheduleArrival: String(match?.next_arrival_minutes ?? ""),
            scheduleDeparture: "",
            actualArrival: "",
            actualDeparture: "",
            delayArrival: "",
            delayDeparture: "",
          },
        ],
      });
    } catch {
      setTrainStatus(null);
    }
  }, [dataset, trainNo, trainDate]);

  return (
    <div className="flex h-full flex-col overflow-auto bg-background">
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Radio className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Live Status</h1>
            <p className="text-sm text-muted-foreground">
              Real-time train tracking information
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-6">
        {/* Live trains at station */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Trains at Station</span>
              <span className="text-xs text-muted-foreground">Using local cached dataset {lastTs ? `(${localeTs(lastTs)})` : ""}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <Input
                placeholder="Station Code (e.g. NDLS)"
                value={stationCode}
                onChange={(e) => setStationCode(e.target.value.toUpperCase())}
                className="w-40"
              />
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value) === 4 ? 4 : 2)}
              >
                <option value={2}>Next 2 hours</option>
                <option value={4}>Next 4 hours</option>
              </select>
              <Button size="sm" onClick={fetchLiveStation}>
                <Search className="h-4 w-4" />
                Fetch
              </Button>
            </div>
            <div className="space-y-3">
              {stationTrains.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No trains found</EmptyTitle>
                    <EmptyDescription>Try a different station code or duration</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                stationTrains.map((t) => (
                  <Card key={`${t.number}-${t.expectedArrival}`} className="transition-shadow hover:shadow-sm">
                    <CardContent className="flex items-stretch gap-3 py-3">
                      <img src={t.img || PLACEHOLDER_IMG} alt={t.name} className="h-20 w-32 rounded-md object-cover" />
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">{t.name} ({t.number})</div>
                        <div className="text-xs text-muted-foreground">{t.source} → {t.destination}</div>
                        <div className="mt-1 text-xs">
                          <span className="font-medium text-foreground">Current:</span> {t.currentStationName} ({t.currentStationCode})
                        </div>
                        <div className="text-xs">
                          <span className="font-medium text-foreground">Next:</span> {t.nextStationName} ({t.nextStationCode})
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Arr {t.expectedArrivalTime}</div>
                        <div className="text-xs">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <WifiOff className="h-3 w-3" />
                            {t.delayArrival || "RT"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live train status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Live Train Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <Input placeholder="Train Number" value={trainNo} onChange={(e) => setTrainNo(e.target.value)} className="w-40" />
              <Input placeholder="YYYYMMDD" value={trainDate} onChange={(e) => setTrainDate(e.target.value)} className="w-32" />
              <Button size="sm" onClick={fetchLiveTrain}>
                <Search className="h-4 w-4" />
                Fetch
              </Button>
            </div>
            {!trainStatus ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No status</EmptyTitle>
                  <EmptyDescription>Enter a valid train number and date</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                <div className="flex items-stretch gap-3">
                  <img src={trainStatus.meta?.img || PLACEHOLDER_IMG} alt={trainStatus.meta?.name} className="h-24 w-36 rounded-md object-cover" />
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">{trainStatus.meta?.name} ({trainStatus.meta?.number})</div>
                    <div className="text-xs text-muted-foreground">{trainStatus.meta?.source} → {trainStatus.meta?.destination}</div>
                    <div className="mt-1 text-xs">
                      <span className="font-medium text-foreground">Current:</span> {trainStatus.currentStation?.StationName} ({trainStatus.currentStation?.StationCode})
                    </div>
                    <div className="text-xs">
                      <span className="font-medium text-foreground">Next:</span> {trainStatus.nextStation?.StationName} ({trainStatus.nextStation?.StationCode}) at {trainStatus.nextStation?.ArrivalTime}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  {trainStatus.route.slice(0, 8).map((r: any) => (
                    <div key={r.stationCode} className="flex justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{r.stationName} ({r.stationCode})</span>
                      <span>
                        Arr {r.actualArrival || formatArrivalTime(lastTs, r.scheduleArrival)} | Dep {r.actualDeparture || formatArrivalTime(lastTs, r.scheduleDeparture)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
