import { useState } from "react";
import { Search, Plane } from "lucide-react";
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

export default function SearchFlightPage() {
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    if (!query.trim()) {
      toast.error("Please enter a flight number or airline");
      return;
    }
    toast.info("Search API not connected yet. Connect your backend to enable search.");
  };

  return (
    <div className="flex h-full flex-col overflow-auto bg-background">
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Search Flight</h1>
            <p className="text-sm text-muted-foreground">Find flights by number, airline, or route</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <Card className="mb-8">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Enter flight number or airline (e.g. AI101, Air India)"
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

        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Plane />
            </EmptyMedia>
            <EmptyTitle>Search for a flight</EmptyTitle>
            <EmptyDescription>
              Enter a flight number or airline above to view status, route, and schedule
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
