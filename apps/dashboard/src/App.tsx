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
import { Search } from "./pages/Search";
import Admin from "./pages/Admin";
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
 * RejectedDomainGate — shared guard behind both ProtectedRoute (via
 * OnboardingGate below) and AuthOnlyRoute. Renders a bare loading state
 * instead of `children` while `useCurrentProfile` is still resolving *or*
 * has signed a non-Cornell session out and is redirecting to
 * `/?error=non-cornell`.
 *
 * Gating on `loading` too (not just the confirmed `rejectedDomain`) closes a
 * race: `useCurrentProfile` reports `rejectedDomain: false` while its
 * `currentUser` query is in flight, so a gate that only checked
 * `rejectedDomain` would still let the real page underneath mount and fire
 * its own `authedQuery`-backed queries — e.g. `Home`'s feed/follows/rsvp
 * queries, or `Onboarding`'s `orgs.getSuggestedForOnboarding` — during that
 * window. Those throw `NON_CORNELL_EMAIL` for a rejected user before we've
 * had a chance to redirect, landing on `FeedErrorBoundary`'s dead-end
 * "Something went wrong" screen (or a hard crash on pages with no boundary)
 * instead of the graceful banner. Withholding `children` until we know the
 * answer costs every signed-in user one extra `currentUser` round trip
 * behind this spinner, but guarantees no authed query fires before the
 * domain check has resolved.
 */
function RejectedDomainGate({ children }: { children: ReactNode }) {
  const { loading, rejectedDomain } = useCurrentProfile();
  if (loading || rejectedDomain) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * OnboardingGate — renders children when the current user has completed
 * onboarding, otherwise redirects to /onboarding. Read by ProtectedRoute
 * below, nested inside `RejectedDomainGate` — by the time this runs,
 * `useCurrentProfile` has already resolved (`loading: false`) and the
 * session isn't rejected, so the `loading` check below is just defence in
 * depth for a call site that somehow skips `RejectedDomainGate`.
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
 * Unfinished users bounce to /onboarding via OnboardingGate.
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="flex h-screen w-screen items-center justify-center">
          <p>Loading…</p>
        </div>
      </AuthLoading>
      <Authenticated>
        <RejectedDomainGate>
          <OnboardingGate>{children}</OnboardingGate>
        </RejectedDomainGate>
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
 *
 * Also gates on `rejectedDomain` (see `RejectedDomainGate`) so a non-Cornell
 * session that lands here directly can't mount `Onboarding`'s authed
 * queries (`orgs.getSuggestedForOnboarding`, `follows.myFollows`) before
 * `useCurrentProfile` finishes signing it out.
 */
function AuthOnlyRoute({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="flex h-screen w-screen items-center justify-center">
          <p>Loading…</p>
        </div>
      </AuthLoading>
      <Authenticated>
        <RejectedDomainGate>{children}</RejectedDomainGate>
      </Authenticated>
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
  return <AppRoutes />;
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
      <Route path="/admin" element={<Admin />} />

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
