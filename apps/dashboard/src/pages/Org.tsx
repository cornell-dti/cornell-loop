/**
 * Org — Loop Dashboard Page
 *
 * Source: Figma "Incubator-design-file" › node 1:573 "club page"
 *
 * Three-column page layout:
 *   • SideBar (left)        — navigation rail, any item active
 *   • Main content (center) — cover banner, org avatar, action buttons, org info,
 *                             Loop Summary card, posts feed with search/filter bar
 *   • Right panel           — SearchBar, "This week" + "Trending" event sections
 *
 * Phase 2F: this page now self-fetches against Convex via:
 *   • api.orgs.getBySlug      — org doc + isFollowing flag
 *   • api.events.byOrg        — paginated events for the org
 *   • api.rsvps.myRsvps       — right-rail "Your RSVPs" data
 *   • api.orgs.listFollowed   — right-rail "Your Clubs" data
 *
 * Cover banner: 240 px tall full-width area; pass `coverImageUrl` for a real image.
 * Org avatar: 121 × 121 px circle, overlaps the cover bottom at left = 24 px.
 *
 * Follow button bg: Figma #909090 — approximated with --color-neutral-600 (#616972).
 * "For you" org tag: Figma bg #ffe4d5 / text #b54400 — approximated with
 *   --color-primary-500 (#ffcaaa) / --color-primary-800 (#a74409).
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded except where noted above.
 */

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  SideBar,
  SearchBar,
  SearchPanel,
  LoopSummary,
  DashboardPost,
  Tag,
  Button,
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

// ─── Inline icon helpers ──────────────────────────────────────────────────────
// Globe and Mail icons are not in shared/ui/src/assets; defined inline here.

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={10} />
      <line x1={2} y1={12} x2={22} y2={12} />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Shared typography class strings ─────────────────────────────────────────

const BODY2_REGULAR =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

// ─── Tag/time placeholder cycles ─────────────────────────────────────────────
// Phase 2F note: these chips cycle through display labels but do NOT yet
// filter the underlying events query. Real filtering lands separately.

const TAG_FILTER_OPTIONS = ["All tags", "Tech", "Outdoors", "For you"] as const;
const TIME_FILTER_OPTIONS = [
  "All time",
  "This week",
  "This month",
  "Past events",
] as const;

// ─── Sidebar nav ─────────────────────────────────────────────────────────────

function pathForNavItem(id: SideBarItemId): string {
  return `/${id}`;
}

// ─── OrgTagPill ───────────────────────────────────────────────────────────────

interface OrgTagSpec {
  label: string;
  variant: "primary" | "neutral";
}

/**
 * Renders a neutral or primary (orange "For you") pill tag for the org header.
 * Uses the Tag design-system component for neutral; a custom span for primary,
 * matching the "For you" badge style used consistently across Home / Subscriptions.
 */
function OrgTagPill({ label, variant }: OrgTagSpec) {
  if (variant === "neutral") {
    return <Tag color="neutral">{label}</Tag>;
  }
  // Primary "For you" pill — match design-system Tag dimensions exactly so
  // primary and neutral pills align in height. Same px/py/radius/font as Tag,
  // only the colour palette differs. Uses primary-900 fg on primary-500 bg
  // to clear WCAG AA 4.5:1 contrast at body text sizes (primary-800 is ~4.11).
  return (
    <span
      className={[
        "inline-flex items-center gap-[var(--space-2)]",
        "px-[var(--space-3)] py-[var(--space-0-5)]",
        "rounded-[var(--radius-input)]",
        "bg-[var(--color-primary-500)]",
        "font-[family-name:var(--font-body)] font-medium",
        "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)]",
        "tracking-[var(--letter-spacing-body2)]",
        "text-[var(--color-primary-900)]",
        "whitespace-nowrap select-none",
      ].join(" ")}
      style={{ fontVariationSettings: "'opsz' 14" }}
    >
      {label}
    </span>
  );
}

// ─── Page-level loading & not-found shells ───────────────────────────────────

