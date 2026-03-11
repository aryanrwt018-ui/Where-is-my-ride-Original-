import { useEffect, useRef, useState } from "react";
import trainPng from "../../Frontend/assets/train.png";

type MarkerData = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  zone?: string;
  state?: string;
};

type Props = {
  markers: MarkerData[];
  centerLat?: number;
  centerLng?: number;
  flyToToken?: number;
  resetViewToken?: number;
  resetLat?: number;
  resetLng?: number;
  resetAltitudeMeters?: number;
  rotateToken?: number;
  rotateHeadingDeltaDeg?: number;
  rotatePitchDeltaDeg?: number;
  zoom?: number;
  base?: "map" | "satellite";
  terrain?: boolean;
  airports?: MarkerData[];
  trains?: MarkerData[];
  flightPaths?: Array<{ id: string; from: [number, number]; to: [number, number] }>;
  trainRoutes?: Array<{ id: string; points: Array<[number, number]> }>;
  labelsOnClick?: boolean;
  tilesetAssetId?: number;
  globeDisabled?: boolean;
  onStationSelect?: (s: MarkerData) => void;
  onTrainSelect?: (t: MarkerData) => void;
  suppressInfoPanel?: boolean;
  selectedTrainTarget?: { id: string; current: [number, number]; next: [number, number]; lastUpdated?: string; etaMinutes?: number };
};

declare const Cesium: any;

function loadCesiumFromCdn(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Cesium) {
      resolve();
      return;
    }
    const cssId = "cesium-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/cesium/Build/Cesium/Widgets/widgets.css";
      document.head.appendChild(link);
    }
    const scriptId = "cesium-js";
    if (document.getElementById(scriptId)) {
      const el = document.getElementById(scriptId)!;
      el.addEventListener("load", () => resolve(), { once: true });
      el.addEventListener("error", () => reject(new Error("Cesium load failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.defer = true;
    script.src = "https://unpkg.com/cesium/Build/Cesium/Cesium.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Cesium load failed"));
    document.head.appendChild(script);
  });
}

