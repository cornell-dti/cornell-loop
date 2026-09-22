import { useState, useRef, useLayoutEffect } from "react";
import { useConvex, useConvexAuth, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@app/convex/_generated/api";
import { Button } from "@app/ui";
import SearchHeader from "./components/SearchHeader";
import FeedView from "./components/FeedView";
import BookmarkView from "./components/BookmarkView";
import SearchView from "./components/SearchView";
import OriginalEmailView from "./components/OriginalEmailView";
import type { EventId, EventItem } from "./data/types";
import { useBookmarks } from "./data/useEvents";
import { openExternalUrl } from "./utils/linkUtils";
import { signInWithGoogle } from "./extensionOAuth";

type View = "feed" | "bookmarks" | "search" | "email";

export type PageContext = "gmail" | "gcal";

export interface AppProps {
  onClose?: () => void;
  pageContext?: PageContext;
  onPreviewSlot?: (event: EventItem | null) => void;
}

const DASHBOARD_URL = (() => {
  const value = import.meta.env.VITE_DASHBOARD_URL;
  return typeof value === "string" && value.length > 0
    ? value
    : "https://cornell-loop.com";
})();

// ── Auth gate sub-components ───────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="font-[family-name:var(--font-body)] text-[length:var(--font-size-body3)] text-[var(--color-neutral-500)]">
        Loading…
      </p>
    </div>
  );
}

interface SignInPromptProps {
  onSignIn: () => void;
  signInError: string | null;
}

