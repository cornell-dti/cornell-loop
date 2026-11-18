import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { ConvexReactClient } from "convex/react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import App from "./App.tsx";
import { initAnalytics } from "./lib/analytics.ts";
import { AnalyticsIdentity } from "./lib/AnalyticsIdentity.tsx";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <AnalyticsIdentity />
          <App />
        </BrowserRouter>
      </ConvexAuthProvider>
    </PostHogProvider>
  </StrictMode>,
);
