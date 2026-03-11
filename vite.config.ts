import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import hercules from "@usehercules/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/rail": {
        target: "http://indianrailapi.com",
        changeOrigin: true,
        configure: (proxy, _options) => {
          const key =
            process.env.INDIAN_RAIL_API_KEY || process.env.VITE_INDIAN_RAIL_API_KEY;
          proxy.on("proxyReq", (proxyReq, req) => {
            const url = req.url || "";
            // Expected incoming path: /rail/StationCode/<code>
            const parts = url.split("/").filter(Boolean);
            const code = parts[2] || "";
            const apiPath = `/api/v2/StationLocationOnMap/apikey/${encodeURIComponent(
              key || "",
            )}/StationCode/${encodeURIComponent(code)}`;
            proxyReq.path = apiPath;
          });
        },
      },
      "/rail-live-station": {
        target: "http://indianrailapi.com",
        changeOrigin: true,
        configure: (proxy, _options) => {
          const key =
            process.env.INDIAN_RAIL_API_KEY || process.env.VITE_INDIAN_RAIL_API_KEY;
          proxy.on("proxyReq", (proxyReq, req) => {
            const url = req.url || "";
            // Expected: /rail-live-station/<code>/<hours>
            const parts = url.split("/").filter(Boolean);
            const code = parts[1] || "";
            const hours = parts[2] || "2";
            const apiPath = `/api/v2/LiveStation/apikey/${encodeURIComponent(
              key || "",
            )}/StationCode/${encodeURIComponent(code)}/hours/${encodeURIComponent(hours)}/`;
            proxyReq.path = apiPath;
          });
        },
      },
      "/rail-live-train": {
        target: "http://indianrailapi.com",
        changeOrigin: true,
        configure: (proxy, _options) => {
          const key =
            process.env.INDIAN_RAIL_API_KEY || process.env.VITE_INDIAN_RAIL_API_KEY;
          proxy.on("proxyReq", (proxyReq, req) => {
            const url = req.url || "";
            // Expected: /rail-live-train/<train>/<yyyymmdd>
            const parts = url.split("/").filter(Boolean);
            const train = parts[1] || "";
            const date = parts[2] || "";
            const apiPath = `/api/v2/livetrainstatus/apikey/${encodeURIComponent(
              key || "",
            )}/trainnumber/${encodeURIComponent(train)}/date/${encodeURIComponent(date)}/`;
            proxyReq.path = apiPath;
          });
        },
      },
      "/rail-train-route": {
        target: "http://indianrailapi.com",
        changeOrigin: true,
        configure: (proxy, _options) => {
          const key =
            process.env.INDIAN_RAIL_API_KEY || process.env.VITE_INDIAN_RAIL_API_KEY;
          proxy.on("proxyReq", (proxyReq, req) => {
            const url = req.url || "";
            // Expected: /rail-train-route/<trainno>
            const parts = url.split("/").filter(Boolean);
            const trainno = parts[1] || "";
            const apiPath = `/api/v1/trainroute/apikey/${encodeURIComponent(
              key || "",
            )}/trainno/${encodeURIComponent(trainno)}/`;
            proxyReq.path = apiPath;
          });
        },
      },
      "/local-train-search": {
        target: "http://localhost:3001",
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const url = req.url || "";
            // Expected: /local-train-search/<trainno>
            const parts = url.split("/").filter(Boolean);
            const trainno = parts[1] || "";
            const apiPath = `/api/v1/search/train?number=${encodeURIComponent(
              trainno,
            )}`;
            proxyReq.path = apiPath;
          });
        },
      },
      "/railradar-train": {
        target: "https://api.railradar.org",
        changeOrigin: true,
        configure: (proxy, _options) => {
          const key =
            process.env.RAILRADAR_API_KEY || process.env.VITE_RAILRADAR_API_KEY;
          proxy.on("proxyReq", (proxyReq, req) => {
            const url = req.url || "";
            const parts = url.split("/").filter(Boolean);
            const trainno = parts[1] || "";
            const apiPath = `/api/v1/trains/${encodeURIComponent(trainno)}`;
            proxyReq.path = apiPath;
            if (key) {
              try {
                proxyReq.setHeader("x-api-key", key);
                proxyReq.setHeader("X-API-Key", key);
              } catch {}
            }
          });
        },
      },
      "/api/railradar/live-map": {
        target: "http://localhost:5175",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), tailwindcss(), hercules()],
  resolve: {
    alias: {
      "@/convex": path.resolve(__dirname, "./convex"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
