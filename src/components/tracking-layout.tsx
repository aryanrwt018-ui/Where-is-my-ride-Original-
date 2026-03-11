import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Globe, Radio, Search, Settings, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils.ts";

type TrackingMode = "train" | "flight";

type NavItem = {
  icon: typeof Globe;
  label: string;
  path: string;
};

function getNavItems(mode: TrackingMode): NavItem[] {
  const base = `/${mode}`;
  const items: NavItem[] = [{ icon: Globe, label: "Map", path: base }];
  if (mode === "train") {
    items.push({ icon: Radio, label: "Live Status", path: `${base}/live-status` });
    items.push({
      icon: Search,
      label: "Search Train",
      path: `${base}/search`,
    });
  } else {
    items.push({
      icon: Search,
      label: "Search Flight",
      path: `${base}/search`,
    });
  }
  items.push({ icon: Settings, label: "Settings", path: "/settings" });
  return items;
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === "/train" || item.path === "/flight"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-primary/15 text-primary shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )
      }
    >
      <item.icon className="h-5 w-5 shrink-0" />
      <span className="hidden lg:inline">{item.label}</span>
    </NavLink>
  );
}

export default function TrackingLayout({ mode }: { mode: TrackingMode }) {
  const navigate = useNavigate();
  const navItems = getNavItems(mode);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-16 flex-col border-r border-border bg-card lg:w-56">
        {/* Back button */}
        <div className="flex items-center gap-3 border-b border-border px-3 py-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden text-sm font-medium lg:inline">Back</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </nav>

        {/* Mode badge */}
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-center rounded-lg bg-primary/10 py-2 lg:justify-start lg:px-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {mode === "train" ? "🚆" : "✈️"}
              <span className="ml-2 hidden lg:inline">
                {mode === "train" ? "Train Mode" : "Flight Mode"}
              </span>
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
