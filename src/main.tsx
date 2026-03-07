import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";
import { initAxeA11y } from "@/lib/axe-a11y";

// Start axe-core accessibility scanner in dev mode (no-op in prod)
initAxeA11y();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
