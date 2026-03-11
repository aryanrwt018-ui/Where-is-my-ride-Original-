import { action } from "./_generated/server";

export const getLiveMap = action({
  args: {},
  handler: async () => {
    const apiKey = process.env.RAILRADAR_API_KEY;
    if (!apiKey) {
      console.error("RAILRADAR_API_KEY is not set in Convex environment variables");
      throw new Error("RAILRADAR_API_KEY is not set");
    }

    try {
      const res = await fetch("https://api.railradar.org/api/v1/live-map", {
        headers: {
          "x-api-key": apiKey,
          "X-API-Key": apiKey,
        },
      });

      if (!res.ok) {
        console.error(`RailRadar API returned ${res.status}: ${res.statusText}`);
        throw new Error(`RailRadar API error: ${res.status}`);
      }

      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch live map from RailRadar:", error);
      throw error;
    }
  },
});
