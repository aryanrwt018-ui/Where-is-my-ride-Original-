import { ConvexProviderWithHerculesAuth } from "@usehercules/auth/convex-react";
import { ConvexReactClient } from "convex/react";

function decodeMaybeUrlToken(token?: string): string | undefined {
  if (!token) return undefined;
  try {
    const decoded = atob(token);
    if (decoded.startsWith("http")) return decoded;
    // If token decodes to JSON with a deployment id/slug, build URL
    try {
      const obj = JSON.parse(decoded);
      const id = obj?.v2 || obj?.deployment || obj?.slug;
      if (typeof id === "string" && id.length) {
        return `https://${id}.convex.cloud`;
      }
    } catch {}
  } catch {}
  return undefined;
}

const convexCandidate =
  import.meta.env.VITE_CONVEX_URL ||
  (import.meta.env.VITE_CONVEX_APP ? `https://${import.meta.env.VITE_CONVEX_APP}.convex.cloud` : undefined) ||
  decodeMaybeUrlToken(import.meta.env.VITE_CONVEX_TOKEN) ||
  "http://localhost:3000";
const convex = new ConvexReactClient(convexCandidate);

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithHerculesAuth client={convex}>
      {children}
    </ConvexProviderWithHerculesAuth>
  );
}
