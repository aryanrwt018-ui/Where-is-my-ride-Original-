import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/railradar/live-map", async (_req, res) => {
  const key = (process.env.RAILRADAR_API_KEY || process.env.VITE_RAILRADAR_API_KEY || "").trim();
  if (!key) {
    res.status(500).json({ error: "RAILRADAR_API_KEY not configured" });
    return;
  }
  try {
    console.log("[Backend] RailRadar live-map request initiated");
    const headers = {};
    if (key) {
      headers["x-api-key"] = key;
    
    }
    const url = "https://api.railradar.org/api/v1/trains/live-map";
    const r = await fetch(url, { headers });
console.log("[Backend] RailRadar upstream status:", r.status);

if (!r.ok) {
  const text = await r.text().catch(() => "");
  console.log("[Backend] RailRadar upstream body:", text);

  res.status(r.status).json({
    error: "RailRadar error",
    status: r.status,
    body: text?.slice(0, 400),
  });
  return;
}
    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.error("[Backend] RailRadar proxy error:", e && e.message ? e.message : e);
    res.status(500).json({ error: "Proxy error" });
  }
});

app.get("/api/train/:trainNumber/:date", async (req, res) => {
  const { trainNumber, date } = req.params;
  const key = process.env.INDIANRAIL_API_KEY;
  if (!key) {
    res.status(500).json({ error: "INDIANRAIL_API_KEY not configured" });
    return;
  }
  try {
    const url = `http://indianrailapi.com/api/v2/livetrainstatus/apikey/${encodeURIComponent(
      key,
    )}/trainnumber/${encodeURIComponent(trainNumber)}/date/${encodeURIComponent(date)}/`;
    const r = await fetch(url, { timeout: 20000 });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      res.status(r.status).json({ error: "Upstream error", status: r.status, body: text?.slice(0, 300) });
      return;
    }
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Proxy error" });
  }
});

const port = process.env.PORT || 5175;
app.listen(port, () => {
  process.stdout.write(`API proxy listening on ${port}\n`);
});