function SignInPrompt({ onSignIn, signInError }: SignInPromptProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[var(--space-4)] px-6">
      <div className="flex flex-col items-center gap-[var(--space-2)] text-center">
        <p
          className={
            "font-[family-name:var(--font-brand)] font-bold " +
            "text-[1.25rem] leading-[1.5] tracking-[-0.22px] " +
            "text-[var(--color-text-primary)]"
          }
        >
          Cornell Loop
        </p>
        <p className="font-[family-name:var(--font-body)] text-[length:var(--font-size-body3)] text-[var(--color-neutral-500)]">
          Sign in with your Cornell Google account to see events from your
          clubs.
        </p>
      </div>
      <Button variant="primary" size="md" onClick={onSignIn}>
        Sign in with Google
      </Button>
      {signInError !== null && (
        <p className="font-[family-name:var(--font-body)] text-[length:var(--font-size-body3)] text-[var(--color-red-600)]">
          {signInError}
        </p>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

export default function App({
  onClose,
  pageContext = "gmail",
  onPreviewSlot,
}: AppProps) {
  const convex = useConvex();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();

  const bookmarkMutation = useMutation(api.bookmarks.bookmark);
  const unbookmarkMutation = useMutation(api.bookmarks.unbookmark);

  const { ids: bookmarkedIds, events: bookmarkedEvents } = useBookmarks();

  const [view, setView] = useState<View>("feed");
  const [activeTab, setActiveTab] = useState<"feed" | "bookmarks">("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);

  const mainScrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [view]);

  // ── Email view ─────────────────────────────────────────────────────────
  const [emailEventId, setEmailEventId] = useState<EventId | undefined>(
    undefined,
  );
  const [emailEventOrgName, setEmailEventOrgName] = useState<
    string | undefined
  >(undefined);

  const handleEmailView = (event: EventItem) => {
    setEmailEventId(event.id);
    setEmailEventOrgName(event.orgName);
    setView("email");
  };

  // ── Bookmark actions ───────────────────────────────────────────────────
  const handleBookmark = (eventId: EventId) => {
    if (bookmarkedIds.has(eventId)) {
      void unbookmarkMutation({ eventId });
    } else {
      void bookmarkMutation({ eventId });
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────
  const isSearchMode = view === "search" || view === "email";

  const handleTabChange = (tab: string) => {
    if (tab !== "feed" && tab !== "bookmarks") return;
    setActiveTab(tab);
    setView(tab);
    setEmailEventId(undefined);
    setEmailEventOrgName(undefined);
  };

  const handleSearchFocus = () => setView("search");

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setView("search");
  };

  const handleSearchClear = () => setSearchQuery("");

  const handleBack = () => {
    setSearchQuery("");
    setEmailEventId(undefined);
    setEmailEventOrgName(undefined);
    setView(activeTab);
  };

  const handleSearchSelect = (term: string) => {
    setSearchQuery(term);
    setView("search");
  };

  // ── Auth gate ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="flex h-full flex-col overflow-hidden rounded-[12px] bg-white"
        style={{ boxShadow: "0px 4px 16px rgba(0, 0, 0, 0.18)" }}
      >
        <LoadingState />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="flex h-full flex-col overflow-hidden rounded-[12px] bg-white"
        style={{ boxShadow: "0px 4px 16px rgba(0, 0, 0, 0.18)" }}
      >
        <div className="shrink-0 px-6 pt-7" data-loop-panel-drag>
          <SearchHeader
            variant="main"
            activeTab={activeTab}
            onTabChange={handleTabChange}
            searchQuery=""
            onSearchChange={() => {}}
            onSearchFocus={() => {}}
            onSearchClear={() => {}}
            onBack={() => {}}
            onClose={onClose}
          />
        </div>
        <SignInPrompt
          onSignIn={() => {
            setSignInError(null);
            signInWithGoogle({ convex, signIn }).catch((err: unknown) => {
              const message =
                err instanceof Error
                  ? err.message
                  : "Sign-in failed. Please try again.";
              setSignInError(message);
            });
          }}
          signInError={signInError}
        />
      </div>
    );
  }

  // ── Authenticated UI ───────────────────────────────────────────────────
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[12px] bg-white"
      style={{ boxShadow: "0px 4px 16px rgba(0, 0, 0, 0.18)" }}
    >
      {/* ── Sticky header ── */}
      <div className="shrink-0 px-6 pt-7" data-loop-panel-drag>
        <SearchHeader
          variant={isSearchMode ? "search" : "main"}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearchFocus={handleSearchFocus}
          onSearchClear={handleSearchClear}
          onBack={handleBack}
          onClose={onClose}
        />
      </div>

      {/* ── Main content ── */}
      {view === "search" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            ref={mainScrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-6 py-[21px]"
            data-loop-scroll
          >
            <SearchView
              query={searchQuery}
              onSearchSelect={handleSearchSelect}
              bookmarkedIds={bookmarkedIds}
              onBookmark={handleBookmark}
              onEmailView={handleEmailView}
            />
          </div>
          <div
            className={[
              "shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]",
              "px-6 py-4",
              "shadow-[0_-4px_16px_rgba(0,0,0,0.06)]",
            ].join(" ")}
          >
            <div className="flex w-full flex-col gap-[var(--space-3)]">
              <Button
                variant="primary"
                size="cta"
                className="w-full"
                onClick={() => openExternalUrl(DASHBOARD_URL)}
              >
                See more in dashboard
              </Button>
              <Button
                variant="secondary"
                size="cta"
                className="w-full"
                onClick={() => {
                  void signOut();
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={mainScrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-[21px]"
          data-loop-scroll
        >
          {view === "feed" && (
            <FeedView
              bookmarkedIds={bookmarkedIds}
              onBookmark={handleBookmark}
              onEmailView={handleEmailView}
            />
          )}

          {view === "bookmarks" && (
            <BookmarkView
              events={bookmarkedEvents}
              onUnbookmark={handleBookmark}
              onEmailView={handleEmailView}
              pageContext={pageContext}
              onPreviewSlot={onPreviewSlot}
            />
          )}

          {view === "email" && (
            <OriginalEmailView
              eventId={emailEventId}
              orgName={emailEventOrgName}
            />
          )}

          <div className="flex w-full flex-col items-center gap-[var(--space-3)] pt-[21px]">
            <Button
              variant="primary"
              size="cta"
              className="w-full"
              onClick={() => openExternalUrl(DASHBOARD_URL)}
            >
              See more in dashboard
            </Button>
            <Button
              variant="secondary"
              size="cta"
              className="w-full"
              onClick={() => {
                void signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
