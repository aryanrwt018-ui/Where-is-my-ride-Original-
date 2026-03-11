import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import TrackingLayout from "./components/tracking-layout.tsx";
import TrainPage from "./pages/train/page.tsx";
import TrainLiveStatus from "./pages/train/live-status/page.tsx";
import SearchTrain from "./pages/train/search/page.tsx";
import SettingsPage from "./pages/settings/page.tsx";
import FlightPage from "./pages/flight/page.tsx";
import SearchFlight from "./pages/flight/search/page.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Train tracking routes */}
          <Route path="/train" element={<TrackingLayout mode="train" />}>
            <Route index element={<TrainPage />} />
            <Route path="live-status" element={<TrainLiveStatus />} />
            <Route path="search" element={<SearchTrain />} />
          </Route>

          {/* Flight tracking routes */}
          <Route path="/flight" element={<TrackingLayout mode="flight" />}>
            <Route index element={<FlightPage />} />
            <Route path="search" element={<SearchFlight />} />
          </Route>

          {/* Settings (shared) */}
          <Route path="/settings" element={<TrackingLayout mode="train" />}>
            <Route index element={<SettingsPage />} />
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
