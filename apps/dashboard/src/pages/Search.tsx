/**
 * Search — /search route.
 *
 * Phase 2F: dedicated grouped-results layout (no longer wraps Home).
 *
 *   ┌────────────┬───────────────────────────────┬────────────────┐
 *   │  SideBar   │  Main column                  │  SearchPanel   │
 *   │ (215px)    │  ┌ SearchBar ──────────────┐  │ (334px)        │
 *   │            │  │  ?q= URL-bound          │  │  Your RSVPs    │
 *   │            │  └────────────────────────┘  │  Your Clubs    │
 *   │            │  Events                       │                │
 *   │            │  DashboardPost × n            │                │
 *   │            │  Organizations                │                │
 *   │            │  [org card grid]              │                │
 *   └────────────┴───────────────────────────────┴────────────────┘
 *
 * Both sections are gated on q.length >= 2. When the query is shorter we show
 * a hint state; when both sections return zero results we show an empty state.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css.
 */

import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  SideBar,
  SearchBar,
  SearchPanel,
  DashboardPost,
  Tag,
  fallbackColorsForName,
} from "@app/ui";
import type {
  SideBarItemId,
  DashboardPostProps,
  Club,
  Organization,
} from "@app/ui";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import {
  eventToPost,
  orgsToClubs,
  rsvpsToRsvpGroups,
} from "../lib/eventToPost";

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_QUERY_LENGTH = 2;

// ─── Sidebar nav ─────────────────────────────────────────────────────────────

function pathForNavItem(id: SideBarItemId): string {
  return `/${id}`;
}

// ─── Shared typography ───────────────────────────────────────────────────────

const SECTION_HEADING =
  "font-[family-name:var(--font-body)] font-bold " +
  "text-[length:var(--font-size-sub2)] leading-[var(--line-height-sub2)] " +
  "tracking-[var(--letter-spacing-body1)] " +
  "text-[var(--color-neutral-900)]";

const BODY2 =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

const BODY3 =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body3)] leading-[var(--line-height-body3)] " +
  "tracking-[var(--letter-spacing-body3)]";

// ─── Org result card ─────────────────────────────────────────────────────────

interface OrgCardProps {
  org: Doc<"orgs">;
  onClick: () => void;
}