export default function Globe3DCesium({
  markers,
  centerLat = 20,
  centerLng = 0,
  flyToToken,
  resetViewToken,
  resetLat = 20.5937,
  resetLng = 78.9629,
  resetAltitudeMeters = 91440, // ~300,000 ft
  rotateToken,
  rotateHeadingDeltaDeg = 0,
  rotatePitchDeltaDeg = 0,
  zoom = 2,
  base = "map",
  terrain = false,
  airports = [],
  trains = [],
  flightPaths = [],
  trainRoutes = [],
  labelsOnClick = true,
  tilesetAssetId,
  globeDisabled = false,
  onStationSelect,
  onTrainSelect,
  suppressInfoPanel = false,
  selectedTrainTarget,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [info, setInfo] = useState<{ code: string; name: string; zone?: string; state?: string; img?: string; lat?: number; lng?: number } | null>(null);
  const [trainRoute, setTrainRoute] = useState<{ number?: string; name?: string; past: any[]; current?: any; upcoming: any[] } | null>(null);
  const initializedRef = useRef(false);
  const positionedRef = useRef(false);
  const trainPngRef = useRef<string>(trainPng as string);
  const trainLogCountRef = useRef(0);
  const FT_TO_M = 0.3048;
  const ALTITUDE_FT = 3500;
  const ALTITUDE_M = ALTITUDE_FT * FT_TO_M;
  const ALT_SHOW_FT = 50000;
  const ALT_SHOW_M = ALT_SHOW_FT * FT_TO_M;
  const ALT_MID_M = 2_000_000;
  const MAX_TRAINS_ZOOMED_OUT = 100;
  const PROX_KM_CLICK = 10;
  const PROX_KM_RENDER = 20;
  const PROX_KM_STATION = 100;
  const proximityActiveRef = useRef(false);
  const proximityCenterRef = useRef<[number, number] | null>(null);
  const animTimerRef = useRef<number | null>(null);
  const selectedTrainIdRef = useRef<string | null>(null);
  const previousCameraRef = useRef<{ destination: any; heading: number; pitch: number; roll: number } | null>(null);
  const DEBUG = true;

  useEffect(() => {
    let destroyed = false;
    loadCesiumFromCdn()
      .then(() => {
        if (destroyed || !ref.current) return;
        if (initializedRef.current && viewerRef.current) return;
        const selectedTrainRef: { current: any | null } = { current: null };
        const selectedStationRef: { current: any | null } = { current: null };
        const opts: any = {
          baseLayerPicker: false,
          geocoder: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          imageryProvider: undefined,
          infoBox: false,
          selectionIndicator: false,
        };
        const creditDiv = document.createElement("div");
        creditDiv.style.display = "none";
        opts.creditContainer = creditDiv;
        if (globeDisabled) {
          opts.globe = false;
          opts.skyAtmosphere = new Cesium.SkyAtmosphere();
        }
        const token = (window as any).VITE_CESIUM_ION_TOKEN || (import.meta as any).env?.VITE_CESIUM_ION_TOKEN;
        const viewer = new Cesium.Viewer(ref.current, opts);
        viewerRef.current = viewer;
        initializedRef.current = true;
        setViewerReady(true);
        viewer.trackedEntity = undefined;
        try {
          const c = viewer.scene.canvas;
          console.log("[CESIUM] canvas size before resize:", c.width, c.height);
          viewer.resize();
          console.log("[CESIUM] canvas size after resize:", c.width, c.height);
        } catch {}
        try {
          viewer.scene.canvas.addEventListener("click", (evt: any) => {
            try { console.log("Canvas click reached"); } catch {}
            try {
              const rect = (viewer.scene.canvas.getBoundingClientRect
                ? viewer.scene.canvas.getBoundingClientRect()
                : (viewer.canvas && viewer.canvas.getBoundingClientRect && viewer.canvas.getBoundingClientRect())) as DOMRect | undefined;
              const x = rect ? evt.clientX - rect.left : evt.offsetX ?? 0;
              const y = rect ? evt.clientY - rect.top : evt.offsetY ?? 0;
              const picked = viewer.scene.pick(new Cesium.Cartesian2(x, y));
              console.log("DOM click pick:", picked);
              const ent = picked?.id;
              const props = ent?.properties;
              const kind = ent?.type ?? props?.kind?.getValue?.() ?? props?.kind ?? "";
              if (ent && (String(kind) === "station" || String(kind) === "train")) {
                if (kind === "station") {
                  const code = props?.code?.getValue?.() ?? props?.code ?? "";
                  const name = props?.name?.getValue?.() ?? props?.name ?? "";
                  const lat = props?.lat?.getValue?.() ?? props?.lat;
                  const lng = props?.lng?.getValue?.() ?? props?.lng;
                if (onStationSelect && typeof lat === "number" && typeof lng === "number") {
                    onStationSelect({ id: String(code), label: String(name), lat, lng });
                  }
              } else {
                  const now = Cesium.JulianDate.now();
                  const pos = ent.position?.getValue?.(now) ?? ent.position;
                  if (pos) {
                    const carto = Cesium.Cartographic.fromCartesian(pos);
                    const lat = Cesium.Math.toDegrees(carto.latitude);
                    const lng = Cesium.Math.toDegrees(carto.longitude);
                    const id = String(props?.code?.getValue?.() ?? props?.code ?? ent.id ?? "");
                    const label = String(props?.name?.getValue?.() ?? props?.name ?? id);
                    if (onTrainSelect && Number.isFinite(lat) && Number.isFinite(lng)) {
                      onTrainSelect({ id, label, lat, lng });
                    }
                    try {
                      highlightTrain(ent);
                      (viewer as any).__applyContextFilter?.(lat, lng, id);
                      (viewer as any).__updateStations?.(lat, lng);
                      viewer.scene.requestRender();
                    } catch {}
                  }
                }
              }
            } catch (e) {
              try { console.error("DOM click pick failed:", e); } catch {}
            }
          });
        } catch {}
        try {
          viewer.scene.requestRenderMode = false;
          viewer.scene.maximumRenderTimeChange = 0.1;
        } catch {}
        // Train icon already imported; log selected path
          try { console.log("[TRAIN MAP] train icon asset selected:", trainPngRef.current); } catch {}
        try {
          viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
            Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
          );
          viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
            Cesium.ScreenSpaceEventType.LEFT_CLICK,
          );
          if (viewer.screenSpaceEventHandler) {
            viewer.screenSpaceEventHandler.removeInputAction(
              Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
            );
            viewer.screenSpaceEventHandler.removeInputAction(
              Cesium.ScreenSpaceEventType.LEFT_CLICK,
            );
            viewer.screenSpaceEventHandler.removeInputAction(
              Cesium.ScreenSpaceEventType.MIDDLE_CLICK,
            );
            viewer.screenSpaceEventHandler.removeInputAction(
              Cesium.ScreenSpaceEventType.RIGHT_CLICK,
            );
          }
        } catch {}
        if (!globeDisabled) {
          const osm = new Cesium.UrlTemplateImageryProvider({
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            credit: "© OpenStreetMap contributors",
            maximumLevel: 19,
          });
          const layers = viewer.imageryLayers;
          const baseLayer = layers.addImageryProvider(osm);
          baseLayer.alpha = base === "map" ? 1.0 : 0.0;
          (viewer as any).__baseLayer = baseLayer;

          if (base === "satellite") {
            let satLayer: any = null;
            if (token) {
              try {
                Cesium.Ion.defaultAccessToken = token;
                const sat = new Cesium.IonImageryProvider({ assetId: 2 });
                satLayer = layers.addImageryProvider(sat);
                satLayer.alpha = 1.0;
                layers.raiseToTop(satLayer);
              } catch {}
            }
            if (!satLayer) {
              const arcgisTiles = new Cesium.UrlTemplateImageryProvider({
                url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                credit: "© Esri, Earthstar Geographics",
                maximumLevel: 19,
              });
              satLayer = layers.addImageryProvider(arcgisTiles);
              satLayer.alpha = 1.0;
              layers.raiseToTop(satLayer);
            }
            baseLayer.alpha = 0.0;
            (viewer as any).__satLayer = satLayer;
          } else {
            baseLayer.alpha = 1.0;
          }
        }

        const ssc = viewer.scene.screenSpaceCameraController;
        ssc.minimumZoomDistance = 50;
        ssc.maximumZoomDistance = 20000000;
        try {
          ssc.inertiaSpin = 0.9;
          ssc.inertiaZoom = 0.8;
          ssc.inertiaTranslate = 0.9;
          (ssc as any).enableCollisionDetection = true;
          if (typeof (ssc as any).maximumTiltAngle !== "undefined") {
            (ssc as any).maximumTiltAngle = Cesium.Math.toRadians(85);
          }
        } catch {}
        // Terrain
        if (terrain && token && !globeDisabled) {
          Cesium.Ion.defaultAccessToken = token;
          viewer.terrainProvider = Cesium.createWorldTerrain();
          viewer.scene.globe.enableLighting = true;
          viewer.scene.globe.depthTestAgainstTerrain = true;
        } else {
          viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
          viewer.scene.globe.depthTestAgainstTerrain = false;
        }

        if (!positionedRef.current) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, Math.pow(2, 8 - zoom) * 2.5e6),
            duration: 0,
          });
          positionedRef.current = true;
        }

        if (tilesetAssetId && token) {
          Cesium.Ion.defaultAccessToken = token;
          (async () => {
            try {
              const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(tilesetAssetId);
              viewer.scene.primitives.add(tileset);
            } catch {}
          })();
        }

        const stationDs = new Cesium.CustomDataSource("stations");
        stationDs.clustering.enabled = false;
        viewer.dataSources.add(stationDs);
        (viewer as any).__stationDs = stationDs;

        const trainsDs = new Cesium.CustomDataSource("trains");
        trainsDs.clustering.enabled = false;
        viewer.dataSources.add(trainsDs);
        (viewer as any).__trainsDs = trainsDs;

        const validCoords = (lat: any, lng: any) => {
          const la = Number(lat);
          const lo = Number(lng);
          if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
          if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
          return { lat: la, lng: lo };
        };
        const kmBetween = (lat1: number, lng1: number, lat2: number, lng2: number) => {
          const c1 = Cesium.Cartographic.fromDegrees(lng1, lat1);
          const c2 = Cesium.Cartographic.fromDegrees(lng2, lat2);
          const g = new Cesium.EllipsoidGeodesic(c1, c2);
          return Number(g.surfaceDistance) / 1000;
        };
        const applyContextFilter = (lat: number, lng: number, selectedId: string) => {
          proximityActiveRef.current = true;
          proximityCenterRef.current = [lat, lng];
          const ents: any[] = (viewer as any).__trainsDs?.entities?.values || [];
          const stents: any[] = (viewer as any).__stationDs?.entities?.values || [];
          const now = Cesium.JulianDate.now();
          const h = viewer.camera.positionCartographic.height;
          const allowLabels = Number(h) <= ALT_SHOW_M;
          let trainLabelsShown = 0;
          let stationsShown = 0;
          for (const en of ents) {
            try {
              const idVal = String(en?.properties?.code?.getValue?.() ?? en?.properties?.code ?? en?.id ?? "");
              const pos = en.position?.getValue?.(now) ?? en.position;
              if (!pos) continue;
              const carto = Cesium.Cartographic.fromCartesian(pos);
              const tLat = Cesium.Math.toDegrees(carto.latitude);
              const tLng = Cesium.Math.toDegrees(carto.longitude);
              const dKm = kmBetween(lat, lng, tLat, tLng);
              const isSelected = String(idVal) === String(selectedId);
              if (isSelected) {
                if (en.billboard) {
                  en.billboard.show = true;
                  en.billboard.scale = 1.6;
                  en.billboard.color = Cesium.Color.CYAN;
                }
                if (en.label) en.label.show = true;
                continue;
              }
              const within = dKm <= PROX_KM_STATION;
              if (en.label) {
                en.label.show = allowLabels && within;
                if (en.label.show) trainLabelsShown += 1;
              }
              if (en.billboard) {
                // keep billboard visibility as-is; optionally adjust scale very slightly
                try { en.billboard.scale = within ? 1.0 : 1.0; } catch {}
              }
            } catch {}
          }
          for (const en of stents) {
            try {
              const pos = en.position;
              if (!pos) continue;
              const carto = Cesium.Cartographic.fromCartesian(pos);
              const sLat = Cesium.Math.toDegrees(carto.latitude);
              const sLng = Cesium.Math.toDegrees(carto.longitude);
              const dKm = kmBetween(lat, lng, sLat, sLng);
              const within = dKm <= PROX_KM_STATION;
              if (en.point) en.point.show = within;
              if (en.label) en.label.show = within && allowLabels;
              if (within) stationsShown += 1;
            } catch {}
          }
          if (DEBUG) {
            try {
              console.log("[DEBUG] Context filter for selected:", selectedId, "trainLabelsShown:", trainLabelsShown, "stationsShown:", stationsShown);
            } catch {}
          }
          try { viewer.scene.requestRender(); } catch {}
        };
        const highlightTrain = (ent: any) => {
          try {
            const id = String(ent?.properties?.code?.getValue?.() ?? ent?.properties?.code ?? ent?.id ?? "");
            selectedTrainIdRef.current = id;
            if (DEBUG) {
              const ents: any[] = (viewer as any).__trainsDs?.entities?.values || [];
              const visible = ents.filter((e: any) => e?.billboard?.show !== false).length;
              console.log("[DEBUG] Visible trains before selection:", visible);
            }
            if (ent?.billboard) {
              ent.billboard.scale = 1.6;
              ent.billboard.color = Cesium.Color.CYAN;
            }
            if (ent?.label) ent.label.show = true;
            if (DEBUG) {
              const ents: any[] = (viewer as any).__trainsDs?.entities?.values || [];
              const visible = ents.filter((e: any) => e?.billboard?.show !== false).length;
              console.log("[DEBUG] Visible trains after selection:", visible);
            }
            try { viewer.scene.requestRender(); } catch {}
          } catch {}
        };
        const clearHighlight = () => {
          try {
            const ents: any[] = (viewer as any).__trainsDs?.entities?.values || [];
            for (const en of ents) {
              try {
                if (en?.billboard) {
                  en.billboard.scale = 1.0;
                  en.billboard.color = Cesium.Color.WHITE;
                  en.billboard.show = true;
                }
              } catch {}
            }
            selectedTrainIdRef.current = null;
            if (DEBUG) {
              const visible = ents.filter((e: any) => e?.billboard?.show !== false).length;
              console.log("[DEBUG] Visible trains after clear:", visible);
            }
            try {
              // also hide any label that was forced visible by selection if altitude says false
              const h = viewer.camera.positionCartographic.height;
              const allowLabels = Number(h) <= ALT_SHOW_M;
              for (const en of ents) {
                try {
                  if (en.label) en.label.show = allowLabels;
                } catch {}
              }
            } catch {}
            try { viewer.scene.requestRender(); } catch {}
          } catch {}
        };
        const saveCameraState = () => {
          try {
            if (previousCameraRef.current) return;
            const c = viewer.camera.positionCartographic;
            const dest = Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, c.height);
            previousCameraRef.current = {
              destination: dest,
              heading: viewer.camera.heading,
              pitch: viewer.camera.pitch,
              roll: viewer.camera.roll,
            };
            if (DEBUG) console.log("[DEBUG] Saved previous camera state");
          } catch {}
        };
        const restoreCameraState = () => {
          try {
            const prev = previousCameraRef.current;
            if (!prev) return;
            viewer.camera.flyTo({
              destination: prev.destination,
              orientation: {
                heading: prev.heading,
                pitch: prev.pitch,
                roll: prev.roll,
              },
              duration: 1.2,
            });
            previousCameraRef.current = null;
            if (DEBUG) console.log("[DEBUG] Restored previous camera state");
          } catch {}
        };
        (viewer as any).__clearHighlight = clearHighlight;
        (viewer as any).__restoreCameraState = restoreCameraState;
        (viewer as any).__applyContextFilter = applyContextFilter;
        const resetAllRender = () => {
          const ents: any[] = (viewer as any).__trainsDs?.entities?.values || [];
          const stents: any[] = (viewer as any).__stationDs?.entities?.values || [];
          const h = viewer.camera.positionCartographic.height;
          const allowLabels = Number(h) <= ALT_SHOW_M;
          proximityActiveRef.current = false;
          proximityCenterRef.current = null;
          try {
            if (ents.length === 0 && Array.isArray(trains)) {
              const addTrainFn = (viewer as any).__addTrain as ((t: MarkerData) => any) | undefined;
              if (addTrainFn) {
                for (const t of trains) {
                  try { addTrainFn(t); } catch {}
                }
              }
            }
          } catch {}
          for (const en of ents) {
            try {
              if (en.billboard) en.billboard.show = true;
              if (en.label) en.label.show = allowLabels;
            } catch {}
          }
          for (const en of stents) {
            try {
              if (en.point) en.point.show = false;
              if (en.label) en.label.show = false;
            } catch {}
          }
          try { viewer.scene.requestRender(); } catch {}
        };
        (viewer as any).__resetAllRender = resetAllRender;
        const updateStationsForTracked = (lat: number, lng: number) => {
          const stents: any[] = (viewer as any).__stationDs?.entities?.values || [];
          for (const en of stents) {
            try {
              const pos = en.position;
              if (!pos) continue;
              const carto = Cesium.Cartographic.fromCartesian(pos);
              const sLat = Cesium.Math.toDegrees(carto.latitude);
              const sLng = Cesium.Math.toDegrees(carto.longitude);
              const dKm = kmBetween(lat, lng, sLat, sLng);
              const show = dKm <= PROX_KM_STATION;
              if (en.point) en.point.show = show;
              if (en.label) en.label.show = false;
            } catch {}
          }
          try { viewer.scene.requestRender(); } catch {}
        };
        (viewer as any).__updateStations = updateStationsForTracked;
        const clearTrainFilter = () => {
          proximityActiveRef.current = false;
          proximityCenterRef.current = null;
          const ents: any[] = (viewer as any).__trainsDs?.entities?.values || [];
          const h = viewer.camera.positionCartographic.height;
          const allowLabels = Number(h) <= ALT_SHOW_M;
          const stents: any[] = (viewer as any).__stationDs?.entities?.values || [];
          for (const en of ents) {
            try {
              if (en.billboard) en.billboard.show = true;
              if (en.label) en.label.show = allowLabels;
            } catch {}
          }
          for (const en of stents) {
            try {
              if (en.point) en.point.show = false;
              if (en.label) en.label.show = false;
            } catch {}
          }
          try { viewer.scene.requestRender(); } catch {}
        };
        (viewer as any).__clearTrainFilter = clearTrainFilter;

        const addStation = (m: MarkerData) => {
          const c = validCoords(m.lat, m.lng);
          if (!c) {
            try { console.warn("Invalid station coordinates:", m.lat, m.lng, m.id); } catch {}
            return null;
          }
          const ent = stationDs.entities.add({
            id: m.id,
            position: Cesium.Cartesian3.fromDegrees(c.lng, c.lat),
            point: {
              pixelSize: 1,
              color: Cesium.Color.YELLOW,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              show: false,
            },
            label: {
              text: m.label,
              font: "12px sans-serif",
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              pixelOffset: new Cesium.Cartesian2(0, -12),
              showBackground: true,
              backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.4),
              show: false,
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            properties: new Cesium.PropertyBag({
              code: m.id,
              name: m.label,
              zone: m.zone || "",
              state: m.state || "",
              lat: c.lat,
              lng: c.lng,
              kind: "station",
            }),
            description: `<div><strong>Station:</strong> ${m.label}<br/><strong>Code:</strong> ${m.id}</div>`,
          });
          (ent as any).type = "station";
          return ent;
        };

        const trainMap = new Map<string, any>();
        const addTrain = (t: MarkerData) => {
          const c = validCoords(t.lat, t.lng);
          if (!c) {
            try { console.warn("Invalid train coordinates:", t.lat, t.lng, t.id); } catch {}
            return null;
          }
          let ent = trainMap.get(t.id);
          if (!ent) {
            const lat = Number(c.lat);
            const lng = Number(c.lng);
            const pos = Cesium.Cartesian3.fromDegrees(lng, lat);
            if (trainLogCountRef.current < 5) {
              try {
                console.log("[TRAIN MAP DEBUG] train:", t.id, "lat:", lat, "lng:", lng, "pos:", pos);
              } catch {}
              trainLogCountRef.current += 1;
            }
            ent = trainsDs.entities.add({
              id: t.id,
              position: pos,
              billboard: {
                image: trainPngRef.current,
                width: 15,
                height: 15,
                scale: 1.0,
                scaleByDistance: new Cesium.NearFarScalar(0.0, 1.0, 3000000.0, 1.0),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                show: true,
              },
              label: {
                text: t.label,
                font: "12px sans-serif",
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                pixelOffset: new Cesium.Cartesian2(0, -28),
                show: false,
                showBackground: true,
                backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.4),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000),
              },
              properties: new Cesium.PropertyBag({
                code: t.id,
                name: t.label,
                lat: c.lat,
                lng: c.lng,
                kind: "train",
              }),
            });
            (ent as any).type = "train";
            trainMap.set(t.id, ent);
            try { console.log("[TRAIN MAP] rendered train billboard icon:", t.id, t.label); } catch {}
            try { viewer.scene.requestRender(); } catch {}
          }
          const lat = Number(c.lat);
          const lng = Number(c.lng);
          const cart = Cesium.Cartesian3.fromDegrees(lng, lat);
          ent.position = cart;
          return ent;
        };
        (viewer as any).__addStation = addStation;
        (viewer as any).__addTrain = addTrain;
          
        if (!globeDisabled) {
          markers.forEach((m) => addStation(m));
          airports.forEach((a) =>
            viewer.entities.add({
              position: Cesium.Cartesian3.fromDegrees(a.lng, a.lat),
              point: {
                pixelSize: 3,
                color: Cesium.Color.ORANGE,
                outlineWidth: 0,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              },
              label: {
                text: a.label,
                font: "12px sans-serif",
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                pixelOffset: new Cesium.Cartesian2(0, -16),
                showBackground: true,
                backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.4),
                show: !labelsOnClick,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000),
              },
              properties: new Cesium.PropertyBag({
                code: a.id,
                name: a.label,
                kind: "airport",
              }),
            }),
          );
          trains.forEach((t) => addTrain(t));
          try {
            let queued = false;
            let last = 0;
            const MIN_DELAY = 150;
            const doUpdate = () => {
              queued = false;
              last = Date.now();
              const h = viewer.camera.positionCartographic.height;
              const show = Number(h) <= ALT_SHOW_M;
              const ents = (viewer as any).__trainsDs?.entities?.values || [];
          const stents = (viewer as any).__stationDs?.entities?.values || [];
              if (proximityActiveRef.current && proximityCenterRef.current && selectedTrainIdRef.current) {
                const [clat, clng] = proximityCenterRef.current;
                for (const en of ents) {
                  try {
                    const pos = en.position?.getValue?.(Cesium.JulianDate.now()) ?? en.position;
                    if (!pos) continue;
                    const carto = Cesium.Cartographic.fromCartesian(pos);
                    const tLat = Cesium.Math.toDegrees(carto.latitude);
                    const tLng = Cesium.Math.toDegrees(carto.longitude);
                    const dKm = kmBetween(clat, clng, tLat, tLng);
                    const within = dKm <= PROX_KM_STATION;
                    const idVal = String(en?.properties?.code?.getValue?.() ?? en?.properties?.code ?? en?.id ?? "");
                    const isSelected = idVal === selectedTrainIdRef.current;
                    if (isSelected) {
                      if (en.billboard) {
                        en.billboard.show = true;
                        en.billboard.scale = 1.6;
                        en.billboard.color = Cesium.Color.CYAN;
                      }
                      if (en.label) en.label.show = true;
                    } else {
                      if (en.label) en.label.show = show && within;
                      if (en.billboard) en.billboard.show = true;
                    }
                  } catch {}
                }
            for (const en of stents) {
              try {
                const pos = en.position;
                if (!pos) continue;
                const carto = Cesium.Cartographic.fromCartesian(pos);
                const sLat = Cesium.Math.toDegrees(carto.latitude);
                const sLng = Cesium.Math.toDegrees(carto.longitude);
                const dKm = kmBetween(clat, clng, sLat, sLng);
                const within = dKm <= PROX_KM_STATION;
                if (en.point) en.point.show = within;
                if (en.label) en.label.show = show && within;
              } catch {}
            }
              } else {
                // No selection: apply altitude-based limits
                let shown = 0;
                let rect: any = null;
                try { rect = viewer.camera.computeViewRectangle(); } catch {}
                for (const en of ents) {
                  try {
                    const nowJ = Cesium.JulianDate.now();
                    const pos = en.position?.getValue?.(nowJ) ?? en.position;
                    if (!pos) continue;
                    const carto = Cesium.Cartographic.fromCartesian(pos);
                    const tLat = Cesium.Math.toDegrees(carto.latitude);
                    const tLng = Cesium.Math.toDegrees(carto.longitude);
                    let inView = true;
                    if (rect) {
                      const cc = Cesium.Cartographic.fromDegrees(tLng, tLat);
                      inView = Cesium.Rectangle.contains(rect, cc);
                    }
                    let billboardShow = true;
                    if (h > ALT_MID_M) {
                      // cap to 500 globally when zoomed out
                      billboardShow = shown < MAX_TRAINS_ZOOMED_OUT;
                      if (billboardShow) shown += 1;
                    } else {
                      // mid/near: show trains within current camera view
                      billboardShow = inView;
                    }
                    if (en.billboard) en.billboard.show = billboardShow;
                    if (en.label) en.label.show = show && billboardShow;
                  } catch {}
                }
            for (const en of stents) {
              try {
                    if (en.point) en.point.show = false;
                if (en.label) en.label.show = false;
              } catch {}
            }
              }
              try { viewer.scene.requestRender(); } catch {}
            };
            const schedule = () => {
              const now = Date.now();
              if (queued) return;
              if (now - last < MIN_DELAY) {
                queued = true;
                setTimeout(() => {
                  queued = false;
                  doUpdate();
                }, MIN_DELAY - (now - last));
                return;
              }
              if (typeof requestAnimationFrame === "function") {
                queued = true;
                requestAnimationFrame(() => {
                  queued = false;
                  doUpdate();
                });
              } else {
                doUpdate();
              }
            };
            doUpdate();
            try { viewer.camera.changed.addEventListener(schedule); } catch {}
          } catch {}
          try { viewer.scene.requestRender(); } catch {}
        }

        {
          const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
          (viewer as any).__clickHandler = handler;
          try { console.log("Click handler installed"); } catch {}
          try {
            window.addEventListener("clear-train-filter", () => {
              try {
                (viewer as any).__clearTrainFilter?.();
                (viewer as any).__resetAllRender?.();
                (viewer as any).__clearHighlight?.();
                (viewer as any).__restoreCameraState?.();
              } catch {}
            });
          } catch {}
          handler.setInputAction((movement: any) => {
            try { console.log("LEFT_CLICK fired", movement?.position); } catch {}
            try {
              const picked = viewer.scene.pick(movement.position);
              console.log("Raw picked:", picked);
              if (!picked || !picked.id) {
                console.log("No entity picked");
                return;
              }
              const ent = picked.id;
              console.log("Picked entity:", ent);
              const props = ent.properties;
              const kind = ent?.type ?? props?.kind?.getValue?.() ?? props?.kind ?? "";
              console.log("Picked kind:", kind);
              if (kind === "station") {
                const code = props?.code?.getValue?.() ?? props?.code ?? "";
                const name = props?.name?.getValue?.() ?? props?.name ?? "";
                const lat = props?.lat?.getValue?.() ?? props?.lat;
                const lng = props?.lng?.getValue?.() ?? props?.lng;
                console.log("Station clicked:", { code, name, lat, lng });
                if (onStationSelect && typeof lat === "number" && typeof lng === "number") {
                  onStationSelect({ id: String(code), label: String(name), lat, lng });
                }
              } else if (kind === "train") {
                const now = Cesium.JulianDate.now();
                const pos = ent.position?.getValue?.(now) ?? ent.position;
                if (!pos) return;
                const c = Cesium.Cartographic.fromCartesian(pos);
                const lat = Cesium.Math.toDegrees(c.latitude);
                const lng = Cesium.Math.toDegrees(c.longitude);
                const id = String(props?.code?.getValue?.() ?? props?.code ?? ent.id ?? "");
                const label = String(props?.name?.getValue?.() ?? props?.name ?? ent?.label?.text ?? id);
                if (onStationSelect && Number.isFinite(lat) && Number.isFinite(lng)) {
                  onStationSelect({ id, label, lat, lng });
                }
                try {
                  highlightTrain(ent);
                  try { (viewer as any).__applyContextFilter?.(lat, lng, id); } catch {}
                  try { (viewer as any).__updateStations?.(lat, lng); } catch {}
                } catch {}
              }
            } catch (e) {
              console.error("Pick failed:", e);
            }
          }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
          handler.setInputAction((movement: any) => {
            let cursor = "default";
            try {
              const picked = viewer.scene.pick(movement.endPosition);
              const ent = picked?.id;
              const kind =
                ent?.type ??
                ent?.properties?.kind?.getValue?.() ??
                ent?.properties?.kind ??
                "";
              if (ent && (String(kind) === "station" || String(kind) === "train")) {
                cursor = "pointer";
              }
            } catch {}
            try {
              viewer.container.style.cursor = cursor;
              viewer.canvas.style.cursor = cursor;
            } catch {}
          }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
          handler.setInputAction((movement: any) => {
            const picked = viewer.scene.pick(movement.position);
            if (Cesium.defined(picked) && picked.id) {
              const ent = picked.id;
              try { viewer.flyTo(ent, { duration: 1.2 }); } catch {}
            }
          }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

          const onSelectTrain = (e: any) => {
            const num = String(e?.detail?.trainNumber ?? "").toUpperCase();
            const shouldFly = Boolean(e?.detail?.flyTo);
            if (!num) return;
            const ents: any[] = [
              ...trainsDs.entities.values,
            ] as any;
            const ent = ents.find((en: any) => {
              const code = en?.properties?.code?.getValue?.() ?? en?.properties?.code ?? "";
              return String(code).toUpperCase() === num;
            });
            if (ent) {
              const props = ent.properties;
              setInfo(null);
              setTrainRoute(null);
              selectedTrainRef.current = ent;
              try {
                const now = Cesium.JulianDate.now();
                const pos = ent.position?.getValue?.(now) ?? ent.position;
                const headingVal = props?.heading?.getValue?.() ?? props?.heading;
                if (Number.isFinite(headingVal)) {
                  const h = Cesium.Math.toRadians(Number(headingVal));
                  const q = Cesium.Transforms.headingPitchRollQuaternion(
                    pos,
                    new Cesium.HeadingPitchRoll(h, 0, 0),
                  );
                  ent.orientation = q;
                }
                if (!pos) { console.warn("Train position not ready"); return; }
                const c = Cesium.Cartographic.fromCartesian(pos);
                if (shouldFly) {
                  try {
                    saveCameraState();
                  } catch {}
                  try {
                    const d = Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, ALTITUDE_M);
                    viewer.camera.flyTo({ destination: d, duration: 1.5, easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT });
                  } catch {}
                }
                try {
                  viewer.scene.requestRender();
                } catch {}
                try {
                  const lat = Cesium.Math.toDegrees(c.latitude);
                  const lng = Cesium.Math.toDegrees(c.longitude);
                  highlightTrain(ent);
                  (viewer as any).__applyContextFilter?.(lat, lng, String(num));
                  (viewer as any).__updateStations?.(lat, lng);
                } catch {}
              } catch {}
            }
          };
          const onSelectStation = (e: any) => {
            console.log("select-station event received", e);

            const code = String(e?.detail?.code ?? e?.detail?.id ?? "").toUpperCase();

            const ents: any[] = [...stationDs.entities.values] as any;
            const ent = ents.find((en: any) => {
              const c = en?.properties?.code?.getValue?.() ?? en?.properties?.code ?? "";
              return String(c).toUpperCase() === code;
            });

            const latFromEvt = Number(e?.detail?.lat);
            const lngFromEvt = Number(e?.detail?.lng);
            let latV: number | undefined = Number.isFinite(latFromEvt) ? latFromEvt : undefined;
            let lngV: number | undefined = Number.isFinite(lngFromEvt) ? lngFromEvt : undefined;

            if ((!Number.isFinite(latV) || !Number.isFinite(lngV)) && ent) {
              try {
                const now = Cesium.JulianDate.now();
                const p2 = ent.position?.getValue?.(now) ?? ent.position;
                if (p2) {
                  const c2 = Cesium.Cartographic.fromCartesian(p2);
                  latV = Cesium.Math.toDegrees(c2.latitude);
                  lngV = Cesium.Math.toDegrees(c2.longitude);
                }
              } catch {}
            }

            if (typeof latV === "number" && typeof lngV === "number") {
              console.log("Received station for flyTo:", { code, lat: latV, lng: lngV });
              console.log("Flying to:", lngV, latV);

              try {
                viewer.camera.flyTo({
                  destination: Cesium.Cartesian3.fromDegrees(lngV, latV, ALTITUDE_M),
                  orientation: {
                    heading: viewer.camera.heading,
                    pitch: Cesium.Math.toRadians(-45),
                    roll: 0,
                  },
                  duration: 1.5,
                });
              } catch {}
            }

            if (ent) {
              try {
                const props = ent.properties;
                const name = props?.name?.getValue?.() ?? props?.name ?? "";
                const zone = props?.zone?.getValue?.() ?? props?.zone ?? "";
                const state = props?.state?.getValue?.() ?? props?.state ?? "";

                setInfo({
                  code,
                  name: name || code,
                  zone: zone || "",
                  state: state || "",
                  lat: latV,
                  lng: lngV,
                });

                (async () => {
                  try {
                    if (name) {
                      const q = encodeURIComponent(`${name} railway station`);
                      const resp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${q}`);
                      if (resp.ok) {
                        const d = await resp.json();
                        const img = d?.thumbnail?.source;
                        if (img) {
                          setInfo({
                            code,
                            name: name || code,
                            zone: zone || "",
                            state: state || "",
                            img,
                            lat: latV,
                            lng: lngV,
                          });
                        }
                      }
                    }
                  } catch {}
                })();

                try {
                  viewer.scene.requestRender();
                } catch {}
              } catch {}
            } else {
              setInfo({
                code,
                name: e?.detail?.label ?? code,
                zone: "",
                state: "",
                lat: latV,
                lng: lngV,
              });
            }
          };

          window.addEventListener("select-train", onSelectTrain as any);
          window.addEventListener("select-station", onSelectStation as any);
        }

        // Removed external GLB model demos to avoid external dependencies
      })
      .catch(() => {
      });

    return () => {
      destroyed = true;
      if (viewerRef.current) {
        try { (viewerRef.current as any).__clickHandler?.destroy?.(); } catch {}
        try {
          viewerRef.current.destroy();
        } catch {}
        viewerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    try {
      console.log("Rendering stations:", Array.isArray(markers) ? markers.length : 0);
      const stationDs = (viewer as any).__stationDs;
      const trainsDs = (viewer as any).__trainsDs;
      const addStation = (viewer as any).__addStation as ((m: MarkerData) => any) | undefined;
      const addTrain = (viewer as any).__addTrain as ((t: MarkerData) => any) | undefined;
      console.log("[CESIUM] counts before render: viewer", viewer.entities.values.length, "stationDs", stationDs?.entities?.values?.length ?? -1, "trainsDs", trainsDs?.entities?.values?.length ?? -1);
      if (stationDs && addStation && Array.isArray(markers)) {
        try { stationDs.entities.removeAll(); } catch {}
        markers.forEach((m) => addStation(m));
      }
      if (trainsDs && addTrain && Array.isArray(trains)) {
        try { console.log("[TRAIN MAP] rendering trains:", trains.length); } catch {}
        trains.forEach((t) => addTrain(t));
      }
      try {
        viewer.scene.requestRender();
      } catch {}
      console.log("[CESIUM] counts after render: viewer", viewer.entities.values.length, "stationDs", stationDs?.entities?.values?.length ?? -1, "trainsDs", trainsDs?.entities?.values?.length ?? -1);
    } catch {}
  }, [viewerReady, markers, trains]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    try {
      const token =
        (window as any).VITE_CESIUM_ION_TOKEN || (import.meta as any).env?.VITE_CESIUM_ION_TOKEN;
      const layers = viewer.imageryLayers;
      const baseLayer = (viewer as any).__baseLayer;
      let satLayer = (viewer as any).__satLayer;
      if (base === "satellite") {
        if (!satLayer) {
          try {
            if (token) {
              Cesium.Ion.defaultAccessToken = token;
              const sat = new Cesium.IonImageryProvider({ assetId: 2 });
              satLayer = layers.addImageryProvider(sat);
            } else {
              const arcgisTiles = new Cesium.UrlTemplateImageryProvider({
                url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                credit: "© Esri, Earthstar Geographics",
                maximumLevel: 19,
              });
              satLayer = layers.addImageryProvider(arcgisTiles);
            }
            (viewer as any).__satLayer = satLayer;
          } catch {}
        }
        if (satLayer) {
          try {
            satLayer.alpha = 1.0;
            layers.raiseToTop(satLayer);
          } catch {}
        }
        if (baseLayer) {
          try {
            baseLayer.alpha = 0.0;
          } catch {}
        }
      } else {
        if (satLayer) {
          try {
            satLayer.alpha = 0.0;
          } catch {}
        }
        if (baseLayer) {
          try {
            baseLayer.alpha = 1.0;
          } catch {}
        }
      }
      if (terrain && token && !globeDisabled) {
        try {
          Cesium.Ion.defaultAccessToken = token;
          viewer.terrainProvider = Cesium.createWorldTerrain();
          viewer.scene.globe.enableLighting = true;
          viewer.scene.globe.depthTestAgainstTerrain = true;
        } catch {}
      } else {
        try {
          viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
          viewer.scene.globe.depthTestAgainstTerrain = false;
        } catch {}
      }
      try {
        viewer.scene.requestRender();
      } catch {}
    } catch {}
  }, [base, terrain, globeDisabled]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;
    const lat = Number(centerLat);
    const lng = Number(centerLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, 1067), // ~3500 ft
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
        duration: 1.5,
      });
      try {
        viewer.scene.requestRender();
      } catch {}
    } catch {}
  }, [viewerReady, centerLat, centerLng, flyToToken]);

  // Handle home/reset view requests (pitch 0, ~50,000 ft)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;
    if (!resetViewToken) return;
    const lat = Number(resetLat);
    const lng = Number(resetLng);
    const alt = Number(resetAltitudeMeters);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(alt)) return;
    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, alt),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
        duration: 1.5,
      });
      try {
        viewer.scene.requestRender();
      } catch {}
    } catch {}
  }, [viewerReady, resetViewToken, resetLat, resetLng, resetAltitudeMeters]);

  // Apply rotation/pitch adjustments from external controls
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;
    if (!rotateToken) return;
    try {
      const c = viewer.camera.positionCartographic;
      const heading = viewer.camera.heading + Cesium.Math.toRadians(rotateHeadingDeltaDeg || 0);
      let pitch = viewer.camera.pitch + Cesium.Math.toRadians(rotatePitchDeltaDeg || 0);
      const MIN_PITCH = Cesium.Math.toRadians(-90);
      const MAX_PITCH = Cesium.Math.toRadians(0);
      if (pitch < MIN_PITCH) pitch = MIN_PITCH;
      if (pitch > MAX_PITCH) pitch = MAX_PITCH;
      const dest = Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, c.height);
      viewer.camera.setView({
        destination: dest,
        orientation: {
          heading,
          pitch,
          roll: 0,
        },
      });
      try { viewer.scene.requestRender(); } catch {}
    } catch {}
  }, [viewerReady, rotateToken, rotateHeadingDeltaDeg, rotatePitchDeltaDeg]);
  // Keep stations as point markers only (no model toggling).

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (animTimerRef.current) {
      try { window.clearInterval(animTimerRef.current); } catch {}
      animTimerRef.current = null;
    }
    const target = selectedTrainTarget;
    if (!target || !target.id) return;
    // Try to find the entity by id in the trains datasource
    const trainsDs = (viewer as any).__trainsDs;
    let ent: any = viewer.trackedEntity;
    const entId = ent?.properties?.code?.getValue?.() ?? ent?.properties?.code ?? ent?.id;
    if (!ent || String(entId) !== String(target.id)) {
      try {
        const ents: any[] = trainsDs?.entities?.values || [];
        ent = ents.find((en: any) => {
          const code = en?.properties?.code?.getValue?.() ?? en?.properties?.code ?? en?.id;
          return String(code) === String(target.id);
        });
      } catch {}
    }
    if (!ent) return;
    try {
      try { viewer.trackedEntity = ent; } catch {}
      const currLat = Number(target.current?.[0]);
      const currLng = Number(target.current?.[1]);
      if (Number.isFinite(currLat) && Number.isFinite(currLng)) {
        try { (viewer as any).__applyContextFilter?.(currLat, currLng, String(target.id)); } catch {}
        try { (viewer as any).__updateStations?.(currLat, currLng); } catch {}
        const now = Cesium.JulianDate.now();
        const nextJ = new Cesium.JulianDate();
        const cart = Cesium.Cartesian3.fromDegrees(currLng, currLat);
        const posProp = (ent as any).__pos as any;
        if (posProp?.addSample) {
          posProp.removeSamples?.();
          posProp.addSample(now, cart);
          Cesium.JulianDate.addSeconds(now, 2, nextJ);
          posProp.addSample(nextJ, cart);
        } else {
          ent.position = cart;
        }
      }
    } catch {}
    const intervalMs = 500;
    const etaMin = Number(target.etaMinutes);
    const etaSeconds = Number.isFinite(etaMin) && etaMin > 0 ? etaMin * 60 : null;
    const step = () => {
      try {
        const now = Cesium.JulianDate.now();
        const pos = ent.position?.getValue?.(now) ?? ent.position;
        if (!pos) return;
        const carto = Cesium.Cartographic.fromCartesian(pos);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        const lng = Cesium.Math.toDegrees(carto.longitude);
        const endLat = Number(target.next?.[0]);
        const endLng = Number(target.next?.[1]);
        if (!Number.isFinite(endLat) || !Number.isFinite(endLng)) return;
        try { (viewer as any).__applyContextFilter?.(lat, lng, String(target.id)); } catch {}
        const dLat = endLat - lat;
        const dLng = endLng - lng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < 0.0005) return;
        let factor = 0.02;
        if (etaSeconds && etaSeconds > 0) {
          const f = (intervalMs / 1000) / etaSeconds;
          factor = Math.max(0.002, Math.min(0.12, f));
        }
        const nLat = lat + dLat * factor;
        const nLng = lng + dLng * factor;
        const cart = Cesium.Cartesian3.fromDegrees(nLng, nLat);
        const posProp = (ent as any).__pos as any;
        const nextJ = new Cesium.JulianDate();
        if (posProp?.addSample) {
          posProp.addSample(now, cart);
          Cesium.JulianDate.addSeconds(now, 2, nextJ);
          posProp.addSample(nextJ, cart);
        } else {
          ent.position = cart;
        }
        viewer.scene.requestRender();
      } catch {}
    };
    animTimerRef.current = window.setInterval(step, intervalMs) as unknown as number;
    return () => {
      if (animTimerRef.current) {
        try { window.clearInterval(animTimerRef.current); } catch {}
        animTimerRef.current = null;
      }
      try { viewer.trackedEntity = undefined; } catch {}
    };
  }, [selectedTrainTarget]);

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="absolute inset-0" />
      {!suppressInfoPanel && info && (
        <div
          className="pointer-events-auto absolute left-4 top-20 z-50 w-[440px] md:w-[500px] max-w-[96vw] max-h-[80vh] overflow-auto rounded-xl bg-black/70 p-4 text-white shadow-lg backdrop-blur"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {info.img && (
            <img
              src={info.img}
              alt={info.name}
              className="mb-4 w-full rounded-lg"
              style={{ maxHeight: 340, height: "auto", objectFit: "contain" }}
            />
          )}
          <div className="space-y-2">
            <div className="text-sm"><span className="text-white/70">Station Name:</span> <span className="font-semibold">{info.name}</span></div>
            <div className="text-sm"><span className="text-white/70">Station Code:</span> <span className="font-semibold">{info.code}</span></div>
            <div className="text-sm"><span className="text-white/70">Railway Zone:</span> <span className="font-semibold">{info.zone || "-"}</span></div>
            <div className="text-sm"><span className="text-white/70">State:</span> <span className="font-semibold">{info.state || "-"}</span></div>
            <div className="text-sm"><span className="text-white/70">Latitude:</span> <span className="font-semibold">{typeof info.lat === "number" ? info.lat.toFixed(6) : "-"}</span></div>
            <div className="text-sm"><span className="text-white/70">Longitude:</span> <span className="font-semibold">{typeof info.lng === "number" ? info.lng.toFixed(6) : "-"}</span></div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setInfo(null);
                try {
                  const v = viewerRef.current;
                  if (v) {
                    v.trackedEntity = undefined;
                    (v as any).__clearTrainFilter?.();
                    (v as any).__resetAllRender?.();
                    (v as any).__clearHighlight?.();
                    (v as any).__restoreCameraState?.();
                    v.scene.requestRender();
                  }
                } catch {}
              }}
              className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {trainRoute && (
        <div
          className="pointer-events-auto absolute right-4 top-20 z-50 w-[360px] max-w-[96vw] max-h-[72vh] overflow-auto rounded-xl bg-black/70 p-4 text-white shadow-lg backdrop-blur"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 text-sm text-white/80">
            <div className="font-semibold">{trainRoute.name || "Selected Train"}</div>
            <div className="text-white/60">{trainRoute.number ?? ""}</div>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <div className="mb-1 font-semibold text-white/70">Past stations</div>
              <ul className="list-disc pl-5">
                {trainRoute.past.slice(-8).map((s, i) => (
                  <li key={i} className="text-white/80">
                    {String(s?.station?.name ?? s?.StationName ?? s?.stationName ?? "")} <span className="text-green-400">(reached)</span>{" "}
                    <span className="text-white/50">
                      {String(s?.arrivalTime ?? s?.ArrivalTime ?? s?.scheduleArrival ?? "")} /
                      {String(s?.departureTime ?? s?.DepartureTime ?? s?.scheduleDeparture ?? "")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {trainRoute.current && (
              <div>
                <div className="mb-1 font-semibold text-white/70">Current station</div>
                <div className="rounded-md bg-white/10 p-2">
                  <div className="text-white">
                    {String(trainRoute.current?.station?.name ?? trainRoute.current?.StationName ?? "")}
                  </div>
                  <div className="text-white/60">
                    {String(trainRoute.current?.arrivalTime ?? trainRoute.current?.ArrivalTime ?? "")} /
                    {String(trainRoute.current?.departureTime ?? trainRoute.current?.DepartureTime ?? "")}
                  </div>
                </div>
              </div>
            )}
            <div>
              <div className="mb-1 font-semibold text-white/70">Upcoming stations</div>
              <ul className="list-disc pl-5">
                {trainRoute.upcoming.slice(0, 12).map((s, i) => (
                  <li key={i} className="text-white/80">
                    {String(s?.station?.name ?? s?.StationName ?? s?.stationName ?? "")} <span className="text-yellow-300">(upcoming)</span>{" "}
                    <span className="text-white/50">
                      {String(s?.arrivalTime ?? s?.ArrivalTime ?? s?.scheduleArrival ?? "")} /
                      {String(s?.departureTime ?? s?.DepartureTime ?? s?.scheduleDeparture ?? "")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setTrainRoute(null);
                try {
                  const v = viewerRef.current;
                  if (v) {
                    v.trackedEntity = undefined;
                    (v as any).__clearTrainFilter?.();
                    (v as any).__resetAllRender?.();
                    (v as any).__clearHighlight?.();
                    (v as any).__restoreCameraState?.();
                    v.scene.requestRender();
                  }
                } catch {}
              }}
              className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-16 right-3 z-50 flex h-[64px] items-center gap-2 rounded-lg bg-black/50 px-3 py-0 backdrop-blur">
        <img
          src="/Frontend/assets/Company.png"
          alt="WIMR"
          className="h-[62px] w-[62px] object-contain"
        />
        <span className="text-xs font-semibold text-white">WIMR</span>
      </div>
    </div>
  );
}

export type { MarkerData };
