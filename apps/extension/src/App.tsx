import { useState } from "react";
import { Button } from "@app/ui";
import SearchHeader from "./components/SearchHeader";
import FeedView from "./components/FeedView";
import BookmarkView from "./components/BookmarkView";
import SearchView from "./components/SearchView";
import OriginalEmailView from "./components/OriginalEmailView";
import type { EventItem } from "./data/types";
import { openExternalUrl } from "./utils/linkUtils";

type View = "feed" | "bookmarks" | "search" | "email";

export type PageContext = "gmail" | "gcal";

export interface AppProps {
  onClose?: () => void;
  pageContext?: PageContext;
  /** Called by BookmarkView when the user hovers a bookmark card on GCal. */
  onPreviewSlot?: (event: EventItem | null) => void;
}

const DASHBOARD_URL =
  (import.meta.env.VITE_DASHBOARD_URL as string | undefined) ??
  "https://cornellloop.com";

export default function App({ onClose, pageContext = "gmail", onPreviewSlot }: AppProps) {
  const [view, setView] = useState<View>("feed");
  const [activeTab, setActiveTab] = useState<"feed" | "bookmarks">("feed");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Bookmark state ─────────────────────────────────────────────────────
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ── Email view ─────────────────────────────────────────────────────────
  const [emailEvent, setEmailEvent] = useState<EventItem | null>(null);

  const handleEmailView = (event: EventItem) => {
    setEmailEvent(event);
    setView("email");
  };

  // ── Navigation ─────────────────────────────────────────────────────────
  const isSearchMode = view === "search" || view === "email";

  const handleTabChange = (tab: string) => {
    const t = tab as "feed" | "bookmarks";
    setActiveTab(t);
    setView(t);
    setEmailEvent(null);
  };

  const handleSearchFocus = () => setView("search");

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setView("search");
  };

  const handleSearchClear = () => setSearchQuery("");

  const handleBack = () => {
    setSearchQuery("");
    setEmailEvent(null);
    setView(activeTab);
  };

  /** Populate the search bar when the user clicks a popular search term. */
  const handleSearchSelect = (term: string) => {
    setSearchQuery(term);
    setView("search");
  };

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[12px] bg-white"
      style={{ boxShadow: "0px 4px 16px rgba(0, 0, 0, 0.18)" }}
    >
      {/* ── Sticky header ── */}
      <div className="shrink-0 px-6 pt-7">
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

      {/* ── Main content: search uses pinned footer CTA; other views scroll with CTA inline ── */}
      {view === "search" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[21px]">
            <SearchView
              query={searchQuery}
              onSearchSelect={handleSearchSelect}
              bookmarkedIds={bookmarkedIds}
              onBookmark={toggleBookmark}
              onEmailView={handleEmailView}
            />
          </div>
          {/* Pinned to bottom of panel while search content scrolls */}
          <div
            className={[
              "shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]",
              "px-6 py-4",
              "shadow-[0_-4px_16px_rgba(0,0,0,0.06)]",
            ].join(" ")}
          >
            <Button
              variant="primary"
              size="cta"
              className="w-full"
              onClick={() => openExternalUrl(DASHBOARD_URL)}
            >
              See more in dashboard
            </Button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-[21px]">
          {view === "feed" && (
            <FeedView
              bookmarkedIds={bookmarkedIds}
              onBookmark={toggleBookmark}
              onEmailView={handleEmailView}
            />
          )}

          {view === "bookmarks" && (
            <BookmarkView
              bookmarkedIds={bookmarkedIds}
              onBookmark={toggleBookmark}
              onEmailView={handleEmailView}
              pageContext={pageContext}
              onPreviewSlot={onPreviewSlot}
            />
          )}

          {view === "email" && <OriginalEmailView event={emailEvent} />}

          {/* CTA — opens dashboard in a new tab */}
          <div className="pt-[21px]">
            <Button
              variant="primary"
              size="cta"
              onClick={() => openExternalUrl(DASHBOARD_URL)}
            >
              See more in dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
