import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import type { ReactNode } from "react";
import "./App.css";
import Landing from "./pages/Landing";
import { Home } from "./pages/Home";
import { Bookmarks } from "./pages/Bookmarks";
import { Subscriptions } from "./pages/Subscriptions";
import { Org } from "./pages/Org";
import { Profile } from "./pages/profile";
import type { SideBarItemId } from "@app/ui";
import DesignSystem from "./pages/DesignSystem";
import { SAMPLE_POSTS, SAMPLE_SIDE_PANELS } from "./data/sampleHome";

/**
 * Maps a SideBar nav id to its route path.
 * 'home' → '/home', 'bookmarks' → '/bookmarks', etc.
 */
function pathForNavItem(id: SideBarItemId): string {
  return `/${id}`;
}

/**
 * Route gate: shows a loading state while auth resolves, renders children when
 * authenticated, and redirects unauthenticated users back to the Landing page.
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  // Dev bypass: skip auth gate during local development for easier iteration.
  if (import.meta.env.DEV) return <>{children}</>;

  return (
    <>
      <AuthLoading>
        <div className="flex h-screen w-screen items-center justify-center">
          <p>Loading…</p>
        </div>
      </AuthLoading>
      <Authenticated>{children}</Authenticated>
      <Unauthenticated>
        <Navigate to="/" replace />
      </Unauthenticated>
    </>
  );
}

// ─── Route wrappers ──────────────────────────────────────────────────────────
// Each dashboard page accepts optional `activeNavItem` and `onNavigate` props.
// These small wrappers wire the router-aware values in once so the page files
// stay framework-agnostic.

function RoutedHome() {
  const navigate = useNavigate();
  return (
    <Home
      activeNavItem="home"
      onNavigate={(id) => navigate(pathForNavItem(id))}
      posts={SAMPLE_POSTS}
      sidePanels={SAMPLE_SIDE_PANELS}
    />
  );
}

function RoutedBookmarks() {
  const navigate = useNavigate();
  return (
    <Bookmarks
      activeNavItem="bookmarks"
      onNavigate={(id) => navigate(pathForNavItem(id))}
    />
  );
}

function RoutedSubscriptions() {
  const navigate = useNavigate();
  return (
    <Subscriptions
      activeNavItem="subscriptions"
      onNavigate={(id) => navigate(pathForNavItem(id))}
    />
  );
}

function RoutedOrg() {
  const navigate = useNavigate();
  return <Org onNavigate={(id) => navigate(pathForNavItem(id))} />;
}

function RoutedProfile() {
  const navigate = useNavigate();
  return <Profile onClose={() => navigate("/home")} />;
}

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />

      {/* Protected dashboard routes */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <RoutedHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookmarks"
        element={
          <ProtectedRoute>
            <RoutedBookmarks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscriptions"
        element={
          <ProtectedRoute>
            <RoutedSubscriptions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orgs/:slug"
        element={
          <ProtectedRoute>
            <RoutedOrg />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <RoutedProfile />
          </ProtectedRoute>
        }
      />

      {/* Dev-only design system page */}
      {import.meta.env.DEV && (
        <Route path="/design-system" element={<DesignSystem />} />
      )}

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
