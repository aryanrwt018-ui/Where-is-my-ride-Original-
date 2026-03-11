import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-muted-foreground">The page you requested does not exist</p>
      </div>
      <Button asChild>
        <Link to="/">Go Home</Link>
      </Button>
    </div>
  );
}
