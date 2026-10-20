import { useCallback, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Optimistic follow/unfollow toggle, shared by every page that renders
 * `Organization[]` chips with a hover-card Follow button (Home, Bookmarks,
 * Org, Search — via `stampFollowState` in `eventToPost.ts`).
 *
 * Layers a local override map on top of the server's `followedOrgIds` query
 * result (e.g. `api.follows.myFollows`) so the click feels instant, and rolls
 * the override back if the mutation fails. Once the query reactively
 * refreshes with the mutation's result, the override is redundant but
 * harmless — it just agrees with the new server state.
 */
export function useFollowToggle(
  followedOrgIds: readonly Id<"orgs">[] | undefined,
): {
  followedOrgIdSet: ReadonlySet<Id<"orgs">>;
  toggleFollow: (orgId: Id<"orgs">, currentlyFollowing: boolean) => void;
} {
  const followMutation = useMutation(api.follows.follow);
  const unfollowMutation = useMutation(api.follows.unfollow);

  const [overrides, setOverrides] = useState<ReadonlyMap<Id<"orgs">, boolean>>(
    () => new Map(),
  );

  const followedOrgIdSet = useMemo<ReadonlySet<Id<"orgs">>>(() => {
    const base = new Set<Id<"orgs">>(followedOrgIds ?? []);
    for (const [orgId, following] of overrides) {
      if (following) {
        base.add(orgId);
      } else {
        base.delete(orgId);
      }
    }
    return base;
  }, [followedOrgIds, overrides]);

  const toggleFollow = useCallback(
    (orgId: Id<"orgs">, currentlyFollowing: boolean) => {
      const next = !currentlyFollowing;
      setOverrides((prev) => {
        const m = new Map(prev);
        m.set(orgId, next);
        return m;
      });
      const promise = next
        ? followMutation({ orgId })
        : unfollowMutation({ orgId });
      void promise.catch(() => {
        setOverrides((prev) => {
          const m = new Map(prev);
          m.set(orgId, currentlyFollowing);
          return m;
        });
      });
    },
    [followMutation, unfollowMutation],
  );

  return { followedOrgIdSet, toggleFollow };
}
