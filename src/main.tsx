import { createRoot } from "react-dom/client";
import App from "./App.tsx";

const mountEl = document.getElementById("root")!;
createRoot(mountEl).render(<App />);
(window as any).__WIMR_APP_BOOT = true;
