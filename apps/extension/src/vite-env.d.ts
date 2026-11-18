/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_CONVEX_URL?: string;
    readonly VITE_CONVEX_SITE_URL?: string;
    readonly VITE_DASHBOARD_URL?: string;
    /**
     * Absent in contributor builds, and blanked for Playwright builds by
     * `vite.config.ts`, so analytics silently no-ops in both.
     */
    readonly VITE_POSTHOG_KEY?: string;
    readonly VITE_POSTHOG_HOST?: string;
    /** Public privacy policy page. The in-panel link is hidden while blank. */
    readonly VITE_PRIVACY_POLICY_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
