import { Link } from "react-router-dom";
import { TrainFront, Plane } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

export default function Index() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-4">
        <img
          src="/Company.png"
          alt="Company logo"
          className="h-12 w-auto md:h-14"
        />
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Where is my ride?
        </h1>
      </div>
      <p className="text-center text-muted-foreground">
        Track trains and flights with a clean, fast interface
      </p>
      <div className="flex items-center gap-3">
        <Button asChild className="group">
          <Link to="/train" className="flex items-center gap-2">
            <TrainFront className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
            <span>Open Train Tracker</span>
          </Link>
        </Button>
        <Button asChild variant="secondary" className="group">
          <Link to="/flight" className="flex items-center gap-2">
            <Plane className="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5" />
            <span>Open Flight Tracker</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
