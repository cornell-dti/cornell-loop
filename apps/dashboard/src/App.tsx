import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import "./App.css";
import Landing from "./pages/Landing";
import { Home } from "./pages/Home";
import { Bookmarks } from "./pages/Bookmarks";
import { Subscriptions } from "./pages/Subscriptions";
import { Org } from "./pages/Org";
import { Profile } from "./pages/profile";
import { Search } from "./pages/Search";
import type { SideBarItemId } from "@app/ui";
import DesignSystem from "./pages/DesignSystem";
import {
  SAMPLE_POSTS,
  SAMPLE_RSVP_GROUPS,
  SAMPLE_CLUBS,
} from "./data/sampleHome";
import { SAMPLE_BOOKMARKED_POSTS } from "./data/sampleBookmarks";
import { SAMPLE_ORGS } from "./data/sampleOrgs";
import { SAMPLE_SUBSCRIPTIONS } from "./data/sampleSubscriptions";
import type { Club, Organization } from "@app/ui";

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
      posts={SAMPLE_POSTS}
      rsvpGroups={SAMPLE_RSVP_GROUPS}
      clubs={SAMPLE_CLUBS}
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
      posts={SAMPLE_BOOKMARKED_POSTS}
      rsvpGroups={SAMPLE_RSVP_GROUPS}
      clubs={SAMPLE_CLUBS}
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
      subscriptionCount={SAMPLE_SUBSCRIPTIONS.length}
      subscriptions={SAMPLE_SUBSCRIPTIONS}
      sortLabel={SORT_OPTIONS[sortIndex]}
      onSortChange={() => setSortIndex((i) => (i + 1) % SORT_OPTIONS.length)}
      rsvpGroups={SAMPLE_RSVP_GROUPS}
      clubs={SAMPLE_CLUBS}
      onClubClick={onClubClick}
    />
  );
}

/**
 * Renders the Org page for a given URL slug.
 *
 * Lookup logic:
 *   • Read `slug` from useParams.
 *   • If the slug is missing or absent from SAMPLE_ORGS, render an inline
 *     "not found" state alongside the SideBar so navigation remains accessible.
 *     (We chose inline-not-found over redirect so users see context for the
 *     broken link instead of a silent bounce to /home.)
 *   • Otherwise, hydrate the Org page with the matched profile.
 *
 * Local state:
 *   • `isFollowing` is seeded from the profile and toggled by the Follow button.
 *   • `feedSearchValue` powers the in-page posts feed search input.
 *   • `sidePanelSearchValue` powers the right-rail search input.
 *   • `tagFilter` / `timeFilter` cycle through a small set of options when the
 *     filter chips are clicked, so the buttons feel interactive even though
 *     filtering is not yet wired to data.
 */
const TAG_FILTER_OPTIONS = ["All tags", "Tech", "Outdoors", "For you"] as const;
const TIME_FILTER_OPTIONS = [
  "All time",
  "This week",
  "This month",
  "Past events",
] as const;

function RoutedOrg() {
  const navigate = useNavigate();
  const onClubClick = useClubClick();
  const onOrgClick = useOrgClick();
  const { slug } = useParams<{ slug: string }>();
  const profile = slug ? SAMPLE_ORGS[slug] : undefined;

  // Hooks must run unconditionally — declare them above any early return.
  const [isFollowing, setIsFollowing] = useState<boolean>(
    profile?.isFollowing ?? false,
  );
  const [feedSearchValue, setFeedSearchValue] = useState("");
  const [tagFilterIndex, setTagFilterIndex] = useState(0);
  const [timeFilterIndex, setTimeFilterIndex] = useState(0);

  if (!profile) {
    return (
      <Org
        onNavigate={(id) => navigate(pathForNavItem(id))}
        orgName="Organization not found"
        orgDescription={
          slug
            ? `We couldn't find an organization with the slug "${slug}". It may have been removed or renamed.`
            : "No organization slug was provided."
        }
        orgTags={[]}
        posts={[]}
        rsvpGroups={SAMPLE_RSVP_GROUPS}
        clubs={SAMPLE_CLUBS}
        onClubClick={onClubClick}
        onOrgClick={onOrgClick}
      />
    );
  }

  return (
    <Org
      onNavigate={(id) => navigate(pathForNavItem(id))}
      orgName={profile.orgName}
      orgDescription={profile.orgDescription}
      orgAvatarUrl={profile.orgAvatarUrl}
      coverImageUrl={profile.coverImageUrl}
      isVerified={profile.isVerified}
      orgTags={profile.orgTags}
      loopSummary={profile.loopSummary}
      isFollowing={isFollowing}
      onFollow={() => setIsFollowing((prev) => !prev)}
      onWebsite={() =>
        window.open(profile.websiteUrl, "_blank", "noopener,noreferrer")
      }
      onEmail={() => {
        window.location.href = `mailto:${profile.email}`;
      }}
      posts={profile.posts}
      feedSearchValue={feedSearchValue}
      onFeedSearchChange={setFeedSearchValue}
      onFeedSearchClear={() => setFeedSearchValue("")}
      tagFilter={TAG_FILTER_OPTIONS[tagFilterIndex]}
      onTagFilterChange={() =>
        setTagFilterIndex((i) => (i + 1) % TAG_FILTER_OPTIONS.length)
      }
      timeFilter={TIME_FILTER_OPTIONS[timeFilterIndex]}
      onTimeFilterChange={() =>
        setTimeFilterIndex((i) => (i + 1) % TIME_FILTER_OPTIONS.length)
      }
      rsvpGroups={SAMPLE_RSVP_GROUPS}
      clubs={SAMPLE_CLUBS}
      onClubClick={onClubClick}
      onOrgClick={onOrgClick}
    />
  );
}

/**
 * RoutedProfile — owns the profile-modal state.
 *
 * Wraps the Profile dialog with a backdrop and centred layout. Manages selected
 * Major / Grad Year / Minor / Interests, plus a `saved` flag that swaps the
 * dialog body to the "Recalibrating your feed…" confirmation. After ~1500 ms in
 * the saved state the modal auto-dismisses by navigating back to /home.
 */
function RoutedProfile() {
  const navigate = useNavigate();
  const [major, setMajor] = useState<string>("Computer Science");
  const [gradYear, setGradYear] = useState<string>("2027");
  const [minor, setMinor] = useState<string>("Linguistics");
  const [interests, setInterests] = useState<string[]>([
    "Tech",
    "Health",
    "Finance",
    "Education",
  ]);
  const [saved, setSaved] = useState(false);
  const dismissTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimer.current !== null) {
        window.clearTimeout(dismissTimer.current);
      }
    };
  }, []);

  const handleSave = () => {
    setSaved(true);
    dismissTimer.current = window.setTimeout(() => {
      navigate("/home");
    }, 1500);
  };

  const handleClose = () => {
    if (dismissTimer.current !== null) {
      window.clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    navigate("/home");
  };

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
          // Click outside the card closes the modal.
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <Profile
          userName="Megan"
          major={major}
          onMajorChange={setMajor}
          gradYear={gradYear}
          onGradYearChange={setGradYear}
          minor={minor}
          onMinorChange={setMinor}
          interests={interests}
          onInterestsChange={setInterests}
          saved={saved}
          onSave={handleSave}
          onClose={handleClose}
        />
      </div>
    </>
  );
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
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <RoutedSearch />
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
