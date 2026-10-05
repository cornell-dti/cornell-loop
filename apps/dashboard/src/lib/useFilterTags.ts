import { useCallback, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  DEFAULT_FILTER_TAGS,
  normalizeTags,
  type CanonicalTag,
} from "../../convex/lib/tags";

/**
 * The user's pinned feed filter-bar tags. Reads `userProfiles.filterTags`
 * (falling back to DEFAULT_FILTER_TAGS) and persists edits via
 * `users.setFilterTags`, so the same bar shows on dashboard and extension.
 * Edits apply locally right away; signed-out sessions (dev bypass) keep them
 * in memory only.
 */
export function useFilterTags(): {
  tags: CanonicalTag[];
  setTags: (next: CanonicalTag[]) => void;
} {
  const current = useQuery(api.users.currentUser);
  const saveFilterTags = useMutation(api.users.setFilterTags);
  const [localTags, setLocalTags] = useState<CanonicalTag[] | null>(null);

  const savedTags = current?.profile?.filterTags;
  const tags =
    localTags ??
    (savedTags !== undefined
      ? normalizeTags(savedTags)
      : [...DEFAULT_FILTER_TAGS]);

  const signedIn = current?.user != null && !current.rejectedDomain;
  const setTags = useCallback(
    (next: CanonicalTag[]) => {
      setLocalTags(next);
      if (!signedIn) return;
      saveFilterTags({ tags: next }).catch((err: unknown) => {
        console.error("Failed to save filter tags", err);
      });
    },
    [saveFilterTags, signedIn],
  );

  return { tags, setTags };
}