function ShellWithSidebar({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div
      className={[
        "flex h-screen w-full overflow-hidden",
        "bg-[var(--color-surface)]",
      ].join(" ")}
    >
      <div className="h-full shrink-0 overflow-y-auto">
        <SideBar onNavigate={(id) => navigate(pathForNavItem(id))} />
      </div>
      <main
        className={[
          "flex min-w-0 flex-1 flex-col items-center justify-center",
          "overflow-y-auto bg-[var(--color-surface-subtle)]",
          "px-[var(--space-8)] py-[var(--space-8)]",
        ].join(" ")}
      >
        {children}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <ShellWithSidebar>
      <div
        className={[
          "flex flex-col items-center gap-[var(--space-3)]",
          "text-[var(--color-text-secondary)]",
          BODY2_REGULAR,
        ].join(" ")}
      >
        <div
          aria-hidden="true"
          className={[
            "size-[var(--space-8)] animate-spin rounded-full",
            "border-2 border-[var(--color-neutral-300)]",
            "border-t-[var(--color-primary-700)]",
          ].join(" ")}
        />
        <p>Loading organisation…</p>
      </div>
    </ShellWithSidebar>
  );
}

function NotFoundState({ slug }: { slug: string | undefined }) {
  return (
    <ShellWithSidebar>
      <div
        className={[
          "flex flex-col items-center gap-[var(--space-2)] text-center",
          "max-w-[40rem]",
        ].join(" ")}
      >
        <h1
          className={[
            "font-[family-name:var(--font-body)] font-semibold",
            "text-[length:var(--font-size-sub2)] leading-[var(--line-height-sub2)]",
            "tracking-[var(--letter-spacing-body1)]",
            "text-[var(--color-neutral-900)]",
          ].join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Organization not found
        </h1>
        <p
          className={[BODY2_REGULAR, "text-[var(--color-text-secondary)]"].join(
            " ",
          )}
        >
          {slug
            ? `We couldn't find an organization with the slug "${slug}". It may have been removed or renamed.`
            : "No organization slug was provided."}
        </p>
      </div>
    </ShellWithSidebar>
  );
}

// ─── Org page ────────────────────────────────────────────────────────────────

export function Org() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const orgQuery = useQuery(api.orgs.getBySlug, slug ? { slug } : "skip");
  const eventsQuery = useQuery(
    api.events.byOrg,
    slug ? { slug, paginationOpts: { numItems: 50, cursor: null } } : "skip",
  );
  const followedOrgs = useQuery(api.orgs.listFollowed, {});
  const myRsvps = useQuery(api.rsvps.myRsvps, {});

  const followMutation = useMutation(api.follows.follow);
  const unfollowMutation = useMutation(api.follows.unfollow);

  // Optimistic local toggle. We seed from the server result and let the
  // mutation propagate; on next query refresh the server value wins.
  const [optimisticFollowing, setOptimisticFollowing] = useState<
    boolean | null
  >(null);

  // Cycling chip state — labels only, no real filtering applied yet.
  const [tagFilterIndex, setTagFilterIndex] = useState(0);
  const [timeFilterIndex, setTimeFilterIndex] = useState(0);
  const [feedSearchValue, setFeedSearchValue] = useState("");

  const posts: DashboardPostProps[] = useMemo(() => {
    if (!eventsQuery) return [];
    return eventsQuery.page.map(eventToPost);
  }, [eventsQuery]);

  const clubs: Club[] = useMemo(
    () => orgsToClubs(followedOrgs),
    [followedOrgs],
  );
  const rsvpGroups = useMemo(() => rsvpsToRsvpGroups(myRsvps), [myRsvps]);

  // Loading / not-found gating. `orgQuery === undefined` is the loading state.
  if (slug === undefined) {
    return <NotFoundState slug={undefined} />;
  }
  if (orgQuery === undefined) {
    return <LoadingState />;
  }
  if (orgQuery.org === null) {
    return <NotFoundState slug={slug} />;
  }

  const org: Doc<"orgs"> = orgQuery.org;
  const serverIsFollowing = orgQuery.isFollowing;
  const isFollowing = optimisticFollowing ?? serverIsFollowing;

  const handleFollowToggle = () => {
    const next = !isFollowing;
    setOptimisticFollowing(next);
    const promise = next
      ? followMutation({ orgId: org._id })
      : unfollowMutation({ orgId: org._id });
    void promise.catch(() => {
      // Roll back optimistic state on failure.
      setOptimisticFollowing(!next);
    });
  };

  const handleClubClick = (club: Club) => {
    navigate(`/orgs/${club.id}`);
  };

  const handleOrgClick = (postOrg: Organization) => {
    if (postOrg.id) navigate(`/orgs/${postOrg.id}`);
  };

  const tagFilter = TAG_FILTER_OPTIONS[tagFilterIndex];
  const timeFilter = TIME_FILTER_OPTIONS[timeFilterIndex];

  // Build the org tag chips. The schema-level tags are all "neutral"; we add
  // a synthetic "For you" primary chip when the user is following the org so
  // the visual treatment matches the Figma reference for subscribed clubs.
  const orgTags: OrgTagSpec[] = [
    ...org.tags.map<OrgTagSpec>((label) => ({ label, variant: "neutral" })),
    ...(isFollowing ? [{ label: "For you", variant: "primary" as const }] : []),
  ];

  return (
    <div
      className={[
        "flex h-screen w-full overflow-hidden",
        "bg-[var(--color-surface)]",
      ].join(" ")}
    >
      {/* ── Left sidebar — design system ── */}
      <div className="h-full shrink-0 overflow-y-auto">
        <SideBar onNavigate={(id) => navigate(pathForNavItem(id))} />
      </div>

      {/* ── Main content ── */}
      <main
        className={[
          "flex min-w-0 flex-1 flex-col",
          "overflow-y-auto bg-[var(--color-surface-subtle)]",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        ].join(" ")}
        aria-label="Organisation"
      >
        {/*
         * Relative wrapper: contains the cover banner and the action buttons row.
         * The org avatar is absolutely positioned within this wrapper so it
         * overlaps the bottom edge of the cover.
         */}
        <div className="relative w-full shrink-0">
          {/*
           * Cover banner — Figma node 613:4241 shows a sky/cloud image. We render
           * a tasteful sky gradient as the no-asset fallback.
           */}
          <div
            className="h-60 w-full shrink-0 bg-[var(--color-surface-raised)]"
            style={
              org.coverImageUrl
                ? {
                    backgroundImage: `url(${org.coverImageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {
                    backgroundImage:
                      "linear-gradient(180deg, var(--color-secondary-500) 0%, var(--color-secondary-300) 100%)",
                  }
            }
          />

          {/*
           * Action buttons row — right-aligned below the cover banner.
           * Website / email buttons are hidden when the org has no such field.
           */}
          <div className="flex items-start justify-end gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)]">
            {org.websiteUrl && (
              <button
                type="button"
                aria-label="Visit website"
                onClick={() =>
                  window.open(org.websiteUrl, "_blank", "noopener,noreferrer")
                }
                className={[
                  "inline-flex shrink-0 items-center justify-center",
                  "px-[var(--space-4)] py-[var(--space-2)]",
                  "rounded-[var(--radius-card)]",
                  "bg-[var(--color-surface-raised)]",
                  "text-[var(--color-neutral-700)]",
                  "cursor-pointer",
                  "hover:bg-[var(--color-neutral-300)]",
                  "transition-colors duration-150",
                ].join(" ")}
              >
                <GlobeIcon className="size-[var(--space-4)]" />
              </button>
            )}

            {org.email && (
              <button
                type="button"
                aria-label="Send email"
                onClick={() => {
                  window.location.href = `mailto:${org.email}`;
                }}
                className={[
                  "inline-flex shrink-0 items-center justify-center",
                  "px-[var(--space-4)] py-[var(--space-2)]",
                  "rounded-[var(--radius-card)]",
                  "bg-[var(--color-surface-raised)]",
                  "text-[var(--color-neutral-700)]",
                  "cursor-pointer",
                  "hover:bg-[var(--color-neutral-300)]",
                  "transition-colors duration-150",
                ].join(" ")}
              >
                <MailIcon className="size-[var(--space-4)]" />
              </button>
            )}

            <Button
              variant={isFollowing ? "primary" : "secondary"}
              size="sm"
              onClick={handleFollowToggle}
              aria-pressed={isFollowing}
            >
              {isFollowing ? "Following" : "Follow"}
            </Button>
          </div>

          {/*
           * Org avatar — 121 × 121 px circle, absolutely positioned to overlap the
           * cover banner.  Figma: left = 24 px, top = 179 px (= 11.1875 rem).
           */}
          <span
            className={[
              "absolute top-[11.1875rem] left-[var(--space-6)]",
              "inline-flex items-center justify-center",
              "shrink-0 overflow-hidden rounded-full",
              "size-[7.5625rem]",
              "ring-4 ring-[var(--color-surface)]",
              "bg-[var(--color-surface-raised)]",
            ].join(" ")}
          >
            {org.avatarUrl ? (
              <img
                src={org.avatarUrl}
                alt={org.name}
                className="size-full object-cover"
              />
            ) : (
              <span
                className={
                  "flex size-full items-center justify-center " +
                  "bg-[var(--color-secondary-400)] " +
                  "font-[family-name:var(--font-brand)] font-bold " +
                  "text-[var(--font-size-sub1)] " +
                  "text-[var(--color-secondary-900)]"
                }
              >
                {org.name.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        </div>

        {/* ── Org info section ── */}
        <div className="flex flex-col gap-[var(--space-6)] px-[var(--space-6)] pt-[var(--space-4)] pb-[var(--space-6)]">
          <div className="flex flex-col gap-[var(--space-4)]">
            <div className="flex flex-col gap-[var(--space-1)]">
              <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                <h1
                  className={
                    "font-[family-name:var(--font-body)] font-semibold " +
                    "text-[length:var(--font-size-sub2)] leading-[var(--line-height-sub2)] " +
                    "tracking-[var(--letter-spacing-body1)] " +
                    "text-[var(--color-neutral-900)]"
                  }
                  style={{ fontVariationSettings: "'opsz' 14" }}
                >
                  {org.name}
                </h1>
              </div>

              {org.description && (
                <p
                  className={
                    BODY2_REGULAR + " text-[var(--color-text-secondary)]"
                  }
                  style={{ fontVariationSettings: "'opsz' 14" }}
                >
                  {org.description}
                </p>
              )}
            </div>

            {orgTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                {orgTags.map((tag, i) => (
                  <OrgTagPill key={i} label={tag.label} variant={tag.variant} />
                ))}
              </div>
            )}
          </div>

          {org.loopSummary && (
            <LoopSummary summary={org.loopSummary} className="w-full" />
          )}
        </div>

        {/* Horizontal divider */}
        <div
          className="h-px w-full shrink-0 bg-[var(--color-border)]"
          role="separator"
          aria-hidden="true"
        />

        {/* ── Posts feed section ── */}
        <div className="flex flex-col gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-4)]">
          {/* Filter bar: search input (flex-1) + tag filter + time filter.
              Tag/time chips cycle a label only — real filtering not yet wired. */}
          <div className="flex items-center gap-[var(--space-4)]">
            <SearchBar
              value={feedSearchValue}
              onChange={setFeedSearchValue}
              onClear={() => setFeedSearchValue("")}
              placeholder="Search"
              className="min-w-0 flex-1"
            />

            <button
              type="button"
              onClick={() =>
                setTagFilterIndex((i) => (i + 1) % TAG_FILTER_OPTIONS.length)
              }
              className={[
                "inline-flex shrink-0 items-center gap-[var(--space-2)]",
                "px-[var(--space-4)] py-[var(--space-2)]",
                "rounded-[var(--radius-card)]",
                "bg-[var(--color-surface)]",
                "border border-[var(--color-border)]",
                BODY2_REGULAR,
                "text-[var(--color-neutral-700)]",
                "cursor-pointer whitespace-nowrap",
                "hover:bg-[var(--color-surface-subtle)]",
                "transition-colors duration-150",
              ].join(" ")}
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {tagFilter}
              <ChevronDownIcon className="size-[var(--space-6)] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() =>
                setTimeFilterIndex((i) => (i + 1) % TIME_FILTER_OPTIONS.length)
              }
              className={[
                "inline-flex shrink-0 items-center gap-[var(--space-2)]",
                "px-[var(--space-4)] py-[var(--space-2)]",
                "rounded-[var(--radius-card)]",
                "bg-[var(--color-surface)]",
                "border border-[var(--color-border)]",
                BODY2_REGULAR,
                "text-[var(--color-neutral-700)]",
                "cursor-pointer whitespace-nowrap",
                "hover:bg-[var(--color-surface-subtle)]",
                "transition-colors duration-150",
              ].join(" ")}
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {timeFilter}
              <ChevronDownIcon className="size-[var(--space-6)] shrink-0" />
            </button>
          </div>

          {/* Post list */}
          <div className="flex flex-col gap-[var(--space-8)] pb-[var(--space-6)]">
            {posts.map((post, i) => (
              <DashboardPost key={i} {...post} onOrgClick={handleOrgClick} />
            ))}
          </div>
        </div>
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

export default Org;
