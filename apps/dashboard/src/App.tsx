import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useState, type ReactNode } from "react";
import "./App.css";
import Landing from "./pages/Landing";
import { Home } from "./pages/Home";
import { Bookmarks } from "./pages/Bookmarks";
import { Subscriptions } from "./pages/Subscriptions";
import { Org } from "./pages/Org";
import { ProfileModalRoute } from "./pages/profile";
import { DevAutoSignIn } from "./components/DevAutoSignIn";
import { Search } from "./pages/Search";
import Onboarding from "./pages/Onboarding";
import { useCurrentProfile } from "./lib/useCurrentProfile";
import type { SideBarItemId } from "@app/ui";
import DesignSystem from "./pages/DesignSystem";
import type { Club, Organization } from "@app/ui";

/**
 * Maps a SideBar nav id to its route path.
 * 'home' → '/home', 'bookmarks' → '/bookmarks', etc.
 */
function pathForNavItem(id: SideBarItemId): string {
  return `/${id}`;
}

/**
 * OnboardingGate — renders children when the current user has completed
 * onboarding, otherwise redirects to /onboarding. Read by ProtectedRoute below.
 *
 * The gate only fires for resolved users. While the `currentUser` query is
 * loading we render children (the page can show its own loading state); the
 * dev-bypass flow without a real user row also passes through unchanged.
 */
function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading, isOnboarded } = useCurrentProfile();
  const location = useLocation();

  if (loading) return <>{children}</>;
  if (user === null) return <>{children}</>;
  if (isOnboarded) return <>{children}</>;
  if (location.pathname === "/onboarding") return <>{children}</>;

  return <Navigate to="/onboarding" replace />;
}

/**
 * Route gate: shows a loading state while auth resolves, renders children when
 * authenticated, and redirects unauthenticated users back to the Landing page.
 *
 * Onboarding redirect:
 *   • In PROD, gate on Convex `<Authenticated>` and additionally check that
 *     the user has finished onboarding (via OnboardingGate). Unfinished users
 *     bounce to /onboarding.
 *   • In DEV, keep the existing bypass so engineers can navigate freely
 *     without signing in. The OnboardingGate only redirects when a real user
 *     row resolves with `!isOnboarded` — so unauthenticated DEV navigation
 *     continues to render normally.
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  if (import.meta.env.DEV) {
    return <OnboardingGate>{children}</OnboardingGate>;
  }

  return (
    <>
      <AuthLoading>
        <div className="flex h-screen w-screen items-center justify-center">
          <p>Loading…</p>
        </div>
      </AuthLoading>
      <Authenticated>
        <OnboardingGate>{children}</OnboardingGate>
      </Authenticated>
      <Unauthenticated>
        <Navigate to="/" replace />
      </Unauthenticated>
    </>
  );
}

/**
 * AuthOnlyRoute — gates on auth without applying the onboarding redirect.
 * Used for /onboarding so an unfinished user can stay on the page instead of
 * being bounced into a redirect loop.
 */
function AuthOnlyRoute({ children }: { children: ReactNode }) {
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

/**
 * Shared handler for clicking a club in the right-rail SearchPanel.
 * Navigates to /orgs/{slug} so each Club tile is a real link to its org page.
 * Falls back to club id when no slug is supplied (current sample data uses id).
 */
function useClubClick() {
  const navigate = useNavigate();
  return (club: Club) => {
    navigate(`/orgs/${club.id}`);
  };
}

/**
 * Shared handler for clicking an organisation name in a post header.
 * Navigates to /orgs/{id} when the org has a slug. Without an id the click is a
 * no-op (the row stays focusable for the hover preview).
 */
function useOrgClick() {
  const navigate = useNavigate();
  return (org: Organization) => {
    if (org.id) navigate(`/orgs/${org.id}`);
  };
}

function RoutedHome() {
  const navigate = useNavigate();
  const onClubClick = useClubClick();
  const onOrgClick = useOrgClick();
  return (
    <Home
      activeNavItem="home"
      onNavigate={(id) => navigate(pathForNavItem(id))}
      onClubClick={onClubClick}
      onOrgClick={onOrgClick}
      // Pressing Enter from /home pushes to /search?q=… so the search has a
      // shareable URL. Home still renders results inline either way.
      onSearchSubmit={(q) => navigate(`/search?q=${encodeURIComponent(q)}`)}
    />
  );
}

function RoutedSearch() {
  return <Search />;
}

function RoutedBookmarks() {
  const navigate = useNavigate();
  const onClubClick = useClubClick();
  const onOrgClick = useOrgClick();
  return (
    <Bookmarks
      activeNavItem="bookmarks"
      onNavigate={(id) => navigate(pathForNavItem(id))}
      onClubClick={onClubClick}
      onOrgClick={onOrgClick}
    />
  );
}

const SORT_OPTIONS = ["Alphabetical", "Most emails", "Recently added"] as const;

function RoutedSubscriptions() {
  const navigate = useNavigate();
  const onClubClick = useClubClick();
  const [sortIndex, setSortIndex] = useState(0);
  return (
    <Subscriptions
      activeNavItem="subscriptions"
      onNavigate={(id) => navigate(pathForNavItem(id))}
      sortLabel={SORT_OPTIONS[sortIndex]}
      onSortChange={() => setSortIndex((i) => (i + 1) % SORT_OPTIONS.length)}
      onClubClick={onClubClick}
    />
  );
}

/**
 * RoutedOrg — thin wrapper around the self-contained <Org> page.
 *
 * Phase 2F: <Org> now reads the slug from useParams and self-fetches all of
 * its data (org doc, events, RSVPs, followed orgs) from Convex. This wrapper
 * exists only to keep the route tree symmetrical with other dashboard pages.
 */
function RoutedOrg() {
  return <Org />;
}

/**
 * RoutedProfile — owns the profile-modal route.
 *
 * Wraps the Profile dialog with a backdrop and centred layout. The form's
 * persisted state and the save mutation live inside `<ProfileModalRoute>`;
 * this wrapper handles the backdrop click + post-save dismiss navigation.
 */
function RoutedProfile() {
  const navigate = useNavigate();
  const handleDismiss = () => navigate("/home");
  return (
    <>
      {/*
       * Render the Home dashboard underneath so the modal floats over it,
       * matching Figma node 633:4436. The modal's z-50 backdrop captures all
       * pointer events so the dashboard is visual-only while the modal is open.
       */}
      <RoutedHome />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleDismiss();
        }}
      >
        <ProfileModalRoute onDismiss={handleDismiss} />
      </div>
    </>
  );
}

function App() {
  return (
    <>
      <DevAutoSignIn />
      <AppRoutes />
    </>
  );
}

function AppRoutes() {
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
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <RoutedSearch />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <AuthOnlyRoute>
            <Onboarding />
          </AuthOnlyRoute>
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