function OrgCard({ org, onClick }: OrgCardProps) {
  const fallback = fallbackColorsForName(org.name);
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group flex flex-col gap-[var(--space-2)] text-left",
        "rounded-[var(--radius-card)]",
        "bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "px-[var(--space-4)] py-[var(--space-3)]",
        "cursor-pointer",
        "hover:border-[var(--color-neutral-400)]",
        "transition-colors duration-150",
      ].join(" ")}
    >
      {/* Header — avatar + name */}
      <div className="flex items-center gap-[var(--space-2)]">
        <span
          className={[
            "inline-flex shrink-0 items-center justify-center",
            "overflow-hidden rounded-full",
            "size-[var(--space-8)]",
          ].join(" ")}
          aria-hidden="true"
        >
          {org.avatarUrl ? (
            <img
              src={org.avatarUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span
              className={[
                "flex size-full items-center justify-center",
                "font-[family-name:var(--font-body)] font-semibold",
                "text-[length:var(--font-size-body3)]",
              ].join(" ")}
              style={{ backgroundColor: fallback.bg, color: fallback.fg }}
            >
              {org.name.charAt(0).toUpperCase()}
            </span>
          )}
        </span>

        <h3
          className={["min-w-0 flex-1 truncate", SECTION_HEADING].join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {org.name}
        </h3>
      </div>

      {org.description && (
        <p
          className={[
            BODY2,
            "line-clamp-2 text-[var(--color-text-secondary)]",
          ].join(" ")}
        >
          {org.description}
        </p>
      )}

      {org.tags.length > 0 && (
        <div className="flex flex-wrap gap-[var(--space-2)]">
          {org.tags.slice(0, 4).map((label) => (
            <Tag key={label} color="neutral">
              {label}
            </Tag>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Search page ─────────────────────────────────────────────────────────────

export function Search() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const trimmed = q.trim();
  const isQueryActive = trimmed.length >= MIN_QUERY_LENGTH;

  // Convex search queries — `"skip"` while the query is too short avoids
  // unnecessary network round-trips.
  const eventResults = useQuery(
    api.events.searchEvents,
    isQueryActive ? { q: trimmed } : "skip",
  );
  const orgResults = useQuery(
    api.orgs.searchOrgs,
    isQueryActive ? { q: trimmed } : "skip",
  );

  // Right-rail data
  const followedOrgs = useQuery(api.orgs.listFollowed, {});
  const myRsvps = useQuery(api.rsvps.myRsvps, {});

  const eventPosts: DashboardPostProps[] = useMemo(() => {
    if (!eventResults) return [];
    return eventResults.map(eventToPost);
  }, [eventResults]);

  const clubs: Club[] = useMemo(
    () => orgsToClubs(followedOrgs),
    [followedOrgs],
  );
  const rsvpGroups = useMemo(() => rsvpsToRsvpGroups(myRsvps), [myRsvps]);

  const handleQueryChange = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next.length === 0) {
      nextParams.delete("q");
    } else {
      nextParams.set("q", next);
    }
    setParams(nextParams, { replace: true });
  };

  const handleClear = () => {
    const nextParams = new URLSearchParams(params);
    nextParams.delete("q");
    setParams(nextParams, { replace: true });
  };

  const handleClubClick = (club: Club) => {
    navigate(`/orgs/${club.id}`);
  };

  const handleOrgClick = (postOrg: Organization) => {
    if (postOrg.id) navigate(`/orgs/${postOrg.id}`);
  };

  const eventsLoading = isQueryActive && eventResults === undefined;
  const orgsLoading = isQueryActive && orgResults === undefined;
  const noResults =
    isQueryActive &&
    !eventsLoading &&
    !orgsLoading &&
    eventPosts.length === 0 &&
    (orgResults?.length ?? 0) === 0;

  return (
    <div
      className={[
        "flex h-screen w-full overflow-hidden",
        "bg-[var(--color-surface)]",
      ].join(" ")}
    >
      {/* ── Left sidebar ── */}
      <div className="h-full shrink-0 overflow-y-auto">
        <SideBar onNavigate={(id) => navigate(pathForNavItem(id))} />
      </div>

      {/* ── Main column ── */}
      <main
        className={[
          "flex min-w-0 flex-1 flex-col gap-[var(--space-6)]",
          "overflow-y-auto bg-[var(--color-surface-subtle)] py-[var(--space-6)]",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        ].join(" ")}
        aria-label="Search"
      >
        {/* SearchBar bound to ?q= */}
        <div className="flex w-full shrink-0 px-[var(--space-8)]">
          <SearchBar
            value={q}
            onChange={handleQueryChange}
            onClear={handleClear}
            placeholder="Search"
            className="w-full shrink-0"
          />
        </div>

        {/* Hint state — query too short */}
        {!isQueryActive && (
          <div
            className={[
              "flex flex-col items-center justify-center",
              "px-[var(--space-8)] py-[var(--space-12)]",
              "text-center",
            ].join(" ")}
          >
            <p
              className={[BODY2, "text-[var(--color-text-secondary)]"].join(
                " ",
              )}
            >
              Type at least {MIN_QUERY_LENGTH} characters to search.
            </p>
          </div>
        )}

        {/* Empty state — no results */}
        {noResults && (
          <div
            className={[
              "flex flex-col items-center justify-center",
              "px-[var(--space-8)] py-[var(--space-12)]",
              "text-center",
            ].join(" ")}
          >
            <p
              className={[BODY2, "text-[var(--color-text-secondary)]"].join(
                " ",
              )}
            >
              No results for{" "}
              <span className="text-[var(--color-neutral-900)]">
                &ldquo;{trimmed}&rdquo;
              </span>
              .
            </p>
          </div>
        )}

        {/* Events section */}
        {isQueryActive && !noResults && (
          <section
            className="flex flex-col gap-[var(--space-4)] px-[var(--space-8)]"
            aria-label="Event results"
          >
            <h2
              className={SECTION_HEADING}
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              Events
            </h2>
            {eventsLoading ? (
              <p
                className={[BODY3, "text-[var(--color-text-secondary)]"].join(
                  " ",
                )}
              >
                Searching events…
              </p>
            ) : eventPosts.length === 0 ? (
              <p
                className={[BODY3, "text-[var(--color-text-secondary)]"].join(
                  " ",
                )}
              >
                No matching events.
              </p>
            ) : (
              <div className="flex flex-col gap-[var(--space-5)]">
                {eventPosts.map((post, i) => (
                  <DashboardPost
                    key={i}
                    {...post}
                    onOrgClick={handleOrgClick}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Organizations section */}
        {isQueryActive && !noResults && (
          <section
            className="flex flex-col gap-[var(--space-4)] px-[var(--space-8)] pb-[var(--space-8)]"
            aria-label="Organization results"
          >
            <h2
              className={SECTION_HEADING}
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              Organizations
            </h2>
            {orgsLoading ? (
              <p
                className={[BODY3, "text-[var(--color-text-secondary)]"].join(
                  " ",
                )}
              >
                Searching organizations…
              </p>
            ) : (orgResults?.length ?? 0) === 0 ? (
              <p
                className={[BODY3, "text-[var(--color-text-secondary)]"].join(
                  " ",
                )}
              >
                No matching organizations.
              </p>
            ) : (
              <div
                className={[
                  "grid gap-[var(--space-3)]",
                  "grid-cols-1 sm:grid-cols-2",
                ].join(" ")}
              >
                {orgResults?.map((org) => (
                  <OrgCard
                    key={org._id}
                    org={org}
                    onClick={() => navigate(`/orgs/${org.slug}`)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Right panel ── */}
      <SearchPanel
        rsvpGroups={rsvpGroups}
        clubs={clubs}
        onClubClick={handleClubClick}
        className="hidden h-full shrink-0 overflow-visible lg:flex"
      />
    </div>
  );
}

export default Search;
